"""Application entrypoint.

Starts immediately with safe defaults, no user prompts, and local-only workers.
"""

from __future__ import annotations

import logging
import signal
import threading
from pathlib import Path

import json

from agent_core.scheduler import Scheduler

LOGGER = logging.getLogger("agent_core")


def _read_log_level(config_path: Path) -> int:
    if not config_path.exists():
        return logging.INFO

    with config_path.open("r", encoding="utf-8") as config_file:
        loaded = json.load(config_file)

    configured_level = str(loaded.get("logging", {}).get("level", "INFO")).upper()
    return getattr(logging, configured_level, logging.INFO)


def configure_logging(level: int) -> None:
    """Enable strict, structured logging for every module."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        force=True,
    )


def main() -> None:
    """Boot the scheduler immediately and wait for graceful shutdown signals."""
    config_path = Path("config/defaults.yaml")
    configure_logging(_read_log_level(config_path))

    shutdown_event = threading.Event()

    def _handle_shutdown(signum: int, _frame: object) -> None:
        LOGGER.info("Received signal %s; starting graceful shutdown", signum)
        shutdown_event.set()

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    scheduler = Scheduler(config_path=config_path, shutdown_event=shutdown_event)

    LOGGER.info("Starting agent_core with config: %s", config_path)
    scheduler.run()
    LOGGER.info("agent_core exited cleanly")


if __name__ == "__main__":
    main()
