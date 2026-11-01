import React, { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { PlayerRef } from "@remotion/player";
import { MasterVideoState } from "@/types/schema";
import { ZeroTrackComposition } from "@/remotion/ZeroTrackComposition";

const Player = dynamic(
  () => import("@remotion/player").then((mod) => mod.Player),
  { ssr: false }
);

import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Tv2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Repeat,
  Eye,
  EyeOff,
  Layers,
  ZoomIn,
} from "lucide-react";

interface CenterPlayerPanelProps {
  state: MasterVideoState;
  selectedSceneId: string;
  onSelectScene: (id: string) => void;
}

export const CenterPlayerPanel: React.FC<CenterPlayerPanelProps> = ({
  state,
  selectedSceneId,
  onSelectScene,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showSafeMargins, setShowSafeMargins] = useState(false);

  const totalFrames = Math.max(30, state.metadata.totalDurationInFrames);
  const fps = state.metadata.fps || 30;
  const isPortrait = state.metadata.height > state.metadata.width;

  // Listen to Player frame updates
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (frame: number) => {
      if (!playerRef.current) return;
      const target = Math.max(0, Math.min(totalFrames - 1, frame));
      playerRef.current.seekTo(target);
      setCurrentFrame(target);
    },
    [totalFrames]
  );

  const stepFrame = useCallback(
    (delta: number) => {
      handleSeek(currentFrame + delta);
    },
    [currentFrame, handleSeek]
  );

  const handleRestart = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(0);
    playerRef.current.play();
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unmute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  // Jump to next or previous scene start frame
  const jumpScene = useCallback(
    (dir: -1 | 1) => {
      const currIdx = state.scenes.findIndex((s) => s.id === selectedSceneId);
      const nextIdx = currIdx + dir;
      if (nextIdx >= 0 && nextIdx < state.scenes.length) {
        const nextScene = state.scenes[nextIdx];
        onSelectScene(nextScene.id);
        handleSeek(nextScene.startFrame);
      }
    },
    [selectedSceneId, state.scenes, onSelectScene, handleSeek]
  );

  // Global Keyboard Shortcuts (Space, Arrows, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepFrame(e.shiftKey ? -10 : -1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        stepFrame(e.shiftKey ? 10 : 1);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "0" || e.code === "Home") {
        e.preventDefault();
        handleSeek(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, stepFrame, toggleMute, handleSeek]);

  // SMPTE Timecode Formatter HH:MM:SS:FF
  const formatTimecode = (frame: number) => {
    const totalSecs = frame / fps;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const frames = Math.floor(frame % fps);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  // Find currently active scene for transport highlight
  const activeSceneIdx = state.scenes.findIndex((s) => {
    return (
      currentFrame >= s.startFrame &&
      currentFrame < s.startFrame + s.durationInFrames
    );
  });
  const currentScene = state.scenes[activeSceneIdx >= 0 ? activeSceneIdx : 0];

  return (
    <main className="flex-1 h-[calc(100vh-4rem)] bg-studio-975 flex flex-col overflow-hidden relative select-none">
      {/* Player Top Canvas Control Bar */}
      <div className="h-11 px-5 border-b border-white/[0.07] bg-studio-950/70 backdrop-blur-xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-studio-accent animate-pulse" />
            <span className="font-bold text-white text-xs tracking-tight">
              Interactive Canvas
            </span>
          </div>

          <span className="text-white/20">•</span>

          <span className="font-mono text-indigo-300 text-[11px] bg-studio-900 px-2 py-0.5 rounded border border-white/[0.08]">
            {isPortrait ? "9:16 Portrait" : "16:9 Landscape"} ({state.metadata.width}×{state.metadata.height})
          </span>

          <span className="text-white/20 hidden sm:inline">•</span>

          <span className="text-emerald-400 font-semibold text-[11px] hidden sm:inline">
            30 FPS Hardware Accelerated
          </span>
        </div>

        {/* Viewport Action Toggles */}
        <div className="flex items-center gap-2">
          {/* Safe Margins Guide (TikTok / Reels safe margins) */}
          <button
            onClick={() => setShowSafeMargins(!showSafeMargins)}
            title="Toggle TikTok / Reels interactive safe UI margins overlay"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              showSafeMargins
                ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                : "bg-studio-900 border-white/[0.08] text-slate-400 hover:text-slate-200"
            }`}
          >
            {showSafeMargins ? (
              <Eye className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Safe Margins</span>
          </button>

          {/* Active Scene Badge */}
          <span className="bg-studio-900 px-2.5 py-1 rounded-lg border border-white/[0.08] font-mono text-[11px] text-slate-300">
            Scene <strong className="text-white">{(activeSceneIdx >= 0 ? activeSceneIdx : 0) + 1}</strong> of{" "}
            {state.scenes.length}
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-studio-900/60 via-studio-975 to-studio-975 overflow-hidden">
        {/* Subtle studio dot matrix backdrop */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Remotion Player Frame with Studio Matte Bezel */}
        <div
          className={`relative rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/[0.12] bg-black flex items-center justify-center transition-all ${
            isPortrait
              ? "h-[94%] max-h-[740px] aspect-[9/16]"
              : "w-[94%] max-w-[960px] aspect-[16/9]"
          }`}
        >
          <Player
            ref={playerRef}
            component={ZeroTrackComposition as any}
            inputProps={{ state }}
            durationInFrames={totalFrames}
            compositionWidth={state.metadata.width}
            compositionHeight={state.metadata.height}
            fps={fps}
            style={{
              width: "100%",
              height: "100%",
            }}
            controls={false}
            loop={isLooping}
            autoPlay={false}
          />

          {/* Optional Safe Area Overlay Mask for Vertical Video */}
          {showSafeMargins && isPortrait && <div className="safe-area-overlay" />}
        </div>
      </div>

      {/* Multi-Segment Timeline & Studio Transport Bar */}
      <div className="border-t border-white/[0.08] bg-studio-950/90 backdrop-blur-2xl p-4 space-y-3 select-none z-30 shadow-2xl">
        {/* Multi-scene Proportional Segmented Track */}
        <div className="space-y-1.5">
          <div className="relative w-full h-5 bg-studio-900 rounded-lg overflow-hidden border border-white/[0.08] flex items-center cursor-pointer group shadow-inner">
            {/* Scene Blocks */}
            {state.scenes.map((scene, idx) => {
              const startPct = (scene.startFrame / totalFrames) * 100;
              const widthPct = (scene.durationInFrames / totalFrames) * 100;
              const isSelected = scene.id === selectedSceneId;
              const isActiveScene = idx === activeSceneIdx;

              return (
                <div
                  key={scene.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScene(scene.id);
                    handleSeek(scene.startFrame);
                  }}
                  title={`Scene ${idx + 1}: ${scene.scriptText.slice(0, 40)}...`}
                  style={{
                    position: "absolute",
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    height: "100%",
                  }}
                  className={`border-r border-studio-950 flex items-center px-1.5 transition-all ${
                    isActiveScene
                      ? "bg-studio-accent/35"
                      : isSelected
                      ? "bg-studio-accent/20"
                      : "bg-studio-800/40 hover:bg-studio-750/60"
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-300 opacity-70 group-hover:opacity-100 truncate">
                    {idx + 1}
                  </span>
                </div>
              );
            })}

            {/* Playhead Progress Fill */}
            <div
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
              className="h-full bg-gradient-to-r from-indigo-500/40 via-studio-accent/50 to-studio-accent pointer-events-none"
            />

            {/* Draggable Scrubber Range Input */}
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            {/* Playhead Cursor Needle */}
            <div
              style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_#ffffff] pointer-events-none -ml-0.5"
            />
          </div>

          {/* Timecode & Frame Counters */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs tabular-nums">
                {formatTimecode(currentFrame)}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-indigo-300 text-[11px] tabular-nums">
                Frame {currentFrame}
              </span>
            </div>

            <div className="text-slate-400 text-[11px]">
              Total:{" "}
              <strong className="text-white tabular-nums font-mono">
                {totalFrames} frames
              </strong>{" "}
              ({(totalFrames / fps).toFixed(1)}s)
            </div>
          </div>
        </div>

        {/* Transport Controls Dock */}
        <div className="flex items-center justify-between pt-1">
          {/* Left Transport: Jump, Step, Play, Loop */}
          <div className="flex items-center gap-1.5">
            {/* Jump Scene Prev */}
            <button
              onClick={() => jumpScene(-1)}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Jump to Previous Scene"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Step 1 Frame Back */}
            <button
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Step -1 Frame (←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={togglePlay}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 border border-white/20 transition-all active:scale-95"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Step 1 Frame Forward */}
            <button
              onClick={() => stepFrame(1)}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Step +1 Frame (→)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Jump Scene Next */}
            <button
              onClick={() => jumpScene(1)}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Jump to Next Scene"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Restart */}
            <button
              onClick={handleRestart}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all ml-1"
              title="Restart from frame 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Transport: Mute, Loop, Status */}
          <div className="flex items-center gap-2">
            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? "Loop playback is On" : "Loop playback is Off"}
              className={`p-2 rounded-xl border transition-all ${
                isLooping
                  ? "bg-studio-accent/20 border-studio-accent/50 text-indigo-300"
                  : "bg-studio-900 border-white/[0.08] text-slate-500 hover:text-slate-300"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            {/* Mute Audio */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition-all ${
                isMuted
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                  : "bg-studio-900 border-white/[0.08] text-slate-300 hover:text-white"
              }`}
              title={isMuted ? "Unmute audio (M)" : "Mute audio (M)"}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
