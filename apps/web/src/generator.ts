import {
  canOverwrite,
  defaultTransform,
  makeClip,
  regenerableClips,
  secToUs,
  type Asset,
  type Clip,
  type Op,
  type Project,
  type Scene,
} from "@vf/schema";

export type StockMediaMode =
  | "videos_and_photos"
  | "videos_only"
  | "photos_only"
  | "wikimedia_only"
  | "synthetic_seed";

export interface StockShotSpec {
  assetId: string;
  title: string;
  caption: string;
  tags: string[];
  mood: string;
  durationUs: number;
  kind?: "video" | "image";
  width?: number;
  height?: number;
  uri?: string;
  previewThumbUrl?: string;
  provider?: "pixabay" | "wikimedia" | "upload" | "seed";
  license?: Asset["license"];
  isUpload?: boolean;
  isLiveStock?: boolean;
}

export const STOCK_CATALOG: StockShotSpec[] = [
  {
    assetId: "stock_office",
    title: "Team Office Collaboration",
    caption: "people around a table in a bright office collaborating during team planning meeting",
    tags: ["team", "meeting", "office", "planning", "table", "work", "morning", "session", "colleagues"],
    mood: "energetic",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_chart",
    title: "Rising Financial Analytics",
    caption: "rising bar chart and revenue growth dashboard on analytics screen",
    tags: ["chart", "growth", "revenue", "sales", "finance", "metrics", "profit", "screen", "year", "data"],
    mood: "optimistic",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_code",
    title: "Software Engineering Laptop",
    caption: "hands typing code on a laptop building software and shipping release",
    tags: ["code", "laptop", "typing", "software", "developer", "engineering", "shipped", "version", "app", "tech"],
    mood: "focused",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_cloud",
    title: "Cloud Data Center Racks",
    caption: "server racks with blinking lights in cloud data center scaling infrastructure",
    tags: ["cloud", "server", "infrastructure", "scale", "traffic", "network", "security", "data", "system"],
    mood: "futuristic",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_nature",
    title: "Clean Energy Wind Turbines",
    caption: "wind turbines spinning on green hills at sunset clean energy sustainability",
    tags: ["energy", "green", "wind", "nature", "sustainable", "environment", "clean", "future", "hills"],
    mood: "inspiring",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_city",
    title: "Modern City Skyline",
    caption: "aerial timelapse of downtown city skyline and busy streets at dusk",
    tags: ["city", "skyline", "urban", "streets", "global", "world", "market", "business", "company"],
    mood: "dynamic",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_medical",
    title: "Clinical Tablet Diagnostics",
    caption: "physician doctor reviewing patient medical scan on digital tablet in clinic",
    tags: ["doctor", "medical", "health", "patient", "clinic", "hospital", "care", "scan", "science"],
    mood: "calm",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_customer",
    title: "Happy Customer Experience",
    caption: "smiling customer using mobile app at cafe checkout with fast service",
    tags: ["customer", "users", "client", "checkout", "phone", "mobile", "happy", "experience", "support"],
    mood: "warm",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_logistics",
    title: "Automated Warehouse & Port",
    caption: "autonomous warehouse robots and cargo containers moving global shipments",
    tags: ["warehouse", "shipping", "cargo", "supply", "logistics", "delivery", "robots", "automation", "packages"],
    mood: "serious",
    durationUs: secToUs(30),
  },
  {
    assetId: "stock_launch",
    title: "Product Launch Keynote",
    caption: "founder presenting product launch on stage to applauding audience",
    tags: ["launch", "stage", "keynote", "product", "vision", "announce", "future", "celebrate", "success"],
    mood: "inspiring",
    durationUs: secToUs(30),
  },
];

export interface ScriptPreset {
  id: string;
  label: string;
  mood: string;
  script: string;
}

export const SCRIPT_PRESETS: ScriptPreset[] = [
  {
    id: "product_launch",
    label: "Startup Product Launch (3 scenes)",
    mood: "energetic",
    script: [
      "Our team starts every morning with a quick planning session.",
      "Revenue grew steadily throughout the year.",
      "Then we shipped the first version to happy customers.",
    ].join("\n\n"),
  },
  {
    id: "cloud_infra",
    label: "Cloud Scale & Engineering (4 scenes)",
    mood: "futuristic",
    script: [
      "Global traffic across downtown city markets demanded a faster cloud architecture.",
      "Our engineering team wrote new software on their laptops to automate deployment.",
      "High-density cloud server racks now scale network security in real time.",
      "We announced the product launch on stage to celebrate with our users.",
    ].join("\n\n"),
  },
  {
    id: "clean_energy",
    label: "Clean Energy & Global Supply (4 scenes)",
    mood: "inspiring",
    script: [
      "Clean wind energy spinning over green hills powers our sustainable future.",
      "Autonomous warehouse robots and logistics containers move shipments around the world.",
      "Financial metrics and sales growth charts proved that green operations are profitable.",
      "Happy customers experience faster delivery right from their mobile phones.",
    ].join("\n\n"),
  },
  {
    id: "clinical_ai",
    label: "Clinical AI & Patient Care (3 scenes)",
    mood: "calm",
    script: [
      "Physicians in modern clinics review patient medical scans with greater precision.",
      "Secure cloud server infrastructure protects clinical data across every hospital.",
      "Our collaborative office team meets daily to support doctors and patients.",
    ].join("\n\n"),
  },
];

const uploadedCatalog = new Map<string, StockShotSpec>();
const liveStockCatalog = new Map<string, StockShotSpec>();

export function registerUploadedCatalogSpec(spec: StockShotSpec): void {
  uploadedCatalog.set(spec.assetId, { ...spec, isUpload: true, provider: "upload" });
}

export function registerLiveStockCatalogSpec(spec: StockShotSpec): void {
  liveStockCatalog.set(spec.assetId, { ...spec, isLiveStock: true });
}

export function getLiveStockAssetRecord(): Record<string, Asset> {
  const out: Record<string, Asset> = {};
  for (const spec of liveStockCatalog.values()) {
    out[spec.assetId] = {
      id: spec.assetId,
      type: spec.kind ?? "video",
      uri: spec.uri ?? `s3://vf/stock/${spec.assetId}.mp4`,
      durationUs: spec.durationUs,
      width: spec.width ?? 1280,
      height: spec.height ?? 720,
      fps: (spec.kind ?? "video") === "video" ? 30 : undefined,
      origin: "stock",
      license: spec.license,
    };
  }
  return out;
}

export function getAllCatalogSpecs(): StockShotSpec[] {
  return [...uploadedCatalog.values(), ...liveStockCatalog.values(), ...STOCK_CATALOG];
}

export function catalogAssetsRecord(): Record<string, Asset> {
  const out: Record<string, Asset> = {
    a1: { id: "a1", type: "video", uri: "s3://vf/demo-a1.mp4", durationUs: secToUs(30), origin: "stock" },
    a2: { id: "a2", type: "video", uri: "s3://vf/demo-a2.mp4", durationUs: secToUs(30), origin: "stock" },
    ...getLiveStockAssetRecord(),
  };
  for (const item of STOCK_CATALOG) {
    out[item.assetId] = {
      id: item.assetId,
      type: "video",
      uri: `s3://vf/${item.assetId}.mp4`,
      durationUs: item.durationUs,
      width: 1920,
      height: 1080,
      fps: 30,
      origin: "stock",
      license: { provider: "videoforge-seed", providerId: item.assetId, terms: "CC0" },
    };
  }
  return out;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "our", "we", "every", "then", "that", "this", "is", "are", "was", "were", "be", "been",
  "from", "into", "over", "throughout", "now", "across", "their", "around", "right",
]);

export function tokenizeText(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function inferMoodFromTokens(tokens: string[], fallback = "energetic"): string {
  const set = new Set(tokens);
  if (set.has("doctor") || set.has("medical") || set.has("clinic") || set.has("patient")) return "calm";
  if (set.has("energy") || set.has("wind") || set.has("launch") || set.has("stage")) return "inspiring";
  if (set.has("cloud") || set.has("server") || set.has("network")) return "futuristic";
  if (set.has("revenue") || set.has("growth") || set.has("chart") || set.has("profit")) return "optimistic";
  if (set.has("code") || set.has("laptop") || set.has("software") || set.has("engineering")) return "focused";
  if (set.has("customer") || set.has("happy") || set.has("phone")) return "warm";
  return fallback;
}

export function extractSceneIntent(narration: string, preferredMood?: string): Scene["intent"] {
  const tokens = tokenizeText(narration);
  const keywords = Array.from(new Set(tokens)).slice(0, 6);
  const mood =
    preferredMood && preferredMood !== "auto"
      ? preferredMood
      : inferMoodFromTokens(tokens, "energetic");
  return {
    literal: narration.trim(),
    keywords,
    mood,
  };
}

export interface RankedShotMatch {
  spec: StockShotSpec;
  score: number;
}

/**
 * Score and rank stock + uploaded shots against a scene's `intent` (`literal`, `keywords`, `mood`),
 * applying a repeat penalty for already-used assets.
 */
export function rankShotsForIntent(
  intent: Scene["intent"],
  usedAssetIds: Set<string> = new Set(),
): RankedShotMatch[] {
  const queryTokens = new Set([
    ...tokenizeText(intent.literal),
    ...tokenizeText(intent.abstract ?? ""),
    ...intent.keywords.map((k) => k.toLowerCase()),
  ]);

  const catalog = getAllCatalogSpecs();
  const scored = catalog.map((spec) => {
    const docTokens = new Set([...tokenizeText(spec.caption), ...spec.tags.map((t) => t.toLowerCase())]);
    let hits = 0;
    for (const qt of queryTokens) {
      if (docTokens.has(qt)) {
        hits += 1;
      } else {
        for (const dt of docTokens) {
          if (dt.startsWith(qt) || qt.startsWith(dt)) {
            hits += 0.6;
            break;
          }
        }
      }
    }
    const denom = Math.max(1, queryTokens.size);
    const semantic = Math.min(1, hits / denom);
    const moodBonus = intent.mood && intent.mood.toLowerCase() === spec.mood.toLowerCase() ? 0.1 : 0;
    const uploadBonus = spec.isUpload && hits > 0 ? 0.16 : 0;
    const liveStockBonus = spec.isLiveStock && hits > 0 ? 0.14 : 0;
    const repeatPenalty = usedAssetIds.has(spec.assetId) ? 0.25 : 0;
    const score = Number(
      Math.min(0.99, Math.max(0.05, 0.75 * semantic + moodBonus + uploadBonus + liveStockBonus - repeatPenalty)).toFixed(4),
    );
    return { spec, score };
  });

  scored.sort((a, b) => b.score - a.score || a.spec.assetId.localeCompare(b.spec.assetId));
  return scored;
}

export function splitScriptIntoSentences(script: string): string[] {
  return script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function estimateDurationUs(narration: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  // ~2.5 words/sec, clamped between 3s and 6s in integer microseconds
  const secs = Math.max(3, Math.min(6, Math.round(words / 2.5)));
  return secToUs(secs);
}

/**
 * Build a single atomic `batch` op (`actor: "ai"`) that generates or updates scenes and
 * timeline clips from a narration script while strictly respecting `canOverwrite(project, clip)`.
 */
export function buildGenerateFromScriptOp(
  project: Project,
  script: string,
  opts: { preferredMood?: string } = {},
): Op {
  const sentences = splitScriptIntoSentences(script);
  if (sentences.length === 0) {
    throw new Error("Script must contain at least one sentence.");
  }

  const ops: Op[] = [];

  // Ensure all catalog assets exist
  for (const [assetId, asset] of Object.entries(catalogAssetsRecord())) {
    if (!project.assets[assetId]) {
      ops.push({ type: "setProp", path: ["assets", assetId], value: asset });
    }
  }

  // Identify clips that CANNOT be overwritten (user-created, userModified, locked, or in locked scene)
  const protectedClipIds = new Set<string>();
  for (const clip of Object.values(project.clips)) {
    if (!canOverwrite(project, clip)) {
      protectedClipIds.add(clip.id);
    } else {
      ops.push({ type: "removeClip", id: clip.id });
    }
  }

  // Keep locked scenes or scenes that still own protected clips; create new scenes for the script
  const keptScenes: Scene[] = project.scenes
    .filter((s) => s.locked || s.clipIds.some((id) => protectedClipIds.has(id)))
    .map((s) => ({
      ...s,
      clipIds: s.clipIds.filter((id) => protectedClipIds.has(id)),
    }));

  const newScenes: Scene[] = sentences.map((narration, idx) => ({
    id: `scene_${idx + 1}`,
    narration,
    intent: extractSceneIntent(narration, opts.preferredMood),
    clipIds: [],
    locked: false,
  }));

  // Replace scenes array before adding new clips so `addClip` automatically populates `scene.clipIds`
  const mergedScenesById = new Map<string, Scene>();
  for (const s of keptScenes) mergedScenesById.set(s.id, s);
  for (const s of newScenes) {
    if (!mergedScenesById.has(s.id)) mergedScenesById.set(s.id, s);
  }
  const finalScenes = Array.from(mergedScenesById.values());
  ops.push({ type: "setProp", path: ["scenes"], value: finalScenes });

  // Find starting timeline offset after any protected clips
  let cursorUs = 0;
  for (const id of protectedClipIds) {
    const c = project.clips[id];
    if (c) cursorUs = Math.max(cursorUs, c.start + c.duration);
  }

  const usedAssets = new Set<string>();
  for (const id of protectedClipIds) {
    const c = project.clips[id];
    if (c?.source?.assetId) usedAssets.add(c.source.assetId);
  }

  for (let i = 0; i < newScenes.length; i++) {
    const scene = newScenes[i]!;
    // Skip generating AI clips if this scene ID was already locked or has protected clips
    const existingKept = keptScenes.find((s) => s.id === scene.id);
    if (existingKept && (existingKept.locked || existingKept.clipIds.length > 0)) {
      continue;
    }

    const durationUs = estimateDurationUs(scene.narration);
    const ranked = rankShotsForIntent(scene.intent, usedAssets);
    const best = ranked[0]!;
    usedAssets.add(best.spec.assetId);

    const vClipId = `ai_v_${scene.id}`;
    const tClipId = `ai_t_${scene.id}`;

    const vClip: Clip = makeClip({
      id: vClipId,
      trackId: "v1",
      kind: "media",
      start: cursorUs,
      duration: durationUs,
      sceneId: scene.id,
      source: { assetId: best.spec.assetId, in: 0, speed: 1 },
      transitionIn: i > 0 ? { type: "fade", duration: 300_000 } : undefined,
      transitionOut: { type: "fade", duration: 300_000 },
      provenance: {
        origin: "ai",
        locked: false,
        userModified: false,
        generator: { step: "match", score: best.score },
      },
    });

    const shortCaption =
      scene.narration.length > 48 ? `${scene.narration.slice(0, 45).trim()}...` : scene.narration;

    const tClip: Clip = makeClip({
      id: tClipId,
      trackId: "t1",
      kind: "text",
      start: cursorUs,
      duration: durationUs,
      sceneId: scene.id,
      text: {
        text: shortCaption,
        fontFamily: "sans-serif",
        fontSize: 44,
        color: "#ffffff",
        align: "center",
      },
      transform: {
        ...defaultTransform(),
        y: { value: 0.82 },
        scale: {
          keys: [
            { t: 0, v: 0.9, ease: "easeOut" },
            { t: 400_000, v: 1.0, ease: "easeOut" },
          ],
        },
      },
      provenance: {
        origin: "ai",
        locked: false,
        userModified: false,
        generator: { step: "script" },
      },
    });

    ops.push({ type: "addClip", clip: vClip });
    ops.push({ type: "addClip", clip: tClip });
    cursorUs += durationUs;
  }

  return { type: "batch", ops, label: "Generate first cut from script" };
}

/**
 * Build an AI regeneration op (`actor: "ai"`) for a specific scene that ONLY updates clips
 * where `canOverwrite(project, clip)` is true (via `regenerableClips`).
 */
export function buildRegenerateSceneOp(project: Project, sceneId: string): Op | null {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene || scene.locked) return null;

  const targetClips = regenerableClips(project, sceneId).filter((c) => c.kind === "media");
  if (targetClips.length === 0) return null;

  const ranked = rankShotsForIntent(scene.intent);
  const allAssets = catalogAssetsRecord();
  const ops: Op[] = [];

  for (const clip of targetClips) {
    const currentAssetId = clip.source?.assetId;
    const curIdx = ranked.findIndex((r) => r.spec.assetId === currentAssetId);
    const nextMatch = ranked[(curIdx + 1) % ranked.length]!;
    const nextId = nextMatch.spec.assetId;
    if (!project.assets[nextId] && allAssets[nextId]) {
      ops.push({
        type: "setProp",
        path: ["assets", nextId],
        value: allAssets[nextId],
      });
    }
    ops.push({
      type: "replaceMedia",
      clipId: clip.id,
      assetId: nextId,
      in: 0,
    });
  }

  return { type: "batch", ops, label: `Regenerate scene ${sceneId}` };
}
