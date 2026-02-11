"""Application entrypoint.

Starts immediately with safe defaults, no user prompts, and local-only workers.
"""

from __future__ import annotations

import logging
import signal
import threading
from pathlib import Path

from agent_core.scheduler import Scheduler

LOGGER = logging.getLogger("agent_core")


def configure_logging() -> None:
    """Enable strict, structured logging for every module."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def main() -> None:
    """Boot the scheduler immediately and wait for graceful shutdown signals."""
    configure_logging()

    shutdown_event = threading.Event()

    def _handle_shutdown(signum: int, _frame: object) -> None:
        LOGGER.info("Received signal %s; starting graceful shutdown", signum)
        shutdown_event.set()

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    config_path = Path("config/defaults.yaml")
    scheduler = Scheduler(config_path=config_path, shutdown_event=shutdown_event)

    LOGGER.info("Starting agent_core with config: %s", config_path)
    scheduler.run()
    LOGGER.info("agent_core exited cleanly")


if __name__ == "__main__":
    main()
