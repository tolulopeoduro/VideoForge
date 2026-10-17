# Task 2: `renderFrame` with a headless-testable backend

## Goal
One function that draws any project at any time, used by BOTH browser preview and server export.

## Read first
`AGENTS.md` (rules 3, 5, 6), `packages/schema/src/eval.ts`, `schema.ts` (Transform, Clip).

## Do
1. Create a new workspace package `packages/render` (`@vf/render`), depending on `@vf/schema`.
2. Define `renderFrame(project, tUs, target)` where `target` is a small `Renderer` interface
   (clear, drawImage with transform/opacity/crop/fit, drawText). Time arrives in integer microseconds.
3. Implement a **Canvas2D backend** first. Use `@napi-rs/canvas` for headless tests and the browser
   canvas in the web app. A PixiJS/WebGL backend comes later; do not build it now.
4. Behavior to support: video/image clips (stub asset loading behind an interface returning a frame
   for `source.in + (t - clip.start) * speed`), text clips, track z-order (tracks are bottom to top),
   hidden tracks, `evalProp` for every animatable transform property using clip-local time,
   `fit` modes, crop, opacity, and `fade` transitions.
5. Create 3 fixture projects (single clip; two clips with a fade; text over video with keyframed scale)
   and snapshot tests at 3 timestamps each. Compare against stored PNGs with a small pixel tolerance
   (document the tolerance and why).
6. Wire `apps/web` so a preview panel calls the same `renderFrame` on the playhead time.
   Do not implement a different drawing path in the web app.

## Done when
- `npm run typecheck` and `npm test` pass; snapshot tests are deterministic on CI.
- The web app shows a frame that changes when the playhead moves.
- A test asserts that preview and the headless backend produce identical output for a fixture frame.

## Out of scope
Audio, FFmpeg export, the export worker, effects beyond opacity/fade, GPU backends.
