import {
  applyChecked,
  createEmptyProject,
  defaultTransform,
  makeClip,
  secToUs,
  type Project,
} from "@vf/schema";

/**
 * Fixture 1: Single video clip on v1 with contain fit and crop.
 */
export function fixtureSingleClip(): Project {
  let p = createEmptyProject({ id: "fix-single", title: "Single Clip", width: 320, height: 180, fps: 30 });
  p = {
    ...p,
    canvas: { ...p.canvas, bg: "#111827" },
    assets: {
      a1: { id: "a1", type: "video", uri: "s3://vf/a1.mp4", durationUs: secToUs(10), origin: "stock" },
    },
  };
  p = applyChecked(p, {
    type: "addClip",
    clip: makeClip({
      id: "c1",
      trackId: "v1",
      start: 0,
      duration: secToUs(3),
      source: { assetId: "a1", in: 0, speed: 1 },
      transform: {
        ...defaultTransform(),
        scale: { value: 0.85 },
        fit: "contain",
      },
    }),
  }).next;
  return p;
}

/**
 * Fixture 2: Two video clips on v1 with a 1-second fade transition overlap between 1s and 2s.
 */
export function fixtureTwoClipsWithFade(): Project {
  let p = createEmptyProject({ id: "fix-fade", title: "Two Clips Fade", width: 320, height: 180, fps: 30 });
  p = {
    ...p,
    canvas: { ...p.canvas, bg: "#000000" },
    assets: {
      a1: { id: "a1", type: "video", uri: "s3://vf/a1.mp4", durationUs: secToUs(10), origin: "stock" },
      a2: { id: "a2", type: "video", uri: "s3://vf/a2.mp4", durationUs: secToUs(10), origin: "stock" },
    },
  };
  p = applyChecked(p, {
    type: "addClip",
    clip: makeClip({
      id: "c1",
      trackId: "v1",
      start: 0,
      duration: secToUs(2),
      source: { assetId: "a1", in: 0, speed: 1 },
      transitionOut: { type: "fade", duration: secToUs(1) },
    }),
  }).next;
  p = applyChecked(p, {
    type: "addClip",
    clip: makeClip({
      id: "c2",
      trackId: "v1",
      start: secToUs(1),
      duration: secToUs(2),
      source: { assetId: "a2", in: 0, speed: 1 },
      transitionIn: { type: "fade", duration: secToUs(1) },
    }),
  }).next;
  return p;
}

/**
 * Fixture 3: Text clip over video clip with keyframed scale on the text track.
 */
export function fixtureTextOverVideoKeyframed(): Project {
  let p = createEmptyProject({ id: "fix-text-kf", title: "Text Over Video Keyframed", width: 320, height: 180, fps: 30 });
  p = {
    ...p,
    canvas: { ...p.canvas, bg: "#0f172a" },
    assets: {
      a1: { id: "a1", type: "video", uri: "s3://vf/a1.mp4", durationUs: secToUs(10), origin: "stock" },
    },
  };
  p = applyChecked(p, {
    type: "addClip",
    clip: makeClip({
      id: "c_video",
      trackId: "v1",
      start: 0,
      duration: secToUs(3),
      source: { assetId: "a1", in: 0, speed: 1 },
    }),
  }).next;
  p = applyChecked(p, {
    type: "addClip",
    clip: makeClip({
      id: "c_text",
      trackId: "t1",
      kind: "text",
      start: 0,
      duration: secToUs(3),
      text: {
        text: "VIDEOFORGE",
        fontFamily: "sans-serif",
        fontSize: 28,
        color: "#ffffff",
        align: "center",
      },
      transform: {
        ...defaultTransform(),
        y: { value: 0.3 },
        scale: {
          keys: [
            { t: 0, v: 0.6, ease: "linear" },
            { t: secToUs(2), v: 1.5, ease: "linear" },
          ],
        },
      },
    }),
  }).next;
  return p;
}
