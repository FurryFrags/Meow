"""Policy layer for hard constraints and prohibited action checks."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class PolicyDecision:
    allowed: bool
    reasons: list[str]


class PolicyEngine:
    """Stateless guardrail engine."""

    PROHIBITED_TERMS = {
        "exfiltrate",
        "credential",
        "password",
        "delete database",
        "ransomware",
        "self-replicate",
    }

    def evaluate(self, text: str) -> PolicyDecision:
        lowered = text.lower()
        reasons = [term for term in self.PROHIBITED_TERMS if term in lowered]
        return PolicyDecision(allowed=not reasons, reasons=reasons)

    def enforce_or_raise(self, text: str) -> None:
        decision = self.evaluate(text)
        if not decision.allowed:
            blocked = ", ".join(sorted(decision.reasons))
            raise ValueError(f"Policy violation: contains prohibited term(s): {blocked}")
