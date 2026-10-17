import type { Project } from "./schema";

/** Invariants that must hold after every op. Returns human-readable errors. */
export function validateProject(p: Project): string[] {
  const errs: string[] = [];
  const trackIds = new Set(p.tracks.map((t) => t.id));
  const byTrack = new Map<string, typeof p.clips[string][]>();

  for (const c of Object.values(p.clips)) {
    if (!trackIds.has(c.trackId)) errs.push(`clip ${c.id}: unknown track ${c.trackId}`);
    if (c.duration <= 0) errs.push(`clip ${c.id}: duration must be > 0`);
    if (c.start < 0) errs.push(`clip ${c.id}: start must be >= 0`);
    if (c.sceneId && !p.scenes.some((s) => s.id === c.sceneId)) errs.push(`clip ${c.id}: unknown scene ${c.sceneId}`);
    if (c.source) {
      const a = p.assets[c.source.assetId];
      if (!a) errs.push(`clip ${c.id}: unknown asset ${c.source.assetId}`);
      else if (a.durationUs !== undefined && a.type !== "image") {
        const needed = c.source.in + Math.round(c.duration * c.source.speed);
        if (c.source.in < 0 || needed > a.durationUs) errs.push(`clip ${c.id}: source range exceeds asset duration`);
      }
    }
    (byTrack.get(c.trackId) ?? byTrack.set(c.trackId, []).get(c.trackId)!).push(c);
  }

  for (const [trackId, clips] of byTrack) {
    clips.sort((a, b) => a.start - b.start);
    let maxEnd = -Infinity;
    for (const c of clips) {
      const overlap = maxEnd - c.start;
      const allowed = c.transitionIn?.duration ?? 0; // explicit transition overlap only
      if (overlap > allowed) errs.push(`track ${trackId}: clip ${c.id} overlaps previous clip by ${overlap}us`);
      maxEnd = Math.max(maxEnd, c.start + c.duration);
    }
  }

  for (const s of p.scenes) {
    for (const id of s.clipIds) if (!p.clips[id]) errs.push(`scene ${s.id}: missing clip ${id}`);
    if (s.voiceClipId && !p.clips[s.voiceClipId]) errs.push(`scene ${s.id}: missing voice clip`);
  }
  return errs;
}
