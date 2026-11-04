import React, { useState } from "react";
import {
  MasterVideoState,
  Scene,
  GraphicOverlay,
  ThreeDScenePreset,
  SlideTransitionStyle,
  CameraMotionType,
  CaptionStyleConfig,
  CaptionPresetId,
  CaptionFontFamily,
  CaptionHighlightStyle,
  CaptionBackgroundStyle,
  DEFAULT_CAPTION_CONFIG,
} from "@/types/schema";
import {
  Sliders,
  Sparkles,
  Smile,
  Image as ImageIcon,
  Layers,
  Trash2,
  Wand2,
  Loader2,
  Check,
  Code,
  TrendingUp,
  CreditCard,
  PieChart,
  Eye,
  EyeOff,
  Trophy,
  Landmark,
  Coins,
  Orbit,
  Cpu,
  Film,
  Box,
  BarChart3,
  Swords,
  Quote,
  Clock,
  Type,
  Search,
  Upload,
  Video as VideoIcon,
  Plus,
} from "lucide-react";

interface RightInspectorPanelProps {
  state: MasterVideoState;
  selectedSceneId: string;
  onUpdateState: (updater: (prev: MasterVideoState) => MasterVideoState) => void;
}

const MASCOT_POSES: Array<{
  id: Scene["mascot"]["pose"];
  label: string;
  preview: string;
  desc: string;
}> = [
  { id: "neutral", label: "Neutral", preview: "/mascot/neutral.svg", desc: "Attentive baseline stance" },
  { id: "explaining", label: "Explaining", preview: "/mascot/explaining.svg", desc: "Open palms presentation" },
  { id: "shocked", label: "Shocked", preview: "/mascot/shocked.svg", desc: "Gasp & high energy impact" },
  { id: "pointing", label: "Pointing", preview: "/mascot/pointing.svg", desc: "Directing viewer focus" },
];

const THREE_D_PRESETS: Array<{ id: ThreeDScenePreset; label: string; desc: string }> = [
  { id: "cyber-globe", label: "Cyber Globe", desc: "3D geodesic sphere & orbital rings" },
  { id: "floating-cubes", label: "3D Polyhedra", desc: "Floating isometric data crystals" },
  { id: "neural-network", label: "Neural Web", desc: "3D interconnected synaptic nodes" },
  { id: "energy-torus", label: "Energy Torus", desc: "Rotating 3D sacred geometry knot" },
  { id: "trophy-arena", label: "3D Trophy", desc: "Metallic gold championship emblem" },
  { id: "starfield-warp", label: "Warp Tunnel", desc: "High-speed 3D depth starfield" },
  { id: "none", label: "None (2D Only)", desc: "Disable WebGL 3D layer" },
];

const SLIDE_TRANSITIONS: Array<{ id: SlideTransitionStyle; label: string }> = [
  { id: "zoom-punch", label: "Zoom Punch" },
  { id: "slide-left", label: "Whip Slide" },
  { id: "flip-3d", label: "3D Card Flip" },
  { id: "wipe-up", label: "Vertical Wipe" },
  { id: "fade", label: "Cross Dissolve" },
  { id: "cut", label: "Hard Cut" },
];

const CAMERA_MOTIONS: Array<{ id: CameraMotionType; label: string }> = [
  { id: "zoom-in", label: "Zoom In" },
  { id: "zoom-out", label: "Zoom Out" },
  { id: "pan-left", label: "Pan Left" },
  { id: "pan-right", label: "Pan Right" },
  { id: "tilt-3d", label: "3D Tilt" },
  { id: "static", label: "Static" },
];

const COLOR_PRESETS = [
  { label: "Obsidian Slate", value: "#0f172a" },
  { label: "Crimson Arena", value: "#991b1b" },
  { label: "Emerald Abyss", value: "#064e3b" },
  { label: "Deep Amber / Rome", value: "#311005" },
  { label: "Midnight Indigo", value: "#1e1b4b" },
  { label: "Cosmic Charcoal", value: "#090d16" },
  { label: "Royal Gold", value: "#78350f" },
  { label: "Steel Blue", value: "#172554" },
];

const GENRE_PROMPT_PRESETS = [
  {
    label: "Sports Arena",
    icon: Trophy,
    prompt: "Old Trafford stadium under electric arena floodlights at night, pitch turf perspective, atmospheric mist, cinematic 8k wallpaper",
  },
  {
    label: "Wall Street",
    icon: Coins,
    prompt: "Wall Street financial trading floor with glowing emerald candlestick charts and holographic market tickers, dark graphite architecture, 8k",
  },
  {
    label: "Ancient Rome",
    icon: Landmark,
    prompt: "Monumental Roman Colosseum with marble columns and antique warm sepia chiaroscuro illumination, historical documentary lighting",
  },
  {
    label: "Deep Space",
    icon: Orbit,
    prompt: "Deep cosmic starfield with violet interstellar nebula dust clouds and tilted planetary orbital rings, photorealistic astrophysics",
  },
  {
    label: "Cyber Matrix",
    icon: Cpu,
    prompt: "Minimalist dark slate developer studio with ambient purple rim lighting and isometric data vectors, modern tech aesthetic",
  },
  {
    label: "Noir Cinema",
    icon: Film,
    prompt: "Moody dramatic cinema stage with volumetric light cones and mysterious architectural shadows, 35mm film still",
  },
];

const VEED_CAPTION_PRESETS: Array<{
  id: CaptionPresetId;
  label: string;
  badge: string;
  previewBg: string;
  previewHighlight: string;
  config: Partial<CaptionStyleConfig>;
}> = [
  {
    id: "veed-box",
    label: "Veed Box",
    badge: "Active Pill",
    previewBg: "#6366f1",
    previewHighlight: "#ffffff",
    config: {
      preset: "veed-box",
      fontFamily: "Montserrat",
      fontSize: 42,
      highlightStyle: "box-highlight",
      highlightColor: "#6366f1",
      textColor: "#ffffff",
      backgroundStyle: "glass-pill",
      textTransform: "uppercase",
      wordsPerChunk: 4,
      strokeWidth: 0,
    },
  },
  {
    id: "hormozi",
    label: "Hormozi Pop",
    badge: "Viral Stroke",
    previewBg: "transparent",
    previewHighlight: "#fbbf24",
    config: {
      preset: "hormozi",
      fontFamily: "Montserrat",
      fontSize: 48,
      highlightStyle: "pop-scale",
      highlightColor: "#fbbf24",
      textColor: "#ffffff",
      backgroundStyle: "none",
      textTransform: "uppercase",
      wordsPerChunk: 3,
      strokeWidth: 3,
    },
  },
  {
    id: "karaoke",
    label: "Karaoke Fill",
    badge: "Smooth Wipe",
    previewBg: "rgba(16,185,129,0.2)",
    previewHighlight: "#10b981",
    config: {
      preset: "karaoke",
      fontFamily: "Space Grotesk",
      fontSize: 42,
      highlightStyle: "karaoke-fill",
      highlightColor: "#10b981",
      textColor: "#ffffff",
      backgroundStyle: "glass-pill",
      textTransform: "uppercase",
      wordsPerChunk: 4,
      strokeWidth: 0,
    },
  },
  {
    id: "neon-glow",
    label: "Neon Cyber",
    badge: "Glow Aura",
    previewBg: "#090d16",
    previewHighlight: "#38bdf8",
    config: {
      preset: "neon-glow",
      fontFamily: "Space Grotesk",
      fontSize: 42,
      highlightStyle: "neon-pulse",
      highlightColor: "#38bdf8",
      textColor: "#ffffff",
      backgroundStyle: "solid-dark",
      textTransform: "uppercase",
      wordsPerChunk: 4,
      strokeWidth: 0,
    },
  },
  {
    id: "word-slam",
    label: "1-Word Slam",
    badge: "Punchy",
    previewBg: "transparent",
    previewHighlight: "#f43f5e",
    config: {
      preset: "word-slam",
      fontFamily: "Bangers",
      fontSize: 58,
      highlightStyle: "pop-scale",
      highlightColor: "#f43f5e",
      textColor: "#ffffff",
      backgroundStyle: "none",
      textTransform: "uppercase",
      wordsPerChunk: 1,
      strokeWidth: 3,
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    badge: "Underline",
    previewBg: "rgba(15,23,42,0.8)",
    previewHighlight: "#f59e0b",
    config: {
      preset: "editorial",
      fontFamily: "Playfair Display",
      fontSize: 38,
      highlightStyle: "underline-slide",
      highlightColor: "#f59e0b",
      textColor: "#f8fafc",
      backgroundStyle: "glass-pill",
      textTransform: "none",
      wordsPerChunk: 5,
      strokeWidth: 0,
    },
  },
];

const CAPTION_FONTS: Array<{ id: CaptionFontFamily; label: string; sample: string }> = [
  { id: "Montserrat", label: "Montserrat", sample: "BOLD VIRAL" },
  { id: "Inter", label: "Inter", sample: "Clean Studio" },
  { id: "Space Grotesk", label: "Space Grotesk", sample: "TECH MODERN" },
  { id: "Playfair Display", label: "Playfair Serif", sample: "Editorial Story" },
  { id: "JetBrains Mono", label: "JetBrains Mono", sample: "CODE_SYNC" },
  { id: "Bangers", label: "Bangers Comic", sample: "SLAM IMPACT!" },
];

const HIGHLIGHT_STYLES: Array<{ id: CaptionHighlightStyle; label: string; desc: string }> = [
  { id: "box-highlight", label: "Veed Box Pill", desc: "Colored rounded box behind active word" },
  { id: "pop-scale", label: "Spring Word Pop", desc: "Active word bounces & scales up" },
  { id: "karaoke-fill", label: "Karaoke Wipe", desc: "Smooth left-to-right color fill" },
  { id: "underline-slide", label: "Underline Bar", desc: "Animated glowing bar beneath word" },
  { id: "neon-pulse", label: "Neon Cyber Glow", desc: "Multi-layer outer neon aura" },
];

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
  state,
  selectedSceneId,
  onUpdateState,
}) => {
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [activeTab, setActiveTab] = useState<"subs" | "3d" | "background" | "mascot" | "overlays">("subs");
  const [brollQuery, setBrollQuery] = useState("");
  const [brollResults, setBrollResults] = useState<any[]>([]);
  const [isSearchingBroll, setIsSearchingBroll] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const captionCfg: CaptionStyleConfig = {
    ...DEFAULT_CAPTION_CONFIG,
    ...(state.captionConfig || {}),
  };

  const updateCaptionConfig = (patch: Partial<CaptionStyleConfig>) => {
    onUpdateState((prev) => ({
      ...prev,
      captionConfig: {
        ...DEFAULT_CAPTION_CONFIG,
        ...(prev.captionConfig || {}),
        ...patch,
      },
    }));
  };

  const scene = state.scenes.find((s) => s.id === selectedSceneId);
  const sceneIdx = state.scenes.findIndex((s) => s.id === selectedSceneId);

  if (!scene) {
    return (
      <aside className="w-[25%] min-w-[290px] max-w-[390px] h-[calc(100vh-4rem)] bg-studio-975 border-l border-white/[0.07] p-6 flex flex-col items-center justify-center text-center text-slate-500">
        <Sliders className="w-8 h-8 mb-2 opacity-30 text-indigo-400" />
        <p className="text-sm font-bold text-slate-300">No scene selected</p>
        <p className="text-xs text-slate-500 mt-1">Select a scene from the feed to inspect and modify</p>
      </aside>
    );
  }

  const updateScene = (updater: (s: Scene) => Scene) => {
    onUpdateState((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === scene.id ? updater(s) : s)),
    }));
  };

  const handleGenerateFluxBackground = async () => {
    setIsGeneratingBg(true);
    try {
      const res = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: scene.background.prompt || "Moody futuristic studio with volumetric neon lights, 8k",
          motion: scene.background.motion,
          width: state.metadata.width,
          height: state.metadata.height,
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        updateScene((s) => ({
          ...s,
          background: {
            ...s.background,
            type: "flux_klein",
            src: data.imageUrl,
          },
        }));
      }
    } catch (err) {
      console.error("FLUX generation failed:", err);
    } finally {
      setIsGeneratingBg(false);
    }
  };

  const handleAddOverlay = (type: GraphicOverlay["type"]) => {
    const id = `overlay-${Date.now()}`;
    let props: Record<string, any> = {};

    if (type === "stat-counter") {
      props = { label: "Performance", targetValue: 100, prefix: "+", suffix: "%", accentColor: "#6366f1" };
    } else if (type === "lower-third") {
      props = { title: "Semantic Anchoring", subtitle: "Speech drives frames", category: "FEATURE" };
    } else if (type === "progress-ring") {
      props = { label: "Progress", percentage: 95, color: "#10b981" };
    } else if (type === "code-snippet") {
      props = { filename: "engine.ts", code: `const duration = audio.length;\nlock(duration * 30);` };
    } else if (type === "bar-chart") {
      props = {
        title: "Market Comparison",
        unit: "%",
        bars: [
          { label: "Top Contender", value: 94, color: "#6366f1" },
          { label: "Runner Up", value: 68, color: "#38bdf8" },
          { label: "Average", value: 42, color: "#64748b" },
        ],
      };
    } else if (type === "versus-battle") {
      props = {
        title: "HEAD TO HEAD",
        leftName: "Manchester Utd",
        leftStat: "20 Titles",
        leftColor: "#ef4444",
        rightName: "Liverpool",
        rightStat: "19 Titles",
        rightColor: "#38bdf8",
      };
    } else if (type === "quote-card") {
      props = {
        quote: "Relentless reinvention is the only path to staying at the top.",
        author: "Studio Insight",
        role: "Core Principle",
        accentColor: "#f59e0b",
      };
    } else if (type === "timeline-milestone") {
      props = {
        year: "1999",
        eventTitle: "Historic Treble Victory",
        detail: "Champions League, Premier League & FA Cup",
        accentColor: "#10b981",
      };
    } else if (type === "kinetic-title") {
      props = {
        topTag: "BREAKING INSIGHT",
        headline: "UNSTOPPABLE DYNASTY",
        accentColor: "#6366f1",
      };
    } else if (type === "media-card") {
      props = {
        title: "B-Roll Feed",
        badge: "LIVE PIP",
        caption: "Source Visual Reference",
        mediaUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
        mediaType: "auto",
        accentColor: "#6366f1",
        tilt3D: true,
      };
    }

    updateScene((s) => ({
      ...s,
      overlays: [...s.overlays, { id, type, props }],
    }));
  };

  const handleSearchBroll = async (customQuery?: string) => {
    const q = (customQuery ?? brollQuery).trim() || scene.scriptText.slice(0, 48);
    setIsSearchingBroll(true);
    try {
      const res = await fetch(`/api/broll?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.items) {
        setBrollResults(data.items);
      }
    } catch (e) {
      console.error("B-Roll search error:", e);
    } finally {
      setIsSearchingBroll(false);
    }
  };

  const handleUploadFile = async (file: File, target: "background" | "pip") => {
    if (!file) return;
    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-media", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        if (target === "background") {
          updateScene((s) => ({
            ...s,
            background: {
              ...s.background,
              type: data.mediaType === "video" ? "video" : "stock",
              src: data.url,
            },
          }));
        } else {
          const id = `overlay-${Date.now()}`;
          updateScene((s) => ({
            ...s,
            overlays: [
              ...s.overlays,
              {
                id,
                type: "media-card",
                props: {
                  title: file.name.replace(/\.[^.]+$/, "").slice(0, 24),
                  badge: data.mediaType === "video" ? "VIDEO PIP" : "SCREENSHOT",
                  caption: "Uploaded Studio Media",
                  mediaUrl: data.url,
                  mediaType: data.mediaType,
                  accentColor: "#6366f1",
                  tilt3D: true,
                },
              },
            ],
          }));
        }
      }
    } catch (err) {
      console.error("Media upload failed:", err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleUpdateOverlayProps = (overlayId: string, newProps: Record<string, any>) => {
    updateScene((s) => ({
      ...s,
      overlays: s.overlays.map((o) => (o.id === overlayId ? { ...o, props: newProps } : o)),
    }));
  };

  const handleDeleteOverlay = (overlayId: string) => {
    updateScene((s) => ({
      ...s,
      overlays: s.overlays.filter((o) => o.id !== overlayId),
    }));
  };

  return (
    <aside className="w-[25%] min-w-[290px] max-w-[390px] h-[calc(100vh-4rem)] bg-studio-975 border-l border-white/[0.07] flex flex-col select-none">
      {/* Top Scene Identifier Header */}
      <div className="p-4 border-b border-white/[0.07] bg-studio-950/70 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-studio-accent" />
          <h2 className="text-xs font-bold text-white tracking-wider uppercase">
            Scene {sceneIdx + 1} Inspector
          </h2>
        </div>
        <span className="text-[11px] text-indigo-300 font-mono bg-studio-900 border border-white/[0.08] px-2 py-0.5 rounded-full font-bold tabular-nums">
          {scene.durationInFrames}f ({(scene.durationInFrames / 30).toFixed(1)}s)
        </span>
      </div>

      {/* 5-Tab Segmented Navigation */}
      <div className="p-2 border-b border-white/[0.07] bg-studio-950/40">
        <div className="grid grid-cols-5 gap-1 bg-studio-900 p-1 rounded-xl border border-white/[0.06] text-[10px]">
          <button
            onClick={() => setActiveTab("subs")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === "subs"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Type className="w-3 h-3" />
            <span>Subs</span>
          </button>

          <button
            onClick={() => setActiveTab("3d")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === "3d"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Box className="w-3 h-3" />
            <span>3D</span>
          </button>

          <button
            onClick={() => setActiveTab("background")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === "background"
                ? "bg-studio-accent text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            <span>Bg</span>
          </button>

          <button
            onClick={() => setActiveTab("mascot")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === "mascot"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smile className="w-3 h-3" />
            <span>Mascot</span>
          </button>

          <button
            onClick={() => setActiveTab("overlays")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === "overlays"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* ================= VEED.IO SUBTITLES STUDIO TAB ================= */}
        {activeTab === "subs" && (
          <div className="space-y-4">
            {/* 1. Veed.io 1-Click Style Presets */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Veed.io Subtitle Presets
                </span>
                <span className="text-[10px] font-mono text-slate-400">1-Click Style</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {VEED_CAPTION_PRESETS.map((p) => {
                  const isSelected = captionCfg.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => updateCaptionConfig(p.config)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-violet-500/15 border-violet-500/70 ring-1 ring-violet-500/40"
                          : "bg-studio-950/70 border-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-[11px] font-bold text-white">{p.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300">
                          {p.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-black tracking-tight">
                        <span className="text-slate-400">WORD</span>
                        <span
                          style={{
                            background: p.previewBg,
                            color: p.previewHighlight,
                            padding: "1px 6px",
                            borderRadius: 6,
                          }}
                        >
                          SYNC
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Font Family Selector */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Font Family
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CAPTION_FONTS.map((f) => {
                  const isSelected = captionCfg.fontFamily === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => updateCaptionConfig({ fontFamily: f.id })}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-violet-600/20 border-violet-500 text-white"
                          : "bg-studio-950 border-white/[0.06] text-slate-300 hover:border-white/15"
                      }`}
                    >
                      <div className="text-[10px] text-slate-400">{f.label}</div>
                      <div
                        className="text-xs font-bold text-white truncate mt-0.5"
                        style={{ fontFamily: f.id }}
                      >
                        {f.sample}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Word Highlight Animation Style */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Active Word Highlight Style
              </label>
              <div className="space-y-1.5">
                {HIGHLIGHT_STYLES.map((hs) => {
                  const isSelected = captionCfg.highlightStyle === hs.id;
                  return (
                    <button
                      key={hs.id}
                      onClick={() => updateCaptionConfig({ highlightStyle: hs.id })}
                      className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-violet-600/20 border-violet-500 text-white"
                          : "bg-studio-950 border-white/[0.06] text-slate-300 hover:border-white/15"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{hs.label}</div>
                        <div className="text-[10px] text-slate-400">{hs.desc}</div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Colors (Highlight & Text) */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Active Highlight Color
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {captionCfg.highlightColor}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {["#6366f1", "#fbbf24", "#10b981", "#f43f5e", "#38bdf8", "#a855f7", "#ef4444"].map(
                    (hex) => (
                      <button
                        key={hex}
                        onClick={() => updateCaptionConfig({ highlightColor: hex })}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          captionCfg.highlightColor === hex
                            ? "scale-110 border-white ring-2 ring-white/30"
                            : "border-white/20 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    )
                  )}
                  <input
                    type="color"
                    value={captionCfg.highlightColor}
                    onChange={(e) => updateCaptionConfig({ highlightColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 ml-auto"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Spoken Text Color
                </label>
                <div className="flex items-center gap-1.5">
                  {["#ffffff", "#f8fafc", "#fef08a", "#bae6fd"].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => updateCaptionConfig({ textColor: hex })}
                      className={`w-5 h-5 rounded-full border ${
                        captionCfg.textColor === hex
                          ? "border-violet-400 ring-2 ring-violet-400/40"
                          : "border-white/20"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    type="color"
                    value={captionCfg.textColor}
                    onChange={(e) => updateCaptionConfig({ textColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>
            </div>

            {/* 5. Size, Chunking, Backdrop & Case */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              {/* Font Size */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-slate-300">Font Size</span>
                  <span className="font-mono text-violet-300">{captionCfg.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={28}
                  max={64}
                  step={2}
                  value={captionCfg.fontSize}
                  onChange={(e) =>
                    updateCaptionConfig({ fontSize: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-violet-500 cursor-pointer"
                />
              </div>

              {/* Words Per Chunk */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Words Per Line (Pacing)
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 6].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => updateCaptionConfig({ wordsPerChunk: cnt })}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        captionCfg.wordsPerChunk === cnt
                          ? "bg-violet-600/25 border-violet-500 text-white"
                          : "bg-studio-950 border-white/[0.06] text-slate-400 hover:text-white"
                      }`}
                    >
                      {cnt === 1 ? "1 Slam" : `${cnt}w`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Container Backdrop Style */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Caption Backdrop
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: "glass-pill", label: "Glass Pill" },
                      { id: "solid-dark", label: "Solid Box" },
                      { id: "none", label: "Floating" },
                    ] as Array<{ id: CaptionBackgroundStyle; label: string }>
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() =>
                        updateCaptionConfig({
                          backgroundStyle: bg.id,
                          strokeWidth: bg.id === "none" ? 3 : 0,
                        })
                      }
                      className={`py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                        captionCfg.backgroundStyle === bg.id
                          ? "bg-violet-600/25 border-violet-500 text-white"
                          : "bg-studio-950 border-white/[0.06] text-slate-400 hover:text-white"
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Case & Position */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Text Case
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "uppercase", label: "AA" },
                        { id: "capitalize", label: "Aa" },
                        { id: "none", label: "aa" },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => updateCaptionConfig({ textTransform: c.id })}
                        className={`py-1 rounded border text-[11px] font-bold ${
                          captionCfg.textTransform === c.id
                            ? "bg-violet-600/25 border-violet-500 text-white"
                            : "bg-studio-950 border-white/[0.06] text-slate-400"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Stage Zone
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["bottom", "middle", "top"] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => updateCaptionConfig({ verticalPosition: pos })}
                        className={`py-1 rounded border text-[10px] font-bold capitalize ${
                          captionCfg.verticalPosition === pos
                            ? "bg-violet-600/25 border-violet-500 text-white"
                            : "bg-studio-950 border-white/[0.06] text-slate-400"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Precision Sync Offset Calibration */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Audio-to-Word Sync Fine-Tune
                </span>
                <button
                  onClick={() => updateCaptionConfig({ syncOffsetFrames: 0 })}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                >
                  {captionCfg.syncOffsetFrames === 0
                    ? "0ms (16kHz Locked)"
                    : `${captionCfg.syncOffsetFrames > 0 ? "+" : ""}${Math.round(
                        captionCfg.syncOffsetFrames * 33.3
                      )}ms • Reset`}
                </button>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={captionCfg.syncOffsetFrames || 0}
                onChange={(e) =>
                  updateCaptionConfig({ syncOffsetFrames: parseInt(e.target.value, 10) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Earlier (-400ms)</span>
                <span>Exact Whisper 16kHz</span>
                <span>Later (+400ms)</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= 3D & TRANSITIONS TAB ================= */}
        {activeTab === "3d" && (
          <div className="space-y-4">
            {/* Three.js WebGL 3D Scene Selector */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5" />
                  Three.js 3D WebGL Layer
                </span>
                <span className="text-[10px] font-mono text-slate-400">60 FPS Synced</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {THREE_D_PRESETS.map((preset) => {
                  const currentPreset = scene.threeDScene || "cyber-globe";
                  const isSelected = currentPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() =>
                        updateScene((s) => ({
                          ...s,
                          threeDScene: preset.id,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-400/60 text-white shadow-sm"
                          : "bg-studio-950/70 border-white/[0.06] text-slate-300 hover:bg-studio-900"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{preset.label}</div>
                        <div className="text-[10px] text-slate-400">{preset.desc}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>

              {/* 3D Accent Color Swatches */}
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  3D Mesh & Light Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#38bdf8", "#ec4899"].map(
                    (hex) => (
                      <button
                        key={hex}
                        onClick={() => updateScene((s) => ({ ...s, threeDColor: hex }))}
                        style={{ backgroundColor: hex }}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                          (scene.threeDColor || "#6366f1") === hex
                            ? "border-white scale-110"
                            : "border-transparent"
                        }`}
                      />
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Remotion Slide Transition Style */}
            <div className="bg-studio-900/50 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Remotion Slide Transition
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SLIDE_TRANSITIONS.map((tr) => {
                  const activeTr = scene.transitionStyle || "zoom-punch";
                  return (
                    <button
                      key={tr.id}
                      onClick={() =>
                        updateScene((s) => ({
                          ...s,
                          transitionStyle: tr.id,
                        }))
                      }
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        activeTr === tr.id
                          ? "bg-studio-accent/25 border-studio-accent text-white"
                          : "bg-studio-950 border-white/[0.06] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= BACKGROUND & B-ROLL TAB ================= */}
        {activeTab === "background" && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Background Layer Type
              </label>
              <div className="grid grid-cols-4 gap-1 bg-studio-900 p-1 rounded-xl border border-white/[0.06] text-[11px]">
                {(["color", "flux_klein", "stock", "video"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      updateScene((s) => ({ ...s, background: { ...s.background, type: t } }))
                    }
                    className={`py-1.5 rounded-lg font-bold capitalize transition-all ${
                      scene.background.type === t
                        ? "bg-studio-accent text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "flux_klein" ? "FLUX" : t === "video" ? "B-Roll" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Live B-Roll Video & Stock Media Search */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <VideoIcon className="w-3.5 h-3.5" />
                  B-Roll Video & Media Library
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const words = scene.scriptText
                      .replace(/[^\w\s]/g, "")
                      .split(/\s+/)
                      .filter((w) => w.length > 3)
                      .slice(0, 3)
                      .join(" ");
                    setBrollQuery(words);
                    handleSearchBroll(words);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Match Script
                </button>
              </div>

              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={brollQuery}
                    onChange={(e) => setBrollQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchBroll()}
                    placeholder="Search HD video B-roll (e.g. stadium, tech, market)..."
                    className="w-full bg-studio-950 border border-white/[0.08] rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchBroll()}
                  disabled={isSearchingBroll}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                >
                  {isSearchingBroll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Find"}
                </button>
              </div>

              {/* Quick B-Roll Category Pills */}
              <div className="flex flex-wrap gap-1">
                {["stadium", "tech ai", "stock market", "deep space", "ancient rome"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setBrollQuery(tag);
                      handleSearchBroll(tag);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-studio-950 hover:bg-studio-800 border border-white/[0.06] text-slate-300 capitalize"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* B-Roll Results Grid */}
              {brollResults.length > 0 && (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {brollResults.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl overflow-hidden bg-studio-950 border border-white/[0.08] flex flex-col justify-between group"
                    >
                      <div className="relative h-20 bg-black overflow-hidden">
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span
                          className={`absolute top-1.5 left-1.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            item.mediaType === "video"
                              ? "bg-emerald-500 text-slate-950"
                              : "bg-indigo-600 text-white"
                          }`}
                        >
                          {item.mediaType === "video" ? "HD MP4" : "PHOTO"}
                        </span>
                      </div>
                      <div className="p-2 space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-200 truncate" title={item.title}>
                          {item.title}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateScene((s) => ({
                                ...s,
                                background: {
                                  ...s.background,
                                  type: item.mediaType === "video" ? "video" : "stock",
                                  src: item.url,
                                },
                              }))
                            }
                            className="py-1 rounded bg-studio-accent/25 hover:bg-studio-accent text-[10px] font-bold text-white transition-colors"
                          >
                            Set Bg
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const id = `overlay-${Date.now()}`;
                              updateScene((s) => ({
                                ...s,
                                overlays: [
                                  ...s.overlays,
                                  {
                                    id,
                                    type: "media-card",
                                    props: {
                                      title: item.title.slice(0, 22),
                                      badge: item.mediaType === "video" ? "B-ROLL VIDEO" : "B-ROLL PHOTO",
                                      caption: `${item.source} • Visual Reference`,
                                      mediaUrl: item.url,
                                      mediaType: item.mediaType,
                                      accentColor: "#10b981",
                                      tilt3D: true,
                                    },
                                  },
                                ],
                              }));
                            }}
                            className="py-1 rounded bg-emerald-600/25 hover:bg-emerald-600 text-[10px] font-bold text-emerald-200 hover:text-white transition-colors"
                          >
                            + PiP Card
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drag-and-Drop Local Video / Image Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleUploadFile(file, "background");
              }}
              className={`rounded-2xl border-2 border-dashed p-3.5 text-center transition-all ${
                isDraggingOver
                  ? "border-emerald-400 bg-emerald-500/10"
                  : "border-white/[0.1] bg-studio-900/40 hover:border-white/20"
              }`}
            >
              <Upload className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
              <div className="text-xs font-bold text-slate-200">
                {isUploadingMedia ? "Uploading Media..." : "Drop MP4 Video or Image Here"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 mb-2.5">
                Supports .mp4, .webm, .png, .jpg for Background or 3D PiP Card
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="py-1.5 px-2 rounded-xl bg-studio-950 hover:bg-studio-800 border border-white/[0.08] text-[10px] font-bold text-indigo-300 cursor-pointer flex items-center justify-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Upload as Bg</span>
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f, "background");
                    }}
                  />
                </label>
                <label className="py-1.5 px-2 rounded-xl bg-studio-950 hover:bg-studio-800 border border-white/[0.08] text-[10px] font-bold text-emerald-300 cursor-pointer flex items-center justify-center gap-1">
                  <Plus className="w-3 h-3" />
                  <span>Upload as 3D PiP</span>
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f, "pip");
                    }}
                  />
                </label>
              </div>
            </div>

            {/* FLUX Prompt Generator & Genre Quick Presets */}
            <div className="bg-studio-900/60 border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-studio-accent" />
                  FLUX Klein Environment
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const text = scene.scriptText.trim();
                    const snippet = text.slice(0, 100).replace(/[^\w\s]/g, "");
                    const generatedPrompt = `Cinematic 8k background environment for: ${snippet}, volumetric lighting, photorealistic studio depth of field`;
                    updateScene((s) => ({
                      ...s,
                      background: { ...s.background, prompt: generatedPrompt },
                    }));
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Suggest from Script
                </button>
              </div>

              <textarea
                value={scene.background.prompt || ""}
                onChange={(e) =>
                  updateScene((s) => ({
                    ...s,
                    background: { ...s.background, prompt: e.target.value },
                  }))
                }
                placeholder="e.g. Cinematic arena floodlights, volumetric atmospheric haze..."
                rows={2}
                className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-xl p-2.5 text-xs text-slate-200 outline-none resize-none leading-relaxed"
              />

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold block">
                  Quick Genre Atmospheric Themes:
                </span>
                <div className="flex items-center flex-wrap gap-1">
                  {GENRE_PROMPT_PRESETS.map((p, idx) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          updateScene((s) => ({
                            ...s,
                            background: { ...s.background, prompt: p.prompt },
                          }))
                        }
                        className="text-[10px] bg-studio-950 hover:bg-studio-800 border border-white/[0.06] text-slate-300 hover:text-white px-2 py-1 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <Icon className="w-2.5 h-2.5 text-studio-accent" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleGenerateFluxBackground}
                disabled={isGeneratingBg}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isGeneratingBg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Environment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate Background</span>
                  </>
                )}
              </button>
            </div>

            {/* Color Palette Presets */}
            {scene.background.type === "color" && (
              <div className="bg-studio-900/40 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Studio Tone Swatches
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() =>
                        updateScene((s) => ({
                          ...s,
                          background: { ...s.background, src: p.value },
                        }))
                      }
                      title={p.label}
                      style={{ backgroundColor: p.value }}
                      className={`h-9 rounded-xl border-2 transition-transform hover:scale-105 flex items-center justify-center ${
                        scene.background.src === p.value
                          ? "border-white ring-2 ring-studio-accent shadow-glow"
                          : "border-white/10"
                      }`}
                    >
                      {scene.background.src === p.value && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6 Camera Motion Modes */}
            <div className="bg-studio-900/40 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Camera Motion (6 Modes)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CAMERA_MOTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      updateScene((s) => ({
                        ...s,
                        background: { ...s.background, motion: m.id },
                      }))
                    }
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      scene.background.motion === m.id
                        ? "bg-studio-accent/20 border-studio-accent text-white"
                        : "bg-studio-900 border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= MASCOT TAB ================= */}
        {activeTab === "mascot" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-studio-900/60 border border-white/[0.08]">
              <div className="flex items-center gap-2">
                {scene.mascot.isVisible ? (
                  <Eye className="w-4 h-4 text-amber-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">Brand Mascot</div>
                  <div className="text-[10px] text-slate-400">Comic lightbulb narrator character</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateScene((s) => ({
                    ...s,
                    mascot: { ...s.mascot, isVisible: !s.mascot.isVisible },
                  }))
                }
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  scene.mascot.isVisible
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-studio-800 text-slate-500 border border-white/[0.05]"
                }`}
              >
                {scene.mascot.isVisible ? "Visible" : "Hidden"}
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Select Mascot Pose
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {MASCOT_POSES.map((pose) => {
                  const isSelected = scene.mascot.pose === pose.id;
                  return (
                    <div
                      key={pose.id}
                      onClick={() =>
                        updateScene((s) => ({
                          ...s,
                          mascot: { ...s.mascot, pose: pose.id },
                        }))
                      }
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center group ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/40 shadow-glow"
                          : "bg-studio-900/50 border-white/[0.07] hover:border-white/15 hover:bg-studio-900"
                      }`}
                    >
                      <div className="w-14 h-14 mb-2 p-1">
                        <img
                          src={pose.preview}
                          alt={pose.label}
                          className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{pose.label}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        {pose.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Horizontal Placement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["left", "center", "right"] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() =>
                      updateScene((s) => ({
                        ...s,
                        mascot: { ...s.mascot, position: pos },
                      }))
                    }
                    className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${
                      scene.mascot.position === pos
                        ? "bg-amber-500/20 border-amber-500 text-white"
                        : "bg-studio-900 border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Entrance Physics Animation
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["slide-up", "pop-in", "fade"] as const).map((anim) => (
                  <button
                    key={anim}
                    onClick={() =>
                      updateScene((s) => ({
                        ...s,
                        mascot: { ...s.mascot, entranceAnimation: anim },
                      }))
                    }
                    className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all ${
                      scene.mascot.entranceAnimation === anim
                        ? "bg-amber-500/20 border-amber-500 text-white"
                        : "bg-studio-900 border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {anim.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= OVERLAYS TAB (9 TYPES) ================= */}
        {activeTab === "overlays" && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Add Remotion Physics Overlay (9 Types)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleAddOverlay("stat-counter")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Stat Counter</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("bar-chart")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Bar Chart</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("versus-battle")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Swords className="w-3.5 h-3.5 text-rose-400" />
                  <span>Versus Battle</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("timeline-milestone")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Milestone</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("quote-card")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Quote className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quote Card</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("kinetic-title")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Type className="w-3.5 h-3.5 text-purple-400" />
                  <span>Kinetic Title</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("lower-third")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5 text-pink-400" />
                  <span>Lower Third</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("progress-ring")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <PieChart className="w-3.5 h-3.5 text-teal-400" />
                  <span>Progress Ring</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("code-snippet")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Code className="w-3.5 h-3.5 text-amber-300" />
                  <span>Code Terminal</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("media-card")}
                  className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <VideoIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3D PiP Media</span>
                </button>
              </div>
            </div>

            {/* Active Overlays List */}
            <div className="space-y-3 pt-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Active Scene Overlays ({scene.overlays.length})
              </label>

              {scene.overlays.length === 0 ? (
                <div className="p-5 rounded-2xl border border-dashed border-white/[0.08] text-center text-xs text-slate-500 bg-studio-900/20">
                  No overlays in this scene. Click an overlay type above to attach one.
                </div>
              ) : (
                scene.overlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="p-3.5 rounded-2xl bg-studio-900/80 border border-white/[0.08] space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                        {overlay.type.replace("-", " ")}
                      </span>
                      <button
                        onClick={() => handleDeleteOverlay(overlay.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                        title="Remove overlay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {overlay.type === "stat-counter" && (
                      <div className="space-y-2 text-xs">
                        <input
                          type="text"
                          placeholder="Label"
                          value={overlay.props.label || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              label: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none text-xs"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Prefix"
                            value={overlay.props.prefix || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                prefix: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                          <input
                            type="number"
                            value={overlay.props.targetValue ?? 100}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                targetValue: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Suffix"
                            value={overlay.props.suffix || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                suffix: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "versus-battle" && (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Left Name"
                            value={overlay.props.leftName || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                leftName: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Left Stat"
                            value={overlay.props.leftStat || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                leftStat: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Right Name"
                            value={overlay.props.rightName || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                rightName: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Right Stat"
                            value={overlay.props.rightStat || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                rightStat: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "quote-card" && (
                      <div className="space-y-2 text-xs">
                        <textarea
                          rows={2}
                          value={overlay.props.quote || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              quote: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none resize-none"
                        />
                        <input
                          type="text"
                          placeholder="Author / Source"
                          value={overlay.props.author || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              author: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                      </div>
                    )}

                    {overlay.type === "timeline-milestone" && (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Year"
                            value={overlay.props.year || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                year: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Event Title"
                            value={overlay.props.eventTitle || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                eventTitle: e.target.value,
                              })
                            }
                            className="col-span-2 bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "kinetic-title" && (
                      <div className="space-y-2 text-xs">
                        <input
                          type="text"
                          placeholder="Top Tag"
                          value={overlay.props.topTag || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              topTag: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Headline"
                          value={overlay.props.headline || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              headline: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                      </div>
                    )}

                    {overlay.type === "lower-third" && (
                      <div className="space-y-2 text-xs">
                        <input
                          type="text"
                          placeholder="Title"
                          value={overlay.props.title || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              title: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Subtitle"
                          value={overlay.props.subtitle || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              subtitle: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                      </div>
                    )}

                    {overlay.type === "media-card" && (
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Card Title"
                            value={overlay.props.title || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                title: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Badge (e.g. LIVE PIP)"
                            value={overlay.props.badge || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                badge: e.target.value,
                              })
                            }
                            className="bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Image or MP4 Video URL"
                          value={overlay.props.mediaUrl || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              mediaUrl: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Caption Footer"
                          value={overlay.props.caption || ""}
                          onChange={(e) =>
                            handleUpdateOverlayProps(overlay.id, {
                              ...overlay.props,
                              caption: e.target.value,
                            })
                          }
                          className="w-full bg-studio-950 border border-white/[0.08] rounded-lg p-2 text-slate-200 outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
