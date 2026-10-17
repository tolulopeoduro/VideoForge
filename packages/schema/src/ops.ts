import { current, enablePatches, isDraft, produceWithPatches, type Draft, type Patch } from "immer";
import { z } from "zod";
import { evalProp } from "./eval";
import { Clip, type NumProp, type Project } from "./schema";
import { validateProject } from "./validate";

enablePatches();

export type Op =
  | { type: "addClip"; clip: Clip }
  | { type: "removeClip"; id: string }
  | { type: "moveClip"; id: string; start: number; trackId?: string }
  /** deltaUs is the timeline movement of the edge: +in shrinks from the left, -out shrinks from the right. */
  | { type: "trimClip"; id: string; edge: "in" | "out"; deltaUs: number }
  | { type: "splitClip"; id: string; at: number; newId: string }
  | { type: "setProp"; path: string[]; value: unknown }
  | { type: "replaceMedia"; clipId: string; assetId: string; in: number }
  | { type: "batch"; ops: Op[]; label: string };

/** Zod schema so ops can be validated at the API boundary. */
export const OpSchema: z.ZodType<Op> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("addClip"), clip: Clip }),
    z.object({ type: z.literal("removeClip"), id: z.string() }),
    z.object({ type: z.literal("moveClip"), id: z.string(), start: z.number().int(), trackId: z.string().optional() }),
    z.object({ type: z.literal("trimClip"), id: z.string(), edge: z.enum(["in", "out"]), deltaUs: z.number().int() }),
    z.object({ type: z.literal("splitClip"), id: z.string(), at: z.number().int(), newId: z.string() }),
    z.object({ type: z.literal("setProp"), path: z.array(z.string()).min(1), value: z.unknown() }),
    z.object({ type: z.literal("replaceMedia"), clipId: z.string(), assetId: z.string(), in: z.number().int() }),
    z.object({ type: z.literal("batch"), ops: z.array(OpSchema), label: z.string() }),
  ]),
) as z.ZodType<Op>;

export type Actor = "user" | "ai";
export interface ApplyResult {
  next: Project;
  patches: Patch[];
  /** Apply these to `next` to get back to the previous state. This is your undo. */
  inverse: Patch[];
}

export class OpError extends Error {}

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

function need(d: Draft<Project>, id: string): Draft<Clip> {
  const c = d.clips[id];
  if (!c) throw new OpError(`unknown clip ${id}`);
  return c;
}

/** Any manual edit of an AI clip marks it, so regeneration will never overwrite it. */
function touch(c: Draft<Clip>, actor: Actor) {
  if (actor === "user" && c.provenance.origin === "ai") c.provenance.userModified = true;
}

const TRANSFORM_NUM_KEYS = ["x", "y", "scale", "rotation", "opacity"] as const;

function splitNumProp(prop: NumProp, splitOffsetUs: number): [NumProp, NumProp] {
  if ("value" in prop) {
    return [{ value: prop.value }, { value: prop.value }];
  }
  const sorted = [...prop.keys].sort((a, b) => a.t - b.t);
  const midVal = evalProp(prop, splitOffsetUs);
  const exact = sorted.find((k) => k.t === splitOffsetUs);
  const nextKf = sorted.find((k) => k.t > splitOffsetUs);
  const before = sorted.filter((k) => k.t < splitOffsetUs).map((k) => ({ ...k }));
  const after = sorted.filter((k) => k.t > splitOffsetUs).map((k) => ({ ...k, t: k.t - splitOffsetUs }));

  let leftKeys: typeof sorted;
  if (before.length === 0) {
    leftKeys = [exact ? { ...exact } : { t: 0, v: midVal, ease: "linear" }];
  } else if (exact || nextKf) {
    leftKeys = [...before, exact ? { ...exact } : { t: splitOffsetUs, v: midVal, ease: nextKf!.ease }];
  } else {
    leftKeys = before;
  }

  let rightKeys: typeof sorted;
  if (after.length === 0) {
    rightKeys = [{ t: 0, v: midVal, ease: exact ? exact.ease : "linear" }];
  } else if (before.length === 0 && !exact) {
    rightKeys = after;
  } else {
    rightKeys = [{ t: 0, v: midVal, ease: exact ? exact.ease : "linear" }, ...after];
  }

  return [{ keys: leftKeys }, { keys: rightKeys }];
}

function trimInNumProp(prop: NumProp, deltaUs: number): NumProp {
  if ("value" in prop || deltaUs === 0) return prop;
  const sorted = [...prop.keys].sort((a, b) => a.t - b.t);
  if (deltaUs < 0) {
    return { keys: sorted.map((k) => ({ ...k, t: k.t - deltaUs })) };
  }
  const startVal = evalProp(prop, deltaUs);
  const exact = sorted.find((k) => k.t === deltaUs);
  const before = sorted.filter((k) => k.t < deltaUs);
  const after = sorted.filter((k) => k.t > deltaUs).map((k) => ({ ...k, t: k.t - deltaUs }));
  if (after.length === 0) {
    return { keys: [{ t: 0, v: startVal, ease: exact ? exact.ease : "linear" }] };
  }
  if (before.length === 0 && !exact) {
    return { keys: after };
  }
  return { keys: [{ t: 0, v: startVal, ease: exact ? exact.ease : "linear" }, ...after] };
}

function splitClipKeyframes(left: Draft<Clip>, right: Clip, splitOffsetUs: number): void {
  for (const key of TRANSFORM_NUM_KEYS) {
    const plainProp = (isDraft(left.transform[key]) ? current(left.transform[key]) : left.transform[key]) as NumProp;
    const [lProp, rProp] = splitNumProp(plainProp, splitOffsetUs);
    left.transform[key] = lProp as Draft<NumProp>;
    right.transform[key] = rProp;
  }
  if (left.audio && right.audio) {
    const plainGain = (isDraft(left.audio.gain) ? current(left.audio.gain) : left.audio.gain) as NumProp;
    const [lGain, rGain] = splitNumProp(plainGain, splitOffsetUs);
    left.audio.gain = lGain as Draft<NumProp>;
    right.audio.gain = rGain;
  }
}

function trimInClipKeyframes(clip: Draft<Clip>, deltaUs: number): void {
  for (const key of TRANSFORM_NUM_KEYS) {
    const plainProp = (isDraft(clip.transform[key]) ? current(clip.transform[key]) : clip.transform[key]) as NumProp;
    clip.transform[key] = trimInNumProp(plainProp, deltaUs) as Draft<NumProp>;
  }
  if (clip.audio) {
    const plainGain = (isDraft(clip.audio.gain) ? current(clip.audio.gain) : clip.audio.gain) as NumProp;
    clip.audio.gain = trimInNumProp(plainGain, deltaUs) as Draft<NumProp>;
  }
}

function mutate(d: Draft<Project>, op: Op, actor: Actor): void {
  switch (op.type) {
    case "batch":
      for (const o of op.ops) mutate(d, o, actor);
      return;

    case "addClip": {
      if (d.clips[op.clip.id]) throw new OpError(`clip ${op.clip.id} already exists`);
      if (!d.tracks.some((t) => t.id === op.clip.trackId)) throw new OpError(`unknown track ${op.clip.trackId}`);
      d.clips[op.clip.id] = op.clip as Draft<Clip>;
      const scene = op.clip.sceneId ? d.scenes.find((s) => s.id === op.clip.sceneId) : undefined;
      scene?.clipIds.push(op.clip.id);
      return;
    }

    case "removeClip": {
      need(d, op.id);
      delete d.clips[op.id];
      for (const s of d.scenes) {
        s.clipIds = s.clipIds.filter((id) => id !== op.id);
        if (s.voiceClipId === op.id) delete s.voiceClipId;
      }
      return;
    }

    case "moveClip": {
      const c = need(d, op.id);
      if (op.trackId && !d.tracks.some((t) => t.id === op.trackId)) throw new OpError(`unknown track ${op.trackId}`);
      c.start = op.start;
      if (op.trackId) c.trackId = op.trackId;
      touch(c, actor);
      return;
    }

    case "trimClip": {
      const c = need(d, op.id);
      if (op.edge === "in") {
        c.start += op.deltaUs;
        c.duration -= op.deltaUs;
        if (c.source) c.source.in += Math.round(op.deltaUs * c.source.speed);
        trimInClipKeyframes(c, op.deltaUs);
      } else {
        c.duration += op.deltaUs;
      }
      touch(c, actor);
      return;
    }

    case "splitClip": {
      const c = need(d, op.id);
      const end = c.start + c.duration;
      if (op.at <= c.start || op.at >= end) throw new OpError("split point must be inside the clip");
      if (d.clips[op.newId]) throw new OpError(`clip ${op.newId} already exists`);
      const splitOffsetUs = op.at - c.start;
      const right = structuredClone(isDraft(c) ? current(c) : c) as Clip;
      right.id = op.newId;
      right.start = op.at;
      right.duration = end - op.at;
      delete right.transitionIn;
      if (right.source) right.source.in += Math.round(splitOffsetUs * right.source.speed);
      c.duration = splitOffsetUs;
      delete c.transitionOut;
      splitClipKeyframes(c, right, splitOffsetUs);
      d.clips[op.newId] = right as Draft<Clip>;
      const scene = c.sceneId ? d.scenes.find((s) => s.id === c.sceneId) : undefined;
      if (scene) scene.clipIds.splice(scene.clipIds.indexOf(c.id) + 1, 0, op.newId);
      touch(c, actor);
      touch(d.clips[op.newId]!, actor);
      return;
    }

    case "replaceMedia": {
      const c = need(d, op.clipId);
      if (!d.assets[op.assetId]) throw new OpError(`unknown asset ${op.assetId}`);
      c.source = { assetId: op.assetId, in: op.in, speed: c.source?.speed ?? 1 };
      touch(c, actor);
      return;
    }

    case "setProp": {
      if (op.path.some((k) => FORBIDDEN.has(k))) throw new OpError("forbidden path segment");
      let cur: any = d;
      for (const k of op.path.slice(0, -1)) {
        cur = cur[k];
        if (cur === undefined || cur === null) throw new OpError(`bad path ${op.path.join(".")}`);
      }
      cur[op.path[op.path.length - 1]!] = op.value;
      if (op.path[0] === "clips" && op.path[1] && d.clips[op.path[1]]) touch(d.clips[op.path[1]]!, actor);
      return;
    }
  }
}

/** Apply one op (or a batch) and return the new state plus patches for undo/redo. */
export function applyOp(p: Project, op: Op, opts: { actor?: Actor } = {}): ApplyResult {
  const actor = opts.actor ?? "user";
  const [next, patches, inverse] = produceWithPatches(p, (d) => {
    mutate(d, op, actor);
  });
  return { next, patches, inverse };
}

/** applyOp + invariant check. Use this everywhere except tests of raw behaviour. */
export function applyChecked(p: Project, op: Op, opts: { actor?: Actor } = {}): ApplyResult {
  const r = applyOp(p, op, opts);
  const errs = validateProject(r.next);
  if (errs.length) throw new OpError(errs.join("; "));
  return r;
}
