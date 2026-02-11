"""Browser automation worker (local-safe placeholder implementation)."""

from __future__ import annotations

import logging

LOGGER = logging.getLogger("agent_core.browser_worker")


class BrowserWorker:
    """Executes browser-related tasks without requiring external credentials."""

    def __init__(self, dry_run: bool = True) -> None:
        self.dry_run = dry_run

    def run_cycle(self) -> None:
        if self.dry_run:
            LOGGER.info("BrowserWorker running in dry-run mode; no browser actions executed")
            return

        LOGGER.info("BrowserWorker active mode; performing local browser automation tasks")
