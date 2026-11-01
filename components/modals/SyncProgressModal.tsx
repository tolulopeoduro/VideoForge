import React from "react";
import { PipelineProgressEvent } from "@/types/schema";
import { Mic, CheckCircle2, AlertCircle, Loader2, Sparkles, X } from "lucide-react";

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
  if (!isOpen) return null;

  const percent = event?.percent ?? 10;
  const isDone = event?.type === "complete" || (event?.percent ?? 0) >= 100;
  const isError = event?.type === "error";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-studio-900/95 border border-white/[0.12] rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform ${
                isDone
                  ? "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-emerald-500/25"
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
                Speech Pipeline & Faster-Whisper IPC
              </p>
            </div>
          </div>

          {isDone && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-studio-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Shimmering Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              {event?.message || "Running speech synthesis..."}
            </span>
            <span className="font-mono font-bold text-amber-400 tabular-nums">{percent}%</span>
          </div>

          <div className="w-full h-3 bg-studio-950 rounded-full overflow-hidden border border-white/[0.08] p-0.5">
            <div
              style={{ width: `${percent}%` }}
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/50"
            />
          </div>
        </div>

        {/* Pipeline Execution Stages */}
        <div className="bg-studio-950 rounded-2xl p-4 border border-white/[0.06] space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  percent >= 25 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={percent >= 25 ? "text-slate-200 font-medium" : "text-slate-500"}>
                Node.js to Python IPC Pipe Bridge
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {percent >= 25 ? "Ready" : "Waiting"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  percent >= 60 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={percent >= 60 ? "text-slate-200 font-medium" : "text-slate-500"}>
                Vocal Synthesis & 24kHz PCM Rendering
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {percent >= 60 ? "Rendered" : "Processing"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  percent >= 85 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-studio-700"
                }`}
              />
              <span className={percent >= 85 ? "text-slate-200 font-medium" : "text-slate-500"}>
                Word-Level Alignment & Frame Locking
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {percent >= 85 ? "Locked" : "Aligning"}
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-1 flex items-center justify-end">
          {isDone ? (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Continue Editing with Synced Audio</span>
            </button>
          ) : isError ? (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-slate-300 font-bold text-xs transition-colors"
            >
              Dismiss
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 mx-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Aligning speech timestamps...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
