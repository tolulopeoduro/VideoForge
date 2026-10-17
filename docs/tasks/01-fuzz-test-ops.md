# Task 1: Property/fuzz tests for the ops reducer

## Goal
Prove that no sequence of ops can corrupt a project, and that undo is exact.

## Read first
`AGENTS.md`, `packages/schema/src/ops.ts`, `validate.ts`, `core.test.ts`.

## Do
1. Add `fast-check` as a devDependency of `@vf/schema` (log it in `docs/LICENSES.md`).
2. Create `packages/schema/src/fuzz.test.ts` with generators for ops against a fixture project
   (several clips on 2 video tracks, 1 scene, 1 video asset of 30s). Generate mostly-plausible ops
   (valid ids, times near clip boundaries) plus some invalid ones.
3. Properties to test:
   - For any op sequence, each step either throws `OpError` (state unchanged) or returns a project where `validateProject` is empty.
   - After each successful op, `applyPatches(next, inverse)` deep-equals the previous state.
   - Applying a whole successful sequence, then undoing every step in reverse, returns the exact starting project.
   - Redo (re-applying `patches` in order) reproduces the final state.
   - A `user` actor edit on an AI clip always sets `userModified`; an `ai` actor edit never does.
4. If a property fails, **do not weaken it**. Report the shrunk counterexample and propose a fix to the
   reducer or validator, then wait for approval (protected files).

## Done when
- `npm test -w @vf/schema` passes with at least 500 runs per property (configure `numRuns`).
- Any bugs found are listed in the PR description with counterexamples, and fixed only after approval.

## Out of scope
New op types, UI changes, performance work.
