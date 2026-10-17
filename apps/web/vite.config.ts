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

async function ensureAssetCachedOnDisk(meta: StoredAssetMeta): Promise<boolean> {
  if (fs.existsSync(meta.filePath) && fs.statSync(meta.filePath).size > 0) {
    return true;
  }
  if (!meta.remoteUrl) return false;
  try {
    fs.mkdirSync(path.dirname(meta.filePath), { recursive: true });
    const resp = await fetch(meta.remoteUrl, {
      headers: {
        "User-Agent": "VideoForgeStudio/1.0 (https://localhost; dev@videoforge.local)",
      },
    });
    if (!resp.ok) return false;
    const arr = await resp.arrayBuffer();
    if (arr.byteLength === 0) return false;
    fs.writeFileSync(meta.filePath, Buffer.from(arr));
    return true;
  } catch {
    return false;
  }
}

async function searchPixabayVideos(
  apiKey: string,
  query: string,
  mood: string,
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }>> {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
    query,
  )}&safesearch=true&per_page=5`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      duration?: number;
      user?: string;
      videos?: {
        tiny?: { url?: string; width?: number; height?: number; thumbnail?: string };
        small?: { url?: string; width?: number; height?: number; thumbnail?: string };
        medium?: { url?: string; width?: number; height?: number; thumbnail?: string };
      };
    }>;
  };
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }> = [];
  for (const hit of data.hits ?? []) {
    const vidVariant = hit.videos?.tiny?.url ? hit.videos.tiny : hit.videos?.small;
    if (!vidVariant?.url) continue;
    const tags = (hit.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const assetId = `pxv_${hit.id}`;
    const labelTag = tags.slice(0, 2).join(" • ") || "video";
    out.push({
      ext: ".mp4",
      mimeType: "video/mp4",
      remoteUrl: vidVariant.url,
      item: {
        assetId,
        title: `Pixabay Video: ${labelTag}`,
        caption: `pixabay stock video ${tags.join(" ")} ${query}`,
        tags: tags.length > 0 ? tags : ["video", "pixabay"],
        mood,
        kind: "video",
        durationUs: Math.max(30_000_000, Math.round((hit.duration ?? 10) * 1_000_000)),
        width: vidVariant.width || 960,
        height: vidVariant.height || 540,
        uri: `s3://vf/stock/${assetId}.mp4`,
        previewThumbUrl: vidVariant.thumbnail,
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
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }>> {
  const url = `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(
    query,
  )}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      user?: string;
      webformatURL?: string;
      previewURL?: string;
      webformatWidth?: number;
      webformatHeight?: number;
    }>;
  };
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }> = [];
  for (const hit of data.hits ?? []) {
    if (!hit.webformatURL) continue;
    const tags = (hit.tags ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const assetId = `pxi_${hit.id}`;
    const labelTag = tags.slice(0, 2).join(" • ") || "photo";
    out.push({
      ext: ".jpg",
      mimeType: "image/jpeg",
      remoteUrl: hit.webformatURL,
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
        previewThumbUrl: hit.previewURL,
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

async function searchWikimediaPhotos(
  query: string,
  mood: string,
): Promise<Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }>> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    `filetype:bitmap ${query}`,
  )}&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|dimensions|mime|extmetadata&iiurlwidth=1280&format=json`;
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
            };
          }>;
        }
      >;
    };
  };
  const pages = Object.values(data.query?.pages ?? {});
  const out: Array<{ item: StockCandidateItem; remoteUrl: string; mimeType: string; ext: string }> = [];
  for (const page of pages) {
    const ii = page.imageinfo?.[0];
    const remoteUrl = ii?.thumburl || ii?.url;
    if (!remoteUrl) continue;
    const cleanTitle = (page.title ?? `Wikimedia ${page.pageid}`)
      .replace(/^File:/i, "")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .slice(0, 36);
    const words = (cleanTitle.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2);
    const assetId = `wiki_${page.pageid}`;
    const isPng = (ii?.mime ?? "").includes("png") || remoteUrl.toLowerCase().endsWith(".png");
    const ext = isPng ? ".png" : ".jpg";
    out.push({
      ext,
      mimeType: isPng ? "image/png" : "image/jpeg",
      remoteUrl,
      item: {
        assetId,
        title: `Wikimedia: ${cleanTitle}`,
        caption: `wikimedia commons ${cleanTitle} ${query}`,
        tags: words.length > 0 ? words.slice(0, 8) : ["wikimedia", "commons"],
        mood,
        kind: "image",
        durationUs: 30_000_000,
        width: ii?.width || 1280,
        height: ii?.height || 720,
        uri: `s3://vf/stock/${assetId}${ext}`,
        previewThumbUrl: ii?.thumburl,
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

function videoforgeStudioPlugin(): Plugin {
  return {
    name: "videoforge-studio-api",
    configureServer(server) {
      const dataDir = getDataDir(server.config.root);
      const uploadsDir = path.join(dataDir, "uploads");

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0] ?? "";
        if (!url.startsWith("/api/")) {
          next();
          return;
        }

        try {
          // 0. POST /api/stock/search (Live Pixabay Videos/Photos + Wikimedia Commons)
          if (url === "/api/stock/search" && req.method === "POST") {
            const raw = (await readBodyBuffer(req)).toString("utf8");
            const body = JSON.parse(raw) as {
              query: string;
              fallbackQuery?: string;
              mood?: string;
              mediaMode?: "videos_and_photos" | "videos_only" | "photos_only" | "wikimedia_only";
              cacheTopN?: number;
            };
            const q = (body.query || "business").trim();
            const fallbackQ = (body.fallbackQuery || q.split(/\s+/)[0] || "technology").trim();
            const mood = body.mood || "energetic";
            const mediaMode = body.mediaMode ?? "videos_and_photos";
            const cacheTopN = typeof body.cacheTopN === "number" ? body.cacheTopN : 1;
            const pixabayKey = readEnvKey(server.config.root, "PIXABAY_API_KEY");

            let videoHits: Awaited<ReturnType<typeof searchPixabayVideos>> = [];
            let photoHits: Awaited<ReturnType<typeof searchPixabayPhotos>> = [];
            let wikiHits: Awaited<ReturnType<typeof searchWikimediaPhotos>> = [];

            const tasks: Promise<void>[] = [];

            if (pixabayKey && (mediaMode === "videos_and_photos" || mediaMode === "videos_only")) {
              tasks.push(
                (async () => {
                  videoHits = await searchPixabayVideos(pixabayKey, q, mood);
                  if (videoHits.length === 0 && fallbackQ !== q) {
                    videoHits = await searchPixabayVideos(pixabayKey, fallbackQ, mood);
                  }
                })(),
              );
            }

            if (pixabayKey && (mediaMode === "videos_and_photos" || mediaMode === "photos_only")) {
              tasks.push(
                (async () => {
                  photoHits = await searchPixabayPhotos(pixabayKey, q, mood);
                  if (photoHits.length === 0 && fallbackQ !== q) {
                    photoHits = await searchPixabayPhotos(pixabayKey, fallbackQ, mood);
                  }
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
                  wikiHits = await searchWikimediaPhotos(q, mood);
                  if (wikiHits.length === 0 && fallbackQ !== q) {
                    wikiHits = await searchWikimediaPhotos(fallbackQ, mood);
                  }
                })(),
              );
            }

            await Promise.all(tasks);

            // Interleave results so videos and photos from both Pixabay and Wikimedia are represented
            const combined: Array<{
              item: StockCandidateItem;
              remoteUrl: string;
              mimeType: string;
              ext: string;
            }> = [];
            const maxLen = Math.max(videoHits.length, photoHits.length, wikiHits.length);
            for (let i = 0; i < maxLen; i++) {
              if (videoHits[i]) combined.push(videoHits[i]!);
              if (photoHits[i]) combined.push(photoHits[i]!);
              if (wikiHits[i]) combined.push(wikiHits[i]!);
            }

            fs.mkdirSync(uploadsDir, { recursive: true });
            const store = readDiskStore(dataDir);
            for (const entry of combined) {
              const fileName = `${entry.item.assetId}${entry.ext}`;
              const filePath = path.join(uploadsDir, fileName);
              store.assets[entry.item.assetId] = {
                filePath,
                mimeType: entry.mimeType,
                fileName,
                remoteUrl: entry.remoteUrl,
              };
            }
            writeDiskStore(dataDir, store);

            // Eagerly download and cache the top N items on disk so immediate preview & export work
            const toCache = combined.slice(0, Math.max(0, cacheTopN));
            await Promise.all(
              toCache.map((c) => {
                const meta = store.assets[c.item.assetId];
                return meta ? ensureAssetCachedOnDisk(meta) : Promise.resolve(false);
              }),
            );

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

          // 2. GET /api/assets/:id/file (serves uploaded or on-demand cached stock files)
          const assetMatch = url.match(/^\/api\/assets\/([^/]+)\/file$/);
          if (assetMatch && req.method === "GET") {
            const assetId = decodeURIComponent(assetMatch[1]!);
            const store = readDiskStore(dataDir);
            const meta = store.assets[assetId];
            if (!meta) {
              sendJson(res, 404, { error: "asset metadata not found" });
              return;
            }
            const ready = await ensureAssetCachedOnDisk(meta);
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

              const store = readDiskStore(dataDir);
              const assetFiles: Record<string, string> = {};
              // Ensure all referenced project media assets are downloaded to disk before running FFmpeg export
              for (const clip of Object.values(project.clips) as Array<{ source?: { assetId?: string } }>) {
                const aid = clip.source?.assetId;
                if (!aid) continue;
                const meta = store.assets[aid];
                if (meta) {
                  await ensureAssetCachedOnDisk(meta);
                  if (fs.existsSync(meta.filePath)) {
                    assetFiles[aid] = meta.filePath;
                  }
                }
              }

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
