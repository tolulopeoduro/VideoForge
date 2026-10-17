import { renderProjectToCanvas2D, type Canvas2DContextLike, type CanvasSurfaceLike } from "@vf/render";
import type { Project } from "@vf/schema";

/**
 * Shared browser preview render entry point. Calls `@vf/render`'s `renderProjectToCanvas2D`
 * (which invokes `renderFrame` with `Canvas2DRenderer`) so preview and headless export
 * share the exact same render path.
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
  renderProjectToCanvas2D(project, tUs, ctx, createSurface);
}
