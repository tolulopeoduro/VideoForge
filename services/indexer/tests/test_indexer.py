import sys
import unittest
from pathlib import Path
from typing import Any, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from index_asset import (  # noqa: E402
    EMBEDDING_DIM,
    analyze_shot_quality,
    build_search_text,
    compute_brightness,
    compute_motion_score,
    detect_has_text_or_watermark,
    index_shot_records,
    sharpness,
)


class StubFrameEmbedder:
    def embed_frames(self, frames: Sequence[Any]) -> list[float]:
        return [1.0] + [0.0] * (EMBEDDING_DIM - 1)


class StubCaptioner:
    def describe_shot(self, frames: Sequence[Any]) -> tuple[str, list[str]]:
        return ("bright office team meeting", ["office", "team", "meeting", "table"])


class IndexerTests(unittest.TestCase):
    def test_sharpness_and_brightness(self) -> None:
        flat_frame = [[128.0 for _ in range(8)] for _ in range(8)]
        checker_frame = [[(255.0 if (x + y) % 2 == 0 else 0.0) for x in range(8)] for y in range(8)]

        self.assertEqual(sharpness(flat_frame), 0.0)
        self.assertGreater(sharpness(checker_frame), 0.5)
        self.assertAlmostEqual(compute_brightness(flat_frame), 128.0 / 255.0, places=3)

    def test_motion_and_stability_scores(self) -> None:
        f1 = [[50.0 for _ in range(6)] for _ in range(6)]
        f2 = [[50.0 for _ in range(6)] for _ in range(6)]
        f3 = [[200.0 for _ in range(6)] for _ in range(6)]

        self.assertEqual(compute_motion_score([f1, f2]), 0.0)
        self.assertGreater(compute_motion_score([f1, f3]), 0.5)

    def test_watermark_detection_and_search_text(self) -> None:
        calm_frame = [[100.0 for _ in range(8)] for _ in range(8)]
        self.assertFalse(detect_has_text_or_watermark([calm_frame], caption="clean nature shot", tags=["forest"]))
        self.assertTrue(detect_has_text_or_watermark([calm_frame], caption="clip with shutterstock watermark", tags=[]))

        st = build_search_text("Bright office team meeting", ["office", "collaboration", "team"])
        self.assertEqual(st, "Bright office team meeting collaboration")

    def test_index_shot_records_end_to_end(self) -> None:
        f1 = [[100.0 for _ in range(6)] for _ in range(6)]
        f2 = [[120.0 for _ in range(6)] for _ in range(6)]
        records = index_shot_records(
            "asset_1",
            [(0.0, 4.5, [f1, f2])],
            embedder=StubFrameEmbedder(),
            captioner=StubCaptioner(),
        )
        self.assertEqual(len(records), 1)
        rec = records[0]
        self.assertEqual(rec["asset_id"], "asset_1")
        self.assertEqual(rec["start_us"], 0)
        self.assertEqual(rec["end_us"], 4_500_000)
        self.assertEqual(len(rec["embedding"]), EMBEDDING_DIM)
        self.assertIn("table", rec["search_text"])
        self.assertFalse(rec["quality"]["has_text"])
        self.assertGreater(rec["quality"]["motion"], 0.0)


if __name__ == "__main__":
    unittest.main()
