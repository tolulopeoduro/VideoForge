import { spawnSync } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

interface StoredAssetMeta {
  filePath: string;
  mimeType: string;
  fileName: string;
  remoteUrl?: string;
  proxyUrl?: string;
  proxyPath?: string;
  thumbUrl?: string;
  thumbPath?: string;
}

interface StoredEditEvent {
  id: string;
  projectId: string;
  sceneId?: string;
  event: "kept" | "replaced_candidate" | "replaced_upload" | "intent_edited";
  payload: Record<string, unknown>;
  createdAt: string;
}

interface StoredProjectEntry {
  version: number;
  doc: unknown;
  updatedAt: string;
}

interface DiskStoreData {
  projects: Record<string, StoredProjectEntry>;
  events: Record<string, StoredEditEvent[]>;
  assets: Record<string, StoredAssetMeta>;
}

export interface StockCandidateItem {
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

function getDataDir(rootDir: string): string {
  return path.resolve(rootDir, "../../.videoforge-data");
}

function readEnvKey(rootDir: string, keyName: string): string | null {
  const fromProc = process.env[keyName];
  if (fromProc && fromProc.trim().length > 0) return fromProc.trim();

  const candidates = [
    path.resolve(rootDir, "../../.env"),
    path.resolve(rootDir, ".env"),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const k = trimmed.slice(0, eqIdx).trim();
        if (k === keyName) {
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (val.length > 0) return val;
        }
      }
    } catch {
      // ignore read errors
    }
  }
  return null;
}

function readDiskStore(dataDir: string): DiskStoreData {
  const storePath = path.join(dataDir, "store.json");
  if (!fs.existsSync(storePath)) {
    return { projects: {}, events: {}, assets: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<DiskStoreData>;
    return {
      projects: raw.projects ?? {},
      events: raw.events ?? {},
      assets: raw.assets ?? {},
    };
  } catch {
    return { projects: {}, events: {}, assets: {} };
  }
}

function writeDiskStore(dataDir: string, store: DiskStoreData): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const storePath = path.join(dataDir, "store.json");
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const payload = Buffer.from(JSON.stringify(data), "utf8");
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", String(payload.byteLength));
  res.end(payload);
}

function normalizeAssetMeta(dataDir: string, assetId: string, meta: StoredAssetMeta): StoredAssetMeta {
  const ext = path.extname(meta.fileName || meta.filePath) || (meta.mimeType.startsWith("video/") ? ".mp4" : ".jpg");
  if (!meta.proxyPath) {
    meta.proxyPath = path.join(dataDir, "proxies", `${assetId}_proxy${ext}`);
  }
  if (!meta.thumbPath) {
    meta.thumbPath = path.join(dataDir, "thumbs", `${assetId}.jpg`);
  }
  if (!meta.proxyUrl && meta.remoteUrl) {
    meta.proxyUrl = meta.remoteUrl;
  }
  return meta;
}

async function recoverPixabayAssetMeta(
  dataDir: string,
  store: DiskStoreData,
  assetId: string,
  apiKey: string | null,
): Promise<StoredAssetMeta | undefined> {
  if (!apiKey) return store.assets[assetId];
  try {
    if (assetId.startsWith("pxv_")) {
      const id = assetId.slice(4);
      const resp = await fetch(
        `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(id)}`,
      );
      if (!resp.ok) return store.assets[assetId];
      const data = (await resp.json()) as {
        hits?: Array<{
          videos?: {
            tiny?: { url?: string; thumbnail?: string };
            small?: { url?: string; thumbnail?: string };
            medium?: { url?: string; thumbnail?: string };
            large?: { url?: string; thumbnail?: string };
          };
        }>;
      };
      const hit = data.hits?.[0];
      const proxyVar = hit?.videos?.tiny?.url ? hit.videos.tiny : hit?.videos?.small;
      const exportVar = hit?.videos?.medium?.url
        ? hit.videos.medium
        : hit?.videos?.large?.url
          ? hit.videos.large
          : proxyVar;
      if (proxyVar?.url && exportVar?.url) {
        const meta: StoredAssetMeta = {
          filePath: path.join(dataDir, "uploads", `${assetId}.mp4`),
          mimeType: "video/mp4",
          fileName: `${assetId}.mp4`,
          remoteUrl: exportVar.url,
          proxyUrl: proxyVar.url,
          proxyPath: path.join(dataDir, "proxies", `${assetId}_proxy.mp4`),
          thumbUrl: proxyVar.thumbnail || exportVar.thumbnail,
          thumbPath: path.join(dataDir, "thumbs", `${assetId}.jpg`),
        };
        store.assets[assetId] = meta;
        writeDiskStore(dataDir, store);
        return meta;
      }
    } else if (assetId.startsWith("pxi_")) {
      const id = assetId.slice(4);
      const resp = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(id)}`,
      );
      if (!resp.ok) return store.assets[assetId];
      const data = (await resp.json()) as {
        hits?: Array<{
          largeImageURL?: string;
          webformatURL?: string;
          previewURL?: string;
        }>;
      };
      const hit = data.hits?.[0];
      const exportUrl = hit?.largeImageURL || hit?.webformatURL;
      const proxyUrl = hit?.webformatURL ? hit.webformatURL.replace("_640.", "_340.") : exportUrl;
      if (exportUrl) {
        const meta: StoredAssetMeta = {
          filePath: path.join(dataDir, "uploads", `${assetId}.jpg`),
          mimeType: "image/jpeg",
          fileName: `${assetId}.jpg`,
          remoteUrl: exportUrl,
          proxyUrl: proxyUrl || exportUrl,
          proxyPath: path.join(dataDir, "proxies", `${assetId}_proxy.jpg`),
          thumbUrl: hit?.previewURL || proxyUrl || exportUrl,
          thumbPath: path.join(dataDir, "thumbs", `${assetId}.jpg`),
        };
        store.assets[assetId] = meta;
        writeDiskStore(dataDir, store);
        return meta;
      }
    }
  } catch {
    // ignore recovery network errors
  }
  return store.assets[assetId];
}

async function downloadUrlToFile(url: string, targetPath: string): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "VideoForgeStudio/1.0 (https://localhost; dev@videoforge.local)",
      },
    });
    if (!resp.ok) return false;
    const arr = await resp.arrayBuffer();
    if (arr.byteLength === 0) return false;
    fs.writeFileSync(targetPath, Buffer.from(arr));
    return true;
  } catch {
    return false;
  }
}

async function ensureAssetCachedOnDisk(
  meta: StoredAssetMeta,
  opts?: { dataDir: string; store: DiskStoreData; assetId: string; apiKey: string | null },
): Promise<boolean> {
  if (fs.existsSync(meta.filePath) && fs.statSync(meta.filePath).size > 0) {
    return true;
  }
  if (meta.remoteUrl && (await downloadUrlToFile(meta.remoteUrl, meta.filePath))) {
    return true;
  }
  if (opts) {
    const recovered = await recoverPixabayAssetMeta(opts.dataDir, opts.store, opts.assetId, opts.apiKey);
    if (recovered?.remoteUrl && (await downloadUrlToFile(recovered.remoteUrl, recovered.filePath))) {
      return true;
    }
  }
  return false;
}

async function ensureProxyCachedOnDisk(
  meta: StoredAssetMeta,
  opts?: { dataDir: string; store: DiskStoreData; assetId: string; apiKey: string | null },
): Promise<string | null> {
  if (opts) {
    normalizeAssetMeta(opts.dataDir, opts.assetId, meta);
  }
  if (meta.proxyPath && fs.existsSync(meta.proxyPath) && fs.statSync(meta.proxyPath).size > 0) {
    return meta.proxyPath;
  }
  if (fs.existsSync(meta.filePath) && fs.statSync(meta.filePath).size > 0) {
    return meta.filePath;
  }
  const sourceUrl = meta.proxyUrl || meta.remoteUrl;
  if (sourceUrl && meta.proxyPath && (await downloadUrlToFile(sourceUrl, meta.proxyPath))) {
    return meta.proxyPath;
  }
  if (opts) {
    const recovered = await recoverPixabayAssetMeta(opts.dataDir, opts.store, opts.assetId, opts.apiKey);
    const recUrl = recovered?.proxyUrl || recovered?.remoteUrl;
    if (recovered?.proxyPath && recUrl && (await downloadUrlToFile(recUrl, recovered.proxyPath))) {
      return recovered.proxyPath;
    }
  }
  return null;
}

async function ensureThumbCachedOnDisk(
  meta: StoredAssetMeta,
  opts?: { dataDir: string; store: DiskStoreData; assetId: string; apiKey: string | null },
): Promise<string | null> {
  if (opts) {
    normalizeAssetMeta(opts.dataDir, opts.assetId, meta);
  }
  if (meta.thumbPath && fs.existsSync(meta.thumbPath) && fs.statSync(meta.thumbPath).size > 0) {
    return meta.thumbPath;
  }
  if (meta.mimeType.startsWith("image/")) {
    if (meta.proxyPath && fs.existsSync(meta.proxyPath) && fs.statSync(meta.proxyPath).size > 0) {
      return meta.proxyPath;
    }
    if (fs.existsSync(meta.filePath) && fs.statSync(meta.filePath).size > 0) {
      return meta.filePath;
    }
  }
  const sourceUrl = meta.thumbUrl || (meta.mimeType.startsWith("image/") ? meta.proxyUrl || meta.remoteUrl : undefined);
  if (sourceUrl && meta.thumbPath && (await downloadUrlToFile(sourceUrl, meta.thumbPath))) {
    return meta.thumbPath;
  }
  if (opts) {
    const recovered = await recoverPixabayAssetMeta(opts.dataDir, opts.store, opts.assetId, opts.apiKey);
    const recUrl =
      recovered?.thumbUrl ||
      (recovered?.mimeType.startsWith("image/") ? recovered.proxyUrl || recovered.remoteUrl : undefined);
    if (recovered?.thumbPath && recUrl && (await downloadUrlToFile(recUrl, recovered.thumbPath))) {
      return recovered.thumbPath;
    }
  }
  // Fallback for video assets: extract frame 0 from cached proxy or full video via ffmpeg
  if (meta.mimeType.startsWith("video/") && meta.thumbPath) {
    const videoFile =
      (meta.proxyPath && fs.existsSync(meta.proxyPath) ? meta.proxyPath : null) ||
      (fs.existsSync(meta.filePath) ? meta.filePath : null);
    if (videoFile) {
      fs.mkdirSync(path.dirname(meta.thumbPath), { recursive: true });
      spawnSync("ffmpeg", ["-y", "-v", "error", "-i", videoFile, "-frames:v", "1", "-vf", "scale=320:-1", meta.thumbPath]);
      if (fs.existsSync(meta.thumbPath) && fs.statSync(meta.thumbPath).size > 0) {
        return meta.thumbPath;
      }
    }
  }
  return null;
}

async function searchPixabayVideos(
  apiKey: string,
  query: string,
  mood: string,
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }>> {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
    query,
  )}&safesearch=true&per_page=8`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      duration?: number;
      user?: string;
      views?: number;
      likes?: number;
      downloads?: number;
      videos?: {
        tiny?: { url?: string; width?: number; height?: number; thumbnail?: string };
        small?: { url?: string; width?: number; height?: number; thumbnail?: string };
        medium?: { url?: string; width?: number; height?: number; thumbnail?: string };
        large?: { url?: string; width?: number; height?: number; thumbnail?: string };
      };
    }>;
  };
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }> = [];
  for (const hit of data.hits ?? []) {
    // Low-resolution editing proxy (360p tiny stream) vs High-resolution export video (720p/1080p medium/large stream)
    const proxyVariant = hit.videos?.tiny?.url ? hit.videos.tiny : hit.videos?.small;
    const exportVariant =
      hit.videos?.medium?.url
        ? hit.videos.medium
        : hit.videos?.large?.url
          ? hit.videos.large
          : hit.videos?.small?.url
            ? hit.videos.small
            : proxyVariant;
    if (!proxyVariant?.url || !exportVariant?.url) continue;
    const width = exportVariant.width || 1280;
    const height = exportVariant.height || 720;
    // Filter out portrait/vertical clips for 16:9 landscape projects
    if (width < height) continue;

    const tags = (hit.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const assetId = `pxv_${hit.id}`;
    const labelTag = tags.slice(0, 3).join(" • ") || "video";
    const popularityBonus = Math.min(0.15, Math.log10(Math.max(1, (hit.likes ?? 0) + (hit.downloads ?? 0))) * 0.03);
    const hdBonus = width >= 1280 ? 0.1 : 0;
    const qualityScore = Number(Math.min(0.98, 0.72 + popularityBonus + hdBonus).toFixed(3));

    out.push({
      ext: ".mp4",
      mimeType: "video/mp4",
      remoteUrl: exportVariant.url,
      proxyUrl: proxyVariant.url,
      item: {
        assetId,
        title: `Pixabay Video: ${labelTag}`,
        caption: `pixabay stock video ${tags.join(" ")} ${query}`,
        tags: tags.length > 0 ? tags : ["video", "pixabay"],
        mood,
        kind: "video",
        durationUs: Math.max(30_000_000, Math.round((hit.duration ?? 10) * 1_000_000)),
        width,
        height,
        uri: `s3://vf/stock/${assetId}.mp4`,
        previewThumbUrl: proxyVariant.thumbnail || exportVariant.thumbnail,
        qualityScore,
        license: {
          provider: "pixabay",
          providerId: String(hit.id),
          terms: "Pixabay Content License",
          attribution: hit.user,
        },
      },
    });
  }
  return out;
}

async function searchPixabayPhotos(
  apiKey: string,
  query: string,
  mood: string,
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }>> {
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
    query,
  )}&image_type=photo&orientation=horizontal&min_width=1280&safesearch=true&per_page=8`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      user?: string;
      likes?: number;
      downloads?: number;
      largeImageURL?: string;
      webformatURL?: string;
      previewURL?: string;
      imageWidth?: number;
      imageHeight?: number;
      webformatWidth?: number;
      webformatHeight?: number;
    }>;
  };
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }> = [];
  for (const hit of data.hits ?? []) {
    if (!hit.webformatURL) continue;
    const width = hit.imageWidth || hit.webformatWidth || 1280;
    const height = hit.imageHeight || hit.webformatHeight || 720;
    if (width < height) continue;

    const tags = (hit.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const assetId = `pxi_${hit.id}`;
    const labelTag = tags.slice(0, 3).join(" • ") || "photo";
    // Low-res editing proxy (340p/640p webformat) vs Full-res export (1280p largeImageURL)
    const proxyUrl = hit.webformatURL.replace("_640.", "_340.");
    const remoteUrl = hit.largeImageURL || hit.webformatURL;
    const popularityBonus = Math.min(0.14, Math.log10(Math.max(1, (hit.likes ?? 0) + (hit.downloads ?? 0))) * 0.03);
    const qualityScore = Number(Math.min(0.95, 0.75 + popularityBonus).toFixed(3));

    out.push({
      ext: ".jpg",
      mimeType: "image/jpeg",
      remoteUrl,
      proxyUrl,
      item: {
        assetId,
        title: `Pixabay Photo: ${labelTag}`,
        caption: `pixabay stock photo ${tags.join(" ")} ${query}`,
        tags: tags.length > 0 ? tags : ["photo", "pixabay"],
        mood,
        kind: "image",
        durationUs: 30_000_000,
        width: hit.webformatWidth || 1280,
        height: hit.webformatHeight || 720,
        uri: `s3://vf/stock/${assetId}.jpg`,
        previewThumbUrl: hit.previewURL || proxyUrl,
        qualityScore,
        license: {
          provider: "pixabay",
          providerId: String(hit.id),
          terms: "Pixabay Content License",
          attribution: hit.user,
        },
      },
    });
  }
  return out;
}

const WIKIMEDIA_REJECT_TITLE_RE =
  /\b(diagram|chart|map|icon|logo|scan|page|document|flag|coat of arms|signature|graph|table|schema|vector|stamp|seal|book|pdf|svg)\b/i;

async function searchWikimediaPhotos(
  query: string,
  mood: string,
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }>> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    `filetype:bitmap ${query}`,
  )}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|dimensions|mime|extmetadata&iiurlwidth=640&format=json`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "VideoForgeStudio/1.0 (https://localhost; dev@videoforge.local)",
    },
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          pageid: number;
          title?: string;
          imageinfo?: Array<{
            url?: string;
            thumburl?: string;
            width?: number;
            height?: number;
            mime?: string;
            extmetadata?: {
              LicenseShortName?: { value?: string };
              Artist?: { value?: string };
              ImageDescription?: { value?: string };
              ObjectName?: { value?: string };
            };
          }>;
        }
      >;
    };
  };
  const pages = Object.values(data.query?.pages ?? {});
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; proxyUrl: string; mimeType: string; ext: string }> = [];
  for (const page of pages) {
    const ii = page.imageinfo?.[0];
    const remoteUrl = ii?.url || ii?.thumburl;
    const proxyUrl = ii?.thumburl || ii?.url;
    if (!remoteUrl || !proxyUrl) continue;
    const width = ii?.width || 1280;
    const height = ii?.height || 720;
    // Reject portrait scans, low-res thumbnails, or non-photographic diagrams/logos
    if (width < height || width < 800) continue;

    const rawTitle = (page.title ?? `Wikimedia ${page.pageid}`).replace(/^File:/i, "");
    if (WIKIMEDIA_REJECT_TITLE_RE.test(rawTitle)) continue;

    const cleanTitle = rawTitle.replace(/\.[a-zA-Z0-9]+$/, "").slice(0, 42);
    const rawDesc = (ii?.extmetadata?.ImageDescription?.value ?? ii?.extmetadata?.ObjectName?.value ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const words = (`${cleanTitle} ${rawDesc}`.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (w) => w.length > 2,
    );
    const uniqueWords = Array.from(new Set(words)).slice(0, 10);
    const assetId = `wiki_${page.pageid}`;
    const isPng = (ii?.mime ?? "").includes("png") || remoteUrl.toLowerCase().endsWith(".png");
    const ext = isPng ? ".png" : ".jpg";
    out.push({
      ext,
      mimeType: isPng ? "image/png" : "image/jpeg",
      remoteUrl,
      proxyUrl,
      item: {
        assetId,
        title: `Wikimedia: ${cleanTitle}`,
        caption: `wikimedia commons ${cleanTitle} ${rawDesc} ${query}`.trim(),
        tags: uniqueWords.length > 0 ? uniqueWords : ["wikimedia", "commons"],
        mood,
        kind: "image",
        durationUs: 30_000_000,
        width,
        height,
        uri: `s3://vf/stock/${assetId}${ext}`,
        previewThumbUrl: proxyUrl,
        qualityScore: width >= 1280 ? 0.78 : 0.68,
        license: {
          provider: "wikimedia",
          providerId: String(page.pageid),
          terms: ii?.extmetadata?.LicenseShortName?.value ?? "CC / Public Domain",
          attribution: ii?.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").slice(0, 60),
        },
      },
    });
  }
  return out;
}

function dedupeHits<T extends { item: { assetId: string } }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of items) {
    if (!seen.has(entry.item.assetId)) {
      seen.add(entry.item.assetId);
      out.push(entry);
    }
  }
  return out;
}

function videoforgeStudioPlugin(): Plugin {
  return {
    name: "videoforge-studio-api",
    configureServer(server) {
      const dataDir = getDataDir(server.config.root);
      const uploadsDir = path.join(dataDir, "uploads");
      const proxiesDir = path.join(dataDir, "proxies");
      const thumbsDir = path.join(dataDir, "thumbs");

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0] ?? "";
        if (!url.startsWith("/api/")) {
          next();
          return;
        }

        try {
          // 0. POST /api/stock/search (Live Pixabay Videos/Photos + Wikimedia Commons with multi-query cascade)
          if (url === "/api/stock/search" && req.method === "POST") {
            const raw = (await readBodyBuffer(req)).toString("utf8");
            const body = JSON.parse(raw) as {
              query?: string;
              queries?: string[];
              fallbackQuery?: string;
              mood?: string;
              mediaMode?: "videos_and_photos" | "videos_only" | "photos_only" | "wikimedia_only";
              cacheTopN?: number;
            };
            const q = (body.query || "business").trim();
            const fallbackQ = (body.fallbackQuery || q.split(/\s+/)[0] || "technology").trim();
            const queryCascade = Array.from(
              new Set([
                ...(Array.isArray(body.queries) ? body.queries.map((s) => s.trim()).filter(Boolean) : []),
                q,
                fallbackQ,
              ]),
            ).slice(0, 3);
            const mood = body.mood || "energetic";
            const mediaMode = body.mediaMode ?? "videos_and_photos";
            // Default cacheTopN = 0: do not block search on full-res video/image downloads; full files download on export
            const cacheTopN = typeof body.cacheTopN === "number" ? body.cacheTopN : 0;
            const pixabayKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");

            let videoHits: Awaited<ReturnType<typeof searchPixabayVideos>> = [];
            let photoHits: Awaited<ReturnType<typeof searchPixabayPhotos>> = [];
            let wikiHits: Awaited<ReturnType<typeof searchWikimediaPhotos>> = [];

            const tasks: Promise<void>[] = [];

            if (pixabayKey && (mediaMode === "videos_and_photos" || mediaMode === "videos_only")) {
              tasks.push(
                (async () => {
                  const collected: Awaited<ReturnType<typeof searchPixabayVideos>> = [];
                  for (const candidateQ of queryCascade) {
                    const hits = await searchPixabayVideos(pixabayKey, candidateQ, mood);
                    collected.push(...hits);
                    if (dedupeHits(collected).length >= 5) break;
                  }
                  videoHits = dedupeHits(collected);
                })(),
              );
            }

            if (pixabayKey && (mediaMode === "videos_and_photos" || mediaMode === "photos_only")) {
              tasks.push(
                (async () => {
                  const collected: Awaited<ReturnType<typeof searchPixabayPhotos>> = [];
                  for (const candidateQ of queryCascade) {
                    const hits = await searchPixabayPhotos(pixabayKey, candidateQ, mood);
                    collected.push(...hits);
                    if (dedupeHits(collected).length >= 5) break;
                  }
                  photoHits = dedupeHits(collected);
                })(),
              );
            }

            if (
              mediaMode === "videos_and_photos" ||
              mediaMode === "photos_only" ||
              mediaMode === "wikimedia_only"
            ) {
              tasks.push(
                (async () => {
                  const collected: Awaited<ReturnType<typeof searchWikimediaPhotos>> = [];
                  for (const candidateQ of queryCascade) {
                    const hits = await searchWikimediaPhotos(candidateQ, mood);
                    collected.push(...hits);
                    if (dedupeHits(collected).length >= 4) break;
                  }
                  wikiHits = dedupeHits(collected);
                })(),
              );
            }

            await Promise.all(tasks);

            // Interleave results so videos and photos from both Pixabay and Wikimedia are represented
            const combined = dedupeHits(
              (() => {
                const list: Array<{
                  item: StockCandidateItem;
                  remoteUrl: string;
                  proxyUrl: string;
                  mimeType: string;
                  ext: string;
                }> = [];
                const maxLen = Math.max(videoHits.length, photoHits.length, wikiHits.length);
                for (let i = 0; i < maxLen; i++) {
                  if (videoHits[i]) list.push(videoHits[i]!);
                  if (photoHits[i]) list.push(photoHits[i]!);
                  if (wikiHits[i]) list.push(wikiHits[i]!);
                }
                return list;
              })(),
            );

            fs.mkdirSync(uploadsDir, { recursive: true });
            fs.mkdirSync(proxiesDir, { recursive: true });
            fs.mkdirSync(thumbsDir, { recursive: true });
            const store = readDiskStore(dataDir);
            for (const entry of combined) {
              const fileName = `${entry.item.assetId}${entry.ext}`;
              const filePath = path.join(uploadsDir, fileName);
              const proxyPath = path.join(proxiesDir, `${entry.item.assetId}_proxy${entry.ext}`);
              const thumbPath = path.join(thumbsDir, `${entry.item.assetId}.jpg`);
              store.assets[entry.item.assetId] = {
                filePath,
                mimeType: entry.mimeType,
                fileName,
                remoteUrl: entry.remoteUrl,
                proxyUrl: entry.proxyUrl,
                proxyPath,
                thumbUrl: entry.item.previewThumbUrl,
                thumbPath,
              };
            }
            writeDiskStore(dataDir, store);

            if (cacheTopN > 0) {
              const toCache = combined.slice(0, cacheTopN);
              await Promise.all(
                toCache.map((c) => {
                  const meta = store.assets[c.item.assetId];
                  return meta
                    ? ensureAssetCachedOnDisk(meta, {
                        dataDir,
                        store,
                        assetId: c.item.assetId,
                        apiKey: pixabayKey,
                      })
                    : Promise.resolve(false);
                }),
              );
            }

            sendJson(res, 200, {
              hasPixabayKey: Boolean(pixabayKey),
              candidates: combined.map((c) => c.item),
            });
            return;
          }

          // 1. POST /api/assets/upload
          if (url === "/api/assets/upload" && req.method === "POST") {
            const raw = (await readBodyBuffer(req)).toString("utf8");
            const body = JSON.parse(raw) as {
              assetId: string;
              fileName: string;
              mimeType?: string;
              dataBase64: string;
            };
            if (!body.assetId || !body.dataBase64) {
              sendJson(res, 400, { error: "Missing assetId or dataBase64" });
              return;
            }
            fs.mkdirSync(uploadsDir, { recursive: true });
            const safeName = path.basename(body.fileName || `${body.assetId}.bin`);
            const filePath = path.join(uploadsDir, safeName);
            fs.writeFileSync(filePath, Buffer.from(body.dataBase64, "base64"));

            const store = readDiskStore(dataDir);
            store.assets[body.assetId] = {
              filePath,
              mimeType: body.mimeType || "application/octet-stream",
              fileName: safeName,
            };
            writeDiskStore(dataDir, store);
            sendJson(res, 201, { ok: true, assetId: body.assetId, fileName: safeName });
            return;
          }

          // 2a. GET /api/assets/:id/thumb (lightweight preview thumbnail)
          const thumbMatch = url.match(/^\/api\/assets\/([^/]+)\/thumb$/);
          if (thumbMatch && req.method === "GET") {
            const assetId = decodeURIComponent(thumbMatch[1]!);
            const apiKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");
            const store = readDiskStore(dataDir);
            let meta: StoredAssetMeta | undefined = store.assets[assetId];
            if (!meta && (assetId.startsWith("pxv_") || assetId.startsWith("pxi_"))) {
              meta = (await recoverPixabayAssetMeta(dataDir, store, assetId, apiKey)) ?? undefined;
            }
            if (!meta) {
              sendJson(res, 404, { error: "asset metadata not found" });
              return;
            }
            const thumbFile = await ensureThumbCachedOnDisk(meta, {
              dataDir,
              store,
              assetId,
              apiKey,
            });
            if (!thumbFile || !fs.existsSync(thumbFile)) {
              sendJson(res, 404, { error: "asset thumbnail not available" });
              return;
            }
            const fileBuf = fs.readFileSync(thumbFile);
            res.statusCode = 200;
            res.setHeader("Content-Type", thumbFile.endsWith(".png") ? "image/png" : "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.setHeader("Content-Length", String(fileBuf.byteLength));
            res.end(fileBuf);
            return;
          }

          // 2b. GET /api/assets/:id/proxy (low-resolution video/image for editing; full-res deferred until export)
          const proxyMatch = url.match(/^\/api\/assets\/([^/]+)\/proxy$/);
          if (proxyMatch && req.method === "GET") {
            const assetId = decodeURIComponent(proxyMatch[1]!);
            const apiKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");
            const store = readDiskStore(dataDir);
            let meta: StoredAssetMeta | undefined = store.assets[assetId];
            if (!meta && (assetId.startsWith("pxv_") || assetId.startsWith("pxi_"))) {
              meta = (await recoverPixabayAssetMeta(dataDir, store, assetId, apiKey)) ?? undefined;
            }
            if (!meta) {
              sendJson(res, 404, { error: "asset metadata not found" });
              return;
            }
            const proxyFile = await ensureProxyCachedOnDisk(meta, {
              dataDir,
              store,
              assetId,
              apiKey,
            });
            if (!proxyFile || !fs.existsSync(proxyFile)) {
              sendJson(res, 404, { error: "asset proxy not available" });
              return;
            }
            const stat = fs.statSync(proxyFile);
            const totalSize = stat.size;
            const rangeHeader = req.headers.range;
            res.setHeader("Content-Type", meta.mimeType);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Cache-Control", "public, max-age=86400");

            if (rangeHeader) {
              const parts = rangeHeader.replace(/bytes=/, "").split("-");
              const start = Number.parseInt(parts[0] || "0", 10);
              const end = parts[1] ? Number.parseInt(parts[1], 10) : totalSize - 1;
              const chunkSize = Math.max(0, end - start + 1);
              const fd = fs.openSync(proxyFile, "r");
              const chunkBuf = Buffer.alloc(chunkSize);
              fs.readSync(fd, chunkBuf, 0, chunkSize, start);
              fs.closeSync(fd);
              res.statusCode = 206;
              res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
              res.setHeader("Content-Length", String(chunkSize));
              res.end(chunkBuf);
              return;
            }

            const fileBuf = fs.readFileSync(proxyFile);
            res.statusCode = 200;
            res.setHeader("Content-Length", String(fileBuf.byteLength));
            res.end(fileBuf);
            return;
          }

          // 2c. GET /api/assets/:id/file (serves uploaded or on-demand cached full-resolution files)
          const assetMatch = url.match(/^\/api\/assets\/([^/]+)\/file$/);
          if (assetMatch && req.method === "GET") {
            const assetId = decodeURIComponent(assetMatch[1]!);
            const apiKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");
            const store = readDiskStore(dataDir);
            let meta: StoredAssetMeta | undefined = store.assets[assetId];
            if (!meta && (assetId.startsWith("pxv_") || assetId.startsWith("pxi_"))) {
              meta = (await recoverPixabayAssetMeta(dataDir, store, assetId, apiKey)) ?? undefined;
            }
            if (!meta) {
              sendJson(res, 404, { error: "asset metadata not found" });
              return;
            }
            const ready = await ensureAssetCachedOnDisk(meta, {
              dataDir,
              store,
              assetId,
              apiKey,
            });
            if (!ready || !fs.existsSync(meta.filePath)) {
              sendJson(res, 404, { error: "asset file not found" });
              return;
            }
            const fileBuf = fs.readFileSync(meta.filePath);
            res.statusCode = 200;
            res.setHeader("Content-Type", meta.mimeType);
            res.setHeader("Content-Length", String(fileBuf.byteLength));
            res.end(fileBuf);
            return;
          }

          // 3. GET / PUT /api/projects/:id
          const projMatch = url.match(/^\/api\/projects\/([^/]+)$/);
          if (projMatch) {
            const projectId = decodeURIComponent(projMatch[1]!);
            const store = readDiskStore(dataDir);
            if (req.method === "GET") {
              const entry = store.projects[projectId];
              if (!entry) {
                sendJson(res, 404, { error: "not found" });
                return;
              }
              sendJson(res, 200, {
                id: projectId,
                version: entry.version,
                doc: entry.doc,
                updatedAt: entry.updatedAt,
                events: store.events[projectId] ?? [],
              });
              return;
            }
            if (req.method === "PUT") {
              const raw = (await readBodyBuffer(req)).toString("utf8");
              const parsed = JSON.parse(raw) as { version?: number; doc: unknown; resetEvents?: boolean };
              const schemaMod = await server.ssrLoadModule("@vf/schema");
              const validDoc = schemaMod.Project.parse(parsed.doc);
              const nextVersion = typeof parsed.version === "number" ? parsed.version : 0;
              store.projects[projectId] = {
                version: nextVersion,
                doc: validDoc,
                updatedAt: new Date().toISOString(),
              };
              if (parsed.resetEvents) {
                store.events[projectId] = [];
              }
              writeDiskStore(dataDir, store);
              sendJson(res, 200, {
                id: projectId,
                version: nextVersion,
                doc: validDoc,
                events: store.events[projectId] ?? [],
              });
              return;
            }
          }

          // 4. POST /api/projects/:id/ops
          const opsMatch = url.match(/^\/api\/projects\/([^/]+)\/ops$/);
          if (opsMatch && req.method === "POST") {
            const projectId = decodeURIComponent(opsMatch[1]!);
            const raw = (await readBodyBuffer(req)).toString("utf8");
            const body = JSON.parse(raw) as {
              expectedVersion?: number;
              actor?: "user" | "ai";
              ops: unknown[];
              baseDoc?: unknown;
            };
            const schemaMod = await server.ssrLoadModule("@vf/schema");
            const store = readDiskStore(dataDir);
            let currentEntry = store.projects[projectId];
            if (!currentEntry && body.baseDoc) {
              currentEntry = {
                version: 0,
                doc: schemaMod.Project.parse(body.baseDoc),
                updatedAt: new Date().toISOString(),
              };
            }
            if (!currentEntry) {
              sendJson(res, 404, { error: "project not found" });
              return;
            }
            let doc = schemaMod.Project.parse(currentEntry.doc);
            const actor = body.actor === "ai" ? "ai" : "user";
            for (const rawOp of body.ops ?? []) {
              const op = schemaMod.OpSchema.parse(rawOp);
              doc = schemaMod.applyChecked(doc, op, { actor }).next;
            }
            const nextVersion = currentEntry.version + 1;
            store.projects[projectId] = {
              version: nextVersion,
              doc,
              updatedAt: new Date().toISOString(),
            };
            writeDiskStore(dataDir, store);
            sendJson(res, 200, { version: nextVersion, doc });
            return;
          }

          // 5. GET / POST /api/projects/:id/events
          const eventsMatch = url.match(/^\/api\/projects\/([^/]+)\/events$/);
          if (eventsMatch) {
            const projectId = decodeURIComponent(eventsMatch[1]!);
            const store = readDiskStore(dataDir);
            if (req.method === "GET") {
              sendJson(res, 200, { events: store.events[projectId] ?? [] });
              return;
            }
            if (req.method === "POST") {
              const raw = (await readBodyBuffer(req)).toString("utf8");
              const body = JSON.parse(raw) as {
                sceneId?: string;
                event: "kept" | "replaced_candidate" | "replaced_upload" | "intent_edited";
                payload?: Record<string, unknown>;
              };
              const entry: StoredEditEvent = {
                id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                projectId,
                sceneId: body.sceneId,
                event: body.event,
                payload: body.payload ?? {},
                createdAt: new Date().toISOString(),
              };
              const list = store.events[projectId] ?? [];
              store.events[projectId] = [entry, ...list];
              writeDiskStore(dataDir, store);
              sendJson(res, 201, entry);
              return;
            }
          }

          // 6. POST /api/export/mp4
          if (url === "/api/export/mp4" && req.method === "POST") {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-web-export-"));
            const mp4Path = path.join(tmpDir, "export.mp4");
            try {
              const rawBody = (await readBodyBuffer(req)).toString("utf8");
              const parsed = JSON.parse(rawBody) as {
                project: unknown;
                audioWavBase64?: string | null;
              };
              const schemaMod = await server.ssrLoadModule("@vf/schema");
              const exportMod = await server.ssrLoadModule(
                path.resolve(server.config.root, "../render-worker/src/export.ts"),
              );
              const project = schemaMod.Project.parse(parsed.project);
              const audioWavBytes =
                typeof parsed.audioWavBase64 === "string" && parsed.audioWavBase64.length > 0
                  ? Buffer.from(parsed.audioWavBase64, "base64")
                  : undefined;

              const apiKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");
              const store = readDiskStore(dataDir);
              const assetFiles: Record<string, string> = {};
              const uniqueAssetIds = Array.from(
                new Set(
                  (Object.values(project.clips) as Array<{ source?: { assetId?: string } }>)
                    .map((c) => c.source?.assetId)
                    .filter((aid): aid is string => Boolean(aid)),
                ),
              );
              // Download full-resolution videos/images on-demand in parallel only when exporting
              await Promise.all(
                uniqueAssetIds.map(async (aid) => {
                  let meta: StoredAssetMeta | undefined = store.assets[aid];
                  if (!meta && (aid.startsWith("pxv_") || aid.startsWith("pxi_"))) {
                    meta = (await recoverPixabayAssetMeta(dataDir, store, aid, apiKey)) ?? undefined;
                  }
                  if (meta) {
                    const ctx = { dataDir, store, assetId: aid, apiKey };
                    await ensureAssetCachedOnDisk(meta, ctx);
                    if (fs.existsSync(meta.filePath) && fs.statSync(meta.filePath).size > 0) {
                      assetFiles[aid] = meta.filePath;
                      return;
                    }
                    // Fallback to proxy file if full-res download failed so export never misses a stock asset
                    const proxyFile = await ensureProxyCachedOnDisk(meta, ctx);
                    if (proxyFile && fs.existsSync(proxyFile) && fs.statSync(proxyFile).size > 0) {
                      assetFiles[aid] = proxyFile;
                    }
                  }
                }),
              );

              await exportMod.exportProjectToMp4(project, {
                outputPath: mp4Path,
                audioWavBytes,
                assetFiles,
              });

              const mp4Buf = fs.readFileSync(mp4Path);
              res.statusCode = 200;
              res.setHeader("Content-Type", "video/mp4");
              res.setHeader("Content-Length", String(mp4Buf.byteLength));
              res.setHeader("Content-Disposition", 'attachment; filename="videoforge-export.mp4"');
              res.end(mp4Buf);
            } finally {
              fs.rmSync(tmpDir, { recursive: true, force: true });
            }
            return;
          }

          next();
        } catch (err) {
          sendJson(res, 422, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), videoforgeStudioPlugin()],
});
