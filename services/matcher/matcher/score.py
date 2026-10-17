from dataclasses import dataclass


@dataclass(frozen=True)
class Weights:
    semantic: float = 0.40
    lexical: float = 0.10
    quality: float = 0.12
    duration_fit: float = 0.10
    mood_match: float = 0.08
    brand_fit: float = 0.05
    novelty: float = 0.05
    repeat_penalty: float = 0.20
    adjacency_penalty: float = 0.15
    user_dislike: float = 0.30


@dataclass
class Candidate:
    shot_id: int
    asset_id: str
    semantic: float            # cosine(text, shot), already normalised to 0..1
    lexical: float = 0.0
    quality: float = 0.0
    duration_s: float = 0.0
    mood_match: float = 0.0
    brand_fit: float = 0.0
    novelty: float = 0.0
    disliked: bool = False


def duration_fit(shot_s: float, needed_s: float) -> float:
    """1.0 when the shot is long enough, decaying linearly to 0 at 60% of needed."""
    if needed_s <= 0 or shot_s >= needed_s:
        return 1.0
    floor = 0.6 * needed_s
    return 0.0 if shot_s <= floor else (shot_s - floor) / (needed_s - floor)


def base_score(c: Candidate, needed_s: float, w: Weights = Weights()) -> float:
    return (
        w.semantic * c.semantic
        + w.lexical * c.lexical
        + w.quality * c.quality
        + w.duration_fit * duration_fit(c.duration_s, needed_s)
        + w.mood_match * c.mood_match
        + w.brand_fit * c.brand_fit
        + w.novelty * c.novelty
        - w.user_dislike * (1.0 if c.disliked else 0.0)
    )


def assign_sequential(
    scenes: list[list[Candidate]],
    needed_s: list[float],
    similarity,                      # callable(Candidate, Candidate) -> 0..1
    w: Weights = Weights(),
) -> list[Candidate]:
    """Greedy pass with repeat and adjacency penalties. Upgrade to Viterbi later."""
    chosen: list[Candidate] = []
    used: set[str] = set()
    for cands, need in zip(scenes, needed_s):
        def total(c: Candidate) -> float:
            s = base_score(c, need, w)
            if c.asset_id in used:
                s -= w.repeat_penalty
            if chosen:
                s -= w.adjacency_penalty * similarity(c, chosen[-1])
            return s
        best = max(cands, key=total)
        chosen.append(best)
        used.add(best.asset_id)
    return chosen
