import React, { useState } from "react";
import { MasterVideoState } from "@/types/schema";
import { Download, CheckCircle2, AlertCircle, Loader2, X, Play, Film } from "lucide-react";

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-studio-900 border border-studio-700 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-studio-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-studio-accent to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Export MP4 Video</h3>
            <p className="text-xs text-slate-400">
              High Performance Local Remotion Node.js Engine
            </p>
          </div>
        </div>

        {/* Export Spec Summary */}
        <div className="bg-studio-950 rounded-xl p-4 border border-studio-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Resolution</span>
            <span className="font-mono font-bold text-white">
              {state.metadata.width} × {state.metadata.height} (
              {state.metadata.height > state.metadata.width ? "9:16 Vertical" : "16:9 Landscape"}
              )
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Frame Rate</span>
            <span className="font-mono font-bold text-white">{state.metadata.fps} FPS</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Total Frames</span>
            <span className="font-mono font-bold text-white">
              {state.metadata.totalDurationInFrames}f (
              {(state.metadata.totalDurationInFrames / state.metadata.fps).toFixed(1)}s)
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Scenes</span>
            <span className="font-mono font-bold text-white">{state.scenes.length} Scenes</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Download Link when finished */}
        {downloadUrl && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>MP4 Video Rendered Successfully!</span>
            </div>
            <a
              href={downloadUrl}
              download
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 Video</span>
            </a>
          </div>
        )}

        {/* Action Button */}
        {!downloadUrl && (
          <button
            onClick={handleStartRender}
            disabled={isRendering}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-studio-accent to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isRendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Bundling & Rendering MP4 (takes ~5-15s)...</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>Start Remotion Render</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
