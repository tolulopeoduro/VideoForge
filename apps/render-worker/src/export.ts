import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, ImageData, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  Canvas2DRenderer,
  createStubFrameProvider,
  renderFrame,
  type AssetFrameProvider,
  type Canvas2DContextLike,
  type CanvasSurfaceLike,
  type FrameData,
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

/**
 * Encodes a mono `Float32Array` (-1.0..1.0) into a 16-bit PCM RIFF WAV `Buffer`.
 */
export function encodeMonoPcm16Wav(samples: Float32Array, sampleRate = 24_000): Buffer {
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format = 1
  buf.writeUInt16LE(1, 22); // mono = 1 channel
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byteRate
  buf.writeUInt16LE(2, 32); // blockAlign
  buf.writeUInt16LE(16, 34); // bitsPerSample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    const pcm = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    buf.writeInt16LE(pcm, 44 + i * 2);
  }
  return buf;
}

export interface ExportOptions {
  outputPath: string;
  frameProvider?: AssetFrameProvider;
  /** Optional map of `assetId -> local disk path` for real uploaded video/image assets */
  assetFiles?: Record<string, string>;
  ffmpegBin?: string;
  audioWavBytes?: Uint8Array | Buffer;
  audioWavPath?: string;
  onProgress?: (renderedFrames: number, totalFrames: number) => void;
}

export interface ExportResult {
  outputPath: string;
  frames: number;
  durationUs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

function createHeadlessSurface(width: number, height: number): CanvasSurfaceLike {
  return createCanvas(width, height) as unknown as CanvasSurfaceLike;
}

interface DecodedVideoEntry {
  width: number;
  height: number;
  fps: number;
  frames: Uint8ClampedArray[];
  surface: Canvas;
  ctx: SKRSContext2D;
}

/**
 * Builds a composite `AssetFrameProvider` that decodes real uploaded image/video files from disk
 * (using `@napi-rs/canvas` `loadImage` for images and `ffmpeg` raw RGBA decoding for videos)
 * and falls back to `createStubFrameProvider` for synthetic stock IDs.
 */
export async function createDiskAssetFrameProvider(
  project: Project,
  assetFiles: Record<string, string>,
  ffmpegBin = resolveFfmpegBin(),
): Promise<AssetFrameProvider> {
  const stub = createStubFrameProvider(createHeadlessSurface, {
    width: project.canvas.width,
    height: project.canvas.height,
  });

  const staticImages = new Map<string, FrameData>();
  const decodedVideos = new Map<string, DecodedVideoEntry>();

  for (const [assetId, filePath] of Object.entries(assetFiles)) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    const asset = project.assets[assetId];
    const ext = path.extname(filePath).toLowerCase();
    const isImage =
      asset?.type === "image" || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);

    if (isImage) {
      try {
        const img = await loadImage(filePath);
        const w = Math.max(1, img.width || asset?.width || project.canvas.width);
        const h = Math.max(1, img.height || asset?.height || project.canvas.height);
        const surface = createCanvas(w, h);
        const ctx = surface.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        staticImages.set(assetId, { image: surface, width: w, height: h });
      } catch {
        // Fallback to stub if image fails to decode
      }
      continue;
    }

    // Video asset: decode frames via ffmpeg into RGBA buffers
    const targetW = Math.min(640, Math.max(64, asset?.width ?? 640));
    const targetH = Math.min(360, Math.max(64, asset?.height ?? 360));
    const sampleFps = Math.min(30, Math.max(5, project.canvas.fps || 15));
    const frameBytes = targetW * targetH * 4;

    const res = spawnSync(
      ffmpegBin,
      [
        "-v",
        "error",
        "-i",
        filePath,
        "-vf",
        `scale=${targetW}:${targetH}`,
        "-r",
        String(sampleFps),
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "pipe:1",
      ],
      { maxBuffer: 256 * 1024 * 1024 },
    );

    if (res.status === 0 && res.stdout && res.stdout.byteLength >= frameBytes) {
      const totalDecoded = Math.floor(res.stdout.byteLength / frameBytes);
      const frames: Uint8ClampedArray[] = [];
      for (let i = 0; i < totalDecoded; i++) {
        const start = i * frameBytes;
        const slice = res.stdout.subarray(start, start + frameBytes);
        frames.push(new Uint8ClampedArray(slice));
      }
      if (frames.length > 0) {
        const surface = createCanvas(targetW, targetH);
        const ctx = surface.getContext("2d");
        decodedVideos.set(assetId, {
          width: targetW,
          height: targetH,
          fps: sampleFps,
          frames,
          surface,
          ctx,
        });
      }
    }
  }

  return {
    getFrame(assetId: string, sourceTimeUs: number, clipId: string): FrameData | null {
      const img = staticImages.get(assetId);
      if (img) return img;

      const vid = decodedVideos.get(assetId);
      if (vid && vid.frames.length > 0) {
        const rawIdx = Math.max(0, Math.floor((Math.max(0, sourceTimeUs) / US_PER_SEC) * vid.fps));
        const idx = rawIdx % vid.frames.length;
        const rgba = vid.frames[idx]!;
        const imgData = new ImageData(rgba, vid.width, vid.height);
        vid.ctx.putImageData(imgData as unknown as globalThis.ImageData, 0, 0);
        return { image: vid.surface, width: vid.width, height: vid.height };
      }

      return stub.getFrame(assetId, sourceTimeUs, clipId);
    },
  };
}

/**
 * Render a `Project` frame-by-frame using the shared `renderFrame` + `Canvas2DRenderer`
 * code path (Rule 5: one render code path) and pipe raw RGBA frames into a spawned
 * `ffmpeg` child process to produce an H.264 MP4 file (with optional AAC audio muxing).
 */
export async function exportProjectToMp4(
  project: Project,
  opts: ExportOptions,
): Promise<ExportResult> {
  const { width, height, fps } = project.canvas;
  const durationUs = projectDurationUs(project);
  const totalFrames = Math.max(1, Math.round((durationUs / US_PER_SEC) * fps));
  const ffmpegBin = opts.ffmpegBin ?? resolveFfmpegBin();

  const resolvedOut = path.resolve(opts.outputPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  let tempWavPath: string | null = null;
  let audioInputPath: string | null = opts.audioWavPath ?? null;
  if (!audioInputPath && opts.audioWavBytes && opts.audioWavBytes.byteLength > 44) {
    tempWavPath = `${resolvedOut}.${Date.now()}.tmp.wav`;
    fs.writeFileSync(tempWavPath, opts.audioWavBytes);
    audioInputPath = tempWavPath;
  }

  const provider =
    opts.frameProvider ??
    (opts.assetFiles && Object.keys(opts.assetFiles).length > 0
      ? await createDiskAssetFrameProvider(project, opts.assetFiles, ffmpegBin)
      : createStubFrameProvider(createHeadlessSurface, { width, height }));

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
  ];

  if (audioInputPath) {
    ffmpegArgs.push("-i", audioInputPath);
  }

  ffmpegArgs.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "14",
    "-preset",
    "ultrafast",
  );

  if (audioInputPath) {
    ffmpegArgs.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  }

  ffmpegArgs.push("-movflags", "+faststart", resolvedOut);

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

  try {
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
  } finally {
    if (tempWavPath && fs.existsSync(tempWavPath)) {
      fs.unlinkSync(tempWavPath);
    }
  }

  return {
    outputPath: opts.outputPath,
    frames: totalFrames,
    durationUs,
    width,
    height,
    fps,
    hasAudio: Boolean(audioInputPath),
  };
}
