import React from "react";
import { MasterVideoState, Scene } from "@/types/schema";
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Sparkles,
  FileText,
  Clock,
  Mic,
  Smile,
  Layers,
  Wand2,
  Trophy,
  TrendingUp,
  Scroll,
  Cpu,
} from "lucide-react";

interface LeftScriptPanelProps {
  state: MasterVideoState;
  selectedSceneId: string;
  onSelectScene: (id: string) => void;
  onUpdateState: (updater: (prev: MasterVideoState) => MasterVideoState) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export const LeftScriptPanel: React.FC<LeftScriptPanelProps> = ({
  state,
  selectedSceneId,
  onSelectScene,
  onUpdateState,
  onTriggerSync,
  isSyncing,
}) => {
  const handleScriptChange = (sceneId: string, newText: string) => {
    onUpdateState((prev) => {
      const isVoiceLocked = Boolean(prev.audio.voiceTrackUrl);
      const nextScenes = prev.scenes.map((s) => {
        if (s.id !== sceneId) return s;
        if (isVoiceLocked) {
          return { ...s, scriptText: newText };
        }
        // If not locked, re-estimate frames based on spoken cadence (~2.7 words/sec @ 30fps)
        const words = newText.trim().split(/\s+/).filter(Boolean);
        const estDuration = Math.max(75, Math.round((Math.max(words.length, 1) / 2.7) * 30));
        return {
          ...s,
          scriptText: newText,
          durationInFrames: estDuration,
        };
      });

      // Recalculate startFrames sequentially
      let curr = 0;
      const reindexed = nextScenes.map((s) => {
        const updated = { ...s, startFrame: curr };
        curr += s.durationInFrames;
        return updated;
      });

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          totalDurationInFrames: Math.max(90, curr),
        },
        scenes: reindexed,
      };
    });
  };

  const handleAddScene = () => {
    const newId = `scene-${Date.now()}`;
    const newScene: Scene = {
      id: newId,
      startFrame: state.metadata.totalDurationInFrames,
      durationInFrames: 90, // Estimated 3s until audio sync locks it
      scriptText: "Write your next scene script here. Python will align the audio timing.",
      wordTokens: [],
      background: {
        type: "color",
        src: "#0f172a",
        motion: "zoom-in",
      },
      mascot: {
        isVisible: true,
        pose: "explaining",
        position: "left",
        entranceAnimation: "slide-up",
      },
      overlays: [],
    };

    onUpdateState((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        totalDurationInFrames: prev.metadata.totalDurationInFrames + 90,
      },
      scenes: [...prev.scenes, newScene],
    }));

    onSelectScene(newId);
  };

  const handleDeleteScene = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (state.scenes.length <= 1) return;

    onUpdateState((prev) => {
      const filtered = prev.scenes.filter((s) => s.id !== sceneId);
      let curr = 0;
      const reindexed = filtered.map((s) => {
        const sCopy = { ...s, startFrame: curr };
        curr += s.durationInFrames;
        return sCopy;
      });
      return {
        ...prev,
        metadata: { ...prev.metadata, totalDurationInFrames: Math.max(90, curr) },
        scenes: reindexed,
      };
    });

    if (selectedSceneId === sceneId) {
      const remaining = state.scenes.filter((s) => s.id !== sceneId);
      if (remaining.length > 0) onSelectScene(remaining[0].id);
    }
  };

  const handleDuplicateScene = (scene: Scene, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `scene-${Date.now()}`;
    const dup: Scene = {
      ...scene,
      id: newId,
    };
    onUpdateState((prev) => {
      const idx = prev.scenes.findIndex((s) => s.id === scene.id);
      const nextScenes = [...prev.scenes];
      nextScenes.splice(idx + 1, 0, dup);

      let curr = 0;
      const reindexed = nextScenes.map((s) => {
        const sCopy = { ...s, startFrame: curr };
        curr += s.durationInFrames;
        return sCopy;
      });

      return {
        ...prev,
        metadata: { ...prev.metadata, totalDurationInFrames: Math.max(90, curr) },
        scenes: reindexed,
      };
    });
    onSelectScene(newId);
  };

  const handleMove = (idx: number, dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= state.scenes.length) return;

    onUpdateState((prev) => {
      const copy = [...prev.scenes];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;

      // Re-index frame starts sequentially
      let curr = 0;
      const reindexed = copy.map((s) => {
        const sCopy = { ...s, startFrame: curr };
        curr += s.durationInFrames;
        return sCopy;
      });

      return {
        ...prev,
        metadata: { ...prev.metadata, totalDurationInFrames: Math.max(90, curr) },
        scenes: reindexed,
      };
    });
  };

  // Preset Script Templates for quick one-click inspiration across diverse genres
  const applyPresetTemplate = (type: "sports" | "finance" | "history" | "tech" | "pitch") => {
    let newScenes: Scene[] = [];
    const timestamp = Date.now();

    if (type === "sports") {
      newScenes = [
        {
          id: `s-${timestamp}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "Old Trafford under the lights. The theatre where impossible comebacks become legend.",
          wordTokens: [],
          background: { type: "color", src: "#991b1b", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "shocked", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-1", type: "lower-third", props: { title: "Old Trafford", subtitle: "Theatre of Dreams • 74,310 Capacity", category: "ARENA SPOTLIGHT" } }],
        },
        {
          id: `s-${timestamp}-2`,
          startFrame: 110,
          durationInFrames: 125,
          scriptText: "From the 1999 treble in Barcelona to twenty league titles, greatness demands unrelenting belief.",
          wordTokens: [],
          background: { type: "color", src: "#0f172a", motion: "pan-left" },
          mascot: { isVisible: true, pose: "pointing", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "League Titles", targetValue: 20, prefix: "", suffix: " Cups", accentColor: "#ef4444" } }],
        },
        {
          id: `s-${timestamp}-3`,
          startFrame: 235,
          durationInFrames: 115,
          scriptText: "When the clock strikes ninety minutes, that is when true champions write football history.",
          wordTokens: [],
          background: { type: "color", src: "#1e1b4b", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-3", type: "progress-ring", props: { label: "Fergie Time", percentage: 99, color: "#f59e0b" } }],
        },
      ];
    } else if (type === "finance") {
      newScenes = [
        {
          id: `s-${timestamp}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "Wall Street trades billions every second, but high-frequency algorithms execute before humans blink.",
          wordTokens: [],
          background: { type: "color", src: "#090d16", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-1", type: "lower-third", props: { title: "Algorithmic Speed", subtitle: "Sub-microsecond latency arbitrage", category: "MARKET DYNAMICS" } }],
        },
        {
          id: `s-${timestamp}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "Over eighty percent of equity volume is now routed through automated algorithmic liquidity pools.",
          wordTokens: [],
          background: { type: "color", src: "#064e3b", motion: "pan-left" },
          mascot: { isVisible: true, pose: "pointing", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Automated Volume", targetValue: 82, prefix: "", suffix: "%", accentColor: "#10b981" } }],
        },
      ];
    } else if (type === "history") {
      newScenes = [
        {
          id: `s-${timestamp}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "In forty-four BC, the Roman Republic stood at a crossroads that reshaped world civilization.",
          wordTokens: [],
          background: { type: "color", src: "#311005", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "shocked", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-1", type: "lower-third", props: { title: "The Roman Forum", subtitle: "The Ides of March • 44 BC", category: "CHRONICLES" } }],
        },
        {
          id: `s-${timestamp}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "From aqueducts to military road networks, Roman engineering spanned over fifty thousand miles.",
          wordTokens: [],
          background: { type: "color", src: "#1c1917", motion: "pan-left" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Paved Highways", targetValue: 50, prefix: "", suffix: "k Miles", accentColor: "#d97706" } }],
        },
      ];
    } else if (type === "tech") {
      newScenes = [
        {
          id: `s-${timestamp}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "How does Semantic Anchoring work under the hood? Let us look at the Node to Python IPC bridge.",
          wordTokens: [],
          background: { type: "color", src: "#0b0d13", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-1", type: "code-snippet", props: { filename: "ipc-bridge.ts", code: `const python = spawn("python3", ["pipeline.py"]);\npython.stdin.write(stateJSON);` } }],
        },
        {
          id: `s-${timestamp}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "Python generates the voice track and returns word-level Whisper timestamps for frame-accurate lock.",
          wordTokens: [],
          background: { type: "color", src: "#172554", motion: "pan-left" },
          mascot: { isVisible: true, pose: "pointing", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Alignment Accuracy", targetValue: 99, prefix: "", suffix: "%", accentColor: "#38bdf8" } }],
        },
      ];
    } else {
      newScenes = [
        {
          id: `s-${timestamp}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "Traditional video editing is broken. Timelines are too complex and manual dragging is slow.",
          wordTokens: [],
          background: { type: "color", src: "#1e1b4b", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "shocked", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-1", type: "lower-third", props: { title: "The Problem", subtitle: "Manual multitrack chaos", category: "INSIGHT" } }],
        },
        {
          id: `s-${timestamp}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "Enter ZeroTrack. The narrative text script directly anchors every frame and visual layer.",
          wordTokens: [],
          background: { type: "color", src: "#0f172a", motion: "pan-left" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Speed Increase", targetValue: 300, prefix: "+", suffix: "%", accentColor: "#6366f1" } }],
        },
      ];
    }

    const totalDur = newScenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    onUpdateState((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, totalDurationInFrames: totalDur },
      scenes: newScenes,
    }));
    onSelectScene(newScenes[0].id);
  };

  return (
    <aside className="w-[30%] min-w-[320px] max-w-[420px] h-[calc(100vh-4rem)] bg-studio-950 border-r border-studio-800 flex flex-col select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-studio-800 flex items-center justify-between bg-studio-900/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-studio-accent" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Script & Scene Feed
          </h2>
          <span className="text-xs bg-studio-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
            {state.scenes.length}
          </span>
        </div>

        {/* Quick Genre Templates */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyPresetTemplate("sports")}
            title="Load Sports & Arena Template"
            className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-red-400 text-xs flex items-center gap-1 transition-all"
          >
            <Trophy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("finance")}
            title="Load Finance & Market Template"
            className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-emerald-400 text-xs flex items-center gap-1 transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("history")}
            title="Load History & Empire Template"
            className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-amber-400 text-xs flex items-center gap-1 transition-all"
          >
            <Scroll className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("tech")}
            title="Load Tech Architecture Template"
            className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-cyan-400 text-xs flex items-center gap-1 transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("pitch")}
            title="Load Product Pitch Template"
            className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-indigo-400 text-xs flex items-center gap-1 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Spoken Audio Sync Banner / Action */}
      <div className="p-3 bg-studio-900/60 border-b border-studio-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-slate-300 font-medium">
            Total Duration: {(state.metadata.totalDurationInFrames / 30).toFixed(1)}s (
            {state.metadata.totalDurationInFrames}f)
          </span>
        </div>

        <button
          onClick={onTriggerSync}
          disabled={isSyncing}
          className="px-3 py-1.5 rounded-lg bg-studio-accent hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{isSyncing ? "Syncing Audio..." : "Sync Audio"}</span>
        </button>
      </div>

      {/* Scene Feed (Scrollable List) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
        {state.scenes.map((scene, idx) => {
          const isSelected = scene.id === selectedSceneId;
          const wordCount = scene.scriptText.trim().split(/\s+/).filter(Boolean).length;
          const durationSeconds = (scene.durationInFrames / 30).toFixed(1);

          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
              className={`rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-studio-900/90 border-studio-accent shadow-lg shadow-studio-accent/10 ring-1 ring-studio-accent"
                  : "bg-studio-900/40 border-studio-800/80 hover:border-studio-700 hover:bg-studio-900/60"
              }`}
            >
              {/* Scene Card Header */}
              <div className="p-3 border-b border-studio-800/60 flex items-center justify-between text-xs bg-studio-950/40">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-studio-800 text-indigo-300 font-mono font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-200">Scene {idx + 1}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {durationSeconds}s ({scene.durationInFrames}f)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Re-order buttons */}
                  <button
                    disabled={idx === 0}
                    onClick={(e) => handleMove(idx, -1, e)}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                    title="Move Scene Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === state.scenes.length - 1}
                    onClick={(e) => handleMove(idx, 1, e)}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                    title="Move Scene Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {/* Duplicate */}
                  <button
                    onClick={(e) => handleDuplicateScene(scene, e)}
                    className="p-1 text-slate-500 hover:text-slate-300"
                    title="Duplicate Scene"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {/* Delete */}
                  <button
                    disabled={state.scenes.length <= 1}
                    onClick={(e) => handleDeleteScene(scene.id, e)}
                    className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-20"
                    title="Delete Scene"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Script Text Input (Core Semantic Anchor) */}
              <div className="p-3">
                <textarea
                  value={scene.scriptText}
                  onChange={(e) => handleScriptChange(scene.id, e.target.value)}
                  placeholder="Type what should be spoken in this scene..."
                  rows={3}
                  className="w-full bg-studio-950/60 border border-studio-800 focus:border-studio-accent/70 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none resize-none leading-relaxed transition-colors"
                />

                {/* Badges / Layer Tags */}
                <div className="mt-2.5 flex items-center flex-wrap gap-2 text-[10px]">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-studio-800/80 text-slate-300 border border-studio-700/50">
                    <Smile className="w-3 h-3 text-amber-400" />
                    <span>{scene.mascot.pose}</span>
                  </span>

                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-studio-800/80 text-slate-300 border border-studio-700/50">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{
                        backgroundColor:
                          scene.background.type === "color"
                            ? scene.background.src
                            : "#6366f1",
                      }}
                    />
                    <span className="capitalize">{scene.background.type.replace("_", " ")}</span>
                  </span>

                  {scene.overlays.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>{scene.overlays.length} overlay{scene.overlays.length > 1 ? "s" : ""}</span>
                    </span>
                  )}

                  <span className="ml-auto text-[10px] text-slate-400 font-mono">
                    {wordCount} words
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Scene Card */}
        <button
          onClick={handleAddScene}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-studio-800 hover:border-studio-accent/60 bg-studio-900/20 hover:bg-studio-900/50 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Scene</span>
        </button>
      </div>
    </aside>
  );
};
