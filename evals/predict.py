#!/usr/bin/env python3
"""
Run the retrieval + ranking pipeline over a golden set and write predictions JSONL
consumable by `evals/run_eval.py`.

Usage:
  python3 evals/predict.py --golden evals/golden/golden_v1.jsonl --out evals/golden/preds_baseline.jsonl
  python3 evals/predict.py --golden evals/golden/golden_v1.jsonl --out evals/golden/preds_abstract.jsonl --include-abstract
  python3 evals/predict.py --golden evals/golden/golden_v1.jsonl --out evals/golden/preds_weights.jsonl --weights '{"semantic":0.35,"lexical":0.22,"quality":0.15}'
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "matcher"))

from matcher.rank import Weights, retrieve_and_rank  # noqa: E402
from matcher.retrieve import (  # noqa: E402
    DeterministicHashEmbedder,
    InMemoryShotStore,
    RetrievalFilters,
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_connection(library_path: Path, db_url: str | None, embedder: DeterministicHashEmbedder) -> Any:
    if db_url:
        try:
            import psycopg  # type: ignore
            return psycopg.connect(db_url)
        except ImportError:
            import psycopg2  # type: ignore
            return psycopg2.connect(db_url)

    rows = read_jsonl(library_path)
    return InMemoryShotStore(rows, embedder=embedder)


def parse_weights(weights_json: str | None) -> Weights:
    base = dataclasses.asdict(Weights())
    if weights_json:
        overrides = json.loads(weights_json)
        for k, v in overrides.items():
            if k not in base:
                raise ValueError(f"Unknown weight field: {k}")
            base[k] = float(v)
    return Weights(**base)


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate ranked shot predictions for a golden set.")
    ap.add_argument("--golden", required=True, help="Path to golden set JSONL")
    ap.add_argument("--out", required=True, help="Output predictions JSONL path")
    ap.add_argument(
        "--library",
        default=str(ROOT / "evals" / "golden" / "library_seed.jsonl"),
        help="Path to seeded shots JSONL when --db-url is not used",
    )
    ap.add_argument("--db-url", default=os.environ.get("DATABASE_URL"), help="Optional Postgres connection URL")
    ap.add_argument("--use-in-memory", action="store_true", help="Force in-memory seeded library even if DATABASE_URL is set")
    ap.add_argument("--k", type=int, default=8, help="Number of ranked shots to output per scene")
    ap.add_argument("--include-abstract", action="store_true", help="Include intent.abstract in retrieval fusion")
    ap.add_argument("--weights", default=None, help="JSON dict overriding Weights fields")
    ap.add_argument("--orientation", default=None, choices=["landscape", "portrait", "square"])
    ap.add_argument("--min-width", type=int, default=1280)
    ap.add_argument("--min-height", type=int, default=720)
    args = ap.parse_args()

    embedder = DeterministicHashEmbedder()
    db_url = None if args.use_in_memory else args.db_url
    library_path = Path(args.library)
    if db_url and not os.environ.get("VF_USE_PG"):
        # Default to deterministic local library unless VF_USE_PG=1 or --db-url explicitly points to a seeded DB
        if args.db_url == os.environ.get("DATABASE_URL"):
            db_url = None

    conn = load_connection(library_path, db_url, embedder)
    weights = parse_weights(args.weights)
    golden_rows = read_jsonl(Path(args.golden))

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as out_f:
        for row in golden_rows:
            scene_id = row["scene_id"]
            intent = row.get("intent") or {}
            needed_s = float(row.get("needed_s", 3.0))
            filters = RetrievalFilters(
                needed_s=needed_s,
                orientation=args.orientation,
                min_width=args.min_width,
                min_height=args.min_height,
                reject_has_text=True,
            )
            ranked_cands = retrieve_and_rank(
                conn,
                intent=intent,
                needed_s=needed_s,
                k=args.k,
                embedder=embedder,
                filters=filters,
                weights=weights,
                include_abstract=args.include_abstract,
            )
            pred_row = {
                "scene_id": scene_id,
                "ranked": [f"shot_{c.shot_id}" for c in ranked_cands],
            }
            out_f.write(json.dumps(pred_row) + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
