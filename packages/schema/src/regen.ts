import type { Clip, Project } from "./schema";

/**
 * The regeneration rule. Re-running AI may only overwrite a clip that is
 * AI-made, unlocked, never touched by the user, and in an unlocked scene.
 */
export function canOverwrite(p: Project, clip: Clip): boolean {
  const scene = clip.sceneId ? p.scenes.find((s) => s.id === clip.sceneId) : undefined;
  return (
    clip.provenance.origin === "ai" &&
    !clip.provenance.locked &&
    !clip.provenance.userModified &&
    !(scene?.locked ?? false)
  );
}

export function regenerableClips(p: Project, sceneId: string): Clip[] {
  return Object.values(p.clips).filter((c) => c.sceneId === sceneId && canOverwrite(p, c));
}
