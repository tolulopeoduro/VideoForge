import { evalProp, snapToFrame, type Clip, type Project, type Transform } from "@vf/schema";

export interface CropRect {
  l: number;
  t: number;
  r: number;
  b: number;
}

export interface EvaluatedTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  fit: Transform["fit"];
  crop?: CropRect;
}

export interface DrawImageParams {
  assetId: string;
  clipId: string;
  /** Source media timestamp in integer microseconds: source.in + (t - clip.start) * speed */
  sourceTimeUs: number;
  canvasWidth: number;
  canvasHeight: number;
  transform: EvaluatedTransform;
}

export interface DrawTextParams {
  clipId: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  canvasWidth: number;
  canvasHeight: number;
  transform: EvaluatedTransform;
}

/**
 * Target renderer interface shared by browser preview and server export.
 */
export interface Renderer {
  clear(width: number, height: number, bg: string): void;
  drawImage(params: DrawImageParams): void;
  drawText(params: DrawTextParams): void;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Compute fade transition multiplier at clip-local time `localT` (microseconds).
 */
export function evalFadeFactor(clip: Clip, localT: number): number {
  let factor = 1;
  if (clip.transitionIn?.type === "fade" && clip.transitionIn.duration > 0) {
    if (localT < clip.transitionIn.duration) {
      factor *= clamp01(localT / clip.transitionIn.duration);
    }
  }
  if (clip.transitionOut?.type === "fade" && clip.transitionOut.duration > 0) {
    const remaining = clip.duration - localT;
    if (remaining < clip.transitionOut.duration) {
      factor *= clamp01(remaining / clip.transitionOut.duration);
    }
  }
  return clamp01(factor);
}

/**
 * Evaluate all animatable transform properties of a clip at clip-local time `localT` (microseconds),
 * incorporating any active `fade` transition into `opacity`.
 */
export function evaluateClipTransform(clip: Clip, localT: number): EvaluatedTransform {
  const baseOpacity = clamp01(evalProp(clip.transform.opacity, localT));
  const fade = evalFadeFactor(clip, localT);
  return {
    x: evalProp(clip.transform.x, localT),
    y: evalProp(clip.transform.y, localT),
    scale: evalProp(clip.transform.scale, localT),
    rotation: evalProp(clip.transform.rotation, localT),
    opacity: clamp01(baseOpacity * fade),
    fit: clip.transform.fit,
    ...(clip.transform.crop ? { crop: clip.transform.crop } : {}),
  };
}

/**
 * Single render code path used by both browser preview and server export.
 * `tUs` is integer microseconds and is snapped to the project frame grid here.
 */
export function renderFrame(project: Project, tUs: number, target: Renderer): void {
  const { width, height, fps, bg } = project.canvas;
  const t = snapToFrame(Math.round(tUs), fps);

  target.clear(width, height, bg);

  const allClips = Object.values(project.clips);

  // project.tracks are ordered bottom -> top (z-order)
  for (const track of project.tracks) {
    if (track.hidden || track.kind === "audio") continue;

    const activeClips = allClips
      .filter((c) => c.trackId === track.id && t >= c.start && t < c.start + c.duration)
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

    for (const clip of activeClips) {
      const localT = t - clip.start;
      const transform = evaluateClipTransform(clip, localT);
      if (transform.opacity <= 0) continue;

      if (clip.kind === "text" && clip.text) {
        target.drawText({
          clipId: clip.id,
          text: clip.text.text,
          fontFamily: clip.text.fontFamily,
          fontSize: clip.text.fontSize,
          color: clip.text.color,
          align: clip.text.align,
          canvasWidth: width,
          canvasHeight: height,
          transform,
        });
      } else if (clip.kind === "media") {
        const speed = clip.source?.speed ?? 1;
        const inUs = clip.source?.in ?? 0;
        const assetId = clip.source?.assetId ?? clip.id;
        const sourceTimeUs = inUs + Math.round(localT * speed);

        target.drawImage({
          assetId,
          clipId: clip.id,
          sourceTimeUs,
          canvasWidth: width,
          canvasHeight: height,
          transform,
        });
      }
    }
  }
}
