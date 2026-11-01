import React, { useState } from "react";
import { MasterVideoState } from "@/types/schema";
import { Download, CheckCircle2, AlertCircle, Loader2, X, Play, Film, Sparkles } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  state: MasterVideoState;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, state, onClose }) => {
  const [isRendering, setIsRendering] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPortrait = state.metadata.height > state.metadata.width;
  const durationSec = (state.metadata.totalDurationInFrames / state.metadata.fps).toFixed(1);

  const handleStartRender = async () => {
    setIsRendering(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });

      const data = await res.json();
      if (res.ok && data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
      } else {
        setError(data.error || "Failed to render video with Remotion.");
      }
    } catch (err: any) {
      setError(err.message || "Network error while rendering video.");
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-studio-900/95 border border-white/[0.12] rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-studio-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-studio-accent via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-white/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Export MP4 Master</h3>
            <p className="text-xs text-slate-400 font-mono">
              High Performance Local Remotion Engine
            </p>
          </div>
        </div>

        {/* Video Specs Card */}
        <div className="bg-studio-950 rounded-2xl p-4 border border-white/[0.06] space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Resolution</span>
            <span className="font-mono font-bold text-white">
              {state.metadata.width} × {state.metadata.height} ({isPortrait ? "9:16 Vertical" : "16:9 Landscape"})
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Frame Rate</span>
            <span className="font-mono font-bold text-emerald-400">{state.metadata.fps} FPS Constant</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Duration</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {state.metadata.totalDurationInFrames} frames ({durationSec}s)
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Scenes & Layers</span>
            <span className="font-mono font-bold text-indigo-300">{state.scenes.length} Scenes Rigged</span>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Render Complete state */}
        {downloadUrl ? (
          <div className="space-y-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">MP4 Video Ready for Download</h4>
              <p className="text-xs text-slate-400 mt-0.5">Rendered locally with hardware-accelerated Chrome</p>
            </div>
            <a
              href={downloadUrl}
              download
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 inline-flex"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 File</span>
            </a>
          </div>
        ) : (
          /* Render Trigger */
          <button
            onClick={handleStartRender}
            disabled={isRendering}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-xl shadow-indigo-600/30 border border-white/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rendering Frame Sequence (Remotion CLI)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Video Render Now</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
