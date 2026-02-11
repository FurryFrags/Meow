"""Instagram adapter."""

from __future__ import annotations

import logging

from agent_core.platforms.base import PlatformAdapter, PlatformCapabilities, RateLimitPolicy, SessionStore

LOGGER = logging.getLogger("agent_core.platforms.instagram")


class InstagramAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            platform_name="instagram",
            capabilities=PlatformCapabilities(
                can_login=True,
                can_fetch_feed=False,
                can_draft_response=False,
                can_post=False,
                notes="Visual-first workflows and anti-bot controls require official API and human review.",
            ),
            rate_limit_policy=RateLimitPolicy(min_interval_seconds=20, jitter_seconds=(1.2, 4.0), max_retries=2),
        )

    def login(self, session_store: SessionStore) -> bool:
        session = session_store.load_or_initialize()
        if not session.get("authenticated", False):
            LOGGER.warning("[instagram] Session not initialized at %s", session_store.path)
            return False
        return True

    def fetch_feed(self) -> list[dict[str, str]]:
        return []

    def draft_response(self, context: list[dict[str, str]]) -> str | None:
        return None

    def post(self, content: str) -> bool:
        LOGGER.info("[instagram] Posting disabled by capability matrix; content=%s", content)
        return False

    def health_check(self) -> bool:
        return True
