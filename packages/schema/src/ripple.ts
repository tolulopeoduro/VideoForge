import type { Op } from "./ops";
import type { Project } from "./schema";

/** Delete a clip and close the gap on its track (or on all tracks). */
export function rippleDelete(p: Project, clipId: string, allTracks = false): Op {
  const c = p.clips[clipId];
  if (!c) throw new Error(`unknown clip ${clipId}`);
  const end = c.start + c.duration;
  const ops: Op[] = [{ type: "removeClip", id: clipId }];
  for (const o of Object.values(p.clips)) {
    if (o.id === clipId) continue;
    if (!allTracks && o.trackId !== c.trackId) continue;
    if (o.start >= end) ops.push({ type: "moveClip", id: o.id, start: o.start - c.duration });
  }
  return { type: "batch", ops, label: "Ripple delete" };
}
