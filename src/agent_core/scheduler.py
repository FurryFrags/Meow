"""Task scheduler with fixed cadence, jitter, watchdogs, and shared state."""

from __future__ import annotations

import json
import logging
import random
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from agent_core.browser_worker import BrowserWorker
from agent_core.platforms import PLATFORM_ADAPTERS
from agent_core.terminal_worker import TerminalWorker

LOGGER = logging.getLogger("agent_core.scheduler")


@dataclass(slots=True)
class SchedulerConfig:
    """Typed scheduler settings loaded from defaults.yaml."""

    interval_seconds: int = 60
    jitter_seconds: int = 5
    dry_run: bool = True
    worker_timeout_seconds: int = 20
    breaker_failure_threshold: int = 3
    breaker_cooldown_cycles: int = 3


class EventTracer:
    """Writes structured event traces as JSONL."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def emit(self, event_type: str, **payload: Any) -> None:
        record = {
            "ts": time.time(),
            "event": event_type,
            **payload,
        }
        line = json.dumps(record, sort_keys=True)
        with self._lock:
            with self.path.open("a", encoding="utf-8") as event_file:
                event_file.write(f"{line}\n")


class SharedStateStore:
    """SQLite-backed state for memory, action queue, and idempotency dedupe."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS memory (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at REAL NOT NULL
                );

                CREATE TABLE IF NOT EXISTS queued_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    worker TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'queued',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                """
            )

    def set_memory(self, key: str, value: dict[str, Any]) -> None:
        now = time.time()
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO memory (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
                """,
                (key, json.dumps(value, sort_keys=True), now),
            )

    def get_memory(self, key: str, default: dict[str, Any] | None = None) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            row = connection.execute("SELECT value FROM memory WHERE key = ?", (key,)).fetchone()
        if not row:
            return default or {}
        return json.loads(str(row["value"]))

    def queue_action(
        self,
        worker: str,
        action_type: str,
        payload: dict[str, Any],
        idempotency_key: str,
    ) -> bool:
        now = time.time()
        with self._lock, self._connect() as connection:
            try:
                connection.execute(
                    """
                    INSERT INTO queued_actions
                    (worker, action_type, payload, idempotency_key, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'queued', ?, ?)
                    """,
                    (
                        worker,
                        action_type,
                        json.dumps(payload, sort_keys=True),
                        idempotency_key,
                        now,
                        now,
                    ),
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def claim_actions(self, worker: str, limit: int = 10) -> list[dict[str, Any]]:
        now = time.time()
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, worker, action_type, payload, idempotency_key
                FROM queued_actions
                WHERE worker = ? AND status = 'queued'
                ORDER BY id ASC
                LIMIT ?
                """,
                (worker, limit),
            ).fetchall()
            ids = [int(row["id"]) for row in rows]
            if ids:
                marks = ",".join("?" for _ in ids)
                connection.execute(
                    f"UPDATE queued_actions SET status = 'processing', updated_at = ? WHERE id IN ({marks})",
                    (now, *ids),
                )
        return [
            {
                "id": int(row["id"]),
                "worker": str(row["worker"]),
                "action_type": str(row["action_type"]),
                "payload": json.loads(str(row["payload"])),
                "idempotency_key": str(row["idempotency_key"]),
            }
            for row in rows
        ]

    def mark_action_status(self, action_id: int, status: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "UPDATE queued_actions SET status = ?, updated_at = ? WHERE id = ?",
                (status, time.time(), action_id),
            )


class CircuitBreaker:
    """Per-worker failure breaker with cooldown cycles."""

    def __init__(self, name: str, failure_threshold: int, cooldown_cycles: int) -> None:
        self.name = name
        self.failure_threshold = max(1, failure_threshold)
        self.cooldown_cycles = max(1, cooldown_cycles)
        self.failures = 0
        self.cooldown_remaining = 0

    def can_run(self) -> bool:
        if self.cooldown_remaining > 0:
            self.cooldown_remaining -= 1
            return False
        return True

    def success(self) -> None:
        self.failures = 0

    def fail(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.cooldown_remaining = self.cooldown_cycles
            self.failures = 0


class Scheduler:
    """Coordinates concurrent workers and optional platform adapters."""

    def __init__(self, config_path: Path, shutdown_event: threading.Event) -> None:
        self.shutdown_event = shutdown_event
        self.raw_config = self._load_config(config_path)
        self.config = self._parse_scheduler_config(self.raw_config)

        self.state_store = SharedStateStore(Path("data/state.sqlite3"))
        self.event_tracer = EventTracer(Path("logs/events.jsonl"))

        self.browser_worker = BrowserWorker(
            dry_run=self.config.dry_run,
            state_store=self.state_store,
            event_tracer=self.event_tracer,
        )
        self.terminal_worker = TerminalWorker(
            dry_run=self.config.dry_run,
            state_store=self.state_store,
            event_tracer=self.event_tracer,
        )
        self._breakers = {
            "terminal": CircuitBreaker(
                "terminal",
                self.config.breaker_failure_threshold,
                self.config.breaker_cooldown_cycles,
            ),
            "browser": CircuitBreaker(
                "browser",
                self.config.breaker_failure_threshold,
                self.config.breaker_cooldown_cycles,
            ),
        }

    def _load_config(self, config_path: Path) -> dict[str, Any]:
        with config_path.open("r", encoding="utf-8") as config_file:
            config_data: dict[str, Any] = json.load(config_file)
        return config_data

    def _parse_scheduler_config(self, config_data: dict[str, Any]) -> SchedulerConfig:
        scheduler_cfg = config_data.get("scheduler", {})
        interval_seconds = int(scheduler_cfg.get("interval_seconds", 60))
        jitter_seconds = int(scheduler_cfg.get("jitter_seconds", 5))
        worker_timeout_seconds = int(scheduler_cfg.get("worker_timeout_seconds", 20))
        failure_threshold = int(scheduler_cfg.get("breaker_failure_threshold", 3))
        cooldown_cycles = int(scheduler_cfg.get("breaker_cooldown_cycles", 3))

        if interval_seconds <= 0:
            LOGGER.warning("Invalid interval_seconds=%s, falling back to 60", interval_seconds)
            interval_seconds = 60
        if jitter_seconds < 0:
            jitter_seconds = 0
        if worker_timeout_seconds <= 0:
            worker_timeout_seconds = 20

        dry_run = bool(scheduler_cfg.get("dry_run", True))
        return SchedulerConfig(
            interval_seconds=interval_seconds,
            jitter_seconds=jitter_seconds,
            dry_run=dry_run,
            worker_timeout_seconds=worker_timeout_seconds,
            breaker_failure_threshold=failure_threshold,
            breaker_cooldown_cycles=cooldown_cycles,
        )

    def _run_platform_adapters(self) -> None:
        platform_config = self.raw_config.get("platforms", {})
        for platform_name, adapter in PLATFORM_ADAPTERS.items():
            enabled = bool(platform_config.get(platform_name, {}).get("enabled", False))
            if not enabled:
                continue
            LOGGER.info("Running adapter for '%s'", platform_name)
            adapter.process_cycle(platform_config.get(platform_name, {}), dry_run=self.config.dry_run)

    def _run_worker_with_watchdog(self, worker_name: str, runner: Any) -> None:
        breaker = self._breakers[worker_name]
        if not breaker.can_run():
            LOGGER.warning("Worker '%s' skipped due to open circuit breaker", worker_name)
            self.event_tracer.emit("worker_skipped_breaker", worker=worker_name)
            return

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(runner)
            try:
                future.result(timeout=self.config.worker_timeout_seconds)
                breaker.success()
                self.event_tracer.emit("worker_success", worker=worker_name)
            except TimeoutError:
                breaker.fail()
                self.event_tracer.emit("worker_timeout", worker=worker_name)
                LOGGER.error("Worker '%s' exceeded watchdog timeout", worker_name)
            except Exception as exc:  # noqa: BLE001
                breaker.fail()
                self.event_tracer.emit("worker_failure", worker=worker_name, error=str(exc))
                LOGGER.exception("Worker '%s' failed", worker_name)

    def run(self) -> None:
        """Run until shutdown event is set."""
        LOGGER.info(
            "Scheduler started with interval=%ss jitter<=%ss timeout=%ss",
            self.config.interval_seconds,
            self.config.jitter_seconds,
            self.config.worker_timeout_seconds,
        )

        while not self.shutdown_event.is_set():
            cycle_started = time.monotonic()
            cycle_jitter = random.uniform(0, self.config.jitter_seconds)
            self.event_tracer.emit("cycle_started", jitter_seconds=cycle_jitter)

            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [
                    executor.submit(
                        self._run_worker_with_watchdog,
                        "terminal",
                        self.terminal_worker.run_cycle,
                    ),
                    executor.submit(
                        self._run_worker_with_watchdog,
                        "browser",
                        self.browser_worker.run_cycle,
                    ),
                ]
                for future in futures:
                    try:
                        future.result()
                    except Exception:
                        LOGGER.exception("Unexpected scheduler orchestration error")

            try:
                self._run_platform_adapters()
            except Exception:
                LOGGER.exception("Unhandled error during platform adapter processing")

            elapsed = time.monotonic() - cycle_started
            target_period = self.config.interval_seconds + cycle_jitter
            sleep_for = max(target_period - elapsed, 0)
            self.event_tracer.emit(
                "cycle_completed",
                elapsed_seconds=round(elapsed, 4),
                sleep_seconds=round(sleep_for, 4),
            )
            LOGGER.info("Scheduler cycle completed in %.2fs; sleeping %.2fs", elapsed, sleep_for)
            self.shutdown_event.wait(timeout=sleep_for)

        LOGGER.info("Scheduler shutdown acknowledged")
