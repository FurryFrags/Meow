"""LinkedIn adapter."""

from __future__ import annotations

import logging

from agent_core.platforms.base import PlatformAdapter, PlatformCapabilities, RateLimitPolicy, SessionStore

LOGGER = logging.getLogger("agent_core.platforms.linkedin")


class LinkedInAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            platform_name="linkedin",
            capabilities=PlatformCapabilities(
                can_login=True,
                can_fetch_feed=True,
                can_draft_response=True,
                can_post=False,
                notes="Posting disabled by default due to strict policy and compliance ambiguity.",
            ),
            rate_limit_policy=RateLimitPolicy(min_interval_seconds=12, jitter_seconds=(1.0, 3.0), max_retries=3),
        )

    def login(self, session_store: SessionStore) -> bool:
        session = session_store.load_or_initialize()
        if not session.get("authenticated", False):
            LOGGER.warning("[linkedin] Session not initialized at %s", session_store.path)
            return False
        return True

    def fetch_feed(self) -> list[dict[str, str]]:
        return [{"id": "post-1", "text": "Looking for best practices on responsible automation."}]

    def draft_response(self, context: list[dict[str, str]]) -> str | None:
        if not context:
            return "Prepared a neutral update pending manual compliance review."
        return f"Professional draft: {context[0]['text']}"

    def post(self, content: str) -> bool:
        LOGGER.info("[linkedin] Posting disabled by capability matrix; content=%s", content)
        return False

    def health_check(self) -> bool:
        return True
