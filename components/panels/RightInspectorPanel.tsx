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
}> = [
  { id: "neutral", label: "Neutral", preview: "/mascot/neutral.svg" },
  { id: "explaining", label: "Explaining", preview: "/mascot/explaining.svg" },
  { id: "shocked", label: "Shocked", preview: "/mascot/shocked.svg" },
  { id: "pointing", label: "Pointing", preview: "/mascot/pointing.svg" },
];

const COLOR_PRESETS = [
  { label: "Obsidian", value: "#0f172a" },
  { label: "Midnight Indigo", value: "#1e1b4b" },
  { label: "Emerald Abyss", value: "#064e3b" },
  { label: "Deep Amber", value: "#311005" },
  { label: "Cyber Black", value: "#090d16" },
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
      <aside className="w-[25%] min-w-[280px] max-w-[380px] h-[calc(100vh-4rem)] bg-studio-950 border-l border-studio-800 p-6 flex flex-col items-center justify-center text-center text-slate-500">
        <Sliders className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-semibold">No scene selected</p>
        <p className="text-xs text-slate-500 mt-1">Select a scene from the feed to inspect</p>
      </aside>
    );
  }

  const updateScene = (updater: (s: Scene) => Scene) => {
    onUpdateState((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === scene.id ? updater(s) : s)),
    }));
  };

  // FLUX Klein Background Generation
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

  // Overlay management
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
    <aside className="w-[25%] min-w-[290px] max-w-[390px] h-[calc(100vh-4rem)] bg-studio-950 border-l border-studio-800 flex flex-col select-none">
      {/* Panel Top Title */}
      <div className="p-4 border-b border-studio-800 bg-studio-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-studio-accent" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Scene {sceneIdx + 1} Inspector
          </h2>
        </div>
        <span className="text-xs text-indigo-400 font-mono bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
          {scene.durationInFrames}f
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-studio-800 bg-studio-900/20 text-xs">
        <button
          onClick={() => setActiveTab("background")}
          className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "background"
              ? "text-studio-accent border-studio-accent bg-studio-900/50"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Background</span>
        </button>

        <button
          onClick={() => setActiveTab("mascot")}
          className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "mascot"
              ? "text-amber-400 border-amber-400 bg-studio-900/50"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Smile className="w-3.5 h-3.5" />
          <span>Mascot</span>
        </button>

        <button
          onClick={() => setActiveTab("overlays")}
          className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === "overlays"
              ? "text-indigo-400 border-indigo-400 bg-studio-900/50"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Overlays ({scene.overlays.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* ================= BACKGROUND TAB ================= */}
        {activeTab === "background" && (
          <div className="space-y-4">
            {/* Background Type */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Layer Type
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-studio-900 p-1 rounded-xl border border-studio-800 text-xs">
                {(["color", "flux_klein", "stock"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateScene((s) => ({ ...s, background: { ...s.background, type: t } }))}
                    className={`py-1.5 rounded-lg font-bold capitalize transition-all ${
                      scene.background.type === t
                        ? "bg-studio-accent text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "flux_klein" ? "FLUX Klein" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* FLUX Prompt Generator */}
            <div className="bg-studio-900/40 border border-studio-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-studio-accent" />
                  FLUX Klein Prompt
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">fal.ai</span>
              </div>

              <textarea
                value={scene.background.prompt || ""}
                onChange={(e) =>
                  updateScene((s) => ({
                    ...s,
                    background: { ...s.background, prompt: e.target.value },
                  }))
                }
                placeholder="e.g. Cyberpunk minimalist glass studio with ambient purple rim lighting..."
                rows={2}
                className="w-full bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg p-2.5 text-xs text-slate-200 outline-none resize-none leading-relaxed"
              />

              <button
                onClick={handleGenerateFluxBackground}
                disabled={isGeneratingBg}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-studio-accent to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
              >
                {isGeneratingBg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Environment...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Background</span>
                  </>
                )}
              </button>
            </div>

            {/* Color Presets */}
            {scene.background.type === "color" && (
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Color Presets
                </label>
                <div className="flex items-center gap-2">
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
                      className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                        scene.background.src === p.value
                          ? "border-white ring-2 ring-studio-accent"
                          : "border-studio-700"
                      }`}
                    >
                      {scene.background.src === p.value && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ken Burns Dynamic Motion */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Ken Burns Motion
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
                        : "bg-studio-900 border-studio-800 text-slate-400 hover:text-slate-200"
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
          <div className="space-y-5">
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-3 bg-studio-900 rounded-xl border border-studio-800">
              <span className="text-xs font-bold text-slate-200">Show Brand Mascot</span>
              <input
                type="checkbox"
                checked={scene.mascot.isVisible}
                onChange={(e) =>
                  updateScene((s) => ({
                    ...s,
                    mascot: { ...s.mascot, isVisible: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Mascot Pose Selector Cards */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Comic Mascot Pose
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
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 group ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/80 shadow-md ring-1 ring-amber-500/50"
                          : "bg-studio-900 border-studio-800 hover:border-studio-700"
                      }`}
                    >
                      <div className="w-16 h-20 rounded-lg overflow-hidden bg-studio-950 p-1 flex items-center justify-center">
                        <img
                          src={pose.preview}
                          alt={pose.label}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? "text-amber-400" : "text-slate-400"
                        }`}
                      >
                        {pose.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Horizontal Placement */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Mascot Position
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
                        : "bg-studio-900 border-studio-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Entrance Physics Animation */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Spring Entrance Physics
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
                        : "bg-studio-900 border-studio-800 text-slate-400 hover:text-slate-200"
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
            {/* Add Overlay Button */}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Add Graphic Overlay
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAddOverlay("stat-counter")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Stat Counter</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("lower-third")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5 text-pink-400" />
                  <span>Lower Third</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("progress-ring")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <PieChart className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Progress Ring</span>
                </button>
                <button
                  onClick={() => handleAddOverlay("code-snippet")}
                  className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Code className="w-3.5 h-3.5 text-amber-400" />
                  <span>Code Snippet</span>
                </button>
              </div>
            </div>

            {/* Active Overlays List */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Active Overlays ({scene.overlays.length})
              </label>

              {scene.overlays.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-studio-800 text-center text-xs text-slate-500">
                  No overlays in this scene yet. Click a preset above to attach one.
                </div>
              ) : (
                scene.overlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="p-3.5 rounded-xl bg-studio-900/60 border border-studio-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        {overlay.type.replace("-", " ")}
                      </span>
                      <button
                        onClick={() => handleDeleteOverlay(overlay.id)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="Remove overlay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dynamic parameter forms according to overlay type */}
                    {overlay.type === "stat-counter" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-400">Label</label>
                          <input
                            type="text"
                            value={overlay.props.label || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                label: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-slate-400">Prefix</label>
                            <input
                              type="text"
                              value={overlay.props.prefix || ""}
                              onChange={(e) =>
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  prefix: e.target.value,
                                })
                              }
                              className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-400">Target</label>
                            <input
                              type="number"
                              value={overlay.props.targetValue ?? 100}
                              onChange={(e) =>
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  targetValue: Number(e.target.value),
                                })
                              }
                              className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-400">Suffix</label>
                            <input
                              type="text"
                              value={overlay.props.suffix || ""}
                              onChange={(e) =>
                                handleUpdateOverlayProps(overlay.id, {
                                  ...overlay.props,
                                  suffix: e.target.value,
                                })
                              }
                              className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {overlay.type === "lower-third" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-400">Category Tag</label>
                          <input
                            type="text"
                            value={overlay.props.category || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                category: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400">Title</label>
                          <input
                            type="text"
                            value={overlay.props.title || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                title: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400">Subtitle</label>
                          <input
                            type="text"
                            value={overlay.props.subtitle || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                subtitle: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "progress-ring" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-400">Label</label>
                          <input
                            type="text"
                            value={overlay.props.label || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                label: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400">Percentage (0 - 100)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={overlay.props.percentage ?? 95}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                percentage: Number(e.target.value),
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {overlay.type === "code-snippet" && (
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-400">Filename</label>
                          <input
                            type="text"
                            value={overlay.props.filename || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                filename: e.target.value,
                              })
                            }
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400">Code</label>
                          <textarea
                            value={overlay.props.code || ""}
                            onChange={(e) =>
                              handleUpdateOverlayProps(overlay.id, {
                                ...overlay.props,
                                code: e.target.value,
                              })
                            }
                            rows={3}
                            className="w-full bg-studio-950 border border-studio-800 rounded p-1.5 text-slate-200 outline-none font-mono text-[11px] leading-relaxed"
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
