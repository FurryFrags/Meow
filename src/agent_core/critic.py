"""Critic module that reviews execution quality and risk."""

from __future__ import annotations

from dataclasses import dataclass, field

from agent_core.executor import ExecutionResult
from agent_core.planner import PlannedTask
from agent_core.policy import PolicyEngine


@dataclass(slots=True)
class CritiqueReport:
    approved: bool
    issues: list[str] = field(default_factory=list)
    revision_tasks: list[PlannedTask] = field(default_factory=list)


class Critic:
    """Evaluates outputs and proposes revisions when quality/risk is poor."""

    def __init__(self, policy: PolicyEngine | None = None, min_output_chars: int = 12) -> None:
        self.policy = policy or PolicyEngine()
        self.min_output_chars = max(1, min_output_chars)

    def review(self, results: list[ExecutionResult]) -> CritiqueReport:
        issues: list[str] = []
        revisions: list[PlannedTask] = []

        for result in results:
            if result.status != "ok":
                issues.append(f"Task failed: {result.task.description} ({result.error})")
                revisions.append(self._revision_task(result.task, reason="retry_failure"))
                continue

            output_text = " ".join(str(value) for value in result.output.values())
            if len(output_text.strip()) < self.min_output_chars:
                issues.append(f"Low-information output for task: {result.task.description}")
                revisions.append(self._revision_task(result.task, reason="expand_output"))

            decision = self.policy.evaluate(output_text)
            if not decision.allowed:
                reasons = ", ".join(decision.reasons)
                issues.append(f"Risky output for task: {result.task.description} ({reasons})")
                revisions.append(self._revision_task(result.task, reason="policy_rewrite"))

        return CritiqueReport(approved=not issues, issues=issues, revision_tasks=revisions)

    def _revision_task(self, task: PlannedTask, reason: str) -> PlannedTask:
        metadata = dict(task.metadata)
        metadata["revision_reason"] = reason
        return PlannedTask(
            description=f"Revise: {task.description}",
            adapter_hint=task.adapter_hint,
            priority=task.priority,
            metadata=metadata,
        )
