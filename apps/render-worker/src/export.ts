import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import {
  Canvas2DRenderer,
  createStubFrameProvider,
  renderFrame,
  type AssetFrameProvider,
  type Canvas2DContextLike,
  type CanvasSurfaceLike,
} from "@vf/render";
import { US_PER_SEC, type Project } from "@vf/schema";

export function resolveFfmpegBin(): string {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  for (const candidate of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "ffmpeg";
}

export function projectDurationUs(project: Project): number {
  let maxEndUs = 0;
  const hiddenTracks = new Set(project.tracks.filter((t) => t.hidden).map((t) => t.id));
  for (const clip of Object.values(project.clips)) {
    if (hiddenTracks.has(clip.trackId)) continue;
    maxEndUs = Math.max(maxEndUs, clip.start + clip.duration);
  }
  return maxEndUs;
}

export interface ExportOptions {
  outputPath: string;
  frameProvider?: AssetFrameProvider;
  ffmpegBin?: string;
  onProgress?: (renderedFrames: number, totalFrames: number) => void;
}

export interface ExportResult {
  outputPath: string;
  frames: number;
  durationUs: number;
  width: number;
  height: number;
  fps: number;
}

function createHeadlessSurface(width: number, height: number): CanvasSurfaceLike {
  return createCanvas(width, height) as unknown as CanvasSurfaceLike;
}

/**
 * Render a `Project` frame-by-frame using the shared `renderFrame` + `Canvas2DRenderer`
 * code path (Rule 5: one render code path) and pipe raw RGBA frames into a spawned
 * `ffmpeg` child process to produce an H.264 MP4 file.
 */
export async function exportProjectToMp4(
  project: Project,
  opts: ExportOptions,
): Promise<ExportResult> {
  const { width, height, fps } = project.canvas;
  const durationUs = projectDurationUs(project);
  const totalFrames = Math.max(1, Math.round((durationUs / US_PER_SEC) * fps));
  const ffmpegBin = opts.ffmpegBin ?? resolveFfmpegBin();

  fs.mkdirSync(path.dirname(path.resolve(opts.outputPath)), { recursive: true });

  const provider =
    opts.frameProvider ??
    createStubFrameProvider(createHeadlessSurface, { width, height });

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const renderer = new Canvas2DRenderer(ctx as unknown as Canvas2DContextLike, provider);

  const ffmpegArgs = [
    "-y",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    `${width}x${height}`,
    "-framerate",
    String(fps),
    "-i",
    "pipe:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "14",
    "-preset",
    "ultrafast",
    "-movflags",
    "+faststart",
    opts.outputPath,
  ];

  const proc = spawn(ffmpegBin, ffmpegArgs, {
    stdio: ["pipe", "ignore", "pipe"],
  });

  let stderrLog = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderrLog += chunk.toString("utf8");
  });

  const exitPromise = new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderrLog.slice(-500)}`));
    });
  });

  for (let i = 0; i < totalFrames; i++) {
    const tUs = Math.round((i * US_PER_SEC) / fps);
    renderFrame(project, tUs, renderer);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const buf = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);

    const canContinue = proc.stdin!.write(buf);
    if (!canContinue) {
      await new Promise<void>((resolve) => proc.stdin!.once("drain", resolve));
    }
    opts.onProgress?.(i + 1, totalFrames);
  }

  proc.stdin!.end();
  await exitPromise;

  return {
    outputPath: opts.outputPath,
    frames: totalFrames,
    durationUs,
    width,
    height,
    fps,
  };
}
