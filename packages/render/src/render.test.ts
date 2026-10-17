import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import {
  applyChecked,
  createEmptyProject,
  defaultTransform,
  makeClip,
  secToUs,
  validateProject,
} from "@vf/schema";
import {
  Canvas2DRenderer,
  createStubFrameProvider,
  fixtureSingleClip,
  fixtureTextOverVideoKeyframed,
  fixtureTwoClipsWithFade,
  renderFrame,
  renderProjectToCanvas2D,
  type Canvas2DContextLike,
  type CanvasSurfaceLike,
  type DrawImageParams,
  type DrawTextParams,
  type Renderer,
} from "./index";
import { renderPreviewFrame } from "../../../apps/web/src/previewRender";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.resolve(__dirname, "../test/__snapshots__");

function createHeadlessSurface(width: number, height: number): CanvasSurfaceLike {
  return createCanvas(width, height) as unknown as CanvasSurfaceLike;
}

function renderToRgbaAndPng(project: ReturnType<typeof fixtureSingleClip>, tUs: number) {
  const canvas = createCanvas(project.canvas.width, project.canvas.height);
  const ctx = canvas.getContext("2d");
  const provider = createStubFrameProvider(createHeadlessSurface, {
    width: project.canvas.width,
    height: project.canvas.height,
  });
  const renderer = new Canvas2DRenderer(ctx as unknown as Canvas2DContextLike, provider);
  renderFrame(project, tUs, renderer);
  const imageData = ctx.getImageData(0, 0, project.canvas.width, project.canvas.height);
  const pngBuffer = canvas.toBuffer("image/png");
  return { rgba: imageData.data, pngBuffer, width: project.canvas.width, height: project.canvas.height };
}

/**
 * Pixel tolerance policy:
 * - Max per-channel delta <= 2 (out of 255)
 * - Mismatched pixels (exceeding channel delta 2) <= 0.5% of total pixels
 * Rationale: Headless Skia (@napi-rs/canvas) font anti-aliasing and subpixel float-to-uint8
 * rounding can vary by 1-2 LSB across OS/CPU architectures on CI while remaining deterministic
 * for layout, colors, transforms, crops, fit modes, and keyframe interpolation.
 */
async function assertMatchesPngSnapshot(
  snapshotName: string,
  actual: { rgba: Uint8ClampedArray; pngBuffer: Buffer; width: number; height: number },
) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const filePath = path.join(SNAPSHOT_DIR, `${snapshotName}.png`);

  if (!fs.existsSync(filePath) || process.env.UPDATE_SNAPSHOTS === "1") {
    fs.writeFileSync(filePath, actual.pngBuffer);
  }

  const storedPng = fs.readFileSync(filePath);
  const img = await loadImage(storedPng);
  expect(img.width).toBe(actual.width);
  expect(img.height).toBe(actual.height);

  const expectedCanvas = createCanvas(actual.width, actual.height);
  const expectedCtx = expectedCanvas.getContext("2d");
  expectedCtx.drawImage(img, 0, 0);
  const expectedRgba = expectedCtx.getImageData(0, 0, actual.width, actual.height).data;

  const totalPixels = actual.width * actual.height;
  const maxChannelDelta = 2;
  let differingPixels = 0;

  for (let i = 0; i < actual.rgba.length; i += 4) {
    const dr = Math.abs(actual.rgba[i]! - expectedRgba[i]!);
    const dg = Math.abs(actual.rgba[i + 1]! - expectedRgba[i + 1]!);
    const db = Math.abs(actual.rgba[i + 2]! - expectedRgba[i + 2]!);
    const da = Math.abs(actual.rgba[i + 3]! - expectedRgba[i + 3]!);
    if (dr > maxChannelDelta || dg > maxChannelDelta || db > maxChannelDelta || da > maxChannelDelta) {
      differingPixels++;
    }
  }

  const mismatchRatio = differingPixels / totalPixels;
  expect(mismatchRatio).toBeLessThanOrEqual(0.005);
}

describe("renderFrame unit behavior", () => {
  it("computes sourceTimeUs as source.in + (t - clip.start) * speed, respects track z-order and hidden tracks", () => {
    let p = createEmptyProject({ id: "u1", title: "Unit", width: 320, height: 180, fps: 30 });
    p = {
      ...p,
      assets: {
        a1: { id: "a1", type: "video", uri: "s3://vf/a1.mp4", durationUs: secToUs(20), origin: "stock" },
        a2: { id: "a2", type: "video", uri: "s3://vf/a2.mp4", durationUs: secToUs(20), origin: "stock" },
      },
      tracks: [
        { id: "v_bottom", kind: "video", name: "Bottom", muted: false, hidden: false, locked: false, height: 64 },
        { id: "v_hidden", kind: "video", name: "Hidden", muted: false, hidden: true, locked: false, height: 64 },
        { id: "t_top", kind: "text", name: "Top Text", muted: false, hidden: false, locked: false, height: 40 },
      ],
    };

    p = applyChecked(p, {
      type: "addClip",
      clip: makeClip({
        id: "c_bot",
        trackId: "v_bottom",
        start: secToUs(1),
        duration: secToUs(4),
        source: { assetId: "a1", in: secToUs(2), speed: 1.5 },
      }),
    }).next;

    p = applyChecked(p, {
      type: "addClip",
      clip: makeClip({
        id: "c_hid",
        trackId: "v_hidden",
        start: 0,
        duration: secToUs(5),
        source: { assetId: "a2", in: 0, speed: 1 },
      }),
    }).next;

    p = applyChecked(p, {
      type: "addClip",
      clip: makeClip({
        id: "c_txt",
        trackId: "t_top",
        kind: "text",
        start: secToUs(1),
        duration: secToUs(4),
        text: { text: "Hello", fontFamily: "sans-serif", fontSize: 24, color: "#fff", align: "center" },
      }),
    }).next;

    const calls: string[] = [];
    const imageParams: DrawImageParams[] = [];
    const textParams: DrawTextParams[] = [];

    const mockTarget: Renderer = {
      clear: () => calls.push("clear"),
      drawImage: (params) => {
        calls.push(`image:${params.clipId}`);
        imageParams.push(params);
      },
      drawText: (params) => {
        calls.push(`text:${params.clipId}`);
        textParams.push(params);
      },
    };

    // At t = 3s: localT = 2s, speed = 1.5, in = 2s => sourceTimeUs = 2s + 2s * 1.5 = 5s
    renderFrame(p, secToUs(3), mockTarget);

    expect(calls).toEqual(["clear", "image:c_bot", "text:c_txt"]);
    expect(imageParams[0]!.sourceTimeUs).toBe(secToUs(5));
  });

  it("evaluates keyframed transform properties in clip-local time and applies fade transitions, fit, and crop", () => {
    let p = createEmptyProject({ id: "u2", title: "Transform & Crop", width: 320, height: 180, fps: 30 });
    p = {
      ...p,
      assets: {
        a1: { id: "a1", type: "video", uri: "s3://vf/a1.mp4", durationUs: secToUs(20), origin: "stock" },
      },
    };

    p = applyChecked(p, {
      type: "addClip",
      clip: makeClip({
        id: "c1",
        trackId: "v1",
        start: secToUs(2),
        duration: secToUs(4),
        source: { assetId: "a1", in: 0, speed: 1 },
        transitionIn: { type: "fade", duration: secToUs(1) },
        transform: {
          ...defaultTransform(),
          x: { keys: [{ t: 0, v: 0.2, ease: "linear" }, { t: secToUs(4), v: 0.8, ease: "linear" }] },
          y: { keys: [{ t: 0, v: 0.3, ease: "linear" }, { t: secToUs(4), v: 0.7, ease: "linear" }] },
          scale: { keys: [{ t: 0, v: 1, ease: "linear" }, { t: secToUs(4), v: 2, ease: "linear" }] },
          rotation: { keys: [{ t: 0, v: 0, ease: "linear" }, { t: secToUs(4), v: 90, ease: "linear" }] },
          opacity: { value: 0.8 },
          fit: "stretch",
          crop: { l: 0.1, t: 0.1, r: 0.1, b: 0.1 },
        },
      }),
    }).next;

    let captured: DrawImageParams | undefined;
    const mockTarget: Renderer = {
      clear: () => {},
      drawImage: (params) => {
        captured = params;
      },
      drawText: () => {},
    };

    // At t = 2.5s (clip-local t = 0.5s, halfway through 1s fadeIn, and 1/8 through 4s keyframes)
    renderFrame(p, 2_500_000, mockTarget);

    expect(captured).toBeDefined();
    expect(captured!.transform.x).toBeCloseTo(0.2 + 0.6 * 0.125, 3);
    expect(captured!.transform.y).toBeCloseTo(0.3 + 0.4 * 0.125, 3);
    expect(captured!.transform.scale).toBeCloseTo(1 + 1 * 0.125, 3);
    expect(captured!.transform.rotation).toBeCloseTo(90 * 0.125, 3);
    // opacity = 0.8 * (0.5 / 1.0) = 0.4
    expect(captured!.transform.opacity).toBeCloseTo(0.4, 2);
    expect(captured!.transform.fit).toBe("stretch");
    expect(captured!.transform.crop).toEqual({ l: 0.1, t: 0.1, r: 0.1, b: 0.1 });
  });
});

describe("fixture snapshot tests (3 fixtures x 3 timestamps)", () => {
  it("Fixture 1: single clip at 3 timestamps", async () => {
    const p = fixtureSingleClip();
    expect(validateProject(p)).toEqual([]);

    const t0 = renderToRgbaAndPng(p, 0);
    const t1 = renderToRgbaAndPng(p, secToUs(1));
    const t2 = renderToRgbaAndPng(p, secToUs(2));

    // Frames change as playhead moves
    expect(Buffer.compare(Buffer.from(t0.rgba), Buffer.from(t1.rgba))).not.toBe(0);
    expect(Buffer.compare(Buffer.from(t1.rgba), Buffer.from(t2.rgba))).not.toBe(0);

    await assertMatchesPngSnapshot("fixture1-single-clip-t0", t0);
    await assertMatchesPngSnapshot("fixture1-single-clip-t1", t1);
    await assertMatchesPngSnapshot("fixture1-single-clip-t2", t2);
  });

  it("Fixture 2: two clips with a fade transition at 3 timestamps", async () => {
    const p = fixtureTwoClipsWithFade();
    expect(validateProject(p)).toEqual([]);

    const t0 = renderToRgbaAndPng(p, 500_000);   // 0.5s: clip 1 only
    const t1 = renderToRgbaAndPng(p, 1_500_000); // 1.5s: mid-fade overlap between clip 1 and clip 2
    const t2 = renderToRgbaAndPng(p, 2_500_000); // 2.5s: clip 2 only

    expect(Buffer.compare(Buffer.from(t0.rgba), Buffer.from(t1.rgba))).not.toBe(0);
    expect(Buffer.compare(Buffer.from(t1.rgba), Buffer.from(t2.rgba))).not.toBe(0);

    await assertMatchesPngSnapshot("fixture2-two-clips-fade-t0", t0);
    await assertMatchesPngSnapshot("fixture2-two-clips-fade-t1", t1);
    await assertMatchesPngSnapshot("fixture2-two-clips-fade-t2", t2);
  });

  it("Fixture 3: text over video with keyframed scale at 3 timestamps", async () => {
    const p = fixtureTextOverVideoKeyframed();
    expect(validateProject(p)).toEqual([]);

    const t0 = renderToRgbaAndPng(p, 0);         // 0.0s: scale = 0.6
    const t1 = renderToRgbaAndPng(p, secToUs(1)); // 1.0s: scale = 1.05
    const t2 = renderToRgbaAndPng(p, secToUs(2)); // 2.0s: scale = 1.5

    expect(Buffer.compare(Buffer.from(t0.rgba), Buffer.from(t1.rgba))).not.toBe(0);
    expect(Buffer.compare(Buffer.from(t1.rgba), Buffer.from(t2.rgba))).not.toBe(0);

    await assertMatchesPngSnapshot("fixture3-text-over-video-t0", t0);
    await assertMatchesPngSnapshot("fixture3-text-over-video-t1", t1);
    await assertMatchesPngSnapshot("fixture3-text-over-video-t2", t2);
  });
});

describe("preview and headless backend parity", () => {
  it("web preview renderPreviewFrame and headless Canvas2DRenderer produce identical pixel output", () => {
    const project = fixtureTextOverVideoKeyframed();
    const tUs = secToUs(1);

    // 1. Headless backend render
    const headless = renderToRgbaAndPng(project, tUs);

    // 2. Web preview code path (renderPreviewFrame from apps/web/src/Preview.tsx)
    const previewCanvas = createCanvas(project.canvas.width, project.canvas.height);
    const previewCtx = previewCanvas.getContext("2d");
    renderPreviewFrame(
      project,
      tUs,
      previewCtx as unknown as Canvas2DContextLike,
      createHeadlessSurface,
    );
    const previewRgba = previewCtx.getImageData(0, 0, project.canvas.width, project.canvas.height).data;

    expect(Buffer.compare(Buffer.from(previewRgba), Buffer.from(headless.rgba))).toBe(0);
  });
});
