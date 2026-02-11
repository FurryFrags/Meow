"""Task executor that maps planned tasks to adapter calls."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from agent_core.planner import PlannedTask
from agent_core.policy import PolicyEngine


class Adapter(Protocol):
    def execute(self, task: PlannedTask) -> dict[str, Any]:
        """Run a task and return structured output."""


@dataclass(slots=True)
class ExecutionResult:
    task: PlannedTask
    adapter: str
    status: str
    output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


class BrowserAdapter:
    def execute(self, task: PlannedTask) -> dict[str, Any]:
        return {"kind": "browser", "message": f"Navigated for task: {task.description}"}


class TerminalAdapter:
    def execute(self, task: PlannedTask) -> dict[str, Any]:
        return {"kind": "terminal", "message": f"Executed command plan for: {task.description}"}


class SocialAdapter:
    def execute(self, task: PlannedTask) -> dict[str, Any]:
        return {"kind": "social", "message": f"Prepared social action for: {task.description}"}


class Executor:
    """Dispatches tasks to runtime adapters with policy checks."""

    def __init__(
        self,
        adapters: dict[str, Adapter] | None = None,
        policy: PolicyEngine | None = None,
    ) -> None:
        self.adapters = adapters or {
            "browser": BrowserAdapter(),
            "terminal": TerminalAdapter(),
            "social": SocialAdapter(),
        }
        self.policy = policy or PolicyEngine()

    def run(self, tasks: list[PlannedTask]) -> list[ExecutionResult]:
        results: list[ExecutionResult] = []
        for task in tasks:
            adapter_name = task.adapter_hint if task.adapter_hint in self.adapters else "terminal"
            try:
                self.policy.enforce_or_raise(task.description)
                output = self.adapters[adapter_name].execute(task)
                results.append(
                    ExecutionResult(
                        task=task,
                        adapter=adapter_name,
                        status="ok",
                        output=output,
                    )
                )
            except Exception as exc:
                results.append(
                    ExecutionResult(
                        task=task,
                        adapter=adapter_name,
                        status="error",
                        error=str(exc),
                    )
                )
        return results
