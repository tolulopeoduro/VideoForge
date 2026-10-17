import type { Project } from "@vf/schema";
import { renderFrame, type DrawImageParams, type DrawTextParams, type Renderer } from "./render";

/**
 * Minimal subset of CanvasRenderingContext2D shared by browser HTMLCanvasElement
 * and headless @napi-rs/canvas SKRSContext2D.
 */
export interface Canvas2DContextLike {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  clip(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(
    image: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: "left" | "right" | "center" | "start" | "end";
  textBaseline: "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";
}

export interface CanvasSurfaceLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): Canvas2DContextLike | null;
}

export interface FrameData {
  /** Underlying CanvasImageSource / @napi-rs/canvas Canvas */
  image: unknown;
  width: number;
  height: number;
}

/**
 * Interface for resolving a media asset frame at `sourceTimeUs` (`source.in + (t - clip.start) * speed`).
 */
export interface AssetFrameProvider {
  getFrame(assetId: string, sourceTimeUs: number, clipId: string): FrameData | null;
}

/**
 * Compute destination width/height for a cropped source (sw, sh) inside (canvasWidth, canvasHeight).
 */
export function computeFitDimensions(
  sw: number,
  sh: number,
  canvasWidth: number,
  canvasHeight: number,
  fit: "cover" | "contain" | "stretch",
): { dw: number; dh: number } {
  if (fit === "stretch") {
    return { dw: canvasWidth, dh: canvasHeight };
  }
  const scaleX = canvasWidth / Math.max(1, sw);
  const scaleY = canvasHeight / Math.max(1, sh);
  const s = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  return { dw: sw * s, dh: sh * s };
}

/**
 * Canvas2D backend implementing `Renderer`.
 * Used by both browser preview and headless tests/export.
 */
export class Canvas2DRenderer implements Renderer {
  constructor(
    private readonly ctx: Canvas2DContextLike,
    private readonly frameProvider: AssetFrameProvider,
  ) {}

  clear(width: number, height: number, bg: string): void {
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  drawImage(params: DrawImageParams): void {
    const { assetId, clipId, sourceTimeUs, canvasWidth, canvasHeight, transform } = params;
    const frame = this.frameProvider.getFrame(assetId, sourceTimeUs, clipId);
    if (!frame) return;

    const cropL = Math.max(0, Math.min(1, transform.crop?.l ?? 0));
    const cropT = Math.max(0, Math.min(1, transform.crop?.t ?? 0));
    const cropR = Math.max(0, Math.min(1, transform.crop?.r ?? 0));
    const cropB = Math.max(0, Math.min(1, transform.crop?.b ?? 0));

    const sx = frame.width * cropL;
    const sy = frame.height * cropT;
    const sw = Math.max(1, frame.width * Math.max(0.01, 1 - cropL - cropR));
    const sh = Math.max(1, frame.height * Math.max(0.01, 1 - cropT - cropB));

    const { dw, dh } = computeFitDimensions(sw, sh, canvasWidth, canvasHeight, transform.fit);

    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
    this.ctx.translate(transform.x * canvasWidth, transform.y * canvasHeight);
    if (transform.rotation !== 0) {
      this.ctx.rotate((transform.rotation * Math.PI) / 180);
    }
    this.ctx.scale(transform.scale, transform.scale);

    if (transform.fit === "cover") {
      this.ctx.beginPath();
      this.ctx.rect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
      this.ctx.clip();
    }

    this.ctx.drawImage(frame.image, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    this.ctx.restore();
  }

  drawText(params: DrawTextParams): void {
    const { text, fontFamily, fontSize, color, align, canvasWidth, canvasHeight, transform } = params;
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
    this.ctx.translate(transform.x * canvasWidth, transform.y * canvasHeight);
    if (transform.rotation !== 0) {
      this.ctx.rotate((transform.rotation * Math.PI) / 180);
    }
    this.ctx.scale(transform.scale, transform.scale);
    this.ctx.font = `bold ${fontSize}px ${fontFamily}`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, 0, 0);
    this.ctx.restore();
  }
}

const PALETTE: Record<string, { bg: string; accent: string; bar: string }> = {
  a1: { bg: "#1e3a8a", accent: "#38bdf8", bar: "#facc15" },
  a2: { bg: "#065f46", accent: "#34d399", bar: "#fb923c" },
  a3: { bg: "#581c87", accent: "#c084fc", bar: "#f472b6" },
  stock_office: { bg: "#1e3a8a", accent: "#60a5fa", bar: "#fbbf24" },
  stock_chart: { bg: "#064e3b", accent: "#10b981", bar: "#34d399" },
  stock_code: { bg: "#0f172a", accent: "#38bdf8", bar: "#a855f7" },
  stock_cloud: { bg: "#312e81", accent: "#818cf8", bar: "#22d3ee" },
  stock_nature: { bg: "#14532d", accent: "#4ade80", bar: "#fde047" },
  stock_city: { bg: "#3b0764", accent: "#e879f9", bar: "#fb7185" },
  stock_medical: { bg: "#0c4a6e", accent: "#38bdf8", bar: "#f43f5e" },
  stock_customer: { bg: "#7c2d12", accent: "#fb923c", bar: "#fef08a" },
  stock_logistics: { bg: "#1e293b", accent: "#94a3b8", bar: "#f97316" },
  stock_launch: { bg: "#4c1d95", accent: "#a78bfa", bar: "#f43f5e" },
};

function hashPalette(id: string): { bg: string; accent: string; bar: string } {
  if (PALETTE[id]) return PALETTE[id]!;
  const keys = Object.keys(PALETTE);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % keys.length;
  return PALETTE[keys[idx]!]!;
}

/**
 * Deterministic stub AssetFrameProvider that synthesizes a visual frame for `(assetId, sourceTimeUs)`.
 * Works identically in headless tests (@napi-rs/canvas) and browser preview (HTMLCanvasElement).
 */
export function createStubFrameProvider(
  createSurface: (width: number, height: number) => CanvasSurfaceLike,
  defaultSize: { width?: number; height?: number } = {},
): AssetFrameProvider {
  const width = defaultSize.width ?? 320;
  const height = defaultSize.height ?? 180;

  return {
    getFrame(assetId: string, sourceTimeUs: number): FrameData {
      const surface = createSurface(width, height);
      const ctx = surface.getContext("2d");
      if (!ctx) throw new Error("Failed to get 2d context for stub frame");

      const colors = hashPalette(assetId);

      // Solid background
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      // Deterministic border and corner quadrants so crop & fit modes are clearly distinguishable
      const border = 12;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(0, 0, width, border);
      ctx.fillRect(0, height - border, width, border);
      ctx.fillRect(0, 0, border, height);
      ctx.fillRect(width - border, 0, border, height);

      // Corner markers (top-left, bottom-right)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(border, border, 28, 28);
      ctx.fillStyle = colors.bar;
      ctx.fillRect(width - border - 28, height - border - 28, 28, 28);

      // Time-dependent horizontal indicator bar: moves smoothly across the frame with sourceTimeUs
      const cycleUs = 4_000_000; // 4s period
      const norm = (((sourceTimeUs % cycleUs) + cycleUs) % cycleUs) / cycleUs;
      const innerW = width - border * 4;
      const markerW = 48;
      const markerX = Math.round(border * 2 + norm * (innerW - markerW));
      const markerY = Math.round(height / 2 - 24);

      ctx.fillStyle = colors.bar;
      ctx.fillRect(markerX, markerY, markerW, 48);

      // Progress track bar near bottom
      const progressW = Math.round(norm * innerW);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(border * 2, height - border * 3, progressW, 10);

      return { image: surface, width, height };
    },
  };
}

/**
 * Convenience helper used by both browser preview and parity tests to render a project frame
 * onto a 2D canvas context.
 */
export function renderProjectToCanvas2D(
  project: Project,
  tUs: number,
  ctx: Canvas2DContextLike,
  createSurface: (width: number, height: number) => CanvasSurfaceLike,
): void {
  const provider = createStubFrameProvider(createSurface, {
    width: project.canvas.width,
    height: project.canvas.height,
  });
  const renderer = new Canvas2DRenderer(ctx, provider);
  renderFrame(project, tUs, renderer);
}
