import React from "react";
import { MasterVideoState } from "@/types/schema";
import {
  Sparkles,
  Download,
  Ratio,
  Volume2,
  Tv2,
  CheckCircle2,
  Loader2,
  HelpCircle,
} from "lucide-react";

interface NavbarProps {
  state: MasterVideoState;
  onUpdateState: (updater: (prev: MasterVideoState) => MasterVideoState) => void;
  onTriggerSync: () => void;
  onOpenExport: () => void;
  isSyncing: boolean;
  isExporting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  onUpdateState,
  onTriggerSync,
  onOpenExport,
  isSyncing,
  isExporting,
}) => {
  const isPortrait = state.metadata.height > state.metadata.width;

  const toggleAspectRatio = () => {
    onUpdateState((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        width: isPortrait ? 1920 : 1080,
        height: isPortrait ? 1080 : 1920,
      },
    }));
  };

  const totalSeconds = (state.metadata.totalDurationInFrames / state.metadata.fps).toFixed(1);

  return (
    <header className="h-16 border-b border-studio-800 bg-studio-950/90 backdrop-blur-md px-6 flex items-center justify-between z-40 select-none">
      {/* Brand & Studio Philosophy */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-studio-accent to-pink-500 flex items-center justify-center shadow-lg shadow-studio-accent/20">
            <Tv2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-lg tracking-tight">ZeroTrack</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-studio-accent/20 text-indigo-400 px-2 py-0.5 rounded-full border border-studio-accent/30">
                Semantic Studio
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium -mt-0.5">
              Script-Driven AI Video Engine
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-studio-800 hidden md:block" />

        {/* Project Title Input */}
        <input
          type="text"
          value={state.metadata.title}
          onChange={(e) =>
            onUpdateState((prev) => ({
              ...prev,
              metadata: { ...prev.metadata, title: e.target.value },
            }))
          }
          className="bg-transparent hover:bg-studio-900 focus:bg-studio-900 border border-transparent focus:border-studio-700 text-slate-200 text-sm font-semibold rounded-lg px-2.5 py-1 outline-none transition-colors w-56 truncate"
        />
      </div>

      {/* Center Timing & Stats Badge */}
      <div className="hidden lg:flex items-center gap-3 bg-studio-900/80 border border-studio-800 rounded-full px-4 py-1.5 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Semantic Timing Locked</span>
        </div>
        <span className="text-studio-700">•</span>
        <span>
          <strong className="text-white">{state.scenes.length}</strong> Scenes
        </span>
        <span className="text-studio-700">•</span>
        <span>
          <strong className="text-white">{state.metadata.totalDurationInFrames}f</strong> ({totalSeconds}s)
        </span>
        <span className="text-studio-700">•</span>
        <span className="text-slate-400 font-mono">
          {isPortrait ? "9:16 (1080×1920)" : "16:9 (1920×1080)"}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Aspect Ratio Switcher */}
        <button
          onClick={toggleAspectRatio}
          title="Toggle 9:16 (Shorts/TikTok) vs 16:9 (YouTube)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-semibold text-slate-300 transition-all hover:text-white"
        >
          <Ratio className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isPortrait ? "9:16 Vertical" : "16:9 Landscape"}</span>
        </button>

        {/* Sync Timings & Speech (Kokoro + Whisper IPC) */}
        <button
          onClick={onTriggerSync}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-md ${
            isSyncing
              ? "bg-studio-800 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-orange-500/20 active:scale-95"
          }`}
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
              <span>Aligning Audio...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Sync Audio & Timing</span>
            </>
          )}
        </button>

        {/* Export MP4 button */}
        <button
          onClick={onOpenExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-studio-accent to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Rendering...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Export MP4</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
