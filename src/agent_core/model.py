"""Model abstractions for local inference with deterministic fallbacks."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import logging
from typing import Sequence

LOGGER = logging.getLogger("agent_core.model")


@dataclass(slots=True)
class ModelResponse:
    """Inference result with metadata."""

    text: str
    model_name: str
    used_fallback: bool = False


class InferenceProvider(ABC):
    """Pluggable model provider interface."""

    model_name: str

    @abstractmethod
    def generate(self, prompt: str, *, max_tokens: int = 256, temperature: float = 0.0) -> str:
        """Generate text for a prompt."""


class LocalHeuristicProvider(InferenceProvider):
    """Default local-only provider requiring no API keys or network calls."""

    model_name = "local-heuristic-v1"

    def generate(self, prompt: str, *, max_tokens: int = 256, temperature: float = 0.0) -> str:
        del temperature
        lines = [line.strip(" -\t") for line in prompt.splitlines() if line.strip()]
        if not lines:
            return "No content provided."

        # Deterministic synthesis: select top lines and normalize into actionable fragments.
        selected = lines[: min(5, len(lines))]
        normalized = []
        for line in selected:
            lowered = line.lower()
            if lowered.startswith(("goal:", "task:", "input:")):
                _, _, remainder = line.partition(":")
                line = remainder.strip() or line
            normalized.append(line.rstrip("."))

        response = "\n".join(f"- {item}" for item in normalized)
        return response[: max_tokens * 4]


@dataclass(slots=True)
class ContextBudgetManager:
    """Approximate token budgeting and summarization for long-running sessions."""

    max_context_tokens: int = 2048
    reserve_tokens: int = 256

    def _estimate_tokens(self, text: str) -> int:
        # Cheap deterministic approximation for local-only environments.
        return max(1, len(text) // 4)

    def apply_budget(
        self,
        messages: Sequence[str],
        *,
        summarizer: "LocalModel | None" = None,
    ) -> list[str]:
        """Trim or summarize oldest messages until they fit within budget."""
        if not messages:
            return []

        budget = max(128, self.max_context_tokens - self.reserve_tokens)
        result = list(messages)
        while result and sum(self._estimate_tokens(item) for item in result) > budget:
            if len(result) == 1:
                result[0] = self._summarize_text(result[0], summarizer)
                break
            oldest = result.pop(0)
            summary = self._summarize_text(oldest, summarizer)
            result.insert(0, summary)
            if len(result) > 1:
                # collapse repeated summaries if still over budget
                result[0] = f"Summary: {result[0][:220]}"
        return result

    def _summarize_text(self, text: str, summarizer: "LocalModel | None") -> str:
        if summarizer is None:
            return self._deterministic_summary(text)
        prompt = f"Summarize briefly:\n{text}"
        response = summarizer.generate(prompt, max_tokens=96)
        return response.text if response.text.strip() else self._deterministic_summary(text)

    def _deterministic_summary(self, text: str) -> str:
        words = text.split()
        preview = " ".join(words[:40])
        return f"Summary: {preview}" if preview else "Summary: (empty)"


class LocalModel:
    """High-level model wrapper with deterministic fallback behavior."""

    def __init__(self, provider: InferenceProvider | None = None) -> None:
        self.provider = provider or LocalHeuristicProvider()

    def generate(self, prompt: str, *, max_tokens: int = 256, temperature: float = 0.0) -> ModelResponse:
        try:
            generated = self.provider.generate(prompt, max_tokens=max_tokens, temperature=temperature)
            return ModelResponse(text=generated.strip(), model_name=self.provider.model_name, used_fallback=False)
        except Exception as exc:  # pragma: no cover - defensive fallback.
            LOGGER.warning("Provider inference failed (%s). Falling back.", exc)
            fallback = self._deterministic_fallback(prompt, max_tokens=max_tokens)
            return ModelResponse(text=fallback, model_name="deterministic-fallback", used_fallback=True)

    def _deterministic_fallback(self, prompt: str, *, max_tokens: int) -> str:
        normalized = " ".join(prompt.split())
        if not normalized:
            return "No prompt provided."
        return f"Fallback response: {normalized[: max_tokens * 4]}"
