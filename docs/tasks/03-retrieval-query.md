# Task 3: Retrieval query and first measured baseline

## Goal
Given a scene intent, return ranked candidate shots from Postgres, and report a real number on the golden set.

## Prerequisites (confirm before starting; stop and ask if missing)
- A seeded library: `shots` rows with embeddings (see `services/indexer`) for at least a few hundred shots.
- A real labelled golden set in `evals/golden/` (not just `sample.jsonl`).

## Read first
`AGENTS.md` (ML section), `infra/db/init.sql`, `services/matcher/matcher/{rrf,score,metrics}.py`.

## Do
1. Create `services/matcher/matcher/retrieve.py`:
   - `retrieve(conn, intent, k)` runs (a) pgvector cosine search on the text embedding of the intent,
     (b) full-text search over `search_text` using the intent keywords, then fuses with
     `reciprocal_rank_fusion`.
   - Apply hard filters in SQL or Python: orientation, minimum resolution, `quality.has_text`,
     duration floor of 60% of `needed_s`.
   - Keep the text-embedding call behind an interface so tests can inject a stub.
2. Add `services/matcher/matcher/rank.py` that scores fused candidates with `base_score` and returns
   the ranked list; include `assign_sequential` for whole-video assignment.
3. Add `evals/predict.py` that runs the pipeline over every golden scene and writes the predictions
   JSONL that `evals/run_eval.py` reads.
4. Run the baseline and paste the full metrics JSON into the PR description. Then try ONE change at a
   time (e.g. scoring weights, adding the abstract query) and report the delta for each.

## Done when
- Unit tests pass with a stubbed embedder and an in-memory or containerised Postgres.
- `python3 evals/run_eval.py` runs end to end on the real golden set.
- The PR lists: baseline top1 / hit@8 / bad@1, each experiment, and which change you recommend keeping.

## Out of scope
Learning-to-rank, VLM reranking, on-demand provider search, UI changes. Do not claim quality
improvements without golden-set numbers.
