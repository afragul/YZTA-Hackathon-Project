"""
Lightweight per-key sliding-window counter for rate-limiting auth endpoints.

For multi-instance deployments swap this for a Redis-backed limiter
(e.g. via slowapi or fastapi-limiter). For an MVP / single-process
deployment this is sufficient and avoids extra infrastructure.
"""
import asyncio
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class _Bucket:
    hits: deque[float] = field(default_factory=deque)


class RateLimiter:
    def __init__(self, max_hits: int, window_seconds: float) -> None:
        self.max_hits = max_hits
        self.window = window_seconds
        self._buckets: dict[str, _Bucket] = {}
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> tuple[bool, float]:
        """
        Returns (allowed, retry_after_seconds).
        """
        now = time.monotonic()
        cutoff = now - self.window
        async with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket()
                self._buckets[key] = bucket
            while bucket.hits and bucket.hits[0] < cutoff:
                bucket.hits.popleft()
            if len(bucket.hits) >= self.max_hits:
                retry_after = self.window - (now - bucket.hits[0])
                return False, max(0.0, retry_after)
            bucket.hits.append(now)
            return True, 0.0


# 10 attempts per 5 minutes per (ip, username).
login_limiter = RateLimiter(max_hits=10, window_seconds=300)
