import { describe, expect, it } from "vitest";
import {
  Project, applyChecked, applyOp, applyPatches, canOverwrite, createEmptyProject, evalProp,
  makeClip, rippleDelete, secToUs, type Op,
} from "./index";

function fixture() {
  let p = createEmptyProject({ id: "p1", title: "test" });
  p = {
    ...p,
    assets: { a1: { id: "a1", type: "video", uri: "s3://x/a1.mp4", durationUs: secToUs(30), origin: "stock" } },
    scenes: [{
      id: "s1", narration: "hi", intent: { literal: "office", keywords: [] }, clipIds: [], locked: false,
    }],
  };
  const add = (clip: ReturnType<typeof makeClip>): Op => ({ type: "addClip", clip });
  p = applyChecked(p, add(makeClip({
    id: "c1", trackId: "v1", start: 0, duration: secToUs(10), sceneId: "s1",
    source: { assetId: "a1", in: 0, speed: 1 },
    provenance: { origin: "ai", locked: false, userModified: false },
  }))).next;
  p = applyChecked(p, add(makeClip({
    id: "c2", trackId: "v1", start: secToUs(10), duration: secToUs(5),
    source: { assetId: "a1", in: secToUs(10), speed: 1 },
  }))).next;
  return p;
}

describe("schema", () => {
  it("a fixture project parses with zod", () => {
    expect(() => Project.parse(fixture())).not.toThrow();
  });
});

describe("ops", () => {
  it("splits a clip and advances the source in-point", () => {
    const p = fixture();
    const { next } = applyChecked(p, { type: "splitClip", id: "c1", at: secToUs(4), newId: "c1b" });
    expect(next.clips.c1!.duration).toBe(secToUs(4));
    expect(next.clips.c1b!.start).toBe(secToUs(4));
    expect(next.clips.c1b!.duration).toBe(secToUs(6));
    expect(next.clips.c1b!.source!.in).toBe(secToUs(4));
    expect(next.scenes[0]!.clipIds).toEqual(["c1", "c1b"]);
  });

  it("undo via inverse patches restores the exact previous state", () => {
    const p = fixture();
    const r = applyChecked(p, { type: "moveClip", id: "c2", start: secToUs(12) });
    expect(r.next.clips.c2!.start).toBe(secToUs(12));
    expect(applyPatches(r.next, r.inverse)).toEqual(p);
  });

  it("user edits mark AI clips as modified; AI edits do not", () => {
    const p = fixture();
    const byUser = applyChecked(p, { type: "moveClip", id: "c1", start: 0 }, { actor: "user" }).next;
    const byAi = applyChecked(p, { type: "moveClip", id: "c1", start: 0 }, { actor: "ai" }).next;
    expect(byUser.clips.c1!.provenance.userModified).toBe(true);
    expect(byAi.clips.c1!.provenance.userModified).toBe(false);
  });

  it("rejects overlaps on the same track", () => {
    const p = fixture();
    expect(() => applyChecked(p, { type: "moveClip", id: "c2", start: secToUs(5) })).toThrow(/overlaps/);
  });

  it("rejects source ranges past the asset end", () => {
    const p = fixture();
    expect(() => applyChecked(p, { type: "replaceMedia", clipId: "c1", assetId: "a1", in: secToUs(25) })).toThrow(/exceeds/);
  });

  it("blocks prototype-pollution paths in setProp", () => {
    const p = fixture();
    expect(() => applyOp(p, { type: "setProp", path: ["__proto__", "x"], value: 1 })).toThrow();
  });

  it("ripple delete closes the gap", () => {
    const p = fixture();
    const next = applyChecked(p, rippleDelete(p, "c1")).next;
    expect(next.clips.c1).toBeUndefined();
    expect(next.clips.c2!.start).toBe(0);
  });

  it("splits clip-local keyframes across left and right clips preserving evaluated curve", () => {
    let p = fixture();
    p = applyChecked(p, {
      type: "setProp",
      path: ["clips", "c1", "transform", "opacity"],
      value: {
        keys: [
          { t: 0, v: 0, ease: "linear" as const },
          { t: secToUs(10), v: 1, ease: "linear" as const },
        ],
      },
    }).next;

    const splitAt = secToUs(4);
    const { next } = applyChecked(p, { type: "splitClip", id: "c1", at: splitAt, newId: "c1b" });
    const left = next.clips.c1!;
    const right = next.clips.c1b!;

    for (const timelineUs of [0, secToUs(1), secToUs(2), secToUs(4), secToUs(6), secToUs(9), secToUs(10)]) {
      const origVal = evalProp(p.clips.c1!.transform.opacity, timelineUs);
      const splitVal =
        timelineUs < splitAt
          ? evalProp(left.transform.opacity, timelineUs - left.start)
          : evalProp(right.transform.opacity, timelineUs - right.start);
      expect(splitVal).toBeCloseTo(origVal, 6);
    }
  });

  it("shifts clip-local keyframes when trimming in-edge", () => {
    let p = fixture();
    p = applyChecked(p, {
      type: "setProp",
      path: ["clips", "c1", "transform", "scale"],
      value: {
        keys: [
          { t: 0, v: 1, ease: "linear" as const },
          { t: secToUs(10), v: 2, ease: "linear" as const },
        ],
      },
    }).next;

    const trimDelta = secToUs(3);
    const { next } = applyChecked(p, { type: "trimClip", id: "c1", edge: "in", deltaUs: trimDelta });
    const trimmed = next.clips.c1!;
    expect(trimmed.start).toBe(trimDelta);
    expect(trimmed.duration).toBe(secToUs(7));

    for (const timelineUs of [secToUs(3), secToUs(5), secToUs(8), secToUs(10)]) {
      const origVal = evalProp(p.clips.c1!.transform.scale, timelineUs);
      const trimmedVal = evalProp(trimmed.transform.scale, timelineUs - trimmed.start);
      expect(trimmedVal).toBeCloseTo(origVal, 6);
    }
  });
});

describe("regeneration rule", () => {
  it("only overwrites untouched, unlocked AI clips", () => {
    const p = fixture();
    expect(canOverwrite(p, p.clips.c1!)).toBe(true);
    expect(canOverwrite(p, p.clips.c2!)).toBe(false); // user clip
    const touched = applyChecked(p, { type: "moveClip", id: "c1", start: 0 }).next;
    expect(canOverwrite(touched, touched.clips.c1!)).toBe(false);
  });
});

describe("evalProp", () => {
  it("interpolates linearly and clamps", () => {
    const prop = { keys: [{ t: 0, v: 0, ease: "linear" as const }, { t: 1000, v: 10, ease: "linear" as const }] };
    expect(evalProp(prop, 500)).toBeCloseTo(5);
    expect(evalProp(prop, -5)).toBe(0);
    expect(evalProp(prop, 5000)).toBe(10);
    expect(evalProp({ value: 3 }, 123)).toBe(3);
  });
});
