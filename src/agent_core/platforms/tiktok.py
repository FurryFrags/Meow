"""TikTok adapter."""

from __future__ import annotations

import logging

from agent_core.platforms.base import PlatformAdapter, PlatformCapabilities, RateLimitPolicy, SessionStore

LOGGER = logging.getLogger("agent_core.platforms.tiktok")


class TikTokAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            platform_name="tiktok",
            capabilities=PlatformCapabilities(
                can_login=True,
                can_fetch_feed=False,
                can_draft_response=False,
                can_post=False,
                notes="Automated publishing is disabled due to policy/legal uncertainty and media requirements.",
            ),
            rate_limit_policy=RateLimitPolicy(min_interval_seconds=25, jitter_seconds=(1.5, 4.5), max_retries=2),
        )

    def login(self, session_store: SessionStore) -> bool:
        session = session_store.load_or_initialize()
        if not session.get("authenticated", False):
            LOGGER.warning("[tiktok] Session not initialized at %s", session_store.path)
            return False
        return True

    def fetch_feed(self) -> list[dict[str, str]]:
        return []

    def draft_response(self, context: list[dict[str, str]]) -> str | None:
        return None

    def post(self, content: str) -> bool:
        LOGGER.info("[tiktok] Posting disabled by capability matrix; content=%s", content)
        return False

    def health_check(self) -> bool:
        return True
