import React, { useState } from "react";
import { MasterVideoState, Scene, GraphicOverlay } from "@/types/schema";
import {
  Sliders,
  Sparkles,
  Smile,
  Image as ImageIcon,
  Layers,
  Move,
  Play,
  Plus,
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
  Compass,
  ArrowUpRight,
  Trophy,
  Landmark,
  Coins,
  Orbit,
  Cpu,
  Film,
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

export const RightInspectorPanel: React.FC<RightInspectorPanelProps> = ({
  state,
  selectedSceneId,
  onUpdateState,
}) => {
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [activeTab, setActiveTab] = useState<"background" | "mascot" | "overlays">("background");

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
    }

    updateScene((s) => ({
      ...s,
      overlays: [...s.overlays, { id, type, props }],
    }));
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

      {/* Segmented Tab Navigation with Sleek Pill Design */}
      <div className="p-2 border-b border-white/[0.07] bg-studio-950/40">
        <div className="grid grid-cols-3 gap-1 bg-studio-900 p-1 rounded-xl border border-white/[0.06] text-xs">
          <button
            onClick={() => setActiveTab("background")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "background"
                ? "bg-studio-accent text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Visual</span>
          </button>

          <button
            onClick={() => setActiveTab("mascot")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "mascot"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Mascot</span>
          </button>

          <button
            onClick={() => setActiveTab("overlays")}
            className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "overlays"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers ({scene.overlays.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* ================= BACKGROUND TAB ================= */}
        {activeTab === "background" && (
          <div className="space-y-4">
            {/* Layer Type */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Background Type
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-studio-900 p-1 rounded-xl border border-white/[0.06] text-xs">
                {(["color", "flux_klein", "stock"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateScene((s) => ({ ...s, background: { ...s.background, type: t } }))}
                    className={`py-1.5 rounded-lg font-bold capitalize transition-all ${
                      scene.background.type === t
                        ? "bg-studio-accent text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "flux_klein" ? "FLUX Klein" : t}
                  </button>
                ))}
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

              {/* Genre Quick-Tags */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold block">Quick Genre Atmospheric Themes:</span>
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

            {/* Ken Burns Dynamic Motion */}
            <div className="bg-studio-900/40 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Ken Burns Camera Motion
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["zoom-in", "pan-left", "static"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      updateScene((s) => ({
                        ...s,
                        background: { ...s.background, motion: m },
                      }))
                    }
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold capitalize flex flex-col items-center gap-1 transition-all ${
                      scene.background.motion === m
                        ? "bg-studio-accent/20 border-studio-accent text-white"
                        : "bg-studio-900 border-white/[0.06] text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>{m.replace("-", " ")}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= MASCOT TAB ================= */}
        {activeTab === "mascot" && (
          <div className="space-y-4">
            {/* Visibility Toggle */}
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

            {/* Mascot Character Pose Visual Grid */}
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
                      <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{pose.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mascot Positioning */}
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

            {/* Entrance Physics Animation */}
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

        {/* ================= OVERLAYS TAB ================= */}
        {activeTab === "overlays" && (
          <div className="space-y-4">
            {/* Add Overlay Buttons */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Add Graphic Overlay
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddOverlay("stat-counter")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Stat Counter</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("lower-third")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5 text-pink-400" />
                  <span>Lower Third</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("progress-ring")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Progress Ring</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("code-snippet")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>Code Snippet</span>
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

                    {/* Dynamic parameter forms */}
                    {overlay.type === "stat-counter" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Metric Label</label>
                          <input
                            type="text"
                            value={overlay.props.label || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                label: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 font-semibold">Prefix</label>
                            <input
                              type="text"
                              value={overlay.props.prefix || ""}
                              onChange={(e) =>
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  prefix: e.target.value,
                                })
                              }
                              className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-semibold">Target</label>
                            <input
                              type="number"
                              value={overlay.props.targetValue ?? 100}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  targetValue: Number.isNaN(val) ? 0 : val,
                                });
                              }}
                              className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-semibold">Suffix</label>
                            <input
                              type="text"
                              value={overlay.props.suffix || ""}
                              onChange={(e) =>
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  suffix: e.target.value,
                                })
                              }
                              className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {overlay.type === "lower-third" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Category Tag</label>
                          <input
                            type="text"
                            value={overlay.props.category || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                category: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Main Title</label>
                          <input
                            type="text"
                            value={overlay.props.title || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                title: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Subtitle Description</label>
                          <input
                            type="text"
                            value={overlay.props.subtitle || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                subtitle: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "progress-ring" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Label</label>
                          <input
                            type="text"
                            value={overlay.props.label || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                label: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Percentage (0-100)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={overlay.props.percentage ?? 80}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                percentage: Number.isNaN(val) ? 0 : val,
                              });
                            }}
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "code-snippet" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Filename</label>
                          <input
                            type="text"
                            value={overlay.props.filename || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                filename: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold">Code Body</label>
                          <textarea
                            rows={3}
                            value={overlay.props.code || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                code: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-white/[0.08] focus:border-studio-accent rounded-lg p-2 text-slate-200 outline-none text-xs font-mono resize-none leading-relaxed"
                          />
                        </div>
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
