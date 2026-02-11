"""Base class for platform adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class PlatformAdapter(ABC):
    """Interface for platform-specific cycle processing."""

    @abstractmethod
    def process_cycle(self, config: dict[str, Any], dry_run: bool = True) -> None:
        """Process one scheduler cycle."""
