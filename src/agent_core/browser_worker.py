"""Browser automation worker with shared queue + idempotent actions."""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

LOGGER = logging.getLogger("agent_core.browser_worker")


class BrowserWorker:
    """Opens/controls pages, extracts tasks, and performs browser actions."""

    def __init__(self, dry_run: bool, state_store: Any, event_tracer: Any) -> None:
        self.dry_run = dry_run
        self.state_store = state_store
        self.event_tracer = event_tracer

    def _extract_tasks(self) -> list[dict[str, Any]]:
        memory = self.state_store.get_memory("browser.tasks", default={"cursor": 0})
        cursor = int(memory.get("cursor", 0))
        task = {
            "target_url": "https://example.local/tasks",
            "action": "scan_notifications",
            "cursor": cursor,
        }
        memory["cursor"] = cursor + 1
        self.state_store.set_memory("browser.tasks", memory)
        return [task]

    def _queue_extracted_tasks(self, tasks: list[dict[str, Any]]) -> None:
        for task in tasks:
            fingerprint = f"{task['target_url']}::{task['action']}::{task['cursor']}"
            idempotency_key = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()
            created = self.state_store.queue_action(
                worker="browser",
                action_type="browser_task",
                payload=task,
                idempotency_key=idempotency_key,
            )
            if created:
                self.event_tracer.emit("action_queued", worker="browser", idempotency_key=idempotency_key)

    def _perform_action(self, action: dict[str, Any]) -> None:
        payload = action["payload"]
        self.event_tracer.emit(
            "browser_action_started",
            idempotency_key=action["idempotency_key"],
            target_url=payload.get("target_url"),
        )
        if self.dry_run:
            LOGGER.info("BrowserWorker dry-run: would open %s", payload.get("target_url"))
            time.sleep(0.05)
        else:
            LOGGER.info("BrowserWorker active: opening %s", payload.get("target_url"))
            time.sleep(0.1)
        self.event_tracer.emit("browser_action_completed", idempotency_key=action["idempotency_key"])

    def run_cycle(self) -> None:
        tasks = self._extract_tasks()
        self._queue_extracted_tasks(tasks)

        queued_actions = self.state_store.claim_actions(worker="browser", limit=10)
        LOGGER.info("BrowserWorker claimed %s action(s)", len(queued_actions))
        for action in queued_actions:
            try:
                self._perform_action(action)
                self.state_store.mark_action_status(action["id"], "done")
            except Exception:
                self.state_store.mark_action_status(action["id"], "failed")
                raise
