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
  qualityScore?: number;
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
    qualityScore: 0.9,
  },
  {
    assetId: "stock_chart",
    title: "Rising Financial Analytics",
    caption: "rising bar chart and revenue growth dashboard on analytics screen",
    tags: ["chart", "growth", "revenue", "sales", "finance", "metrics", "profit", "screen", "year", "data"],
    mood: "optimistic",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_code",
    title: "Software Engineering Laptop",
    caption: "hands typing code on a laptop building software and shipping release",
    tags: ["code", "laptop", "typing", "software", "developer", "engineering", "shipped", "version", "app", "tech"],
    mood: "focused",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_cloud",
    title: "Cloud Data Center Racks",
    caption: "server racks with blinking lights in cloud data center scaling infrastructure",
    tags: ["cloud", "server", "infrastructure", "scale", "traffic", "network", "security", "data", "system"],
    mood: "futuristic",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_nature",
    title: "Clean Energy Wind Turbines",
    caption: "wind turbines spinning on green hills at sunset clean energy sustainability",
    tags: ["energy", "green", "wind", "nature", "sustainable", "environment", "clean", "future", "hills"],
    mood: "inspiring",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_city",
    title: "Modern City Skyline",
    caption: "aerial timelapse of downtown city skyline and busy streets at dusk",
    tags: ["city", "skyline", "urban", "streets", "global", "world", "market", "business", "company"],
    mood: "dynamic",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_medical",
    title: "Clinical Tablet Diagnostics",
    caption: "physician doctor reviewing patient medical scan on digital tablet in clinic",
    tags: ["doctor", "medical", "health", "patient", "clinic", "hospital", "care", "scan", "science"],
    mood: "calm",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_customer",
    title: "Happy Customer Experience",
    caption: "smiling customer using mobile app at cafe checkout with fast service",
    tags: ["customer", "users", "client", "checkout", "phone", "mobile", "happy", "experience", "support"],
    mood: "warm",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_logistics",
    title: "Automated Warehouse & Port",
    caption: "autonomous warehouse robots and cargo containers moving global shipments",
    tags: ["warehouse", "shipping", "cargo", "supply", "logistics", "delivery", "robots", "automation", "packages"],
    mood: "serious",
    durationUs: secToUs(30),
    qualityScore: 0.9,
  },
  {
    assetId: "stock_launch",
    title: "Product Launch Keynote",
    caption: "founder presenting product launch on stage to applauding audience",
    tags: ["launch", "stage", "keynote", "product", "vision", "announce", "future", "celebrate", "success"],
    mood: "inspiring",
    durationUs: secToUs(30),
    qualityScore: 0.9,
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

/**
 * Non-visual verbs, adverbs, and temporal fillers that dilute stock provider searches
 * (e.g. Pixabay AND-queries fail when verbs like "starts", "grew", "demanded" are included).
 */
const NON_VISUAL_FILLERS = new Set([
  "starts", "start", "started", "quick", "quickly", "grew", "steadily", "year", "years",
  "first", "version", "demanded", "faster", "fast", "wrote", "new", "proved", "prove",
  "daily", "meets", "meet", "support", "greater", "precision", "real", "time", "powers",
  "move", "moves", "moving", "experience", "announced", "announcing", "scales", "scale",
  "automatically", "under", "heavy", "transforming", "seconds", "stalled", "stay", "sort",
  "thousands", "per", "hour", "clock", "struggled", "keep", "open", "push", "past",
  "during", "early", "helps", "conserve", "iterate", "rapidly", "replacing", "learn",
  "sequence", "gather", "after", "showed", "incredible", "breaking", "down", "created",
  "weighing", "single", "changed", "entire", "built",
]);

interface VisualBrollArchetype {
  triggers: string[];
  literal: string;
  abstract: string;
  keywords: string[];
  mood: string;
}

const VISUAL_BROLL_ARCHETYPES: VisualBrollArchetype[] = [
  {
    triggers: ["team", "planning", "morning", "session", "meeting", "colleagues", "collaborative", "office"],
    literal: "people around a table in a bright office collaborating during team planning meeting",
    abstract: "collaboration teamwork planning",
    keywords: ["team", "meeting", "office", "planning"],
    mood: "energetic",
  },
  {
    triggers: ["revenue", "grew", "growth", "sales", "financial", "metrics", "profit", "profitable", "chart", "charts"],
    literal: "rising bar chart and revenue growth dashboard on analytics screen",
    abstract: "financial growth upward trend profit",
    keywords: ["chart", "growth", "revenue", "finance"],
    mood: "optimistic",
  },
  {
    triggers: ["code", "laptop", "laptops", "software", "engineering", "developer", "automate", "deployment"],
    literal: "hands typing code on a laptop building software and shipping release",
    abstract: "software deployment engineering launch",
    keywords: ["laptop", "typing", "code", "software"],
    mood: "focused",
  },
  {
    triggers: ["cloud", "server", "racks", "infrastructure", "datacenter", "network", "security"],
    literal: "server racks with blinking lights in cloud data center scaling infrastructure",
    abstract: "cloud scalability high availability network",
    keywords: ["server", "cloud", "network", "datacenter"],
    mood: "futuristic",
  },
  {
    triggers: ["wind", "turbines", "renewable", "energy", "green", "hills", "sustainable", "sustainability", "grid"],
    literal: "wind turbines spinning on green hills at sunset clean energy sustainability",
    abstract: "clean energy sustainability transition",
    keywords: ["wind", "energy", "green", "nature"],
    mood: "inspiring",
  },
  {
    triggers: ["downtown", "city", "skyline", "markets", "urban", "streets", "global", "traffic"],
    literal: "aerial timelapse of downtown city skyline and busy streets at dusk",
    abstract: "global markets urban connectivity scale",
    keywords: ["city", "skyline", "urban", "business"],
    mood: "dynamic",
  },
  {
    triggers: ["physician", "physicians", "doctor", "doctors", "medical", "patient", "scans", "clinic", "clinics", "hospital"],
    literal: "physician doctor reviewing patient medical scan on digital tablet in clinic",
    abstract: "healthcare diagnostics efficiency clinical",
    keywords: ["doctor", "medical", "patient", "clinic"],
    mood: "calm",
  },
  {
    triggers: ["customer", "customers", "happy", "checkout", "phone", "phones", "mobile", "users"],
    literal: "smiling customer using mobile app at cafe checkout with fast service",
    abstract: "customer satisfaction mobile experience service",
    keywords: ["customer", "mobile", "phone", "happy"],
    mood: "warm",
  },
  {
    triggers: ["warehouse", "robots", "logistics", "containers", "shipments", "cargo", "supply", "parcels", "packages"],
    literal: "autonomous warehouse robots and cargo containers moving global shipments",
    abstract: "automation robotics logistics supply chain",
    keywords: ["warehouse", "logistics", "cargo", "robots"],
    mood: "serious",
  },
  {
    triggers: ["launch", "stage", "keynote", "celebrate", "product", "announce", "announced"],
    literal: "founder presenting product launch on stage to applauding audience",
    abstract: "product launch keynote presentation celebration",
    keywords: ["launch", "stage", "keynote", "product"],
    mood: "inspiring",
  },
  {
    triggers: ["remote", "videocall", "zones", "homeoffice"],
    literal: "woman on video call waving at laptop in home office",
    abstract: "remote work global connection communication",
    keywords: ["remote", "laptop", "office", "meeting"],
    mood: "warm",
  },
  {
    triggers: ["coffee", "espresso", "barista", "cafe", "roasted"],
    literal: "barista pouring steamed milk into coffee cup",
    abstract: "artisan craft morning routine",
    keywords: ["coffee", "barista", "cafe", "espresso"],
    mood: "warm",
  },
  {
    triggers: ["cybersecurity", "threats", "monitors", "analyst"],
    literal: "analyst watching multiple monitors in dark control room",
    abstract: "cybersecurity vigilance threat monitoring",
    keywords: ["security", "monitors", "technology", "data"],
    mood: "focused",
  },
  {
    triggers: ["athletes", "runner", "training", "stairs", "fatigue", "endurance"],
    literal: "runner sprinting up stadium stairs at dawn",
    abstract: "endurance grit determination discipline",
    keywords: ["runner", "training", "fitness", "sport"],
    mood: "energetic",
  },
  {
    triggers: ["agriculture", "farmers", "farmland", "drone", "irrigation", "water"],
    literal: "drone flying over irrigated green farmland",
    abstract: "agritech smart farming conservation",
    keywords: ["farmland", "agriculture", "drone", "nature"],
    mood: "calm",
  },
  {
    triggers: ["designers", "wireframe", "ux", "prototyping", "interfaces"],
    literal: "hands arranging wireframe sketches and color swatches on desk",
    abstract: "ui ux design prototyping creativity",
    keywords: ["design", "creative", "office", "sketch"],
    mood: "energetic",
  },
  {
    triggers: ["electric", "vehicles", "ev", "charging", "fleets"],
    literal: "electric car plugged into charging station on city street",
    abstract: "clean mobility electrification transport",
    keywords: ["electric", "car", "charging", "transport"],
    mood: "futuristic",
  },
  {
    triggers: ["students", "classroom", "vr", "education", "simulations"],
    literal: "students wearing vr headsets in modern classroom",
    abstract: "edtech immersive learning education",
    keywords: ["students", "classroom", "education", "technology"],
    mood: "inspiring",
  },
  {
    triggers: ["biotech", "scientist", "laboratory", "pipette", "samples", "researchers"],
    literal: "scientist pipetting liquid into microplate in laboratory",
    abstract: "biotechnology genomics research precision",
    keywords: ["scientist", "laboratory", "science", "research"],
    mood: "focused",
  },
];

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

/**
 * Extracts a structured visual `Scene["intent"]` from narration text, enriching raw prose
 * with concrete B-roll `literal` descriptions, `abstract` themes, clean visual `keywords`
 * (without non-visual verbs), `mood`, and `avoid` filters.
 */
export function extractSceneIntent(narration: string, preferredMood?: string): Scene["intent"] {
  const rawTokens = tokenizeText(narration);
  const tokenSet = new Set(rawTokens);

  let bestArchetype: VisualBrollArchetype | undefined;
  let bestOverlap = 0;

  for (const arch of VISUAL_BROLL_ARCHETYPES) {
    let overlap = 0;
    for (const t of arch.triggers) {
      if (tokenSet.has(t)) overlap++;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestArchetype = arch;
    }
  }

  const visualTokens = rawTokens.filter((t) => !NON_VISUAL_FILLERS.has(t));
  const candidateKws = [
    ...(bestArchetype ? bestArchetype.keywords : []),
    ...visualTokens,
  ];
  const mergedKeywords = Array.from(
    new Set(candidateKws.length > 0 ? candidateKws : rawTokens),
  ).slice(0, 6);

  const mood =
    preferredMood && preferredMood !== "auto"
      ? preferredMood
      : bestArchetype?.mood ?? inferMoodFromTokens(rawTokens, "energetic");

  const literal = bestArchetype
    ? `${narration.trim()} — ${bestArchetype.literal}`
    : narration.trim();

  return {
    literal,
    abstract: bestArchetype?.abstract ?? visualTokens.slice(0, 4).join(" "),
    keywords: mergedKeywords,
    mood,
    avoid: ["watermark", "text", "logo", "diagram"],
  };
}

/**
 * Builds a tiered cascade of 1–3 clean, visual-first search queries for stock APIs
 * (Pixabay Videos, Pixabay Photos, Wikimedia Commons) from a scene's `intent`.
 */
export function buildSearchQueriesForIntent(intent: Scene["intent"], narration = ""): string[] {
  const visualKws = intent.keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 2 && !NON_VISUAL_FILLERS.has(k) && !STOPWORDS.has(k));

  const literalVisual = tokenizeText(intent.literal).filter((t) => !NON_VISUAL_FILLERS.has(t));
  const abstractVisual = tokenizeText(intent.abstract ?? "").filter((t) => !NON_VISUAL_FILLERS.has(t));

  const queries: string[] = [];

  if (visualKws.length >= 2) {
    queries.push(visualKws.slice(0, 2).join(" "));
  }
  if (visualKws.length >= 3) {
    queries.push(`${visualKws[0]} ${visualKws[2]}`);
  }
  if (abstractVisual.length >= 2) {
    queries.push(abstractVisual.slice(0, 2).join(" "));
  }
  if (literalVisual.length >= 2) {
    queries.push(literalVisual.slice(0, 2).join(" "));
  }
  if (visualKws.length >= 1) {
    queries.push(visualKws[0]!);
  }
  if (queries.length === 0) {
    const fallbackTokens = tokenizeText(narration);
    queries.push(fallbackTokens.slice(0, 2).join(" ") || "business office");
  }

  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(0, 3);
}

export interface RankedShotMatch {
  spec: StockShotSpec;
  score: number;
}

export interface RankShotsOptions {
  neededDurationUs?: number;
  preferredKind?: "video" | "image" | "any";
  previousChosenSpec?: StockShotSpec;
  onlyLiveStock?: boolean;
}

function durationFitScore(shotDurationUs: number, neededDurationUs: number): number {
  if (neededDurationUs <= 0 || shotDurationUs >= neededDurationUs) return 1.0;
  const floor = 0.6 * neededDurationUs;
  if (shotDurationUs <= floor) return 0.0;
  return (shotDurationUs - floor) / (neededDurationUs - floor);
}

function extractBigrams(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return out;
}

function candidateSimilarity(a: StockShotSpec, b: StockShotSpec): number {
  if (a.assetId === b.assetId) return 1.0;
  const setA = new Set([...tokenizeText(a.caption), ...a.tags.map((t) => t.toLowerCase())]);
  const setB = new Set([...tokenizeText(b.caption), ...b.tags.map((t) => t.toLowerCase())]);
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / Math.sqrt(setA.size * setB.size);
}

/**
 * Multi-signal shot ranker mirroring `services/matcher/matcher/{retrieve,rank,score}.py`:
 * combines unigram+bigram semantic similarity (`literal` + `0.65 * abstract`),
 * lexical keyword recall, Reciprocal Rank Fusion (RRF), duration fit, quality/aspect ratio,
 * mood match, and repeat/adjacency/avoid penalties.
 */
export function rankShotsForIntent(
  intent: Scene["intent"],
  usedAssetIds: Set<string> = new Set(),
  opts: RankShotsOptions = {},
): RankedShotMatch[] {
  const litTokens = tokenizeText(intent.literal);
  const absTokens = tokenizeText(intent.abstract ?? "");
  const kwTokens = intent.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  const avoidTokens = new Set((intent.avoid ?? []).map((a) => a.toLowerCase().trim()).filter(Boolean));

  const queryFeatures = new Set([
    ...litTokens,
    ...extractBigrams(litTokens),
    ...kwTokens,
  ]);
  const abstractFeatures = new Set([
    ...absTokens,
    ...extractBigrams(absTokens),
  ]);

  let catalog = getAllCatalogSpecs();
  if (opts.onlyLiveStock) {
    const liveOnly = catalog.filter((s) => s.isLiveStock || s.isUpload);
    if (liveOnly.length > 0) catalog = liveOnly;
  }

  const neededUs = opts.neededDurationUs ?? secToUs(4);

  // Compute raw semantic and lexical scores for RRF fusion
  const rawMetrics = catalog.map((spec) => {
    const capTokens = tokenizeText(spec.caption);
    const tagTokens = spec.tags.map((t) => t.toLowerCase().trim());
    const docTokens = new Set([...capTokens, ...tagTokens]);
    const docFeatures = new Set([...docTokens, ...extractBigrams(capTokens)]);

    let semHits = 0;
    for (const qf of queryFeatures) {
      if (docFeatures.has(qf)) {
        semHits += 1.0;
      } else if (!qf.includes("_")) {
        for (const dt of docTokens) {
          if (dt.startsWith(qf) || qf.startsWith(dt)) {
            semHits += 0.65;
            break;
          }
        }
      }
    }

    let absHits = 0;
    for (const af of abstractFeatures) {
      if (docFeatures.has(af)) {
        absHits += 1.0;
      } else if (!af.includes("_")) {
        for (const dt of docTokens) {
          if (dt.startsWith(af) || af.startsWith(dt)) {
            absHits += 0.55;
            break;
          }
        }
      }
    }

    let lexHits = 0;
    for (const kw of kwTokens) {
      if (docTokens.has(kw)) {
        lexHits += 1.0;
      } else {
        for (const dt of docTokens) {
          if (dt.startsWith(kw) || kw.startsWith(dt)) {
            lexHits += 0.6;
            break;
          }
        }
      }
    }

    const semNorm = Math.min(1.0, semHits / Math.max(1, Math.min(8, queryFeatures.size)));
    const absNorm = abstractFeatures.size > 0
      ? Math.min(1.0, absHits / Math.max(1, Math.min(6, abstractFeatures.size)))
      : 0;
    const semantic = Math.min(1.0, semNorm + 0.35 * absNorm);
    const lexical = kwTokens.length > 0 ? Math.min(1.0, lexHits / kwTokens.length) : semNorm;

    let disliked = false;
    for (const av of avoidTokens) {
      if (docTokens.has(av)) {
        disliked = true;
        break;
      }
    }

    return { spec, semantic, lexical, disliked, rawHits: semHits + lexHits };
  });

  // Reciprocal Rank Fusion (RRF) across semantic and lexical rankings
  const bySemantic = [...rawMetrics].sort((a, b) => b.semantic - a.semantic);
  const byLexical = [...rawMetrics].sort((a, b) => b.lexical - a.lexical);
  const rrfBonusMap = new Map<string, number>();
  const rrfK = 60;
  bySemantic.forEach((item, idx) => {
    rrfBonusMap.set(item.spec.assetId, (rrfBonusMap.get(item.spec.assetId) ?? 0) + 1 / (rrfK + idx + 1));
  });
  byLexical.forEach((item, idx) => {
    rrfBonusMap.set(item.spec.assetId, (rrfBonusMap.get(item.spec.assetId) ?? 0) + 1 / (rrfK + idx + 1));
  });

  const scored = rawMetrics.map(({ spec, semantic, lexical, disliked, rawHits }) => {
    const durFit = durationFitScore(spec.durationUs, neededUs);
    const isLandscape = (spec.width ?? 1920) >= (spec.height ?? 1080);
    const isHd = (spec.width ?? 1920) >= 1280;
    const baseQuality = spec.qualityScore ?? (isLandscape && isHd ? 0.85 : isLandscape ? 0.7 : 0.4);
    const kindBonus =
      opts.preferredKind && opts.preferredKind !== "any" && spec.kind === opts.preferredKind ? 0.06 : 0;

    const moodMatch =
      intent.mood && intent.mood.toLowerCase() === spec.mood.toLowerCase() ? 1.0 : 0.0;
    const uploadBonus = spec.isUpload && rawHits > 0 ? 0.16 : 0;
    const liveStockBonus = spec.isLiveStock && rawHits > 0 ? 0.14 : 0;
    const rrfNormalized = (rrfBonusMap.get(spec.assetId) ?? 0) * (rrfK / 2); // 0..1

    const repeatPenalty = usedAssetIds.has(spec.assetId) ? 0.55 : 0;
    const adjPenalty = opts.previousChosenSpec
      ? 0.20 * candidateSimilarity(spec, opts.previousChosenSpec)
      : 0;
    const dislikePenalty = disliked ? 0.35 : 0;

    const rawScore =
      0.42 * semantic +
      0.18 * lexical +
      0.10 * rrfNormalized +
      0.10 * baseQuality +
      0.08 * durFit +
      0.08 * moodMatch +
      kindBonus +
      uploadBonus +
      liveStockBonus -
      repeatPenalty -
      adjPenalty -
      dislikePenalty;

    const score = Number(Math.min(0.99, Math.max(0.05, rawScore)).toFixed(4));
    return { spec, score };
  });

  scored.sort((a, b) => b.score - a.score || a.spec.assetId.localeCompare(b.spec.assetId));
  return scored;
}

/**
 * Whole-video sequential shot assignment across multiple scenes with repeat and adjacency penalties.
 */
export function assignSequentialShotsForScenes(
  scenes: Array<{ id: string; intent: Scene["intent"]; durationUs?: number }>,
  opts: {
    initialUsedAssetIds?: Iterable<string>;
    preferredKind?: "video" | "image" | "any";
    onlyLiveStock?: boolean;
  } = {},
): Map<string, RankedShotMatch> {
  const used = new Set<string>(opts.initialUsedAssetIds ?? []);
  const assignments = new Map<string, RankedShotMatch>();
  let previousChosenSpec: StockShotSpec | undefined;

  for (const scene of scenes) {
    const ranked = rankShotsForIntent(scene.intent, used, {
      neededDurationUs: scene.durationUs ?? secToUs(4),
      preferredKind: opts.preferredKind,
      previousChosenSpec,
      onlyLiveStock: opts.onlyLiveStock,
    });
    const best = ranked.find((r) => !used.has(r.spec.assetId)) ?? ranked[0];
    if (best) {
      assignments.set(scene.id, best);
      used.add(best.spec.assetId);
      previousChosenSpec = best.spec;
    }
  }

  return assignments;
}

export function splitScriptIntoSentences(script: string): string[] {
  return script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function estimateDurationUs(narration: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  const clausePauses = (narration.match(/[,;:—–-]/g) ?? []).length * 0.25;
  // ~2.5 words/sec + punctuation cadence, clamped between 3s and 6s in integer microseconds
  const secs = Math.max(3, Math.min(6, Math.round(words / 2.5 + clausePauses)));
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

  const sceneDurations = new Map<string, number>();
  for (const s of newScenes) {
    sceneDurations.set(s.id, estimateDurationUs(s.narration));
  }

  const sequentialAssignments = assignSequentialShotsForScenes(
    newScenes.map((s) => ({
      id: s.id,
      intent: s.intent,
      durationUs: sceneDurations.get(s.id) ?? secToUs(4),
    })),
    { initialUsedAssetIds: usedAssets },
  );

  for (let i = 0; i < newScenes.length; i++) {
    const scene = newScenes[i]!;
    // Skip generating AI clips if this scene ID was already locked or has protected clips
    const existingKept = keptScenes.find((s) => s.id === scene.id);
    if (existingKept && (existingKept.locked || existingKept.clipIds.length > 0)) {
      continue;
    }

    const durationUs = sceneDurations.get(scene.id) ?? estimateDurationUs(scene.narration);
    const best = sequentialAssignments.get(scene.id) ?? rankShotsForIntent(scene.intent, usedAssets)[0]!;
    usedAssets.add(best.spec.assetId);

    const vClipId = `ai_v_${scene.id}`;
    const tClipId = `ai_t_${scene.id}`;

    // Subtle alternating Ken Burns motion (clip-local keyframe `t` in integer microseconds)
    const startScale = i % 2 === 0 ? 1.0 : 1.06;
    const endScale = i % 2 === 0 ? 1.06 : 1.0;

    const vClip: Clip = makeClip({
      id: vClipId,
      trackId: "v1",
      kind: "media",
      start: cursorUs,
      duration: durationUs,
      sceneId: scene.id,
      source: { assetId: best.spec.assetId, in: 0, speed: 1 },
      transform: {
        ...defaultTransform(),
        scale: {
          keys: [
            { t: 0, v: startScale, ease: "easeInOut" },
            { t: durationUs, v: endScale, ease: "easeInOut" },
          ],
        },
      },
      transitionIn: i > 0 ? { type: "fade", duration: 300_000 } : undefined,
      transitionOut: { type: "fade", duration: 300_000 },
      provenance: {
        origin: "ai",
        locked: false,
        userModified: false,
        generator: { step: "match", candidateSetId: scene.id, score: best.score },
      },
    });

    const shortCaption =
      scene.narration.length > 54 ? `${scene.narration.slice(0, 51).trim()}...` : scene.narration;

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
    const spec = nextMatch.spec;
    const catalogAsset = allAssets[nextId];
    const kind: "video" | "image" =
      spec.kind ??
      (nextId.startsWith("pxi_") || nextId.startsWith("wiki_") ? "image" : "video");
    const safeDurationUs = Math.max(
      spec.durationUs || secToUs(30),
      catalogAsset?.durationUs || secToUs(30),
      clip.duration * 2,
      secToUs(30),
    );

    const assetObj: Asset = catalogAsset
      ? { ...catalogAsset, durationUs: safeDurationUs }
      : {
          id: nextId,
          type: kind,
          uri:
            spec.uri ||
            `s3://vf/stock/${nextId}.${kind === "image" ? "jpg" : "mp4"}`,
          durationUs: safeDurationUs,
          width: spec.width ?? 1280,
          height: spec.height ?? 720,
          fps: kind === "video" ? 30 : undefined,
          origin: spec.isUpload ? ("upload" as const) : ("stock" as const),
          license: spec.license,
        };

    ops.push({
      type: "setProp",
      path: ["assets", nextId],
      value: assetObj,
    });
    ops.push({
      type: "replaceMedia",
      clipId: clip.id,
      assetId: nextId,
      in: 0,
    });
    ops.push({
      type: "setProp",
      path: ["clips", clip.id, "provenance", "generator"],
      value: {
        step: "match",
        candidateSetId: scene.id,
        score: nextMatch.score,
      },
    });
  }

  return { type: "batch", ops, label: `Regenerate scene ${sceneId}` };
}
