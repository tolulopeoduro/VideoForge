import React, { useState } from "react";
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
  Search,
  CheckCircle2,
  AlertCircle,
  Split,
} from "lucide-react";

interface LeftScriptPanelProps {
  state: MasterVideoState;
  selectedSceneId: string;
  onSelectScene: (id: string) => void;
  onUpdateState: (updater: (prev: MasterVideoState) => MasterVideoState) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

const POSE_AVATARS: Record<Scene["mascot"]["pose"], string> = {
  neutral: "/mascot/neutral.svg",
  explaining: "/mascot/explaining.svg",
  shocked: "/mascot/shocked.svg",
  pointing: "/mascot/pointing.svg",
};

export const LeftScriptPanel: React.FC<LeftScriptPanelProps> = ({
  state,
  selectedSceneId,
  onSelectScene,
  onUpdateState,
  onTriggerSync,
  isSyncing,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const isAudioLocked = Boolean(state.audio.voiceTrackUrl);

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

  const handleAddScene = (presetText?: string) => {
    const newId = `scene-${Date.now()}`;
    const newScene: Scene = {
      id: newId,
      startFrame: state.metadata.totalDurationInFrames,
      durationInFrames: 90,
      scriptText:
        presetText || "Write your next scene script here. Python will align the audio timing.",
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

  const filteredScenes = searchQuery.trim()
    ? state.scenes.filter((s) =>
        s.scriptText.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : state.scenes;

  return (
    <aside className="w-[30%] min-w-[320px] max-w-[420px] h-[calc(100vh-4rem)] bg-studio-975 border-r border-white/[0.07] flex flex-col select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-white/[0.07] flex items-center justify-between bg-studio-950/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-studio-accent" />
          <h2 className="text-xs font-bold text-white tracking-wider uppercase">
            Script & Narrative Feed
          </h2>
          <span className="text-[11px] bg-studio-900 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-full border border-white/[0.08]">
            {state.scenes.length}
          </span>
        </div>

        {/* Quick Genre Inspiration Chips */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyPresetTemplate("sports")}
            title="Load Sports & Arena Template"
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 text-red-400 text-xs border border-white/[0.06] transition-all hover:scale-105"
          >
            <Trophy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("finance")}
            title="Load Finance & Market Template"
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 text-emerald-400 text-xs border border-white/[0.06] transition-all hover:scale-105"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("history")}
            title="Load History & Empire Template"
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 text-amber-400 text-xs border border-white/[0.06] transition-all hover:scale-105"
          >
            <Scroll className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("tech")}
            title="Load Tech Architecture Template"
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 text-cyan-400 text-xs border border-white/[0.06] transition-all hover:scale-105"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyPresetTemplate("pitch")}
            title="Load Product Pitch Template"
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 text-indigo-400 text-xs border border-white/[0.06] transition-all hover:scale-105"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Script Search & Audio Sync Banner */}
      <div className="p-3 bg-studio-950/40 border-b border-white/[0.07] space-y-2">
        {/* Search input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dialogue text..."
            className="w-full bg-studio-900/90 border border-white/[0.08] focus:border-studio-accent rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
          />
        </div>

        {/* Sync Status strip */}
        <div className="flex items-center justify-between text-[11px] px-1">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>
              Total runtime:{" "}
              <strong className="text-white font-mono tabular-nums">
                {(state.metadata.totalDurationInFrames / 30).toFixed(1)}s
              </strong>
            </span>
          </div>

          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
              isAudioLocked
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25"
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>{isSyncing ? "Syncing..." : isAudioLocked ? "Audio Locked" : "Sync Needed"}</span>
          </button>
        </div>
      </div>

      {/* Scene Feed (Scrollable List) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
        {filteredScenes.map((scene, idx) => {
          const isSelected = scene.id === selectedSceneId;
          const wordCount = scene.scriptText.trim().split(/\s+/).filter(Boolean).length;
          const durationSeconds = (scene.durationInFrames / 30).toFixed(1);
          const wordsPerSec =
            scene.durationInFrames > 0
              ? (wordCount / (scene.durationInFrames / 30)).toFixed(1)
              : "0";

          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
              className={`rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? "bg-studio-900/90 border-studio-accent shadow-xl shadow-studio-accent/10 ring-1 ring-studio-accent"
                  : "bg-studio-900/40 border-white/[0.07] hover:border-white/15 hover:bg-studio-900/70"
              }`}
            >
              {/* Left Accent Status Strip */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${
                  isSelected
                    ? "bg-studio-accent shadow-[0_0_10px_#6366f1]"
                    : "bg-transparent group-hover:bg-white/20"
                }`}
              />

              {/* Scene Card Header */}
              <div className="p-3 pl-4 border-b border-white/[0.06] flex items-center justify-between text-xs bg-studio-950/40">
                <div className="flex items-center gap-2">
                  {/* Mascot mini avatar preview */}
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-studio-800 border border-white/10 shrink-0">
                    <img
                      src={POSE_AVATARS[scene.mascot.pose] || POSE_AVATARS.neutral}
                      alt={scene.mascot.pose}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <span className="font-bold text-slate-100">Scene {idx + 1}</span>

                  <span className="text-[10px] text-slate-400 font-mono bg-studio-900 px-1.5 py-0.5 rounded border border-white/[0.06] tabular-nums">
                    {durationSeconds}s ({scene.durationInFrames}f)
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                  <button
                    disabled={idx === 0}
                    onClick={(e) => handleMove(idx, -1, e)}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                    title="Move Scene Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === state.scenes.length - 1}
                    onClick={(e) => handleMove(idx, 1, e)}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
                    title="Move Scene Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDuplicateScene(scene, e)}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title="Duplicate Scene"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={state.scenes.length <= 1}
                    onClick={(e) => handleDeleteScene(scene.id, e)}
                    className="p-1 text-slate-400 hover:text-red-400 disabled:opacity-20 transition-colors"
                    title="Delete Scene"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Script Text Input (Core Semantic Anchor) */}
              <div className="p-3 pl-4">
                <textarea
                  value={scene.scriptText}
                  onChange={(e) => handleScriptChange(scene.id, e.target.value)}
                  placeholder="Type spoken text for this scene..."
                  rows={3}
                  className="w-full bg-studio-950/80 border border-white/[0.07] focus:border-studio-accent rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 outline-none resize-none leading-relaxed transition-all focus:ring-1 focus:ring-studio-accent"
                />

                {/* Badges / Layer Tags */}
                <div className="mt-2.5 flex items-center flex-wrap gap-1.5 text-[10px]">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-studio-900 text-amber-300 border border-white/[0.06]">
                    <Smile className="w-3 h-3 text-amber-400" />
                    <span className="capitalize">{scene.mascot.pose}</span>
                  </span>

                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-studio-900 text-slate-300 border border-white/[0.06]">
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
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>{scene.overlays.length} overlay{scene.overlays.length > 1 ? "s" : ""}</span>
                    </span>
                  )}

                  <span className="ml-auto text-[10px] text-slate-400 font-mono tabular-nums">
                    {wordCount} words ({wordsPerSec} w/s)
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Scene Card */}
        <button
          onClick={() => handleAddScene()}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-studio-accent/70 bg-studio-900/20 hover:bg-studio-900/60 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all group"
        >
          <Plus className="w-4 h-4 text-studio-accent group-hover:scale-110 transition-transform" />
          <span>Add New Scene Beat</span>
        </button>
      </div>
    </aside>
  );
};
