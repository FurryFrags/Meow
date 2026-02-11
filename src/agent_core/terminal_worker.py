"""Terminal worker for safe local command execution."""

from __future__ import annotations

import logging
import subprocess

LOGGER = logging.getLogger("agent_core.terminal_worker")


class TerminalWorker:
    """Runs deterministic local terminal actions each scheduler cycle."""

    def __init__(self, dry_run: bool = True) -> None:
        self.dry_run = dry_run

    def run_cycle(self) -> None:
        if self.dry_run:
            LOGGER.info("TerminalWorker dry-run: skipping command execution")
            return

        command = ["/bin/echo", "TerminalWorker active: local action completed"]
        LOGGER.info("Running local command: %s", " ".join(command))
        completed = subprocess.run(command, check=True, capture_output=True, text=True)
        LOGGER.info("Command output: %s", completed.stdout.strip())
