"""Reddit adapter placeholder."""

from __future__ import annotations

import logging
from typing import Any

from agent_core.platforms.base import PlatformAdapter

LOGGER = logging.getLogger("agent_core.platforms.reddit")


class RedditAdapter(PlatformAdapter):
    def process_cycle(self, config: dict[str, Any], dry_run: bool = True) -> None:
        LOGGER.info("Reddit adapter cycle (dry_run=%s, local_only=%s)", dry_run, config.get("local_only", True))
