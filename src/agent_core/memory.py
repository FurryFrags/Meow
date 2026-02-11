"""Memory subsystem with short-term context and long-term indexed retrieval."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import hashlib
import json
import math
import sqlite3
import time
from pathlib import Path


@dataclass(slots=True)
class MemoryEntry:
    key: str
    text: str
    metadata: dict[str, str]
    created_at: float


class ShortTermMemory:
    """Bounded in-process context window."""

    def __init__(self, max_items: int = 50) -> None:
        self._items: deque[MemoryEntry] = deque(maxlen=max(1, max_items))

    def append(self, key: str, text: str, metadata: dict[str, str] | None = None) -> None:
        self._items.append(
            MemoryEntry(
                key=key,
                text=text,
                metadata=metadata or {},
                created_at=time.time(),
            )
        )

    def recent(self, limit: int = 10) -> list[MemoryEntry]:
        if limit <= 0:
            return []
        return list(self._items)[-limit:]


class LongTermMemory:
    """SQLite + deterministic hashed-vector index for retrieval."""

    def __init__(self, db_path: Path | str = "data/agent_memory.sqlite3") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS long_term_memory (
                    key TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    embedding_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                );
                """
            )

    def store(self, key: str, text: str, metadata: dict[str, str] | None = None) -> None:
        embedding = self._embed(text)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO long_term_memory (key, text, metadata_json, embedding_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    text=excluded.text,
                    metadata_json=excluded.metadata_json,
                    embedding_json=excluded.embedding_json,
                    created_at=excluded.created_at
                """,
                (key, text, json.dumps(metadata or {}, sort_keys=True), json.dumps(embedding), time.time()),
            )

    def query(self, text: str, limit: int = 5) -> list[MemoryEntry]:
        target = self._embed(text)
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT key, text, metadata_json, embedding_json, created_at FROM long_term_memory"
            ).fetchall()

        scored: list[tuple[float, MemoryEntry]] = []
        for row in rows:
            emb = json.loads(str(row["embedding_json"]))
            score = self._cosine(target, emb)
            scored.append(
                (
                    score,
                    MemoryEntry(
                        key=str(row["key"]),
                        text=str(row["text"]),
                        metadata=json.loads(str(row["metadata_json"])),
                        created_at=float(row["created_at"]),
                    ),
                )
            )
        scored.sort(key=lambda item: item[0], reverse=True)
        return [entry for _score, entry in scored[: max(1, limit)]]

    def _embed(self, text: str, dims: int = 16) -> list[float]:
        vector = [0.0] * dims
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            idx = digest[0] % dims
            value = (digest[1] / 255.0) * 2 - 1
            vector[idx] += value
        norm = math.sqrt(sum(component * component for component in vector)) or 1.0
        return [component / norm for component in vector]

    def _cosine(self, left: list[float], right: list[float]) -> float:
        return sum(a * b for a, b in zip(left, right))


class MemoryManager:
    """Unified memory facade."""

    def __init__(self, long_term_path: Path | str = "data/agent_memory.sqlite3") -> None:
        self.short_term = ShortTermMemory()
        self.long_term = LongTermMemory(long_term_path)

    def remember(self, key: str, text: str, metadata: dict[str, str] | None = None) -> None:
        self.short_term.append(key=key, text=text, metadata=metadata)
        self.long_term.store(key=key, text=text, metadata=metadata)

    def recall(self, query: str, *, short_limit: int = 5, long_limit: int = 5) -> dict[str, list[MemoryEntry]]:
        return {
            "short_term": self.short_term.recent(short_limit),
            "long_term": self.long_term.query(query, limit=long_limit),
        }
