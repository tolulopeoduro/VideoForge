import type { Clip, Project, Transform } from "./schema";

export const defaultTransform = (): Transform => ({
  x: { value: 0.5 },
  y: { value: 0.5 },
  scale: { value: 1 },
  rotation: { value: 0 },
  opacity: { value: 1 },
  fit: "cover",
});

export function createEmptyProject(opts: {
  id: string;
  title: string;
  width?: number;
  height?: number;
  fps?: number;
}): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: opts.id,
    meta: { title: opts.title, createdAt: now, updatedAt: now },
    canvas: { width: opts.width ?? 1920, height: opts.height ?? 1080, fps: opts.fps ?? 30, bg: "#000000" },
    assets: {},
    tracks: [
      { id: "v1", kind: "video", name: "Video 1", muted: false, hidden: false, locked: false, height: 64 },
      { id: "t1", kind: "text", name: "Text", muted: false, hidden: false, locked: false, height: 40 },
      { id: "a1", kind: "audio", name: "Voice", muted: false, hidden: false, locked: false, height: 48 },
    ],
    clips: {},
    scenes: [],
    captions: null,
    markers: [],
    generation: { runs: [] },
  };
}

export function makeClip(
  c: Pick<Clip, "id" | "trackId" | "start" | "duration"> & Partial<Clip>,
): Clip {
  return {
    kind: "media",
    transform: defaultTransform(),
    effects: [],
    provenance: { origin: "user", locked: false, userModified: false },
    ...c,
  };
}
