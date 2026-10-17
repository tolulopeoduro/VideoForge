from collections import defaultdict
from typing import Hashable, Iterable, Sequence


def reciprocal_rank_fusion(rankings: Iterable[Sequence[Hashable]], k: int = 60) -> list[Hashable]:
    """Fuse several ranked lists (best first) into one. score(d) = sum 1 / (k + rank)."""
    scores: dict[Hashable, float] = defaultdict(float)
    for ranking in rankings:
        for rank, doc in enumerate(ranking, start=1):
            scores[doc] += 1.0 / (k + rank)
    return sorted(scores, key=lambda d: scores[d], reverse=True)
