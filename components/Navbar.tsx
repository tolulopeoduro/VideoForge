import React, { useState } from "react";
import { MasterVideoState } from "@/types/schema";
import {
  Sparkles,
  Download,
  Volume2,
  Tv2,
  CheckCircle2,
  Loader2,
  HelpCircle,
  Smartphone,
  Monitor,
  Music2,
  X,
  Keyboard,
  Pencil,
} from "lucide-react";

interface NavbarProps {
  state: MasterVideoState;
  onUpdateState: (updater: (prev: MasterVideoState) => MasterVideoState) => void;
  onTriggerSync: () => void;
  onOpenExport: () => void;
  onOpenWizard?: () => void;
  isSyncing: boolean;
  isExporting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  onUpdateState,
  onTriggerSync,
  onOpenExport,
  onOpenWizard,
  isSyncing,
  isExporting,
}) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const isPortrait = state.metadata.height > state.metadata.width;
  const isAudioLocked = Boolean(state.audio.voiceTrackUrl);

  const setAspectRatio = (target: "9:16" | "16:9") => {
    if ((target === "9:16" && isPortrait) || (target === "16:9" && !isPortrait)) return;
    onUpdateState((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        width: target === "9:16" ? 1080 : 1920,
        height: target === "9:16" ? 1920 : 1080,
      },
    }));
  };

  const totalSeconds = (state.metadata.totalDurationInFrames / state.metadata.fps).toFixed(1);

  return (
    <>
      <header className="h-16 border-b border-white/[0.07] bg-studio-975/95 backdrop-blur-2xl px-5 flex items-center justify-between z-40 select-none shadow-sm">
        {/* Left Section: Brand & Project Identity */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5 group cursor-pointer" onClick={onOpenWizard}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-studio-accent via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-studio-accent/25 border border-white/20 transition-transform group-hover:scale-105">
              <Tv2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight leading-none">
                  ZeroTrack
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider bg-studio-accent/20 text-indigo-300 px-1.5 py-0.5 rounded border border-studio-accent/30 font-bold">
                  Studio
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
                Semantic Anchor Engine
              </div>
            </div>
          </div>

          <div className="h-5 w-px bg-white/[0.08] mx-1 hidden md:block" />

          {/* Project Title Editor */}
          <div className="relative flex items-center group">
            <input
              type="text"
              value={state.metadata.title}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              onChange={(e) =>
                onUpdateState((prev) => ({
                  ...prev,
                  metadata: { ...prev.metadata, title: e.target.value },
                }))
              }
              title="Click to rename project"
              className="bg-transparent hover:bg-studio-900/80 focus:bg-studio-900 border border-transparent hover:border-white/10 focus:border-studio-accent text-slate-100 text-xs font-semibold rounded-lg px-2.5 py-1 outline-none transition-all w-52 truncate"
            />
            {!isEditingTitle && (
              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 absolute right-2 pointer-events-none transition-opacity" />
            )}
          </div>

          {/* AI Script Wizard Re-trigger */}
          {onOpenWizard && (
            <button
              onClick={onOpenWizard}
              title="Re-open conversational research and script onboarding"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-indigo-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Director</span>
            </button>
          )}
        </div>

        {/* Center: Live Resolution & Duration Stats Bar */}
        <div className="hidden xl:flex items-center gap-3 bg-studio-900/80 border border-white/[0.08] rounded-full px-4 py-1.5 text-xs text-slate-300 shadow-inner">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isAudioLocked ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-semibold text-slate-200">
              {isAudioLocked ? "Audio Synchronized" : "Draft Timing"}
            </span>
          </div>

          <span className="text-white/20">•</span>

          <span className="font-mono text-slate-300">
            <strong className="text-white">{state.scenes.length}</strong> scenes
          </span>

          <span className="text-white/20">•</span>

          <span className="font-mono text-slate-300 tabular-nums">
            <strong className="text-white">{state.metadata.totalDurationInFrames}f</strong> ({totalSeconds}s)
          </span>

          {isAudioLocked && (
            <>
              <span className="text-white/20">•</span>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <Music2 className="w-3 h-3" />
                <span>24kHz Locked</span>
              </div>
            </>
          )}
        </div>

        {/* Right Section: Format Switcher, Audio Sync & Export */}
        <div className="flex items-center gap-2">
          {/* Aspect Ratio Segmented Control */}
          <div className="flex items-center bg-studio-900 p-0.5 rounded-xl border border-white/[0.08] text-xs">
            <button
              onClick={() => setAspectRatio("9:16")}
              title="Switch to 9:16 Portrait (TikTok, Shorts, Reels)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                isPortrait
                  ? "bg-studio-accent text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">9:16</span>
            </button>
            <button
              onClick={() => setAspectRatio("16:9")}
              title="Switch to 16:9 Landscape (YouTube, Desktop)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
                !isPortrait
                  ? "bg-studio-accent text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">16:9</span>
            </button>
          </div>

          {/* Sync Speech & Timings Modal Trigger */}
          <button
            onClick={onTriggerSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isSyncing
                ? "bg-studio-800 text-slate-400 cursor-not-allowed border border-white/[0.05]"
                : isAudioLocked
                ? "bg-studio-900 hover:bg-studio-850 border border-emerald-500/40 text-emerald-300 hover:text-white"
                : "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-white shadow-amber-500/10"
            }`}
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Syncing Audio...</span>
              </>
            ) : isAudioLocked ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Re-Sync Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Sync Audio</span>
              </>
            )}
          </button>

          {/* Shortcuts Info Trigger */}
          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts & studio tips"
            className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Primary MP4 Export Trigger */}
          <button
            onClick={onOpenExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95 disabled:opacity-50"
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

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-studio-900 border border-white/[0.12] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-studio-accent" />
                <h3 className="text-sm font-bold text-white">Studio Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { key: "Space", desc: "Play / Pause Video Preview" },
                { key: "←  /  →", desc: "Step 1 frame backward / forward" },
                { key: "Shift + ← / →", desc: "Jump 10 frames backward / forward" },
                { key: "Home / 0", desc: "Restart preview from frame 0" },
                { key: "M", desc: "Mute / Unmute audio playback" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-studio-950 border border-white/[0.05]">
                  <span className="text-slate-300">{item.desc}</span>
                  <kbd className="font-mono font-bold bg-studio-800 text-indigo-300 px-2 py-0.5 rounded border border-white/10 text-[11px]">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-slate-500 text-center">
              Semantic text editing automatically recalculates frames in real-time.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
