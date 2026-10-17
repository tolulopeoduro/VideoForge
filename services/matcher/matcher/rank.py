from __future__ import annotations

from typing import Any, Callable, Optional, Sequence

from .retrieve import (
    RetrievalFilters,
    RetrievedShot,
    TextEmbedder,
    retrieve,
    tokenize,
)
from .score import Candidate, Weights, assign_sequential, base_score


def compute_quality_score(quality: dict[str, Any]) -> float:
    """Aggregate quality JSONB metrics (sharpness, stability, motion) into a 0..1 scalar."""
    if not quality:
        return 0.5
    if quality.get("has_text"):
        return 0.0
    vals: list[float] = []
    for key in ("sharpness", "stability", "aesthetic", "brightness"):
        if key in quality and isinstance(quality[key], (int, float)):
            vals.append(max(0.0, min(1.0, float(quality[key]))))
    return sum(vals) / len(vals) if vals else 0.5


def shot_to_candidate(shot: RetrievedShot, intent: Optional[dict[str, Any]] = None) -> Candidate:
    """Convert a `RetrievedShot` row and scene `intent` into a `Candidate` for `base_score`."""
    intent = intent or {}
    mood = str(intent.get("mood") or "").strip().lower()
    avoid_terms = {str(x).strip().lower() for x in (intent.get("avoid") or []) if str(x).strip()}

    shot_tokens = set(tokenize(shot.search_text)) | {t.lower() for t in shot.tags}
    shot_mood = str(shot.quality.get("mood") or "").strip().lower()

    mood_match = 0.0
    if mood and (mood == shot_mood or mood in shot_tokens):
        mood_match = 1.0

    disliked = bool(avoid_terms and (avoid_terms & shot_tokens))

    return Candidate(
        shot_id=shot.shot_id,
        asset_id=shot.asset_id,
        semantic=shot.semantic,
        lexical=shot.lexical,
        quality=compute_quality_score(shot.quality),
        duration_s=shot.duration_s,
        mood_match=mood_match,
        brand_fit=float(shot.quality.get("brand_fit", 0.5)),
        novelty=float(shot.quality.get("novelty", 0.5)),
        disliked=disliked,
    )


def rank_candidates(
    candidates: Sequence[Candidate],
    needed_s: float,
    weights: Weights = Weights(),
) -> list[Candidate]:
    """Score fused candidates with `base_score` and return the ranked list (best first)."""
    return sorted(
        candidates,
        key=lambda c: (-base_score(c, needed_s, weights), c.shot_id),
    )


def retrieve_and_rank(
    conn: Any,
    intent: dict[str, Any],
    needed_s: float,
    k: int = 8,
    *,
    retrieval_k: Optional[int] = None,
    embedder: Optional[TextEmbedder] = None,
    filters: Optional[RetrievalFilters] = None,
    weights: Weights = Weights(),
    include_abstract: bool = False,
) -> list[Candidate]:
    """
    End-to-end single-scene retrieval and scoring pipeline:
      1. Retrieve top `retrieval_k` fused candidates from `conn` (Postgres or InMemoryShotStore).
      2. Convert to `Candidate` objects and score with `base_score`.
      3. Return the top `k` ranked `Candidate`s.
    """
    pool_k = retrieval_k or max(k * 3, 24)
    shots = retrieve(
        conn,
        intent,
        k=pool_k,
        embedder=embedder,
        needed_s=needed_s,
        filters=filters,
        include_abstract=include_abstract,
    )
    candidates = [shot_to_candidate(s, intent) for s in shots]
    ranked = rank_candidates(candidates, needed_s=needed_s, weights=weights)
    return ranked[:k]


def assign_video_scenes(
    scenes: list[list[Candidate]],
    needed_s: list[float],
    similarity: Callable[[Candidate, Candidate], float] = lambda a, b: 1.0 if a.asset_id == b.asset_id else 0.0,
    weights: Weights = Weights(),
) -> list[Candidate]:
    """Whole-video sequential shot assignment using `assign_sequential`."""
    return assign_sequential(scenes, needed_s, similarity=similarity, w=weights)


__all__ = [
    "Candidate",
    "Weights",
    "assign_sequential",
    "assign_video_scenes",
    "base_score",
    "compute_quality_score",
    "rank_candidates",
    "retrieve_and_rank",
    "shot_to_candidate",
]
