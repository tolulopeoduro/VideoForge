import unittest
from typing import Any

from matcher.rank import (
    Weights,
    assign_video_scenes,
    rank_candidates,
    retrieve_and_rank,
    shot_to_candidate,
)
from matcher.retrieve import (
    InMemoryShotStore,
    RetrievalFilters,
    retrieve,
)


class StubEmbedder:
    """Injectable stub embedder for deterministic unit tests."""

    def __init__(self, mapping: dict[str, list[float]], dim: int = 4) -> None:
        self.mapping = mapping
        self.dim = dim
        self.calls: list[str] = []

    def embed_text(self, text: str) -> list[float]:
        self.calls.append(text)
        for key, vec in self.mapping.items():
            if key in text.lower():
                return vec
        return [1.0] + [0.0] * (self.dim - 1)


class FakePgCursor:
    def __init__(self, vec_rows: list[tuple[Any, ...]], fts_rows: list[tuple[Any, ...]]) -> None:
        self.vec_rows = vec_rows
        self.fts_rows = fts_rows
        self.queries: list[tuple[str, list[Any]]] = []
        self._last_rows: list[tuple[Any, ...]] = []

    def __enter__(self) -> "FakePgCursor":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        pass

    def execute(self, sql: str, params: list[Any]) -> None:
        self.queries.append((sql, list(params)))
        if "plainto_tsquery" in sql:
            self._last_rows = self.fts_rows
        else:
            self._last_rows = self.vec_rows

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self._last_rows)


class FakePgConnection:
    def __init__(self, vec_rows: list[tuple[Any, ...]], fts_rows: list[tuple[Any, ...]]) -> None:
        self.cursor_instance = FakePgCursor(vec_rows, fts_rows)

    def cursor(self) -> FakePgCursor:
        return self.cursor_instance


class RetrieveAndRankTests(unittest.TestCase):
    def setUp(self) -> None:
        self.embedder = StubEmbedder(
            {
                "office": [1.0, 0.0, 0.0, 0.0],
                "chart": [0.0, 1.0, 0.0, 0.0],
                "growth": [0.0, 0.8, 0.6, 0.0],
            }
        )
        self.rows = [
            {
                "id": 10,
                "asset_id": "a_office_good",
                "start_us": 0,
                "end_us": 5_000_000,  # 5.0s
                "width": 1920,
                "height": 1080,
                "caption": "bright office team meeting around table",
                "tags": ["office", "team", "meeting"],
                "embedding": [1.0, 0.0, 0.0, 0.0],
                "quality": {"has_text": False, "sharpness": 0.9, "stability": 0.9, "mood": "energetic"},
            },
            {
                "id": 11,
                "asset_id": "a_office_short",
                "start_us": 0,
                "end_us": 2_000_000,  # 2.0s (< 60% of 4.0s = 2.4s -> filtered out)
                "width": 1920,
                "height": 1080,
                "caption": "office team meeting",
                "tags": ["office", "team"],
                "embedding": [1.0, 0.0, 0.0, 0.0],
                "quality": {"has_text": False, "sharpness": 0.95},
            },
            {
                "id": 12,
                "asset_id": "a_office_watermark",
                "start_us": 0,
                "end_us": 5_000_000,
                "width": 1920,
                "height": 1080,
                "caption": "office team meeting watermarked",
                "tags": ["office", "team"],
                "embedding": [1.0, 0.0, 0.0, 0.0],
                "quality": {"has_text": True, "sharpness": 0.95},
            },
            {
                "id": 13,
                "asset_id": "a_office_portrait",
                "start_us": 0,
                "end_us": 5_000_000,
                "width": 1080,
                "height": 1920,
                "caption": "vertical office clip",
                "tags": ["office", "team"],
                "embedding": [0.9, 0.1, 0.0, 0.0],
                "quality": {"has_text": False, "sharpness": 0.8},
            },
            {
                "id": 14,
                "asset_id": "a_office_lowres",
                "start_us": 0,
                "end_us": 5_000_000,
                "width": 640,
                "height": 360,
                "caption": "low resolution office clip",
                "tags": ["office", "team"],
                "embedding": [0.95, 0.05, 0.0, 0.0],
                "quality": {"has_text": False, "sharpness": 0.8},
            },
            {
                "id": 20,
                "asset_id": "a_chart",
                "start_us": 0,
                "end_us": 5_000_000,
                "width": 1920,
                "height": 1080,
                "caption": "rising revenue chart on screen",
                "tags": ["chart", "growth"],
                "embedding": [0.0, 1.0, 0.0, 0.0],
                "quality": {"has_text": False, "sharpness": 0.85, "stability": 0.85},
            },
        ]
        self.store = InMemoryShotStore(self.rows, embedder=self.embedder)

    def test_hard_filters_duration_watermark_resolution_and_orientation(self) -> None:
        intent = {"literal": "office meeting", "keywords": ["office", "team"]}
        filters = RetrievalFilters(
            needed_s=4.0,  # 60% floor = 2.4s -> filters out shot 11 (2.0s)
            orientation="landscape",  # filters out shot 13 (1080x1920)
            min_width=1280,  # filters out shot 14 (640x360)
            min_height=720,
            reject_has_text=True,  # filters out shot 12 (has_text=True)
        )
        shots = retrieve(self.store, intent, k=10, embedder=self.embedder, filters=filters)
        ids = [s.shot_id for s in shots]
        self.assertIn(10, ids)
        self.assertNotIn(11, ids)
        self.assertNotIn(12, ids)
        self.assertNotIn(13, ids)
        self.assertNotIn(14, ids)
        self.assertEqual(ids[0], 10)

    def test_postgres_connection_executes_pgvector_and_fts_queries_and_fuses_with_rrf(self) -> None:
        vec_rows = [
            (10, "a_office_good", 0, 5_000_000, 1920, 1080, "office clip", ["office"], "office clip", {"has_text": False, "sharpness": 0.9}, 0.92),
            (20, "a_chart", 0, 5_000_000, 1920, 1080, "chart clip", ["chart"], "chart clip", {"has_text": False, "sharpness": 0.8}, 0.60),
        ]
        fts_rows = [
            (20, "a_chart", 0, 5_000_000, 1920, 1080, "chart clip", ["chart"], "chart clip", {"has_text": False, "sharpness": 0.8}, 0.80),
            (10, "a_office_good", 0, 5_000_000, 1920, 1080, "office clip", ["office"], "office clip", {"has_text": False, "sharpness": 0.9}, 0.40),
        ]
        conn = FakePgConnection(vec_rows, fts_rows)
        intent = {"literal": "office meeting", "keywords": ["office", "meeting"]}
        filters = RetrievalFilters(needed_s=4.0, orientation="landscape", min_width=1280, min_height=720)

        shots = retrieve(conn, intent, k=5, embedder=self.embedder, filters=filters)
        self.assertEqual(len(conn.cursor_instance.queries), 2)
        self.assertIn("<=>", conn.cursor_instance.queries[0][0])
        self.assertIn("plainto_tsquery", conn.cursor_instance.queries[1][0])
        self.assertEqual({s.shot_id for s in shots}, {10, 20})

    def test_rank_and_whole_video_sequential_assignment(self) -> None:
        intent1 = {"literal": "office meeting", "keywords": ["office", "team"], "mood": "energetic"}
        intent2 = {"literal": "chart screen", "keywords": ["chart", "growth"]}

        cands1 = retrieve_and_rank(self.store, intent1, needed_s=4.0, k=5, embedder=self.embedder)
        cands2 = retrieve_and_rank(self.store, intent2, needed_s=3.0, k=5, embedder=self.embedder)

        self.assertEqual(cands1[0].shot_id, 10)
        self.assertEqual(cands2[0].shot_id, 20)

        assigned = assign_video_scenes([cands1, cands2], [4.0, 3.0], weights=Weights())
        self.assertEqual([c.shot_id for c in assigned], [10, 20])

    def test_enrich_intent_from_raw_narration(self) -> None:
        from matcher.rank import enrich_intent_from_narration

        raw_intent = enrich_intent_from_narration(
            "Revenue grew steadily throughout the year."
        )
        self.assertEqual(raw_intent["literal"], "rising bar chart on a screen")
        self.assertIn("financial growth", raw_intent["abstract"])
        self.assertIn("chart", raw_intent["keywords"])
        self.assertEqual(raw_intent["mood"], "optimistic")

        cands = retrieve_and_rank(
            self.store,
            {"literal": "Revenue grew steadily throughout the year."},
            needed_s=3.0,
            k=5,
            embedder=self.embedder,
        )
        self.assertEqual(cands[0].shot_id, 20)


if __name__ == "__main__":
    unittest.main()
