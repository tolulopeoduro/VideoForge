# Golden set

The measuring stick for matching quality. Nothing in `services/matcher` or the indexer should change
without a before/after number from this set.

## Labelling protocol

1. Collect 200+ real scenes (narration lines from varied topics: business, tech, health, lifestyle,
   abstract concepts like "synergy" or "resilience"). Include hard cases on purpose.
2. For each scene, write the intent (`literal`, optional `abstract`, `keywords`).
3. Against your indexed library, mark every shot a human would **accept** for that line (usually 2-10).
4. Optionally mark clearly **rejected** shots that a naive system tends to pick (wrong sense, logos,
   awkward faces). These power the `bad_at_1` metric.
5. Two people label a 20% overlap; disagreement above 20% means the intent text needs tightening.
6. Freeze the file per library version. Re-label when the library changes materially.

`sample.jsonl` is toy data with fake ids so the harness runs. Replace it with real labels.

## Running

```bash
python3 evals/run_eval.py --golden evals/golden/sample.jsonl --pred evals/golden/sample_preds.jsonl --k 8
```

Metrics: `top1` (the headline: first pick acceptable), `hit_at_k` (replace panel contains an acceptable
clip), `recall_at_k`, `mrr`, `ndcg_at_k`, `coverage` (scenes with any prediction), `bad_at_1`
(lower is better), plus the list of scenes whose top-1 failed.

Report the baseline before tuning anything, then show the delta for every change.
