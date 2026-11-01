import React from "react";
import { PipelineProgressEvent } from "@/types/schema";
import { Mic, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-studio-900 border border-studio-700 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : isError ? (
              <AlertCircle className="w-5 h-5 text-red-200" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              {isDone
                ? "Audio & Timing Synced!"
                : isError
                ? "Sync Encountered an Error"
                : "Semantic Audio Synchronization"}
            </h3>
            <p className="text-xs text-slate-400">
              Kokoro-82M TTS & Faster-Whisper IPC Pipeline
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              {event?.message || "Running Python speech pipeline..."}
            </span>
            <span className="font-mono font-bold text-amber-400">{percent}%</span>
          </div>

          <div className="w-full h-3 bg-studio-950 rounded-full overflow-hidden border border-studio-800 p-0.5">
            <div
              style={{ width: `${percent}%` }}
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/50"
            />
          </div>
        </div>

        {/* Progress Stages Checklist */}
        <div className="bg-studio-950 rounded-xl p-3 border border-studio-800 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                percent >= 25 ? "bg-emerald-400" : "bg-studio-700"
              }`}
            />
            <span className={percent >= 25 ? "text-slate-200" : "text-slate-500"}>
              Spawn Python Child Process & IPC Pipe
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                percent >= 60 ? "bg-emerald-400" : "bg-studio-700"
              }`}
            />
            <span className={percent >= 60 ? "text-slate-200" : "text-slate-500"}>
              Kokoro-82M Vocal Speech Synthesis (.wav)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                percent >= 85 ? "bg-emerald-400" : "bg-studio-700"
              }`}
            />
            <span className={percent >= 85 ? "text-slate-200" : "text-slate-500"}>
              Faster-Whisper Word Alignment & Frames Lock
            </span>
          </div>
        </div>

        {/* Footer actions */}
        {(isDone || isError) && (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-studio-accent hover:bg-studio-accentHover text-white text-xs font-bold transition-all shadow-md"
          >
            {isDone ? "Apply Timings to Studio" : "Dismiss"}
          </button>
        )}
      </div>
    </div>
  );
};
