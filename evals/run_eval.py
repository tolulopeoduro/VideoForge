#!/usr/bin/env python3
"""
Score a predictions file against the golden set.

  python3 evals/run_eval.py --golden evals/golden/sample.jsonl --pred preds.jsonl --k 8
  python3 evals/run_eval.py ... --min-top1 0.6 --min-hit-at-k 0.9   # exit 1 if below

Golden row:  {"scene_id": "g001", "narration": "...", "intent": {...}, "needed_s": 4.0,
              "acceptable": ["shot_12"], "rejected": ["shot_9"], "notes": ""}
Pred row:    {"scene_id": "g001", "ranked": ["shot_12", "shot_5", ...]}
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "matcher"))
from matcher.metrics import evaluate  # noqa: E402


def read_jsonl(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", required=True)
    ap.add_argument("--pred", required=True)
    ap.add_argument("--k", type=int, default=8)
    ap.add_argument("--min-top1", type=float)
    ap.add_argument("--min-hit-at-k", type=float)
    args = ap.parse_args()

    golden = read_jsonl(args.golden)
    preds = {r["scene_id"]: r["ranked"] for r in read_jsonl(args.pred)}
    result = evaluate(golden, preds, k=args.k)
    print(json.dumps(result, indent=2))

    failed = False
    if args.min_top1 is not None and result["top1"] < args.min_top1:
        print(f"FAIL: top1 {result['top1']:.3f} < {args.min_top1}", file=sys.stderr)
        failed = True
    if args.min_hit_at_k is not None and result["hit_at_k"] < args.min_hit_at_k:
        print(f"FAIL: hit@{args.k} {result['hit_at_k']:.3f} < {args.min_hit_at_k}", file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
