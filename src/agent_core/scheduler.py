"""Task scheduler with a strict 60-second processing loop."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import json

from agent_core.browser_worker import BrowserWorker
from agent_core.platforms import PLATFORM_ADAPTERS
from agent_core.terminal_worker import TerminalWorker

LOGGER = logging.getLogger("agent_core.scheduler")


@dataclass(slots=True)
class SchedulerConfig:
    """Typed scheduler settings loaded from defaults.yaml."""

    interval_seconds: int = 60
    dry_run: bool = True


class Scheduler:
    """Coordinates local-only workers and optional platform adapters."""

    def __init__(self, config_path: Path, shutdown_event: threading.Event) -> None:
        self.shutdown_event = shutdown_event
        self.raw_config = self._load_config(config_path)
        self.config = self._parse_scheduler_config(self.raw_config)

        self.browser_worker = BrowserWorker(dry_run=self.config.dry_run)
        self.terminal_worker = TerminalWorker(dry_run=self.config.dry_run)

    def _load_config(self, config_path: Path) -> dict[str, Any]:
        with config_path.open("r", encoding="utf-8") as config_file:
            config_data: dict[str, Any] = json.load(config_file)
        return config_data

    def _parse_scheduler_config(self, config_data: dict[str, Any]) -> SchedulerConfig:
        scheduler_cfg = config_data.get("scheduler", {})
        interval_seconds = int(scheduler_cfg.get("interval_seconds", 60))
        if interval_seconds <= 0:
            LOGGER.warning("Invalid interval_seconds=%s, falling back to 60", interval_seconds)
            interval_seconds = 60

        dry_run = bool(scheduler_cfg.get("dry_run", True))
        return SchedulerConfig(interval_seconds=interval_seconds, dry_run=dry_run)

    def _run_platform_adapters(self) -> None:
        platform_config = self.raw_config.get("platforms", {})
        for platform_name, adapter in PLATFORM_ADAPTERS.items():
            enabled = bool(platform_config.get(platform_name, {}).get("enabled", False))
            if not enabled:
                LOGGER.info("Platform '%s' is disabled by default", platform_name)
                continue

            LOGGER.info("Running adapter for '%s'", platform_name)
            adapter.process_cycle(platform_config.get(platform_name, {}), dry_run=self.config.dry_run)

    def run(self) -> None:
        """Run until shutdown event is set."""
        LOGGER.info("Scheduler started with %s-second interval", self.config.interval_seconds)

        while not self.shutdown_event.is_set():
            cycle_started = time.monotonic()
            LOGGER.info("Starting scheduler cycle")

            try:
                self.terminal_worker.run_cycle()
                self.browser_worker.run_cycle()
                self._run_platform_adapters()
            except Exception:
                LOGGER.exception("Unhandled error during scheduler cycle")

            elapsed = time.monotonic() - cycle_started
            sleep_for = max(self.config.interval_seconds - elapsed, 0)
            LOGGER.info("Scheduler cycle completed in %.2fs; sleeping %.2fs", elapsed, sleep_for)
            self.shutdown_event.wait(timeout=sleep_for)

        LOGGER.info("Scheduler shutdown acknowledged")
