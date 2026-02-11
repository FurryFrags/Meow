"""Terminal worker with explicit allowlist enforcement."""

from __future__ import annotations

import hashlib
import logging
import subprocess
import time
from typing import Any

LOGGER = logging.getLogger("agent_core.terminal_worker")


class TerminalWorker:
    """Runs vetted local terminal actions each scheduler cycle."""

    ALLOWLIST = {
        "/bin/echo",
        "/usr/bin/printf",
    }

    def __init__(self, dry_run: bool, state_store: Any, event_tracer: Any) -> None:
        self.dry_run = dry_run
        self.state_store = state_store
        self.event_tracer = event_tracer

    def _seed_default_actions(self) -> None:
        command = ["/bin/echo", "TerminalWorker action completed"]
        key = hashlib.sha256(" ".join(command).encode("utf-8")).hexdigest()
        created = self.state_store.queue_action(
            worker="terminal",
            action_type="command",
            payload={"command": command},
            idempotency_key=key,
        )
        if created:
            self.event_tracer.emit("action_queued", worker="terminal", idempotency_key=key)

    def _vet_command(self, command: list[str]) -> None:
        if not command:
            raise ValueError("Refusing empty command")
        executable = command[0]
        if executable not in self.ALLOWLIST:
            raise ValueError(f"Executable not in allowlist: {executable}")

    def _execute_action(self, action: dict[str, Any]) -> None:
        payload = action["payload"]
        command = payload.get("command", [])
        self._vet_command(command)
        self.event_tracer.emit(
            "terminal_action_started",
            idempotency_key=action["idempotency_key"],
            command=command,
        )

        if self.dry_run:
            LOGGER.info("TerminalWorker dry-run: skipping %s", " ".join(command))
            time.sleep(0.02)
        else:
            completed = subprocess.run(command, check=True, capture_output=True, text=True)
            LOGGER.info("TerminalWorker output: %s", completed.stdout.strip())

        self.event_tracer.emit("terminal_action_completed", idempotency_key=action["idempotency_key"])

    def run_cycle(self) -> None:
        self._seed_default_actions()
        queued_actions = self.state_store.claim_actions(worker="terminal", limit=10)
        LOGGER.info("TerminalWorker claimed %s action(s)", len(queued_actions))
        for action in queued_actions:
            try:
                self._execute_action(action)
                self.state_store.mark_action_status(action["id"], "done")
            except Exception:
                self.state_store.mark_action_status(action["id"], "failed")
                raise
