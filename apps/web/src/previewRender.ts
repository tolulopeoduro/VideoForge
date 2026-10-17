import { renderProjectToCanvas2D, type Canvas2DContextLike, type CanvasSurfaceLike } from "@vf/render";
import type { Project } from "@vf/schema";
import { createBrowserAssetFrameProvider } from "./mediaCache";

/**
 * Shared browser preview render entry point. Calls `@vf/render`'s `renderProjectToCanvas2D`
 * (which invokes `renderFrame` with `Canvas2DRenderer`) using `createBrowserAssetFrameProvider`
 * so uploaded real video/image assets render decoded frames and synthetic stock IDs use the
 * deterministic stub provider.
 */
export function renderPreviewFrame(
  project: Project,
  tUs: number,
  ctx: Canvas2DContextLike,
  createSurface: (width: number, height: number) => CanvasSurfaceLike = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c as unknown as CanvasSurfaceLike;
  },
): void {
  const provider = createBrowserAssetFrameProvider(project, createSurface);
  renderProjectToCanvas2D(project, tUs, ctx, createSurface, provider);
}
