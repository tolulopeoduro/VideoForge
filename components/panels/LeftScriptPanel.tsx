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
    onUpdateState((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, scriptText: newText } : s)),
    }));
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
      // recalculate frame starts
      let curr = 0;
      const reindexed = filtered.map((s) => {
        const sCopy = { ...s, startFrame: curr };
        curr += s.durationInFrames;
        return sCopy;
      });
      return {
        ...prev,
        metadata: { ...prev.metadata, totalDurationInFrames: curr },
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
      return { ...prev, scenes: nextScenes };
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
      return { ...prev, scenes: copy };
    });
  };

  // Preset Script Templates for quick one-click inspiration
  const applyPresetTemplate = (type: "pitch" | "tech" | "case_study") => {
    let newScenes: Scene[] = [];
    if (type === "pitch") {
      newScenes = [
        {
          id: `s-${Date.now()}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "Traditional video editing is broken. Timelines are too complex and tedious.",
          wordTokens: [],
          background: { type: "color", src: "#1e1b4b", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "shocked", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-1", type: "lower-third", props: { title: "The Problem", subtitle: "Manual multitrack chaos", category: "INSIGHT" } }],
        },
        {
          id: `s-${Date.now()}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "Enter ZeroTrack. The narrative text script directly anchors every frame and visual.",
          wordTokens: [],
          background: { type: "color", src: "#0f172a", motion: "pan-left" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Speed Increase", targetValue: 300, prefix: "+", suffix: "%", accentColor: "#6366f1" } }],
        },
        {
          id: `s-${Date.now()}-3`,
          startFrame: 230,
          durationInFrames: 120,
          scriptText: "Kokoro TTS and Whisper generate instant thirty FPS videos in seconds.",
          wordTokens: [],
          background: { type: "color", src: "#064e3b", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "pointing", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-3", type: "progress-ring", props: { label: "Export Ready", percentage: 100, color: "#10b981" } }],
        },
      ];
    } else {
      newScenes = [
        {
          id: `s-${Date.now()}-1`,
          startFrame: 0,
          durationInFrames: 110,
          scriptText: "How does Semantic Anchoring work under the hood? Let us look at the IPC architecture.",
          wordTokens: [],
          background: { type: "color", src: "#0b0d13", motion: "zoom-in" },
          mascot: { isVisible: true, pose: "explaining", position: "left", entranceAnimation: "slide-up" },
          overlays: [{ id: "o-1", type: "code-snippet", props: { filename: "ipc-bridge.ts", code: `const python = spawn("python3", ["pipeline.py"]);\npython.stdin.write(stateJSON);` } }],
        },
        {
          id: `s-${Date.now()}-2`,
          startFrame: 110,
          durationInFrames: 120,
          scriptText: "Python generates the voice track and returns word-level Whisper timestamps.",
          wordTokens: [],
          background: { type: "color", src: "#172554", motion: "pan-left" },
          mascot: { isVisible: true, pose: "pointing", position: "left", entranceAnimation: "pop-in" },
          overlays: [{ id: "o-2", type: "stat-counter", props: { label: "Word Accuracy", targetValue: 99, prefix: "", suffix: "%", accentColor: "#38bdf8" } }],
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

        {/* Quick Template Inspirations */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyPresetTemplate("pitch")}
            title="Load Product Pitch Script"
            className="text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800 transition-colors"
          >
            Pitch
          </button>
          <button
            onClick={() => applyPresetTemplate("tech")}
            title="Load Technical Explainer Script"
            className="text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800 transition-colors"
          >
            Code
          </button>
        </div>
      </div>

      {/* Narrative Script Philosophy Banner */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-studio-accent/15 via-studio-850 to-transparent border-b border-studio-800/80 text-[11px] text-slate-300 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong>Semantic Anchoring:</strong> Edit script text below. Audio and frame durations lock automatically.
        </span>
      </div>

      {/* Scene Feed (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {state.scenes.map((scene, idx) => {
          const isSelected = scene.id === selectedSceneId;
          const durationSeconds = (scene.durationInFrames / state.metadata.fps).toFixed(1);
          const wordCount = scene.scriptText.trim().split(/\s+/).filter(Boolean).length;
          const hasTokens = scene.wordTokens && scene.wordTokens.length > 0;

          return (
            <div
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
              className={`rounded-xl border transition-all cursor-pointer p-3.5 relative group ${
                isSelected
                  ? "bg-studio-900/95 border-studio-accent shadow-lg shadow-studio-accent/10 ring-1 ring-studio-accent/40"
                  : "bg-studio-900/40 border-studio-800 hover:bg-studio-900/80 hover:border-studio-700"
              }`}
            >
              {/* Scene Card Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold ${
                      isSelected
                        ? "bg-studio-accent text-white"
                        : "bg-studio-800 text-slate-400 group-hover:text-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </span>

                  {/* Frame & Seconds Badge */}
                  <div className="flex items-center gap-1 text-[11px] font-mono font-medium text-slate-300 bg-studio-950 px-2 py-0.5 rounded border border-studio-800">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{durationSeconds}s</span>
                    <span className="text-slate-500">({scene.durationInFrames}f)</span>
                  </div>

                  {/* Word Count */}
                  <span className="text-[10px] text-slate-400 font-medium">
                    {wordCount} words
                  </span>
                </div>

                {/* Card Controls */}
                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleMove(idx, -1, e)}
                    disabled={idx === 0}
                    className="p-1 hover:bg-studio-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleMove(idx, 1, e)}
                    disabled={idx === state.scenes.length - 1}
                    className="p-1 hover:bg-studio-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDuplicateScene(scene, e)}
                    className="p-1 hover:bg-studio-800 rounded text-slate-400 hover:text-white"
                    title="Duplicate Scene"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {state.scenes.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteScene(scene.id, e)}
                      className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                      title="Delete Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Spoken Text Script Area */}
              <div className="relative">
                <textarea
                  value={scene.scriptText}
                  onChange={(e) => handleScriptChange(scene.id, e.target.value)}
                  placeholder="Enter the voice narrative for this scene..."
                  rows={2}
                  className="w-full bg-studio-950/80 hover:bg-studio-950 focus:bg-studio-950 border border-studio-800 focus:border-studio-accent rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed font-sans transition-all"
                />
              </div>

              {/* Scene Metadata Tags */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-studio-800/60">
                <div className="flex items-center gap-2">
                  {/* Mascot Pose Tag */}
                  {scene.mascot.isVisible ? (
                    <span className="flex items-center gap-1 bg-studio-950 px-2 py-0.5 rounded border border-studio-800 text-[10px] text-amber-400 font-medium">
                      <Smile className="w-3 h-3 text-amber-400" />
                      <span>{scene.mascot.pose}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Mascot hidden</span>
                  )}

                  {/* Overlays Tag */}
                  {scene.overlays.length > 0 && (
                    <span className="flex items-center gap-1 bg-studio-950 px-2 py-0.5 rounded border border-studio-800 text-[10px] text-indigo-300 font-medium">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>{scene.overlays.length} overlay</span>
                    </span>
                  )}
                </div>

                {/* Whisper Alignment Status Indicator */}
                <div className="flex items-center gap-1">
                  {hasTokens ? (
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Whisper Synced
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-amber-400/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                      Needs Audio Sync
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Scene Button */}
        <button
          onClick={handleAddScene}
          className="w-full py-3 rounded-xl border border-dashed border-studio-700 hover:border-studio-accent bg-studio-900/20 hover:bg-studio-900/60 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all group"
        >
          <Plus className="w-4 h-4 text-studio-accent group-hover:scale-110 transition-transform" />
          <span>Add New Scene</span>
        </button>
      </div>

      {/* Bottom Sync Banner */}
      <div className="p-3 border-t border-studio-800 bg-studio-900/60 flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          Sync generates Kokoro .wav and Whisper frames
        </div>
        <button
          onClick={onTriggerSync}
          disabled={isSyncing}
          className="px-3 py-1.5 rounded-lg bg-studio-accent hover:bg-studio-accentHover text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Sync Timings</span>
        </button>
      </div>
    </aside>
  );
};
