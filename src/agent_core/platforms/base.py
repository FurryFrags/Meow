"""Shared base implementation for platform adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import json
import logging
from pathlib import Path
import random
import time
from typing import Any, Callable

LOGGER = logging.getLogger("agent_core.platforms.base")


@dataclass(slots=True)
class PlatformCapabilities:
    """Capability matrix that controls which actions are allowed per platform."""

    can_login: bool = True
    can_fetch_feed: bool = True
    can_draft_response: bool = True
    can_post: bool = True
    notes: str = ""


@dataclass(slots=True)
class RateLimitPolicy:
    """Per-platform request pacing and retry policy."""

    min_interval_seconds: float = 5.0
    jitter_seconds: tuple[float, float] = (0.2, 1.2)
    max_retries: int = 3
    backoff_base_seconds: float = 1.5
    max_backoff_seconds: float = 30.0


@dataclass(slots=True)
class SafetyDecision:
    """Result for content policy checks."""

    allowed: bool
    reason: str


class SessionStore:
    """Persistent on-disk session/cookie store."""

    def __init__(self, platform_name: str, base_dir: Path = Path("data/sessions")) -> None:
        self.platform_name = platform_name
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.base_dir / f"{platform_name}.json"

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}

        with self.path.open("r", encoding="utf-8") as session_file:
            return json.load(session_file)

    def save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as session_file:
            json.dump(payload, session_file, indent=2, sort_keys=True)

    def load_or_initialize(self) -> dict[str, Any]:
        existing = self.load()
        if existing:
            return existing

        bootstrap = {
            "authenticated": False,
            "cookies": {},
            "notes": "Set authenticated=true after completing platform login/MFA/CAPTCHA manually.",
            "updated_at": time.time(),
        }
        self.save(bootstrap)
        return bootstrap


class ContentSafetyPolicy:
    """Fail-closed content policy for social posting."""

    def evaluate(self, content: str | None) -> SafetyDecision:
        if content is None:
            return SafetyDecision(False, "Blocked: draft returned no content.")

        body = content.strip()
        if not body:
            return SafetyDecision(False, "Blocked: empty content.")

        if len(body) > 500:
            return SafetyDecision(False, "Blocked: content exceeds conservative 500-char limit.")

        lowered = body.lower()
        blocked_markers = ["password", "api key", "credit card", "social security"]
        for marker in blocked_markers:
            if marker in lowered:
                return SafetyDecision(False, f"Blocked: possible sensitive data marker '{marker}'.")

        if "http://" in lowered or "https://" in lowered:
            return SafetyDecision(False, "Blocked: external links require manual review.")

        if "TODO" in content or "TBD" in content:
            return SafetyDecision(False, "Blocked: uncertain draft placeholder detected.")

        return SafetyDecision(True, "Allowed")


class PlatformAdapter(ABC):
    """Shared interface and safety controls for platform adapters."""

    def __init__(
        self,
        platform_name: str,
        capabilities: PlatformCapabilities,
        rate_limit_policy: RateLimitPolicy,
    ) -> None:
        self.platform_name = platform_name
        self.capabilities = capabilities
        self.rate_limit_policy = rate_limit_policy
        self.session_store = SessionStore(platform_name)
        self.safety_policy = ContentSafetyPolicy()
        self._last_action_at: float = 0.0

    @abstractmethod
    def login(self, session_store: SessionStore) -> bool:
        """Authenticate using the session store; return True when authenticated."""

    @abstractmethod
    def fetch_feed(self) -> list[dict[str, Any]]:
        """Fetch candidate feed items for response drafting."""

    @abstractmethod
    def draft_response(self, context: list[dict[str, Any]]) -> str | None:
        """Create a post/reply draft from context."""

    @abstractmethod
    def post(self, content: str) -> bool:
        """Publish content; return True on success."""

    @abstractmethod
    def health_check(self) -> bool:
        """Run platform-specific health checks before any action."""

    def _apply_rate_limit(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_action_at
        min_wait = max(self.rate_limit_policy.min_interval_seconds - elapsed, 0.0)
        jitter = random.uniform(*self.rate_limit_policy.jitter_seconds)
        wait_for = min_wait + jitter
        if wait_for > 0:
            LOGGER.info("[%s] Rate limiting: sleeping %.2fs", self.platform_name, wait_for)
            time.sleep(wait_for)
        self._last_action_at = time.monotonic()

    def _with_retry(self, action_name: str, action: Callable[[], Any]) -> Any:
        attempt = 0
        while True:
            self._apply_rate_limit()
            try:
                return action()
            except Exception as exc:
                attempt += 1
                if attempt > self.rate_limit_policy.max_retries:
                    LOGGER.error("[%s] %s failed after %s retries: %s", self.platform_name, action_name, attempt - 1, exc)
                    raise

                backoff = min(
                    self.rate_limit_policy.backoff_base_seconds * (2 ** (attempt - 1)),
                    self.rate_limit_policy.max_backoff_seconds,
                )
                backoff += random.uniform(*self.rate_limit_policy.jitter_seconds)
                LOGGER.warning(
                    "[%s] %s failed (attempt %s/%s): %s. Backing off %.2fs",
                    self.platform_name,
                    action_name,
                    attempt,
                    self.rate_limit_policy.max_retries,
                    exc,
                    backoff,
                )
                time.sleep(backoff)

    def process_cycle(self, config: dict[str, Any], dry_run: bool = True) -> None:
        """Default process cycle using shared safeguards and capability gating."""
        LOGGER.info("[%s] Starting platform cycle", self.platform_name)
        if not self.health_check():
            LOGGER.error("[%s] Health check failed; failing closed.", self.platform_name)
            return

        if self.capabilities.can_login:
            authenticated = self._with_retry("login", lambda: self.login(self.session_store))
            if not authenticated:
                LOGGER.error("[%s] Not authenticated. Manual setup required; failing closed.", self.platform_name)
                return

        feed: list[dict[str, Any]] = []
        if self.capabilities.can_fetch_feed:
            feed = self._with_retry("fetch_feed", self.fetch_feed)
        else:
            LOGGER.info("[%s] fetch_feed disabled by capability matrix", self.platform_name)

        if not self.capabilities.can_draft_response:
            LOGGER.info("[%s] draft_response disabled by capability matrix", self.platform_name)
            return

        draft = self._with_retry("draft_response", lambda: self.draft_response(feed))
        decision = self.safety_policy.evaluate(draft)
        if not decision.allowed:
            LOGGER.error("[%s] Content policy rejected draft: %s", self.platform_name, decision.reason)
            return

        if dry_run or not self.capabilities.can_post:
            LOGGER.info(
                "[%s] Post skipped (dry_run=%s, can_post=%s). Draft: %s",
                self.platform_name,
                dry_run,
                self.capabilities.can_post,
                draft,
            )
            return

        self._with_retry("post", lambda: self.post(draft))
        LOGGER.info("[%s] Post completed", self.platform_name)
