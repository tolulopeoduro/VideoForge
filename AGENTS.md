# Agent rules for VideoForge

Read this file at the start of every session. If a task conflicts with these rules, stop and ask instead of working around them.

## What this project is

A script-to-video editor. AI produces a first cut; the result is an ordinary, fully editable project (multi-track, scene-aware). The product's value is the editor's control and the AI-to-manual handoff, so the core data model is the most important thing in the repo.

Task prompts live in `docs/tasks/`. Do one at a time.

## Commands

```bash
npm install
npm run typecheck     # must pass
npm test              # vitest (schema) + unittest (matcher); must pass
npm run up            # postgres+pgvector, redis, minio
```

## Hard rules (never violate)

1. **All edits are ops.** UI and services never mutate a `Project` directly. Use `applyChecked(project, op, { actor })`. New edit behavior means a new `Op` type, a handler in `ops.ts`, an entry in `OpSchema`, and tests.
2. **Undo/redo uses Immer patches** returned by `applyOp`. Do not replace this with snapshot copies.
3. **Time is integer microseconds** everywhere in the model. Never store float seconds. Snap to frames only inside the renderer.
4. **Never overwrite user work.** AI regeneration may only change clips where `canOverwrite()` is true (AI-origin, unlocked, not `userModified`, scene unlocked). Any manual edit of an AI clip must set `provenance.userModified`. Do not remove or bypass `provenance`.
5. **One render code path.** Browser preview and server export must call the same `renderFrame` and `evalProp`. Do not write a second renderer or an FFmpeg filter-graph approximation of the canvas output.
6. **Keyframe `t` is clip-local.** Preserve this when splitting, trimming, or moving clips.
7. **Invariants must hold after every op:** no overlaps on a track (except explicit transition overlap), `duration > 0`, source ranges inside asset duration, all ids resolve. Do not weaken `validateProject` to make a test pass.
8. **Log edit events** (`edit_events`) for kept/replaced/edited matches. They are training data for ranking.

## Protected files (ask before changing)

- `packages/schema/src/schema.ts`
- `packages/schema/src/ops.ts`
- `packages/schema/src/validate.ts`
- `packages/schema/src/regen.ts`
- `packages/schema/src/eval.ts`
- `infra/db/init.sql` (changes need a migration plan)

If a change here seems necessary: explain why, propose the diff and the tests, and wait for approval.

## Definition of done

- `npm run typecheck` and `npm test` pass.
- New behavior has tests. **Never edit or delete an existing test to make it pass.** If a test looks wrong, say so and ask.
- Only files relevant to the task changed. No drive-by refactors or renames.
- The README "Known gaps" list is updated if you closed or discovered a gap.

## Scope discipline

- Work on **one task at a time**, exactly as stated, including its "done when."
- Do **not** build deferred features unless asked: real-time collaboration, avatars, voice cloning, generative video, billing, client-side export.
- Prefer small commits with clear messages so any step can be reverted.

## ML and matching code

- Do not claim matching quality without numbers. Report top-1 acceptance and recall@8 against the golden set (`evals/golden/`, to be created) for any change to scoring, retrieval, or models.
- Embedding dimension must match `vector(N)` in `init.sql`. Changing the model means a migration and a re-index.
- Keep model and provider calls behind interfaces so they can be swapped by config.

## Dependencies and licenses

- Before adding any dependency, model, font, or stock source, check its license and record it in `docs/LICENSES.md` (name, version, license, commercial-use verdict).
- Do not add: GPL/AGPL code linked into our code (separate processes are acceptable only after review), non-commercial or research-only model weights, or source-available libraries with commercial restrictions, without explicit approval.
- Pin versions. Do not install packages published in the last 14 days.
- Stock-media terms (caching, bulk indexing, redistribution) must be confirmed per provider before indexing their content.

## Security

- `setProp` and any path-based mutation must keep the forbidden-key guard (`__proto__`, `constructor`, `prototype`).
- Validate all network input with Zod (`OpSchema`, `Project`) at the API boundary.
- Never commit secrets. Use `.env` (see `.env.example`). Store storage keys in documents, never signed URLs.

## When unsure

Stop and ask. A short question is cheaper than a wrong abstraction in the core model.
