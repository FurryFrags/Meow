"""X/Twitter adapter with conservative local-only defaults."""

from __future__ import annotations

import logging
from typing import Any

from agent_core.platforms.base import PlatformAdapter, PlatformCapabilities, RateLimitPolicy, SessionStore

LOGGER = logging.getLogger("agent_core.platforms.twitter")


class TwitterAdapter(PlatformAdapter):
    def __init__(self) -> None:
        super().__init__(
            platform_name="twitter",
            capabilities=PlatformCapabilities(
                can_login=True,
                can_fetch_feed=True,
                can_draft_response=True,
                can_post=True,
                notes="CAPTCHA/MFA and anti-automation controls may block unattended posting.",
            ),
            rate_limit_policy=RateLimitPolicy(min_interval_seconds=8, jitter_seconds=(0.5, 2.0), max_retries=3),
        )

    def login(self, session_store: SessionStore) -> bool:
        session = session_store.load_or_initialize()
        if not session.get("authenticated", False):
            LOGGER.warning("[twitter] Session not initialized at %s", session_store.path)
            return False
        return True

    def fetch_feed(self) -> list[dict[str, Any]]:
        return [{"id": "tweet-1", "text": "What are safe automation practices?"}]

    def draft_response(self, context: list[dict[str, Any]]) -> str | None:
        if not context:
            return "Sharing a brief update while operating in manual-review mode."
        return f"Reply draft: {context[0]['text']}"

    def post(self, content: str) -> bool:
        LOGGER.info("[twitter] Simulated post: %s", content)
        return True

    def health_check(self) -> bool:
        return True
