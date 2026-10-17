import { renderProjectToCanvas2D, type Canvas2DContextLike, type CanvasSurfaceLike } from "@vf/render";
import type { Project } from "@vf/schema";
import { createBrowserAssetFrameProvider } from "./mediaCache";

let cachedScratchCanvas: HTMLCanvasElement | null = null;

function getReusableSurface(width: number, height: number): CanvasSurfaceLike {
  if (typeof document === "undefined") {
    throw new Error("getReusableSurface requires a browser document");
  }
  if (!cachedScratchCanvas) {
    cachedScratchCanvas = document.createElement("canvas");
  }
  if (cachedScratchCanvas.width !== width) cachedScratchCanvas.width = width;
  if (cachedScratchCanvas.height !== height) cachedScratchCanvas.height = height;
  return cachedScratchCanvas as unknown as CanvasSurfaceLike;
}

/**
 * Shared browser preview render entry point. Calls `@vf/render`'s `renderProjectToCanvas2D`
 * (which invokes `renderFrame` with `Canvas2DRenderer`) using `createBrowserAssetFrameProvider`
 * so uploaded and stock assets render lightweight preview frames and synthetic stock IDs use the
 * deterministic stub provider without per-frame DOM allocations.
 */
export function renderPreviewFrame(
  project: Project,
  tUs: number,
  ctx: Canvas2DContextLike,
  createSurface: (width: number, height: number) => CanvasSurfaceLike = getReusableSurface,
): void {
  const provider = createBrowserAssetFrameProvider(project, createSurface);
  renderProjectToCanvas2D(project, tUs, ctx, createSurface, provider);
}
