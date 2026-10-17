import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { fixtureTwoClipsWithFade, type Canvas2DContextLike, type CanvasSurfaceLike } from "@vf/render";
import { describe, expect, it } from "vitest";
import { renderPreviewFrame } from "../../web/src/previewRender";
import { encodeMonoPcm16Wav, exportProjectToMp4, resolveFfmpegBin } from "./export";

function createHeadlessSurface(width: number, height: number): CanvasSurfaceLike {
  return createCanvas(width, height) as unknown as CanvasSurfaceLike;
}

function decodeFrameRgbaFromMp4(
  mp4Path: string,
  frameIndex: number,
  width: number,
  height: number,
  ffmpegBin: string,
): Buffer {
  const res = spawnSync(
    ffmpegBin,
    [
      "-v",
      "error",
      "-i",
      mp4Path,
      "-vf",
      `select=eq(n\\,${frameIndex})`,
      "-vframes",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "pipe:1",
    ],
    { maxBuffer: width * height * 4 + 1024 * 1024 },
  );
  if (res.status !== 0) {
    throw new Error(`ffmpeg decode failed: ${res.stderr?.toString("utf8")}`);
  }
  return res.stdout;
}

describe("MP4 export pipeline and preview frame-diff parity", () => {
  it("exports an MP4 whose decoded frames match the browser preview renderer on a frame-diff test", async () => {
    const project = fixtureTwoClipsWithFade(); // 3s @ 30fps = 90 frames, 320x180
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-export-test-"));
    const mp4Path = path.join(tmpDir, "out.mp4");
    const ffmpegBin = resolveFfmpegBin();

    try {
      let lastProgress = 0;
      const exportRes = await exportProjectToMp4(project, {
        outputPath: mp4Path,
        ffmpegBin,
        onProgress: (done, total) => {
          lastProgress = Math.round((done / total) * 100);
        },
      });

      expect(fs.existsSync(mp4Path)).toBe(true);
      expect(fs.statSync(mp4Path).size).toBeGreaterThan(1000);
      expect(exportRes.frames).toBe(90);
      expect(lastProgress).toBe(100);

      // Compare at 3 timestamps: frame 15 (0.5s, clip 1), frame 45 (1.5s, mid-fade), frame 75 (2.5s, clip 2)
      for (const frameIdx of [15, 45, 75]) {
        const tUs = Math.round((frameIdx * 1_000_000) / project.canvas.fps);

        // Render preview frame
        const previewCanvas = createCanvas(project.canvas.width, project.canvas.height);
        const previewCtx = previewCanvas.getContext("2d");
        renderPreviewFrame(
          project,
          tUs,
          previewCtx as unknown as Canvas2DContextLike,
          createHeadlessSurface,
        );
        const previewRgba = previewCtx.getImageData(0, 0, project.canvas.width, project.canvas.height).data;

        // Decode frame from exported H.264 MP4
        const decodedRgba = decodeFrameRgbaFromMp4(
          mp4Path,
          frameIdx,
          project.canvas.width,
          project.canvas.height,
          ffmpegBin,
        );

        expect(decodedRgba.byteLength).toBe(previewRgba.byteLength);

        // Compute mean absolute error across RGB channels (allowing for H.264 yuv420p chroma subsampling)
        let diffSum = 0;
        const numSamples = (previewRgba.length / 4) * 3;
        for (let i = 0; i < previewRgba.length; i += 4) {
          diffSum += Math.abs(previewRgba[i]! - decodedRgba[i]!);
          diffSum += Math.abs(previewRgba[i + 1]! - decodedRgba[i + 1]!);
          diffSum += Math.abs(previewRgba[i + 2]! - decodedRgba[i + 2]!);
        }
        const mae = diffSum / numSamples;
        expect(mae).toBeLessThan(3.5);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("muxes 24kHz PCM WAV voiceover audio into the exported MP4 as an AAC stream", async () => {
    const project = fixtureTwoClipsWithFade(); // 3s @ 30fps
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-export-audio-test-"));
    const mp4Path = path.join(tmpDir, "out_with_audio.mp4");
    const ffmpegBin = resolveFfmpegBin();

    try {
      const sampleRate = 24_000;
      const samples = new Float32Array(sampleRate * 3);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.25 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
      }
      const wavBuf = encodeMonoPcm16Wav(samples, sampleRate);

      const exportRes = await exportProjectToMp4(project, {
        outputPath: mp4Path,
        ffmpegBin,
        audioWavBytes: wavBuf,
      });

      expect(exportRes.hasAudio).toBe(true);
      expect(fs.existsSync(mp4Path)).toBe(true);

      const probe = spawnSync(ffmpegBin, ["-i", mp4Path], { encoding: "utf8" });
      const info = (probe.stderr ?? "") + (probe.stdout ?? "");
      expect(info).toMatch(/Video: h264/);
      expect(info).toMatch(/Audio: aac/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("decodes real uploaded media files from disk via assetFiles and composites them into the exported MP4", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-export-upload-test-"));
    const uploadedPngPath = path.join(tmpDir, "upload_red.png");
    const mp4Path = path.join(tmpDir, "out_upload.mp4");
    const ffmpegBin = resolveFfmpegBin();

    try {
      // Create a solid bright green 320x180 PNG on disk representing an uploaded asset
      const srcCanvas = createCanvas(320, 180);
      const srcCtx = srcCanvas.getContext("2d");
      srcCtx.fillStyle = "#00ff00";
      srcCtx.fillRect(0, 0, 320, 180);
      fs.writeFileSync(uploadedPngPath, srcCanvas.toBuffer("image/png"));

      const base = fixtureTwoClipsWithFade();
      const project = {
        ...base,
        assets: {
          ...base.assets,
          upload_green: {
            id: "upload_green",
            type: "image" as const,
            uri: "s3://vf/uploads/upload_green.png",
            durationUs: 5_000_000,
            width: 320,
            height: 180,
            origin: "upload" as const,
          },
        },
        clips: {
          ...base.clips,
          c1: {
            ...base.clips.c1!,
            source: { assetId: "upload_green", in: 0, speed: 1 },
          },
        },
      };

      await exportProjectToMp4(project, {
        outputPath: mp4Path,
        ffmpegBin,
        assetFiles: { upload_green: uploadedPngPath },
      });

      const decodedRgba = decodeFrameRgbaFromMp4(mp4Path, 5, 320, 180, ffmpegBin);
      // Center pixel should be strongly green (G > 200, R < 50, B < 50)
      const centerOffset = (90 * 320 + 160) * 4;
      expect(decodedRgba[centerOffset]!).toBeLessThan(50);
      expect(decodedRgba[centerOffset + 1]!).toBeGreaterThan(200);
      expect(decodedRgba[centerOffset + 2]!).toBeLessThan(50);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

