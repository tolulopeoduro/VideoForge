import unittest
from matcher.rrf import reciprocal_rank_fusion
from matcher.score import Candidate, assign_sequential, duration_fit


class MatcherTests(unittest.TestCase):
    def test_rrf_prefers_docs_ranked_well_in_both_lists(self):
        fused = reciprocal_rank_fusion([["a", "b", "c"], ["b", "a", "d"]])
        self.assertEqual(set(fused[:2]), {"a", "b"})
        self.assertEqual(len(fused), 4)

    def test_duration_fit(self):
        self.assertEqual(duration_fit(5, 4), 1.0)
        self.assertEqual(duration_fit(2, 4), 0.0)
        self.assertGreater(duration_fit(3.5, 4), 0.0)

    def test_assignment_avoids_reusing_an_asset(self):
        a = Candidate(1, "assetA", semantic=0.9, duration_s=5)
        b = Candidate(2, "assetB", semantic=0.85, duration_s=5)
        a2 = Candidate(3, "assetA", semantic=0.9, duration_s=5)
        picks = assign_sequential([[a], [a2, b]], [3, 3], similarity=lambda x, y: 0.0)
        self.assertEqual([p.asset_id for p in picks], ["assetA", "assetB"])


if __name__ == "__main__":
    unittest.main()
