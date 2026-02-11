"""Facebook adapter."""

from __future__ import annotations

import logging

from agent_core.platforms.base import PlatformAdapter, PlatformCapabilities, RateLimitPolicy, SessionStore

LOGGER = logging.getLogger("agent_core.platforms.facebook")


class FacebookAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            platform_name="facebook",
            capabilities=PlatformCapabilities(
                can_login=True,
                can_fetch_feed=False,
                can_draft_response=True,
                can_post=False,
                notes="Feed scraping and automated posting disabled without explicit API/legal approval.",
            ),
            rate_limit_policy=RateLimitPolicy(min_interval_seconds=15, jitter_seconds=(1.0, 3.2), max_retries=2),
        )

    def login(self, session_store: SessionStore) -> bool:
        session = session_store.load_or_initialize()
        if not session.get("authenticated", False):
            LOGGER.warning("[facebook] Session not initialized at %s", session_store.path)
            return False
        return True

    def fetch_feed(self) -> list[dict[str, str]]:
        return []

    def draft_response(self, context: list[dict[str, str]]) -> str | None:
        return "Manual-only mode: no automated response drafted for Facebook."

    def post(self, content: str) -> bool:
        LOGGER.info("[facebook] Posting disabled by capability matrix; content=%s", content)
        return False

    def health_check(self) -> bool:
        return True
