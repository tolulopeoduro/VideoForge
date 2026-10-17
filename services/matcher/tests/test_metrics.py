import json
import unittest
from pathlib import Path

from matcher.metrics import evaluate, hit_at_k, mrr, ndcg_at_k, recall_at_k, top1

ROOT = Path(__file__).resolve().parents[3]


class MetricTests(unittest.TestCase):
    def test_basic_metrics(self):
        acc = {"a", "b"}
        self.assertEqual(top1(["a", "x"], acc), 1.0)
        self.assertEqual(top1(["x", "a"], acc), 0.0)
        self.assertEqual(hit_at_k(["x", "a"], acc, 2), 1.0)
        self.assertEqual(hit_at_k(["x", "y", "a"], acc, 2), 0.0)
        self.assertEqual(mrr(["x", "a"], acc), 0.5)
        self.assertEqual(recall_at_k(["a", "x", "b"], acc, 3), 1.0)
        self.assertAlmostEqual(ndcg_at_k(["a", "b"], acc, 2), 1.0)
        self.assertLess(ndcg_at_k(["x", "a"], acc, 2), 1.0)

    def test_sample_files(self):
        golden = [json.loads(l) for l in (ROOT / "evals/golden/sample.jsonl").read_text().splitlines() if l.strip()]
        preds = {
            r["scene_id"]: r["ranked"]
            for r in (json.loads(l) for l in (ROOT / "evals/golden/sample_preds.jsonl").read_text().splitlines() if l.strip())
        }
        r = evaluate(golden, preds, k=8)
        self.assertEqual(r["n"], 3)
        self.assertAlmostEqual(r["coverage"], 2 / 3)
        self.assertAlmostEqual(r["top1"], 1 / 3)       # only g001
        self.assertAlmostEqual(r["hit_at_k"], 2 / 3)   # g001, g002 (g003 has no prediction)
        self.assertAlmostEqual(r["bad_at_1"], 0.5)     # g002 top1 was an explicitly rejected shot
        self.assertEqual(r["top1_failures"], ["g002", "g003"])

    def test_empty_golden_raises(self):
        with self.assertRaises(ValueError):
            evaluate([], {})


if __name__ == "__main__":
    unittest.main()
