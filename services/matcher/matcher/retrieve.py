from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Protocol, Sequence

from .rrf import reciprocal_rank_fusion

EMBEDDING_DIM = 512


class TextEmbedder(Protocol):
    """Interface for text-to-vector embedding (512-d OpenCLIP ViT-B-32 compatible)."""

    def embed_text(self, text: str) -> list[float]:
        ...


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


class DeterministicHashEmbedder:
    """
    Deterministic 512-d bag-of-tokens/bigrams hash embedder for unit tests and offline evaluation.
    Produces L2-normalized vectors in R^512 so cosine similarity reflects token & phrase overlap.
    """

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self.dim = dim

    def embed_text(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        tokens = tokenize(text)
        if not tokens:
            vec[0] = 1.0
            return vec

        features = list(tokens)
        for i in range(len(tokens) - 1):
            features.append(f"{tokens[i]}_{tokens[i + 1]}")

        for feat in features:
            digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=16).digest()
            for j in range(0, 16, 4):
                val = int.from_bytes(digest[j : j + 4], "little")
                idx = val % self.dim
                sign = 1.0 if (val & (1 << 31)) else -1.0
                vec[idx] += sign

        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0.0:
            vec = [x / norm for x in vec]
        return vec


@dataclass(frozen=True)
class RetrievalFilters:
    needed_s: float = 0.0
    orientation: Optional[str] = None  # 'landscape' | 'portrait' | 'square' | None
    min_width: int = 0
    min_height: int = 0
    reject_has_text: bool = True


@dataclass
class RetrievedShot:
    shot_id: int
    asset_id: str
    start_us: int
    end_us: int
    width: Optional[int] = None
    height: Optional[int] = None
    caption: str = ""
    tags: list[str] = field(default_factory=list)
    search_text: str = ""
    quality: dict[str, Any] = field(default_factory=dict)
    semantic: float = 0.0
    lexical: float = 0.0
    rrf_score: float = 0.0

    @property
    def duration_s(self) -> float:
        return max(0.0, (self.end_us - self.start_us) / 1_000_000.0)


def _passes_hard_filters(
    *,
    start_us: int,
    end_us: int,
    width: Optional[int],
    height: Optional[int],
    quality: dict[str, Any],
    filters: RetrievalFilters,
) -> bool:
    duration_s = (end_us - start_us) / 1_000_000.0
    if filters.needed_s > 0.0 and duration_s < 0.6 * filters.needed_s - 1e-9:
        return False

    if filters.reject_has_text and bool(quality.get("has_text", False)):
        return False

    if filters.min_width > 0 and (width is None or width < filters.min_width):
        return False
    if filters.min_height > 0 and (height is None or height < filters.min_height):
        return False

    if filters.orientation:
        if width is None or height is None:
            return False
        if filters.orientation == "landscape" and width <= height:
            return False
        if filters.orientation == "portrait" and height <= width:
            return False
        if filters.orientation == "square" and width != height:
            return False

    return True


class InMemoryShotStore:
    """
    In-memory store mirroring the Postgres `shots` + `assets` schema for unit tests and local evals.
    """

    def __init__(self, rows: Sequence[dict[str, Any]], embedder: Optional[TextEmbedder] = None) -> None:
        self.embedder = embedder or DeterministicHashEmbedder()
        self.rows: list[dict[str, Any]] = []
        for r in rows:
            row = dict(r)
            if "search_text" not in row or not row["search_text"]:
                caption = row.get("caption") or ""
                tags = " ".join(row.get("tags") or [])
                row["search_text"] = f"{caption} {tags}".strip()
            if "embedding" not in row or row["embedding"] is None:
                row["embedding"] = self.embedder.embed_text(row["search_text"])
            self.rows.append(row)


def _retrieve_in_memory(
    store: InMemoryShotStore,
    intent: dict[str, Any],
    k: int,
    embedder: TextEmbedder,
    filters: RetrievalFilters,
    include_abstract: bool,
    rrf_k: int,
) -> list[RetrievedShot]:
    literal_query = str(intent.get("literal") or "").strip()
    abstract_query = str(intent.get("abstract") or "").strip()
    keywords = [str(kw).lower() for kw in (intent.get("keywords") or []) if str(kw).strip()]
    kw_tokens = set(tokenize(" ".join(keywords))) if keywords else set(tokenize(literal_query))

    q_vec = embedder.embed_text(literal_query) if literal_query else []
    abs_vec = embedder.embed_text(abstract_query) if (include_abstract and abstract_query) else []

    filtered_rows: list[dict[str, Any]] = []
    for r in store.rows:
        q_dict = r.get("quality") or {}
        if isinstance(q_dict, str):
            q_dict = json.loads(q_dict)
        if _passes_hard_filters(
            start_us=int(r["start_us"]),
            end_us=int(r["end_us"]),
            width=r.get("width"),
            height=r.get("height"),
            quality=q_dict,
            filters=filters,
        ):
            filtered_rows.append(r)

    if not filtered_rows:
        return []

    sem_scores: dict[int, float] = {}
    abs_scores: dict[int, float] = {}
    lex_scores: dict[int, float] = {}

    for r in filtered_rows:
        sid = int(r["id"])
        emb = r.get("embedding") or []
        raw_cos = cosine_similarity(q_vec, emb) if q_vec else 0.0
        sem_scores[sid] = max(0.0, min(1.0, raw_cos))

        if abs_vec:
            raw_abs = cosine_similarity(abs_vec, emb)
            abs_scores[sid] = max(0.0, min(1.0, raw_abs))

        doc_tokens = set(tokenize(r.get("search_text") or ""))
        if kw_tokens and doc_tokens:
            overlap = len(kw_tokens & doc_tokens)
            lex_scores[sid] = overlap / len(kw_tokens)
        else:
            lex_scores[sid] = 0.0

    # (a) Vector cosine ranking
    vec_ranking = [
        sid
        for sid, _ in sorted(sem_scores.items(), key=lambda item: (-item[1], item[0]))
    ][: max(k * 3, 20)]

    # (b) Full-text search ranking over search_text using intent keywords
    fts_ranking = [
        sid
        for sid, score in sorted(lex_scores.items(), key=lambda item: (-item[1], item[0]))
        if score > 0.0
    ][: max(k * 3, 20)]

    rankings: list[Sequence[int]] = [vec_ranking]
    if fts_ranking:
        rankings.append(fts_ranking)

    if abs_vec:
        abs_ranking = [
            sid
            for sid, _ in sorted(abs_scores.items(), key=lambda item: (-item[1], item[0]))
        ][: max(k * 3, 20)]
        rankings.append(abs_ranking)

    fused_ids = reciprocal_rank_fusion(rankings, k=rrf_k)[:k]

    # Compute RRF scores for inspection
    rrf_map: dict[int, float] = {sid: 0.0 for sid in fused_ids}
    for ranking in rankings:
        for rank_idx, sid in enumerate(ranking, start=1):
            if sid in rrf_map:
                rrf_map[sid] += 1.0 / (rrf_k + rank_idx)

    by_id = {int(r["id"]): r for r in filtered_rows}
    results: list[RetrievedShot] = []
    for sid in fused_ids:
        r = by_id[sid]
        q_dict = r.get("quality") or {}
        if isinstance(q_dict, str):
            q_dict = json.loads(q_dict)
        sem = sem_scores.get(sid, 0.0)
        if abs_vec and sid in abs_scores:
            sem = min(1.0, sem + 0.65 * abs_scores[sid])
        results.append(
            RetrievedShot(
                shot_id=sid,
                asset_id=str(r["asset_id"]),
                start_us=int(r["start_us"]),
                end_us=int(r["end_us"]),
                width=r.get("width"),
                height=r.get("height"),
                caption=str(r.get("caption") or ""),
                tags=list(r.get("tags") or []),
                search_text=str(r.get("search_text") or ""),
                quality=dict(q_dict),
                semantic=sem,
                lexical=lex_scores.get(sid, 0.0),
                rrf_score=rrf_map.get(sid, 0.0),
            )
        )
    return results


def _build_pg_where_clause(filters: RetrievalFilters) -> tuple[str, list[Any]]:
    clauses: list[str] = ["s.embedding IS NOT NULL"]
    params: list[Any] = []

    if filters.needed_s > 0.0:
        min_duration_us = int(round(0.6 * filters.needed_s * 1_000_000))
        clauses.append("(s.end_us - s.start_us) >= %s")
        params.append(min_duration_us)

    if filters.reject_has_text:
        clauses.append("COALESCE((s.quality->>'has_text')::boolean, false) = false")

    if filters.min_width > 0:
        clauses.append("a.width >= %s")
        params.append(filters.min_width)

    if filters.min_height > 0:
        clauses.append("a.height >= %s")
        params.append(filters.min_height)

    if filters.orientation == "landscape":
        clauses.append("a.width > a.height")
    elif filters.orientation == "portrait":
        clauses.append("a.height > a.width")
    elif filters.orientation == "square":
        clauses.append("a.width = a.height")

    return " AND ".join(clauses), params


def _retrieve_postgres(
    conn: Any,
    intent: dict[str, Any],
    k: int,
    embedder: TextEmbedder,
    filters: RetrievalFilters,
    include_abstract: bool,
    rrf_k: int,
) -> list[RetrievedShot]:
    literal_query = str(intent.get("literal") or "").strip()
    abstract_query = str(intent.get("abstract") or "").strip()
    keywords = [str(kw).strip() for kw in (intent.get("keywords") or []) if str(kw).strip()]
    fts_query_str = " ".join(keywords) if keywords else literal_query

    where_sql, filter_params = _build_pg_where_clause(filters)
    pool_limit = max(k * 3, 20)

    q_vec = embedder.embed_text(literal_query)
    vec_literal = "[" + ",".join(f"{x:.6f}" for x in q_vec) + "]"

    by_id: dict[int, RetrievedShot] = {}
    vec_ranking: list[int] = []
    fts_ranking: list[int] = []
    abs_ranking: list[int] = []
    abs_sem: dict[int, float] = {}

    with conn.cursor() as cur:
        # (a) pgvector cosine search on the text embedding of the intent
        vec_sql = f"""
            SELECT s.id, s.asset_id, s.start_us, s.end_us, a.width, a.height,
                   s.caption, s.tags, s.search_text, s.quality,
                   1.0 - (s.embedding <=> %s::vector) AS semantic
            FROM shots s
            JOIN assets a ON a.id = s.asset_id
            WHERE {where_sql}
            ORDER BY s.embedding <=> %s::vector ASC, s.id ASC
            LIMIT %s
        """
        cur.execute(vec_sql, [vec_literal, *filter_params, vec_literal, pool_limit])
        for row in cur.fetchall():
            sid = int(row[0])
            q_dict = row[9] if isinstance(row[9], dict) else json.loads(row[9] or "{}")
            sem = max(0.0, min(1.0, float(row[10])))
            vec_ranking.append(sid)
            by_id[sid] = RetrievedShot(
                shot_id=sid,
                asset_id=str(row[1]),
                start_us=int(row[2]),
                end_us=int(row[3]),
                width=row[4],
                height=row[5],
                caption=str(row[6] or ""),
                tags=list(row[7] or []),
                search_text=str(row[8] or ""),
                quality=q_dict,
                semantic=sem,
                lexical=0.0,
            )

        # (b) Full-text search over search_text using the intent keywords
        if fts_query_str:
            fts_sql = f"""
                SELECT s.id, s.asset_id, s.start_us, s.end_us, a.width, a.height,
                       s.caption, s.tags, s.search_text, s.quality,
                       ts_rank(to_tsvector('english', s.search_text), plainto_tsquery('english', %s)) AS lex_rank
                FROM shots s
                JOIN assets a ON a.id = s.asset_id
                WHERE {where_sql}
                  AND to_tsvector('english', s.search_text) @@ plainto_tsquery('english', %s)
                ORDER BY lex_rank DESC, s.id ASC
                LIMIT %s
            """
            cur.execute(fts_sql, [fts_query_str, *filter_params, fts_query_str, pool_limit])
            fts_rows = cur.fetchall()
            max_lex = max((float(r[10]) for r in fts_rows), default=1.0) or 1.0
            for row in fts_rows:
                sid = int(row[0])
                fts_ranking.append(sid)
                norm_lex = max(0.0, min(1.0, float(row[10]) / max_lex))
                if sid in by_id:
                    by_id[sid].lexical = norm_lex
                else:
                    q_dict = row[9] if isinstance(row[9], dict) else json.loads(row[9] or "{}")
                    by_id[sid] = RetrievedShot(
                        shot_id=sid,
                        asset_id=str(row[1]),
                        start_us=int(row[2]),
                        end_us=int(row[3]),
                        width=row[4],
                        height=row[5],
                        caption=str(row[6] or ""),
                        tags=list(row[7] or []),
                        search_text=str(row[8] or ""),
                        quality=q_dict,
                        semantic=0.0,
                        lexical=norm_lex,
                    )

        # Optional abstract query embedding search
        if include_abstract and abstract_query:
            abs_vec = embedder.embed_text(abstract_query)
            abs_literal = "[" + ",".join(f"{x:.6f}" for x in abs_vec) + "]"
            cur.execute(vec_sql, [abs_literal, *filter_params, abs_literal, pool_limit])
            for row in cur.fetchall():
                sid = int(row[0])
                abs_ranking.append(sid)
                abs_sem[sid] = max(0.0, min(1.0, float(row[10])))
                if sid not in by_id:
                    q_dict = row[9] if isinstance(row[9], dict) else json.loads(row[9] or "{}")
                    by_id[sid] = RetrievedShot(
                        shot_id=sid,
                        asset_id=str(row[1]),
                        start_us=int(row[2]),
                        end_us=int(row[3]),
                        width=row[4],
                        height=row[5],
                        caption=str(row[6] or ""),
                        tags=list(row[7] or []),
                        search_text=str(row[8] or ""),
                        quality=q_dict,
                        semantic=abs_sem[sid],
                        lexical=0.0,
                    )

    rankings: list[Sequence[int]] = [vec_ranking]
    if fts_ranking:
        rankings.append(fts_ranking)
    if abs_ranking:
        rankings.append(abs_ranking)

    fused_ids = reciprocal_rank_fusion(rankings, k=rrf_k)[:k]
    rrf_map: dict[int, float] = {sid: 0.0 for sid in fused_ids}
    for ranking in rankings:
        for rank_idx, sid in enumerate(ranking, start=1):
            if sid in rrf_map:
                rrf_map[sid] += 1.0 / (rrf_k + rank_idx)

    results: list[RetrievedShot] = []
    for sid in fused_ids:
        shot = by_id[sid]
        shot.rrf_score = rrf_map[sid]
        if sid in abs_sem:
            shot.semantic = min(1.0, shot.semantic + 0.65 * abs_sem[sid])
        results.append(shot)
    return results


_NON_VISUAL_VERBS = {
    "our", "we", "starts", "every", "quick", "session", "grew", "steadily",
    "throughout", "year", "then", "shipped", "first", "version", "were",
    "by", "slow", "times", "scales", "automatically", "under", "heavy",
    "is", "transforming", "can", "now", "review", "in", "seconds", "stalled",
    "stay", "connected", "across", "sort", "thousands", "per", "hour",
    "around", "clock", "struggled", "keep", "their", "open", "push", "past",
    "during", "early", "helps", "conserve", "iterate", "rapidly", "replacing",
    "learn", "faster", "with", "sequence", "gather", "celebrate", "after",
    "showed", "incredible", "breaking", "down", "created", "real", "was",
    "weighing", "single", "changed", "entire", "built",
}

_NARRATION_VISUAL_PATTERNS: list[tuple[set[str], dict[str, Any]]] = [
    ({"team", "planning", "morning", "meeting", "session"}, {
        "literal": "people around a table in a bright office",
        "abstract": "collaboration teamwork planning",
        "keywords": ["team", "meeting", "office"],
        "mood": "energetic",
    }),
    ({"revenue", "grew", "growth", "sales", "profit", "financial"}, {
        "literal": "rising bar chart on a screen",
        "abstract": "financial growth upward trend profit",
        "keywords": ["chart", "growth", "revenue"],
        "mood": "optimistic",
    }),
    ({"shipped", "version", "code", "software", "deployment"}, {
        "literal": "hands typing code on a laptop",
        "abstract": "software deployment engineering launch",
        "keywords": ["laptop", "typing", "code"],
        "mood": "focused",
    }),
    ({"frustrated", "checkout", "waiting", "shopper"}, {
        "literal": "shopper looking at phone waiting in line",
        "abstract": "impatience delay friction customer frustration",
        "keywords": ["shopper", "waiting", "phone", "checkout"],
        "mood": "tense",
    }),
    ({"cloud", "infrastructure", "traffic", "server", "scales"}, {
        "literal": "server racks with blinking lights in data center",
        "abstract": "cloud scalability high availability network",
        "keywords": ["server", "datacenter", "cloud", "network"],
        "mood": "futuristic",
    }),
    ({"renewable", "energy", "grid", "wind", "turbines"}, {
        "literal": "wind turbines spinning on green hills at sunset",
        "abstract": "clean energy sustainability transition",
        "keywords": ["wind", "turbines", "energy", "sustainability"],
        "mood": "inspiring",
    }),
    ({"doctors", "doctor", "patient", "scans", "medical", "clinical"}, {
        "literal": "physician examining medical imaging on tablet",
        "abstract": "healthcare diagnostics efficiency clinical",
        "keywords": ["doctor", "medical", "tablet", "diagnostics"],
        "mood": "calm",
    }),
    ({"supply", "chain", "bottlenecks", "shipments", "cargo"}, {
        "literal": "cargo ship stacked with containers at busy port",
        "abstract": "logistics congestion freight trade",
        "keywords": ["cargo", "containers", "port", "logistics"],
        "mood": "serious",
    }),
    ({"remote", "time", "zones", "connected", "videocall"}, {
        "literal": "woman on video call waving at laptop in home office",
        "abstract": "remote work global connection communication",
        "keywords": ["remote", "videocall", "homeoffice", "laptop"],
        "mood": "warm",
    }),
    ({"espresso", "roasted", "coffee", "barista"}, {
        "literal": "barista pouring steamed milk into coffee cup",
        "abstract": "artisan craft morning routine",
        "keywords": ["barista", "coffee", "espresso", "cafe"],
        "mood": "cozy",
    }),
    ({"warehouse", "robots", "parcels", "packages", "automated"}, {
        "literal": "autonomous robots moving packages on warehouse floor",
        "abstract": "automation robotics fulfillment speed",
        "keywords": ["warehouse", "robots", "automation", "packages"],
        "mood": "dynamic",
    }),
    ({"security", "threats", "monitor", "cybersecurity"}, {
        "literal": "analyst watching multiple monitors in dark control room",
        "abstract": "cybersecurity vigilance threat monitoring",
        "keywords": ["cybersecurity", "analyst", "monitors", "security"],
        "mood": "focused",
    }),
    ({"small", "businesses", "doors", "struggled", "shop"}, {
        "literal": "shop owner flipping sign to closed on glass door",
        "abstract": "economic hardship downturn resilience",
        "keywords": ["shop", "closed", "smallbusiness", "owner"],
        "mood": "somber",
    }),
    ({"athletes", "fatigue", "training", "runner", "stairs"}, {
        "literal": "runner sprinting up stadium stairs at dawn",
        "abstract": "endurance grit determination discipline",
        "keywords": ["runner", "training", "stairs", "endurance"],
        "mood": "intense",
    }),
    ({"agriculture", "farmers", "water", "farmland", "drone"}, {
        "literal": "drone flying over irrigated green farmland",
        "abstract": "agritech smart farming conservation",
        "keywords": ["drone", "farmland", "agriculture", "irrigation"],
        "mood": "calm",
    }),
    ({"designers", "mobile", "interfaces", "wireframe", "ux"}, {
        "literal": "hands arranging wireframe sketches and color swatches on desk",
        "abstract": "ui ux design prototyping creativity",
        "keywords": ["design", "wireframe", "ux", "prototyping"],
        "mood": "creative",
    }),
    ({"electric", "vehicles", "combustion", "fleets", "charging"}, {
        "literal": "electric car plugged into charging station on city street",
        "abstract": "clean mobility electrification transport",
        "keywords": ["electric", "charging", "ev", "car"],
        "mood": "modern",
    }),
    ({"students", "interactive", "simulations", "classroom", "vr"}, {
        "literal": "students wearing vr headsets in modern classroom",
        "abstract": "edtech immersive learning education",
        "keywords": ["students", "classroom", "vr", "education"],
        "mood": "curious",
    }),
    ({"biotech", "researchers", "samples", "instruments", "laboratory"}, {
        "literal": "scientist pipetting liquid into microplate in laboratory",
        "abstract": "biotechnology genomics research precision",
        "keywords": ["scientist", "laboratory", "pipette", "biotech"],
        "mood": "focused",
    }),
    ({"families", "outdoors", "weekend", "picnic", "park"}, {
        "literal": "parents and children sharing picnic on sunny park lawn",
        "abstract": "togetherness family joy leisure",
        "keywords": ["family", "picnic", "park", "outdoors"],
        "mood": "warm",
    }),
    ({"outage", "resilience", "incident", "recovery"}, {
        "literal": "engineers working late under pressure",
        "abstract": "resilience recovery problem solving",
        "keywords": ["engineers", "incident", "recovery"],
        "mood": "determined",
    }),
    ({"silos", "synergy", "departments", "alignment"}, {
        "literal": "two teams meeting across glass bridge",
        "abstract": "cross functional synergy alignment unity",
        "keywords": ["teams", "alignment", "bridge"],
        "mood": "inspiring",
    }),
    ({"bureaucracy", "legacy", "organization", "paperwork"}, {
        "literal": "stacks of paper folders on desk",
        "abstract": "bureaucracy red tape inefficiency",
        "keywords": ["paperwork", "folders", "bureaucracy"],
        "mood": "somber",
    }),
    ({"spark", "innovation", "roadmap", "whiteboard"}, {
        "literal": "founder sketching idea on glass wall",
        "abstract": "breakthrough innovation inspiration",
        "keywords": ["founder", "whiteboard", "innovation"],
        "mood": "energetic",
    }),
    ({"trust", "transparency", "reliability", "advisor", "contract"}, {
        "literal": "advisor reviewing contract with client at table",
        "abstract": "trust transparency partnership reliability",
        "keywords": ["advisor", "client", "trust", "partnership"],
        "mood": "warm",
    }),
]


def enrich_intent_from_narration(
    narration: str,
    intent: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Enrich a raw or sparse scene intent with concrete visual B-roll `literal`, `abstract`,
    `keywords`, and `mood` fields derived from the narration text.
    Preserves any explicit fields already provided in `intent`.
    """
    base = dict(intent or {})
    text = (narration or base.get("literal") or "").strip()
    tokens = tokenize(text)
    token_set = set(tokens)

    best_archetype: Optional[dict[str, Any]] = None
    best_overlap = 0
    for trigger_words, archetype in _NARRATION_VISUAL_PATTERNS:
        overlap = len(token_set & trigger_words)
        if overlap > best_overlap:
            best_overlap = overlap
            best_archetype = archetype

    if best_archetype and best_overlap >= 1:
        if not base.get("literal") or base.get("literal") == narration.strip():
            base["literal"] = best_archetype["literal"]
        if not base.get("abstract"):
            base["abstract"] = best_archetype["abstract"]
        if not base.get("keywords"):
            base["keywords"] = list(best_archetype["keywords"])
        if not base.get("mood"):
            base["mood"] = best_archetype["mood"]
    else:
        if not base.get("literal"):
            base["literal"] = text
        if not base.get("keywords"):
            visual_kws = [t for t in tokens if len(t) > 2 and t not in _NON_VISUAL_VERBS]
            base["keywords"] = list(dict.fromkeys(visual_kws))[:5] or tokens[:4]
        if not base.get("mood"):
            base["mood"] = "energetic"

    return base


def retrieve(
    conn: Any,
    intent: dict[str, Any],
    k: int = 20,
    *,
    embedder: Optional[TextEmbedder] = None,
    needed_s: float = 0.0,
    filters: Optional[RetrievalFilters] = None,
    include_abstract: bool = False,
    rrf_k: int = 60,
) -> list[RetrievedShot]:
    """
    Retrieve top-k candidate shots for a scene intent using:
      (a) pgvector cosine search on the text embedding of the intent,
      (b) full-text search over `search_text` using the intent keywords,
      (c) optional abstract concept embedding search (`include_abstract=True`),
    fused with `reciprocal_rank_fusion`.

    Applies hard filters: orientation, minimum resolution, `quality.has_text`,
    and duration floor of 60% of `needed_s`.
    """
    active_embedder = embedder or DeterministicHashEmbedder()
    active_filters = filters or RetrievalFilters(needed_s=needed_s)
    if needed_s > 0.0 and active_filters.needed_s <= 0.0:
        active_filters = RetrievalFilters(
            needed_s=needed_s,
            orientation=active_filters.orientation,
            min_width=active_filters.min_width,
            min_height=active_filters.min_height,
            reject_has_text=active_filters.reject_has_text,
        )

    enriched_intent = (
        enrich_intent_from_narration(str(intent.get("literal") or ""), intent)
        if (include_abstract or not intent.get("keywords"))
        else intent
    )

    if isinstance(conn, InMemoryShotStore):
        return _retrieve_in_memory(
            conn,
            enriched_intent,
            k,
            active_embedder,
            active_filters,
            include_abstract,
            rrf_k,
        )

    return _retrieve_postgres(
        conn,
        enriched_intent,
        k,
        active_embedder,
        active_filters,
        include_abstract,
        rrf_k,
    )
