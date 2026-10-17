"""Ranking metrics for the golden set. Binary relevance, no dependencies."""
import math
from typing import Iterable, Sequence


def _dedupe(ranked: Iterable[str]) -> list[str]:
    seen, out = set(), []
    for x in ranked:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def top1(ranked: Sequence[str], acceptable: set[str]) -> float:
    return 1.0 if ranked and ranked[0] in acceptable else 0.0


def hit_at_k(ranked: Sequence[str], acceptable: set[str], k: int) -> float:
    """Did the replace panel (top k) contain at least one acceptable clip?"""
    return 1.0 if any(x in acceptable for x in ranked[:k]) else 0.0


def recall_at_k(ranked: Sequence[str], acceptable: set[str], k: int) -> float:
    denom = min(len(acceptable), k)
    return len(set(ranked[:k]) & acceptable) / denom if denom else 0.0


def mrr(ranked: Sequence[str], acceptable: set[str]) -> float:
    for i, x in enumerate(ranked, start=1):
        if x in acceptable:
            return 1.0 / i
    return 0.0


def ndcg_at_k(ranked: Sequence[str], acceptable: set[str], k: int) -> float:
    dcg = sum(1.0 / math.log2(i + 1) for i, x in enumerate(ranked[:k], start=1) if x in acceptable)
    ideal = sum(1.0 / math.log2(i + 1) for i in range(1, min(len(acceptable), k) + 1))
    return dcg / ideal if ideal else 0.0


def evaluate(golden: list[dict], preds: dict[str, list[str]], k: int = 8) -> dict:
    """
    golden rows: {"scene_id", "acceptable": [shot ids], "rejected": [shot ids] (optional)}
    preds:       {scene_id: [shot ids, best first]}
    A scene with no prediction counts as a miss on every metric.
    """
    n = len(golden)
    if n == 0:
        raise ValueError("golden set is empty")
    sums = {"top1": 0.0, "hit_at_k": 0.0, "recall_at_k": 0.0, "mrr": 0.0, "ndcg_at_k": 0.0}
    covered = 0
    bad_rows = bad_hits = 0
    failures: list[str] = []

    for row in golden:
        acceptable = set(row["acceptable"])
        ranked = _dedupe(preds.get(row["scene_id"], []))
        if ranked:
            covered += 1
        sums["top1"] += top1(ranked, acceptable)
        sums["hit_at_k"] += hit_at_k(ranked, acceptable, k)
        sums["recall_at_k"] += recall_at_k(ranked, acceptable, k)
        sums["mrr"] += mrr(ranked, acceptable)
        sums["ndcg_at_k"] += ndcg_at_k(ranked, acceptable, k)
        if top1(ranked, acceptable) == 0.0:
            failures.append(row["scene_id"])
        rejected = set(row.get("rejected", []))
        if rejected:
            bad_rows += 1
            if ranked and ranked[0] in rejected:
                bad_hits += 1

    out = {"n": n, "k": k, "coverage": covered / n}
    out.update({name: total / n for name, total in sums.items()})
    # Rate at which top-1 is a clip a human explicitly marked as bad. Lower is better.
    out["bad_at_1"] = (bad_hits / bad_rows) if bad_rows else None
    out["top1_failures"] = failures
    return out
