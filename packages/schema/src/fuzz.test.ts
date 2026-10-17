import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyChecked,
  applyPatches,
  createEmptyProject,
  makeClip,
  OpError,
  secToUs,
  validateProject,
  type Actor,
  type Clip,
  type Op,
  type Project,
} from "./index";

function createFixtureProject(): Project {
  let p = createEmptyProject({ id: "fuzz-proj", title: "Fuzz Fixture" });
  p = {
    ...p,
    assets: {
      a1: {
        id: "a1",
        type: "video",
        uri: "s3://bucket/a1.mp4",
        durationUs: secToUs(30),
        origin: "stock",
      },
    },
    tracks: [
      { id: "v1", kind: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
      { id: "v2", kind: "video", name: "Video 2", muted: false, hidden: false, locked: false, height: 64 },
    ],
    scenes: [
      {
        id: "s1",
        narration: "Scene one narration",
        intent: { literal: "city skyline", keywords: ["city", "skyline"] },
        clipIds: [],
        locked: false,
      },
    ],
  };

  const initialClips: Clip[] = [
    makeClip({
      id: "c1",
      trackId: "v1",
      start: 0,
      duration: secToUs(8),
      sceneId: "s1",
      source: { assetId: "a1", in: 0, speed: 1 },
      provenance: { origin: "ai", locked: false, userModified: false },
    }),
    makeClip({
      id: "c2",
      trackId: "v1",
      start: secToUs(10),
      duration: secToUs(6),
      sceneId: "s1",
      source: { assetId: "a1", in: secToUs(8), speed: 1 },
      provenance: { origin: "ai", locked: false, userModified: false },
    }),
    makeClip({
      id: "c3",
      trackId: "v2",
      start: secToUs(2),
      duration: secToUs(10),
      sceneId: "s1",
      source: { assetId: "a1", in: secToUs(5), speed: 1 },
      provenance: { origin: "user", locked: false, userModified: false },
    }),
    makeClip({
      id: "c4",
      trackId: "v2",
      start: secToUs(15),
      duration: secToUs(5),
      source: { assetId: "a1", in: secToUs(20), speed: 1 },
      provenance: { origin: "ai", locked: false, userModified: false },
    }),
  ];

  for (const clip of initialClips) {
    p = applyChecked(p, { type: "addClip", clip }, { actor: "ai" }).next;
  }

  return p;
}

const VALID_CLIP_IDS = ["c1", "c2", "c3", "c4", "c5", "c6", "split1", "split2"];
const ALL_CLIP_IDS = [...VALID_CLIP_IDS, "missing-clip"];
const TRACK_IDS = ["v1", "v2", "bad-track"];
const ASSET_IDS = ["a1", "bad-asset"];
const SCENE_IDS = ["s1", undefined, "bad-scene"] as const;

// Mostly plausible boundary times (in us) around initial clips [0, 2s, 8s, 10s, 12s, 15s, 16s, 20s, 30s] plus some invalid negative/overflow times
const timeUsArb = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(
    0,
    secToUs(2),
    secToUs(4),
    secToUs(5),
    secToUs(8),
    secToUs(9),
    secToUs(10),
    secToUs(12),
    secToUs(15),
    secToUs(16),
    secToUs(18),
    secToUs(20),
    secToUs(25),
    secToUs(30),
  ) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: secToUs(30) }) },
  { weight: 1, arbitrary: fc.integer({ min: -secToUs(5), max: secToUs(40) }) },
);

const durationUsArb = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(secToUs(1), secToUs(2), secToUs(4), secToUs(5), secToUs(8), secToUs(10)) },
  { weight: 2, arbitrary: fc.integer({ min: 1, max: secToUs(15) }) },
  { weight: 1, arbitrary: fc.integer({ min: -secToUs(5), max: 0 }) },
);

const deltaUsArb = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(-secToUs(2), -secToUs(1), -500_000, 500_000, secToUs(1), secToUs(2)) },
  { weight: 2, arbitrary: fc.integer({ min: -secToUs(10), max: secToUs(10) }) },
);

const clipIdArb = fc.oneof(
  { weight: 6, arbitrary: fc.constantFrom(...VALID_CLIP_IDS) },
  { weight: 1, arbitrary: fc.constantFrom(...ALL_CLIP_IDS) },
);

const trackIdArb = fc.oneof(
  { weight: 6, arbitrary: fc.constantFrom("v1", "v2") },
  { weight: 1, arbitrary: fc.constantFrom(...TRACK_IDS) },
);

const assetIdArb = fc.oneof(
  { weight: 6, arbitrary: fc.constant("a1") },
  { weight: 1, arbitrary: fc.constantFrom(...ASSET_IDS) },
);

const newClipArb: fc.Arbitrary<Clip> = fc
  .record({
    id: fc.constantFrom("c5", "c6", "c1"),
    trackId: trackIdArb,
    start: timeUsArb,
    duration: durationUsArb,
    inPoint: fc.oneof(
      { weight: 5, arbitrary: fc.integer({ min: 0, max: secToUs(25) }) },
      { weight: 1, arbitrary: fc.integer({ min: -secToUs(2), max: secToUs(35) }) },
    ),
    assetId: assetIdArb,
    sceneId: fc.oneof(
      { weight: 6, arbitrary: fc.constantFrom("s1", undefined) },
      { weight: 1, arbitrary: fc.constantFrom(...SCENE_IDS) },
    ),
    origin: fc.constantFrom("ai" as const, "user" as const),
  })
  .map(({ id, trackId, start, duration, inPoint, assetId, sceneId, origin }) =>
    makeClip({
      id,
      trackId,
      start,
      duration,
      ...(sceneId !== undefined ? { sceneId } : {}),
      source: { assetId, in: inPoint, speed: 1 },
      provenance: { origin, locked: false, userModified: false },
    }),
  );

const leafOpArb: fc.Arbitrary<Op> = fc.oneof(
  {
    weight: 2,
    arbitrary: newClipArb.map((clip): Op => ({ type: "addClip", clip })),
  },
  {
    weight: 2,
    arbitrary: clipIdArb.map((id): Op => ({ type: "removeClip", id })),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("moveClip" as const),
      id: clipIdArb,
      start: timeUsArb,
      trackId: fc.option(trackIdArb, { nil: undefined }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("trimClip" as const),
      id: clipIdArb,
      edge: fc.constantFrom("in" as const, "out" as const),
      deltaUs: deltaUsArb,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant("splitClip" as const),
      id: clipIdArb,
      at: timeUsArb,
      newId: fc.constantFrom("split1", "split2", "c1"),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant("replaceMedia" as const),
      clipId: clipIdArb,
      assetId: assetIdArb,
      in: timeUsArb,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.oneof(
      fc.record({
        type: fc.constant("setProp" as const),
        path: clipIdArb.chain((id) =>
          fc.constantFrom(
            ["clips", id, "transform", "opacity"],
            ["clips", id, "transform", "scale"],
            ["clips", id, "transform", "rotation"],
          ),
        ),
        value: fc.double({ min: 0.1, max: 2, noNaN: true }).map((v) => ({ value: v })),
      }),
      fc.record({
        type: fc.constant("setProp" as const),
        path: clipIdArb.map((id) => ["clips", id, "start"]),
        value: timeUsArb,
      }),
      fc.record({
        type: fc.constant("setProp" as const),
        path: fc.constantFrom(
          ["__proto__", "polluted"],
          ["clips", "missing-clip", "transform", "opacity"],
        ),
        value: fc.constant(1),
      }),
    ),
  },
);

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 8, arbitrary: leafOpArb },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("batch" as const),
      ops: fc.array(leafOpArb, { minLength: 1, maxLength: 3 }),
      label: fc.constant("fuzz-batch"),
    }),
  },
);

const opSeqArb = fc.array(
  fc.record({
    op: opArb,
    actor: fc.constantFrom<Actor>("user", "ai"),
  }),
  { minLength: 1, maxLength: 20 },
);

describe("ops reducer fuzz properties", () => {
  it("1. each step either throws OpError (state unchanged) or returns a project where validateProject is empty", () => {
    fc.assert(
      fc.property(opSeqArb, (steps) => {
        let state = createFixtureProject();
        expect(validateProject(state)).toEqual([]);

        for (const { op, actor } of steps) {
          const snapshot = structuredClone(state);
          try {
            const res = applyChecked(state, op, { actor });
            expect(validateProject(res.next)).toEqual([]);
            state = res.next;
          } catch (err) {
            expect(err).toBeInstanceOf(OpError);
            expect(state).toEqual(snapshot);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("2. after each successful op, applyPatches(next, inverse) deep-equals the previous state", () => {
    fc.assert(
      fc.property(opSeqArb, (steps) => {
        let state = createFixtureProject();

        for (const { op, actor } of steps) {
          try {
            const res = applyChecked(state, op, { actor });
            expect(applyPatches(res.next, res.inverse)).toEqual(state);
            state = res.next;
          } catch (err) {
            expect(err).toBeInstanceOf(OpError);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("3. applying a whole successful sequence, then undoing every step in reverse, returns the exact starting project", () => {
    fc.assert(
      fc.property(opSeqArb, (steps) => {
        const initial = createFixtureProject();
        let current = initial;
        const inverses: ReturnType<typeof applyChecked>["inverse"][] = [];

        for (const { op, actor } of steps) {
          try {
            const res = applyChecked(current, op, { actor });
            inverses.push(res.inverse);
            current = res.next;
          } catch (err) {
            expect(err).toBeInstanceOf(OpError);
          }
        }

        let undone = current;
        for (let i = inverses.length - 1; i >= 0; i--) {
          undone = applyPatches(undone, inverses[i]!);
        }
        expect(undone).toEqual(initial);
      }),
      { numRuns: 500 },
    );
  });

  it("4. redo (re-applying patches in order) reproduces the final state", () => {
    fc.assert(
      fc.property(opSeqArb, (steps) => {
        const initial = createFixtureProject();
        let current = initial;
        const history: {
          patches: ReturnType<typeof applyChecked>["patches"];
          inverse: ReturnType<typeof applyChecked>["inverse"];
        }[] = [];

        for (const { op, actor } of steps) {
          try {
            const res = applyChecked(current, op, { actor });
            history.push({ patches: res.patches, inverse: res.inverse });
            current = res.next;
          } catch (err) {
            expect(err).toBeInstanceOf(OpError);
          }
        }

        const finalState = current;
        let undone = finalState;
        for (let i = history.length - 1; i >= 0; i--) {
          undone = applyPatches(undone, history[i]!.inverse);
        }

        let redone = undone;
        for (let i = 0; i < history.length; i++) {
          redone = applyPatches(redone, history[i]!.patches);
        }
        expect(redone).toEqual(finalState);
      }),
      { numRuns: 500 },
    );
  });

  it("5. a user actor edit on an AI clip always sets userModified; an ai actor edit never does", () => {
    const targetClipIdArb = fc.constantFrom("c1", "c2", "c4"); // AI clips in fixture
    const aiClipEditOpArb: fc.Arbitrary<{ id: string; op: Op }> = targetClipIdArb.chain((id) =>
      fc.oneof(
        timeUsArb.map((start): { id: string; op: Op } => ({ id, op: { type: "moveClip", id, start } })),
        fc
          .record({ edge: fc.constantFrom("in" as const, "out" as const), deltaUs: deltaUsArb })
          .map(({ edge, deltaUs }): { id: string; op: Op } => ({ id, op: { type: "trimClip", id, edge, deltaUs } })),
        timeUsArb.map((at): { id: string; op: Op } => ({ id, op: { type: "splitClip", id, at, newId: "split-ai" } })),
        timeUsArb.map((inPoint): { id: string; op: Op } => ({
          id,
          op: { type: "replaceMedia", clipId: id, assetId: "a1", in: inPoint },
        })),
        fc.double({ min: 0.1, max: 1, noNaN: true }).map((v): { id: string; op: Op } => ({
          id,
          op: { type: "setProp", path: ["clips", id, "transform", "opacity"], value: { value: v } },
        })),
      ),
    );

    fc.assert(
      fc.property(aiClipEditOpArb, fc.constantFrom<Actor>("user", "ai"), ({ id, op }, actor) => {
        const initial = createFixtureProject();
        expect(initial.clips[id]!.provenance.origin).toBe("ai");
        expect(initial.clips[id]!.provenance.userModified).toBe(false);

        try {
          const { next } = applyChecked(initial, op, { actor });
          if (actor === "user") {
            expect(next.clips[id]!.provenance.userModified).toBe(true);
            if (op.type === "splitClip") {
              expect(next.clips[op.newId]!.provenance.userModified).toBe(true);
            }
          } else {
            expect(next.clips[id]!.provenance.userModified).toBe(false);
            if (op.type === "splitClip") {
              expect(next.clips[op.newId]!.provenance.userModified).toBe(false);
            }
          }
        } catch (err) {
          expect(err).toBeInstanceOf(OpError);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("regression: batch with addClip followed by splitClip on the newly added clip succeeds or throws OpError", () => {
    const initial = createFixtureProject();
    // Valid non-overlapping addClip + splitClip in a single batch
    const validBatch: Op = {
      type: "batch",
      label: "add-then-split",
      ops: [
        {
          type: "addClip",
          clip: makeClip({
            id: "c6",
            trackId: "v1",
            start: secToUs(20),
            duration: secToUs(4),
            sceneId: "s1",
            source: { assetId: "a1", in: secToUs(20), speed: 1 },
            provenance: { origin: "ai", locked: false, userModified: false },
          }),
        },
        { type: "splitClip", id: "c6", at: secToUs(22), newId: "split1" },
      ],
    };
    const res = applyChecked(initial, validBatch, { actor: "user" });
    expect(validateProject(res.next)).toEqual([]);
    expect(res.next.clips.c6?.duration).toBe(secToUs(2));
    expect(res.next.clips.split1?.start).toBe(secToUs(22));
    expect(applyPatches(res.next, res.inverse)).toEqual(initial);
  });
});
