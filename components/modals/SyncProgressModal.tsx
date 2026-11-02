import React, { useEffect } from "react";
import { PipelineProgressEvent } from "@/types/schema";
import { Mic, CheckCircle2, AlertCircle, Loader2, Sparkles, X, ArrowRight } from "lucide-react";

interface SyncProgressModalProps {
  isOpen: boolean;
  event: PipelineProgressEvent | null;
  onClose: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  event,
  onClose,
}) => {
  const isDone = event?.type === "complete" || (event?.percent ?? 0) >= 100;
  const isError = event?.type === "error";

  // When complete, force 100% progress
  const displayPercent = isDone ? 100 : Math.max(5, event?.percent ?? 10);
  const displayMessage = isDone
    ? "Speech synthesis & word-level frame alignment complete!"
    : isError
    ? (event?.error || "An error occurred during synchronization.")
    : (event?.message || "Running speech synthesis & alignment pipeline...");

  // Auto-dismiss modal 2.5 seconds after successful completion so user is never stuck
  useEffect(() => {
    if (isDone && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isDone, isOpen, onClose]);

  // Pressing Escape or clicking backdrop closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-studio-900/95 border border-white/[0.12] rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative cursor-default"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform ${
                isDone
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/25 scale-105"
                  : isError
                  ? "bg-gradient-to-tr from-rose-500 to-red-600 shadow-rose-500/25"
                  : "bg-gradient-to-tr from-amber-500 to-orange-500 shadow-orange-500/25 animate-pulse"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isDone
                  ? "Audio & Timing Synchronized!"
                  : isError
                  ? "Sync Encountered an Error"
                  : "Aligning Spoken Audio & Frames"}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Kokoro-82M TTS & Faster-Whisper Alignment
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-studio-800 transition-colors"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 truncate pr-2">
              {displayMessage}
            </span>
            <span
              className={`font-mono font-bold tabular-nums ${
                isDone ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {displayPercent}%
            </span>
          </div>

          <div className="w-full h-3 bg-studio-950 rounded-full overflow-hidden border border-white/[0.08] p-0.5">
            <div
              style={{ width: `${displayPercent}%` }}
              className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                isDone
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-emerald-500/50"
                  : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shadow-amber-500/50"
              }`}
            />
          </div>
        </div>

        {/* Execution Stages Checklist */}
        <div className="bg-studio-950 rounded-2xl p-4 border border-white/[0.06] space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  displayPercent >= 25 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={displayPercent >= 25 ? "text-slate-200 font-medium" : "text-slate-500"}>
                Node.js to Python IPC Pipe Bridge
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 font-semibold">
              {displayPercent >= 25 ? "Connected" : "Waiting"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  displayPercent >= 60 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={displayPercent >= 60 ? "text-slate-200 font-medium" : "text-slate-500"}>
                Kokoro-82M Neural Vocal Synthesis
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 font-semibold">
              {displayPercent >= 60 ? "Rendered (24kHz)" : "Processing"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isDone ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={isDone ? "text-slate-200 font-medium" : "text-slate-500"}>
                Faster-Whisper Word Frame Alignment
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 font-semibold">
              {isDone ? "Locked to Timeline" : "Aligning"}
            </span>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-1">
          {isDone ? (
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-emerald-500/25 border border-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Continue Editing in Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : isError ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-slate-300 font-bold text-xs transition-colors"
            >
              Dismiss
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Generating speech and locking frames...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
