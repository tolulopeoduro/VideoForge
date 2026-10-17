# VideoForge (working name)

Script-to-video with a real editor underneath. AI produces the first cut; every result is a normal,
editable project: multi-track, scene-aware, lock-aware.

## Quickstart

```bash
cp .env.example .env
npm install
npm run up            # postgres+pgvector, redis, minio
npm test              # schema tests (vitest) + matcher tests (unittest)
npm run typecheck
npm run dev:api       # http://localhost:4000/health
npm run dev:web       # editor skeleton (Vite)
npm run dev:render    # render worker stub
```

## Layout

```
packages/schema     Zod schema, ops reducer (+undo patches), validation, evalProp, regen rule   <- core IP
apps/api            Fastify. Single write path: POST /projects/:id/ops (optimistic concurrency)
apps/web            React + Zustand editor skeleton; timeline is a placeholder to replace
apps/render-worker  BullMQ worker stub (headless Chromium -> ffmpeg plan is in the file header)
services/matcher    Pure-Python scoring, RRF fusion, sequential assignment (tested)
services/indexer    Shot detection + OpenCLIP embedding skeleton (untested on real footage)
infra/db/init.sql   projects, assets, shots (pgvector HNSW + FTS), edit_events
evals/              Golden-set labelling guide, metrics CLI (run_eval.py)
docs/tasks/         Bounded agent task prompts, in order; docs/LICENSES.md is the dependency license log
AGENTS.md           Rules every agent session must follow
```

## Rules the codebase is built around

1. **All edits are ops.** The UI never mutates the project. `applyChecked` runs the op, then validates invariants.
2. **Undo/redo is free.** `applyOp` returns Immer patches and inverse patches.
3. **Time is integer microseconds.** Snap to frames only when rendering.
4. **Regeneration never overwrites user work.** See `canOverwrite` in `packages/schema/src/regen.ts`.
5. **One render code path.** Preview and export must share `renderFrame` and `evalProp`.
6. **Log edits from day one** (`edit_events`). They become your ranking training data.

## Known gaps (deliberate TODOs)

- Keyframes are split and shifted across `splitClip` and `trimClip` (`transform` numeric props and `audio.gain`); custom effect-level keyframe splitting remains a future enhancement.
- `renderFrame` (Canvas2D) and the FFmpeg MP4 export worker are implemented; a PixiJS/WebGL GPU backend is a future upgrade.
- Timeline UI supports pointer drag-to-move with magnetic snapping, edge-trim handles, sticky track headers (`M`/`H`/`L`), NLE keyboard shortcuts, and candidate replacement; multi-clip box selection remains a future enhancement.
- Indexer implements quality metrics (`sharpness`, `brightness`, `motion`, `stability`, `has_text`) and `search_text`; VLM captioning and live footage indexing remain to be run.
- Matcher retrieval (`retrieve.py`), ranking (`rank.py`), and `evals/predict.py` are implemented; live OpenCLIP model inference on indexed video assets is not wired yet.
- No auth, no object-storage upload flow, no stock-provider adapters.
- Verify licenses (code, model weights, stock terms) before adding any dependency.

## Suggested first four weeks

| Week | Goal | Done when |
|---|---|---|
| 1 | Schema + ops hardened | Fuzz test: random op sequences never break invariants; undo returns to the start state |
| 2 | `renderFrame` + player | 5 hand-written projects play with audio in sync |
| 3 | Export worker | Exported MP4 matches preview on a frame-diff test |
| 4 | Timeline wired to ops | Drag, trim, split, snap, ripple all work and undo cleanly |
