import {
  createStubFrameProvider,
  type AssetFrameProvider,
  type CanvasSurfaceLike,
  type FrameData,
} from "@vf/render";
import { regenerableClips, secToUs, US_PER_SEC, type Asset, type Op, type Project } from "@vf/schema";
import {
  registerLiveStockCatalogSpec,
  registerUploadedCatalogSpec,
  tokenizeText,
  type StockMediaMode,
} from "./generator";

export interface LoadedMediaEntry {
  assetId: string;
  title: string;
  kind: "video" | "image";
  width: number;
  height: number;
  durationUs: number;
  sampleFps: number;
  imageSource?: CanvasImageSource;
  frames?: HTMLCanvasElement[];
  thumbnailUrl?: string;
}

interface ServerStockCandidate {
  assetId: string;
  title: string;
  caption: string;
  tags: string[];
  mood: string;
  kind: "video" | "image";
  durationUs: number;
  width: number;
  height: number;
  uri: string;
  previewThumbUrl?: string;
  license: {
    provider: "pixabay" | "wikimedia";
    providerId: string;
    terms: string;
    attribution?: string;
  };
}

const mediaMap = new Map<string, LoadedMediaEntry>();
const hydratingIds = new Set<string>();
const listeners = new Set<() => void>();

export function onMediaCacheUpdated(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyMediaListeners(): void {
  for (const fn of listeners) fn();
}

export function getLoadedMediaEntries(): LoadedMediaEntry[] {
  return Array.from(mediaMap.values());
}

export function getLoadedMediaEntry(assetId: string): LoadedMediaEntry | undefined {
  return mediaMap.get(assetId);
}

async function decodeImageBlob(assetId: string, title: string, blob: Blob): Promise<LoadedMediaEntry> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to decode image ${title}`));
      img.src = url;
    });
    const width = Math.max(1, img.naturalWidth || 1280);
    const height = Math.max(1, img.naturalHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0, width, height);

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 160;
    thumbCanvas.height = 90;
    thumbCanvas.getContext("2d")?.drawImage(img, 0, 0, 160, 90);

    return {
      assetId,
      title,
      kind: "image",
      width,
      height,
      durationUs: secToUs(30),
      sampleFps: 1,
      imageSource: canvas,
      thumbnailUrl: thumbCanvas.toDataURL("image/jpeg", 0.75),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeVideoBlob(assetId: string, title: string, blob: Blob): Promise<LoadedMediaEntry> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error(`Failed to load video metadata for ${title}`));
    });

    const durationSec =
      Number.isFinite(video.duration) && video.duration > 0 ? Math.min(12, video.duration) : 5;
    const durationUs = Math.max(secToUs(30), Math.round(durationSec * US_PER_SEC));
    const rawW = video.videoWidth || 960;
    const rawH = video.videoHeight || 540;
    const scale = Math.min(1, 640 / Math.max(1, rawW));
    const width = Math.max(64, Math.round(rawW * scale));
    const height = Math.max(36, Math.round(rawH * scale));

    const sampleFps = 10;
    const totalFrames = Math.min(90, Math.max(1, Math.ceil(durationSec * sampleFps)));
    const frames: HTMLCanvasElement[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const targetTime = Math.min(Math.max(0, durationSec - 0.01), i / sampleFps);
      video.currentTime = targetTime;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
      });
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      ctx?.drawImage(video, 0, 0, width, height);
      frames.push(c);
    }

    const thumbnailUrl = frames[0]?.toDataURL("image/jpeg", 0.75);
    return {
      assetId,
      title,
      kind: "video",
      width,
      height,
      durationUs,
      sampleFps,
      frames,
      thumbnailUrl,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Fetches `/api/assets/:id/file` (which downloads from Pixabay/Wikimedia on-demand if needed)
 * and decodes its frames into `mediaMap` for the browser preview.
 */
export async function hydrateAssetById(
  assetId: string,
  kind: "video" | "image",
  title = assetId,
): Promise<LoadedMediaEntry | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (mediaMap.has(assetId)) return mediaMap.get(assetId)!;
  if (hydratingIds.has(assetId)) return null;

  hydratingIds.add(assetId);
  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/file`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const entry =
      kind === "image"
        ? await decodeImageBlob(assetId, title, blob)
        : await decodeVideoBlob(assetId, title, blob);
    mediaMap.set(assetId, entry);
    notifyMediaListeners();
    return entry;
  } catch {
    return null;
  } finally {
    hydratingIds.delete(assetId);
  }
}

/**
 * Queries `/api/stock/search` (Pixabay Videos & Photos + Wikimedia Commons) for each scene's
 * intent keywords, registers the candidates in the matcher catalog, decodes the top match
 * per scene, and returns an atomic `batch` op (`actor: "ai"`) that replaces regenerable
 * scene clips with real stock videos/photos.
 */
export async function fetchLiveStockForProject(
  project: Project,
  mediaMode: StockMediaMode,
  onStatus?: (msg: string) => void,
): Promise<Op | null> {
  if (mediaMode === "synthetic_seed" || typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  const ops: Op[] = [];
  const usedIds = new Set<string>();
  const assetsToHydrate: Array<{ assetId: string; kind: "video" | "image"; title: string }> = [];

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i]!;
    const query = scene.intent.keywords.slice(0, 3).join(" ") || scene.narration.slice(0, 32);
    const fallbackQuery = scene.intent.keywords[0] || "business";
    onStatus?.(`Fetching stock media (${mediaMode.replace(/_/g, " ")}) for Scene ${i + 1}: "${query}"...`);

    try {
      const resp = await fetch("/api/stock/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          fallbackQuery,
          mood: scene.intent.mood ?? "energetic",
          mediaMode,
          cacheTopN: 2,
        }),
      });
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        hasPixabayKey?: boolean;
        candidates?: ServerStockCandidate[];
      };
      const candidates = data.candidates ?? [];
      if (candidates.length === 0) continue;

      for (const c of candidates) {
        registerLiveStockCatalogSpec({
          assetId: c.assetId,
          title: c.title,
          caption: c.caption,
          tags: c.tags,
          mood: c.mood,
          durationUs: c.durationUs,
          kind: c.kind,
          width: c.width,
          height: c.height,
          uri: c.uri,
          previewThumbUrl: c.previewThumbUrl,
          provider: c.license.provider,
          license: c.license,
          isLiveStock: true,
        });
      }

      const chosen = candidates.find((c) => !usedIds.has(c.assetId)) ?? candidates[0]!;
      usedIds.add(chosen.assetId);

      // Register top candidates in project.assets so switching candidates in Inspector works immediately
      for (const cand of candidates.slice(0, 6)) {
        const assetObj: Asset = {
          id: cand.assetId,
          type: cand.kind,
          uri: cand.uri,
          durationUs: cand.durationUs,
          width: cand.width,
          height: cand.height,
          fps: cand.kind === "video" ? 30 : undefined,
          origin: "stock",
          license: cand.license,
        };
        ops.push({ type: "setProp", path: ["assets", cand.assetId], value: assetObj });
      }

      // Only overwrite clips in this scene where `canOverwrite` is true (via regenerableClips)
      const targetClips = regenerableClips(project, scene.id).filter((c) => c.kind === "media");
      for (const clip of targetClips) {
        ops.push({
          type: "replaceMedia",
          clipId: clip.id,
          assetId: chosen.assetId,
          in: 0,
        });
      }

      assetsToHydrate.push({
        assetId: chosen.assetId,
        kind: chosen.kind,
        title: chosen.title,
      });
    } catch {
      // Continue with remaining scenes if one query fails
    }
  }

  // Decode the chosen video/photo frames in parallel for the Canvas2D preview
  if (assetsToHydrate.length > 0) {
    onStatus?.(`Decoding ${assetsToHydrate.length} stock video/photo clip(s) for preview...`);
    await Promise.all(assetsToHydrate.map((a) => hydrateAssetById(a.assetId, a.kind, a.title)));
  }

  if (ops.length === 0) return null;
  return {
    type: "batch",
    label: `Apply live stock media (${mediaMode})`,
    ops,
  };
}

/**
 * Uploads a local video or image `File` to `/api/assets/upload` (persisting it on disk for
 * server-side MP4 export and page reloads), decodes its frames into the browser `AssetFrameProvider`,
 * and returns a schema-compliant `Asset` ready to insert or replace on the timeline.
 */
export async function uploadAndDecodeMediaFile(file: File): Promise<{
  asset: Asset;
  entry: LoadedMediaEntry;
}> {
  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  const kind: "video" | "image" = isImage ? "image" : "video";
  const cleanBase =
    file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 24) || "media";
  const assetId = `upload_${cleanBase.toLowerCase()}_${Date.now().toString(36).slice(-4)}`;
  const extMatch = file.name.match(/\.[a-zA-Z0-9]+$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : isImage ? ".png" : ".mp4";

  const entry = isImage
    ? await decodeImageBlob(assetId, file.name, file)
    : await decodeVideoBlob(assetId, file.name, file);

  mediaMap.set(assetId, entry);

  try {
    const buf = await file.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(buf);
    await fetch("/api/assets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        fileName: `${assetId}${ext}`,
        mimeType: file.type || (isImage ? "image/png" : "video/mp4"),
        dataBase64,
      }),
    });
  } catch {
    // Non-fatal in offline/test mode
  }

  const asset: Asset = {
    id: assetId,
    type: kind,
    uri: `s3://vf/uploads/${assetId}${ext}`,
    durationUs: entry.durationUs,
    width: entry.width,
    height: entry.height,
    fps: kind === "video" ? 30 : undefined,
    origin: "upload",
  };

  const tags = tokenizeText(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  registerUploadedCatalogSpec({
    assetId,
    title: file.name,
    caption: `user uploaded ${kind} ${file.name} ${tags.join(" ")}`,
    tags: tags.length > 0 ? tags : ["upload", "custom", kind],
    mood: "energetic",
    durationUs: entry.durationUs,
  });

  notifyMediaListeners();
  return { asset, entry };
}

/**
 * Re-hydrates any uploaded assets (`origin === "upload"`) or active fetched stock assets
 * (`pxv_*`, `pxi_*`, `wiki_*`) from `/api/assets/:id/file` after a page reload.
 */
export async function hydrateProjectUploadedAssets(project: Project): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const activeAssetIds = new Set(
    Object.values(project.clips)
      .map((c) => c.source?.assetId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const asset of Object.values(project.assets)) {
    const isLiveStock =
      asset.id.startsWith("pxv_") ||
      asset.id.startsWith("pxi_") ||
      asset.id.startsWith("wiki_") ||
      asset.uri.startsWith("s3://vf/stock/");
    const shouldHydrate = asset.origin === "upload" || (isLiveStock && activeAssetIds.has(asset.id));
    if (!shouldHydrate) continue;
    if (mediaMap.has(asset.id) || hydratingIds.has(asset.id)) continue;

    const kind: "video" | "image" = asset.type === "image" ? "image" : "video";
    const title = asset.uri.split("/").pop() ?? asset.id;
    const entry = await hydrateAssetById(asset.id, kind, title);
    if (entry && asset.origin === "upload") {
      const tags = tokenizeText(title.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      registerUploadedCatalogSpec({
        assetId: asset.id,
        title,
        caption: `user uploaded ${asset.type} ${title} ${tags.join(" ")}`,
        tags: tags.length > 0 ? tags : ["upload", "custom", asset.type],
        mood: "energetic",
        durationUs: asset.durationUs ?? entry.durationUs,
      });
    }
  }
}

/**
 * Browser `AssetFrameProvider` that serves real decoded frames for uploaded and fetched stock
 * video/image assets and delegates to `createStubFrameProvider` for synthetic stock IDs.
 */
export function createBrowserAssetFrameProvider(
  project: Project,
  createSurface: (width: number, height: number) => CanvasSurfaceLike,
): AssetFrameProvider {
  const stub = createStubFrameProvider(createSurface, {
    width: project.canvas.width,
    height: project.canvas.height,
  });

  return {
    getFrame(assetId: string, sourceTimeUs: number, clipId: string): FrameData | null {
      const entry = mediaMap.get(assetId);
      if (entry) {
        if (entry.kind === "image" && entry.imageSource) {
          return {
            image: entry.imageSource,
            width: entry.width,
            height: entry.height,
          };
        }
        if (entry.kind === "video" && entry.frames && entry.frames.length > 0) {
          const rawIdx = Math.max(0, Math.floor((Math.max(0, sourceTimeUs) / US_PER_SEC) * entry.sampleFps));
          const idx = rawIdx % entry.frames.length;
          const frameCanvas = entry.frames[idx]!;
          return {
            image: frameCanvas,
            width: entry.width,
            height: entry.height,
          };
        }
      }
      return stub.getFrame(assetId, sourceTimeUs, clipId);
    },
  };
}
