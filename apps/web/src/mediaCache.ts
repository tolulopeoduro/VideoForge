import {
  createStubFrameProvider,
  type AssetFrameProvider,
  type CanvasSurfaceLike,
  type FrameData,
} from "@vf/render";
import { regenerableClips, secToUs, US_PER_SEC, type Asset, type Op, type Project } from "@vf/schema";
import {
  buildSearchQueriesForIntent,
  extractSceneIntent,
  getAllCatalogSpecs,
  rankShotsForIntent,
  registerLiveStockCatalogSpec,
  registerUploadedCatalogSpec,
  tokenizeText,
  type StockMediaMode,
  type StockShotSpec,
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
  videoElement?: HTMLVideoElement;
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
  qualityScore?: number;
  license: {
    provider: "pixabay" | "wikimedia";
    providerId: string;
    terms: string;
    attribution?: string;
  };
}

const mediaMap = new Map<string, LoadedMediaEntry>();
const hydratingIds = new Set<string>();
const syntheticThumbCache = new Map<string, string>();
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

/**
 * Resolves a lightweight thumbnail URL for any stock, uploaded, or procedural asset ID
 * so Timeline clips and Stock Candidate cards can always display a visual reference image.
 */
export function resolveAssetThumbnailUrl(assetId?: string, explicitThumbUrl?: string): string | undefined {
  if (!assetId) return undefined;
  const loaded = mediaMap.get(assetId);
  if (loaded?.thumbnailUrl) return loaded.thumbnailUrl;
  if (explicitThumbUrl) return explicitThumbUrl;

  const spec = getAllCatalogSpecs().find((s) => s.assetId === assetId);
  if (spec?.previewThumbUrl) return spec.previewThumbUrl;

  if (
    assetId.startsWith("pxv_") ||
    assetId.startsWith("pxi_") ||
    assetId.startsWith("wiki_")
  ) {
    return `/api/assets/${encodeURIComponent(assetId)}/thumb`;
  }

  if (typeof document !== "undefined") {
    const cachedSynthetic = syntheticThumbCache.get(assetId);
    if (cachedSynthetic) return cachedSynthetic;
    try {
      const stub = createStubFrameProvider(
        (w, h) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c as unknown as CanvasSurfaceLike;
        },
        { width: 160, height: 90 },
      );
      const frame = stub.getFrame(assetId, 500_000, `thumb_${assetId}`);
      if (frame && frame.image && typeof (frame.image as HTMLCanvasElement).toDataURL === "function") {
        const dataUrl = (frame.image as HTMLCanvasElement).toDataURL("image/jpeg", 0.72);
        syntheticThumbCache.set(assetId, dataUrl);
        return dataUrl;
      }
    } catch {
      // Ignore in headless/non-canvas environments
    }
  }
  return undefined;
}

async function decodeImageBlobToPreview(
  assetId: string,
  title: string,
  blob: Blob,
  kind: "video" | "image" = "image",
): Promise<LoadedMediaEntry> {
  // Decode at preview resolution (max 640px wide) off the main thread via createImageBitmap when available
  if (typeof createImageBitmap === "function") {
    try {
      const rawBitmap = await createImageBitmap(blob);
      const rawW = Math.max(1, rawBitmap.width || 640);
      const rawH = Math.max(1, rawBitmap.height || 360);
      const scale = Math.min(1, 640 / rawW);
      const width = Math.max(64, Math.round(rawW * scale));
      const height = Math.max(36, Math.round(rawH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(rawBitmap, 0, 0, width, height);

      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 160;
      thumbCanvas.height = 90;
      thumbCanvas.getContext("2d")?.drawImage(rawBitmap, 0, 0, 160, 90);
      rawBitmap.close();

      return {
        assetId,
        title,
        kind,
        width,
        height,
        durationUs: secToUs(30),
        sampleFps: 1,
        imageSource: canvas,
        thumbnailUrl: thumbCanvas.toDataURL("image/jpeg", 0.7),
      };
    } catch {
      // Fall back to HTMLImageElement below
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to decode image ${title}`));
      img.src = url;
    });
    const rawW = Math.max(1, img.naturalWidth || 640);
    const rawH = Math.max(1, img.naturalHeight || 360);
    const scale = Math.min(1, 640 / rawW);
    const width = Math.max(64, Math.round(rawW * scale));
    const height = Math.max(36, Math.round(rawH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);

    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 160;
    thumbCanvas.height = 90;
    thumbCanvas.getContext("2d")?.drawImage(img, 0, 0, 160, 90);

    return {
      assetId,
      title,
      kind,
      width,
      height,
      durationUs: secToUs(30),
      sampleFps: 1,
      imageSource: canvas,
      thumbnailUrl: thumbCanvas.toDataURL("image/jpeg", 0.7),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeVideoBlob(
  assetId: string,
  title: string,
  blob: Blob,
  onProgress?: (partial: LoadedMediaEntry) => void,
  existingThumbUrl?: string,
): Promise<LoadedMediaEntry> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout loading video metadata for ${title}`)), 12000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to load video metadata for ${title}`));
      };
    });

    const rawDurationSec =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;
    const decodeDurationSec = Math.min(6, rawDurationSec);
    const durationUs = Math.max(secToUs(30), Math.round(rawDurationSec * US_PER_SEC));
    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 360;
    const scale = Math.min(1, 480 / Math.max(1, rawW));
    const width = Math.max(64, Math.round(rawW * scale));
    const height = Math.max(36, Math.round(rawH * scale));

    // Smooth 6fps proxy keyframe strip (up to 36 frames = 6s) with main-thread yielding between seeks
    const sampleFps = 6;
    const totalFrames = Math.min(36, Math.max(1, Math.ceil(decodeDurationSec * sampleFps)));
    const frames: HTMLCanvasElement[] = [];
    let thumbnailUrl = existingThumbUrl;

    for (let i = 0; i < totalFrames; i++) {
      // Yield to browser UI thread before each seek so the page never hangs
      await new Promise<void>((r) => setTimeout(r, 0));
      const targetTime = Math.min(Math.max(0, decodeDurationSec - 0.02), i / sampleFps);
      video.currentTime = targetTime;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        }, 1500);
        const onSeeked = () => {
          clearTimeout(timer);
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
      });
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d")?.drawImage(video, 0, 0, width, height);
      frames.push(c);

      if (i === 0 && !thumbnailUrl) {
        thumbnailUrl = c.toDataURL("image/jpeg", 0.72);
      }
      if (onProgress && (i === 0 || i === 5 || i === 15)) {
        onProgress({
          assetId,
          title,
          kind: "video",
          width,
          height,
          durationUs,
          sampleFps,
          imageSource: frames[0],
          frames: [...frames],
          thumbnailUrl,
        });
      }
    }

    return {
      assetId,
      title,
      kind: "video",
      width,
      height,
      durationUs,
      sampleFps,
      imageSource: frames[0],
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
 * Hydrates a low-resolution proxy image or 360p proxy video (`/api/assets/:id/proxy`) for smooth,
 * zero-hang editing in the browser preview. Full-resolution 720p/1080p videos and images are left
 * untouched until server-side `Export MP4` runs.
 */
export async function hydrateAssetById(
  assetId: string,
  kind: "video" | "image",
  title = assetId,
): Promise<LoadedMediaEntry | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const existing = mediaMap.get(assetId);
  if (existing && (kind === "image" || (existing.frames && existing.frames.length > 1))) {
    return existing;
  }
  if (hydratingIds.has(assetId)) return existing ?? null;

  hydratingIds.add(assetId);
  try {
    if (kind === "image") {
      // 1. Fetch low-resolution proxy image (340p/640p) for editing preview
      const proxyRes = await fetch(`/api/assets/${encodeURIComponent(assetId)}/proxy`);
      if (proxyRes.ok) {
        const proxyBlob = await proxyRes.blob();
        const entry = await decodeImageBlobToPreview(assetId, title, proxyBlob, "image");
        mediaMap.set(assetId, entry);
        notifyMediaListeners();
        return entry;
      }
      // 2. Fallback to thumbnail or full file
      const thumbRes = await fetch(`/api/assets/${encodeURIComponent(assetId)}/thumb`);
      if (thumbRes.ok) {
        const thumbBlob = await thumbRes.blob();
        const entry = await decodeImageBlobToPreview(assetId, title, thumbBlob, "image");
        mediaMap.set(assetId, entry);
        notifyMediaListeners();
        return entry;
      }
    } else {
      // 1. For stock video, immediately load lightweight thumbnail as instant poster frame
      let posterThumbUrl: string | undefined = existing?.thumbnailUrl;
      if (!existing) {
        try {
          const thumbRes = await fetch(`/api/assets/${encodeURIComponent(assetId)}/thumb`);
          if (thumbRes.ok) {
            const thumbBlob = await thumbRes.blob();
            const posterEntry = await decodeImageBlobToPreview(assetId, title, thumbBlob, "video");
            posterThumbUrl = posterEntry.thumbnailUrl;
            mediaMap.set(assetId, posterEntry);
            notifyMediaListeners();
          }
        } catch {
          // Proceed to proxy video fetch
        }
      }

      // 2. Fetch low-resolution 360p proxy video and decode smooth 6fps frame strip for zero-lag playback
      const proxyRes = await fetch(`/api/assets/${encodeURIComponent(assetId)}/proxy`);
      if (proxyRes.ok) {
        const proxyBlob = await proxyRes.blob();
        const decoded = await decodeVideoBlob(
          assetId,
          title,
          proxyBlob,
          (partial) => {
            mediaMap.set(assetId, partial);
            notifyMediaListeners();
          },
          posterThumbUrl,
        );
        mediaMap.set(assetId, decoded);
        notifyMediaListeners();
        return decoded;
      }
    }

    // Fallback for local user-uploaded assets or direct file endpoint
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/file`);
    if (!res.ok) return mediaMap.get(assetId) ?? null;
    const blob = await res.blob();
    const entry =
      kind === "image"
        ? await decodeImageBlobToPreview(assetId, title, blob, "image")
        : await decodeVideoBlob(assetId, title, blob, (partial) => {
            mediaMap.set(assetId, partial);
            notifyMediaListeners();
          });
    mediaMap.set(assetId, entry);
    notifyMediaListeners();
    return entry;
  } catch {
    return mediaMap.get(assetId) ?? null;
  } finally {
    hydratingIds.delete(assetId);
  }
}

/**
 * Queries `/api/stock/search` (Pixabay Videos & Photos + Wikimedia Commons) using a tiered
 * cascade of visual B-roll queries per scene, registers candidates in the matcher catalog,
 * ranks them with `rankShotsForIntent` (applying repeat and adjacency penalties across scenes),
 * and returns an atomic `batch` op (`actor: "ai"`) that replaces regenerable scene clips.
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

  // Fetch stock candidates for all scenes in parallel with cacheTopN: 0 (no full-res download during search)
  const sceneResults = await Promise.all(
    project.scenes.map(async (scene, i) => {
      const enrichedIntent = scene.intent.abstract
        ? scene.intent
        : extractSceneIntent(scene.narration, scene.intent.mood);
      const queries = buildSearchQueriesForIntent(enrichedIntent, scene.narration);
      const query = queries[0] || "business office";
      const fallbackQuery = queries[queries.length - 1] || "technology";
      onStatus?.(`Searching low-res stock proxies (${mediaMode.replace(/_/g, " ")}) for ${project.scenes.length} scenes...`);
      try {
        const resp = await fetch("/api/stock/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            queries,
            fallbackQuery,
            mood: enrichedIntent.mood ?? "energetic",
            mediaMode,
            cacheTopN: 0,
          }),
        });
        if (!resp.ok) return { scene, enrichedIntent, i, candidates: [] as ServerStockCandidate[] };
        const data = (await resp.json()) as {
          hasPixabayKey?: boolean;
          candidates?: ServerStockCandidate[];
        };
        return { scene, enrichedIntent, i, candidates: data.candidates ?? [] };
      } catch {
        return { scene, enrichedIntent, i, candidates: [] as ServerStockCandidate[] };
      }
    }),
  );

  // First register all returned candidates so cross-scene ranking has the full live pool
  for (const { candidates } of sceneResults) {
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
        qualityScore: c.qualityScore,
        provider: c.license.provider,
        license: c.license,
        isLiveStock: true,
      });
    }
  }
  notifyMediaListeners();

  const preferredKind: "video" | "image" | "any" =
    mediaMode === "videos_only"
      ? "video"
      : mediaMode === "photos_only" || mediaMode === "wikimedia_only"
        ? "image"
        : "video";

  let previousChosenSpec: StockShotSpec | undefined;

  for (const { scene, enrichedIntent, candidates } of sceneResults) {
    if (candidates.length === 0) continue;

    const targetClips = regenerableClips(project, scene.id).filter((c) => c.kind === "media");
    const neededDurationUs = targetClips[0]?.duration ?? secToUs(4);

    // Rank candidates with multi-signal scorer (semantic + lexical + RRF + quality + duration + mood - repeat - adjacency)
    const sceneCandidateIds = new Set(candidates.map((c) => c.assetId));
    const rankedAll = rankShotsForIntent(enrichedIntent, usedIds, {
      neededDurationUs,
      preferredKind,
      previousChosenSpec,
      onlyLiveStock: true,
    });
    const rankedSceneMatches = rankedAll.filter((r) => sceneCandidateIds.has(r.spec.assetId));
    const bestMatch = rankedSceneMatches[0] ?? rankedAll[0];

    const chosen =
      (bestMatch ? candidates.find((c) => c.assetId === bestMatch.spec.assetId) : undefined) ??
      candidates.find((c) => !usedIds.has(c.assetId)) ??
      candidates[0]!;
    const chosenScore = bestMatch?.score ?? 0.85;

    usedIds.add(chosen.assetId);
    if (bestMatch) {
      previousChosenSpec = bestMatch.spec;
    }

    // Register top ranked candidates in project.assets so switching candidates in Inspector works immediately
    const topSceneCandidates = [
      chosen,
      ...rankedSceneMatches
        .map((m) => candidates.find((c) => c.assetId === m.spec.assetId))
        .filter((c): c is ServerStockCandidate => Boolean(c && c.assetId !== chosen.assetId)),
      ...candidates.filter((c) => c.assetId !== chosen.assetId),
    ].slice(0, 8);

    const registeredAssetIds = new Set<string>();
    for (const cand of topSceneCandidates) {
      if (registeredAssetIds.has(cand.assetId)) continue;
      registeredAssetIds.add(cand.assetId);
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
    for (const clip of targetClips) {
      ops.push({
        type: "replaceMedia",
        clipId: clip.id,
        assetId: chosen.assetId,
        in: 0,
      });
      ops.push({
        type: "setProp",
        path: ["clips", clip.id, "provenance", "generator"],
        value: {
          step: "match",
          candidateSetId: scene.id,
          score: chosenScore,
        },
      });
    }

    assetsToHydrate.push({
      assetId: chosen.assetId,
      kind: chosen.kind,
      title: chosen.title,
    });
  }

  // Hydrate low-resolution proxy assets non-blockingly so the timeline op applies immediately
  if (assetsToHydrate.length > 0) {
    void Promise.all(assetsToHydrate.map((a) => hydrateAssetById(a.assetId, a.kind, a.title)));
  }

  if (ops.length === 0) return null;
  return {
    type: "batch",
    label: `Apply live stock media (${mediaMode})`,
    ops,
  };
}

/**
 * Fetches and registers live stock candidates (with thumbnails) for a single scene
 * so that when a user selects a clip on the timeline, the Clip & Stock panel can
 * immediately display visual stock thumbnails to reference and swap.
 */
export async function fetchLiveStockCandidatesForScene(
  scene: {
    id: string;
    narration: string;
    intent: {
      literal: string;
      keywords: string[];
      mood?: string;
      abstract?: string;
      avoid?: string[];
    };
  },
  mediaMode: StockMediaMode = "videos_and_photos",
): Promise<number> {
  if (mediaMode === "synthetic_seed" || typeof window === "undefined" || typeof fetch !== "function") {
    return 0;
  }
  const enrichedIntent = scene.intent.abstract
    ? scene.intent
    : extractSceneIntent(scene.narration, scene.intent.mood);
  const queries = buildSearchQueriesForIntent(enrichedIntent, scene.narration);
  const query = queries[0] || "business office";
  const fallbackQuery = queries[queries.length - 1] || "technology";

  try {
    const resp = await fetch("/api/stock/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        queries,
        fallbackQuery,
        mood: enrichedIntent.mood ?? "energetic",
        mediaMode,
        cacheTopN: 0,
      }),
    });
    if (!resp.ok) return 0;
    const data = (await resp.json()) as { candidates?: ServerStockCandidate[] };
    const candidates = data.candidates ?? [];
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
        qualityScore: c.qualityScore,
        provider: c.license.provider,
        license: c.license,
        isLiveStock: true,
      });
    }
    if (candidates.length > 0) {
      notifyMediaListeners();
    }
    return candidates.length;
  } catch {
    return 0;
  }
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
    ? await decodeImageBlobToPreview(assetId, file.name, file, "image")
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
 * Searches Pixabay/Wikimedia for a user-typed query directly from the Clip & Stock panel,
 * registers the returned candidates in the matcher catalog, and returns them as `StockShotSpec[]`.
 */
export async function searchCustomStockCandidates(
  customQuery: string,
  mediaMode: StockMediaMode = "videos_and_photos",
): Promise<StockShotSpec[]> {
  const cleaned = customQuery.trim();
  if (!cleaned || typeof window === "undefined" || typeof fetch !== "function") {
    return [];
  }
  const effectiveMode: StockMediaMode =
    mediaMode === "synthetic_seed" ? "videos_and_photos" : mediaMode;
  try {
    const resp = await fetch("/api/stock/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: cleaned,
        queries: [cleaned],
        fallbackQuery: cleaned.split(/\s+/)[0] || "business",
        mood: "energetic",
        mediaMode: effectiveMode,
        cacheTopN: 0,
      }),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { candidates?: ServerStockCandidate[] };
    const candidates = data.candidates ?? [];
    const specs: StockShotSpec[] = [];
    for (const c of candidates) {
      const spec: StockShotSpec = {
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
        qualityScore: c.qualityScore,
        provider: c.license.provider,
        license: c.license,
        isLiveStock: true,
      };
      registerLiveStockCatalogSpec(spec);
      specs.push(spec);
    }
    if (specs.length > 0) {
      notifyMediaListeners();
    }
    return specs;
  } catch {
    return [];
  }
}

/**
 * Re-hydrates any uploaded assets (`origin === "upload"`) or active fetched stock assets
 * (`pxv_*`, `pxi_*`, `wiki_*`) from `/api/assets/:id/proxy` (or `/file` for uploads) after a page reload.
 */
export async function hydrateProjectUploadedAssets(project: Project): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const activeAssetIds = new Set(
    Object.values(project.clips)
      .map((c) => c.source?.assetId)
      .filter((id): id is string => Boolean(id)),
  );

  const tasks: Array<Promise<void>> = [];

  for (const asset of Object.values(project.assets)) {
    const isLiveStock =
      asset.id.startsWith("pxv_") ||
      asset.id.startsWith("pxi_") ||
      asset.id.startsWith("wiki_") ||
      asset.uri.startsWith("s3://vf/stock/");

    if (isLiveStock) {
      const existingSpec = getAllCatalogSpecs().find((s) => s.assetId === asset.id);
      if (!existingSpec) {
        const rawTitle = asset.uri.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? asset.id;
        const tags = tokenizeText(rawTitle.replace(/[_-]+/g, " "));
        registerLiveStockCatalogSpec({
          assetId: asset.id,
          title: rawTitle,
          caption: `stock ${asset.type} ${rawTitle} ${tags.join(" ")}`,
          tags: tags.length > 0 ? tags : ["stock", asset.type === "image" ? "image" : "video"],
          mood: "energetic",
          durationUs: Math.max(secToUs(30), asset.durationUs ?? secToUs(30)),
          kind: asset.type === "image" ? "image" : "video",
          width: asset.width ?? 1280,
          height: asset.height ?? 720,
          uri: asset.uri,
          previewThumbUrl: `/api/assets/${encodeURIComponent(asset.id)}/thumb`,
          provider: asset.license?.provider === "wikimedia" ? "wikimedia" : "pixabay",
          license: asset.license
            ? {
                provider: asset.license.provider === "wikimedia" ? "wikimedia" : "pixabay",
                providerId: asset.license.providerId,
                terms: asset.license.terms,
                attribution: asset.license.attribution,
              }
            : undefined,
          isLiveStock: true,
        });
      }
    }

    const shouldHydrate = asset.origin === "upload" || (isLiveStock && activeAssetIds.has(asset.id));
    if (!shouldHydrate) continue;

    const kind: "video" | "image" = asset.type === "image" ? "image" : "video";
    const title = asset.uri.split("/").pop() ?? asset.id;

    tasks.push(
      (async () => {
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
      })(),
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

/**
 * Browser `AssetFrameProvider` that serves low-resolution 360p proxy video streams, low-res proxy images,
 * or decoded keyframe strips while editing, delegating to `createStubFrameProvider` for synthetic stock IDs.
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
        if (entry.frames && entry.frames.length > 0) {
          const rawIdx = Math.max(0, Math.floor((Math.max(0, sourceTimeUs) / US_PER_SEC) * entry.sampleFps));
          const idx = rawIdx % entry.frames.length;
          const frameCanvas = entry.frames[idx]!;
          return {
            image: frameCanvas,
            width: entry.width,
            height: entry.height,
          };
        }
        if (entry.imageSource) {
          // If this is a video entry that only has its poster thumbnail so far, kick off full proxy frame decode
          if (entry.kind === "video" && !hydratingIds.has(assetId)) {
            void hydrateAssetById(assetId, "video", entry.title);
          }
          return {
            image: entry.imageSource,
            width: entry.width,
            height: entry.height,
          };
        }
      } else if (!hydratingIds.has(assetId)) {
        const projAsset = project.assets[assetId];
        const isRealAsset =
          assetId.startsWith("pxv_") ||
          assetId.startsWith("pxi_") ||
          assetId.startsWith("wiki_") ||
          assetId.startsWith("upload_") ||
          projAsset?.origin === "upload" ||
          Boolean(projAsset?.uri?.startsWith("s3://vf/stock/"));
        if (isRealAsset) {
          const kind: "video" | "image" =
            assetId.startsWith("pxi_") || assetId.startsWith("wiki_") || projAsset?.type === "image"
              ? "image"
              : "video";
          void hydrateAssetById(assetId, kind, assetId);
        }
      }
      return stub.getFrame(assetId, sourceTimeUs, clipId);
    },
  };
}
