"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { MasterVideoState } from "@/types/schema";
import { ZeroTrackComposition } from "@/remotion/ZeroTrackComposition";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Repeat,
  Eye,
  EyeOff,
  Box,
  Sparkles,
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
  const [isMounted, setIsMounted] = useState(false);
  const playerRef = useRef<PlayerRef | null>(null);
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [audioPolicyBlocked, setAudioPolicyBlocked] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calculatedTotalFrames = state.scenes.reduce(
    (acc, s) => acc + (s.durationInFrames || 30),
    0
  );
  const totalFrames = Math.max(
    30,
    state.metadata.totalDurationInFrames || calculatedTotalFrames
  );
  const fps = state.metadata.fps || 30;
  const isPortrait = state.metadata.height > state.metadata.width;

  const setPlayerRef = useCallback((node: PlayerRef | null) => {
    playerRef.current = node;
    setPlayer(node);
  }, []);

  // Attach Remotion Player event listeners directly to the real PlayerRef instance
  useEffect(() => {
    if (!player) return;

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      setCurrentFrame(e.detail.frame);
    };

    const onPlay = () => {
      setIsPlaying(true);
      setAudioPolicyBlocked(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (isLooping) {
        try {
          player.seekTo(0);
          player.play();
        } catch (e) {}
      }
    };
    const onError = (e: { detail: { error: Error } }) => {
      console.warn("Remotion Player runtime event error:", e.detail?.error);
    };

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    player.addEventListener("error", onError);

    try {
      setIsPlaying(player.isPlaying());
      setCurrentFrame(player.getCurrentFrame());
    } catch (e) {}

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("error", onError);
    };
  }, [player, isLooping]);

  // 60fps rAF sync loop to guarantee buttery-smooth playhead and timecode updates
  useEffect(() => {
    if (!isPlaying || !player) return;

    let rafId: number;
    const tick = () => {
      try {
        const frame = player.getCurrentFrame();
        if (typeof frame === "number") {
          setCurrentFrame(frame);
        }
        const activePlaying = player.isPlaying();
        if (!activePlaying && isPlaying) {
          setIsPlaying(false);
        }
      } catch (e) {}
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, player]);

  // Master Play / Pause Toggle Controller
  const togglePlay = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      const activePlayer = playerRef.current || player;
      if (!activePlayer) return;

      try {
        if (activePlayer.isPlaying()) {
          activePlayer.pause();
          setIsPlaying(false);
        } else {
          if (activePlayer.getCurrentFrame() >= totalFrames - 1) {
            activePlayer.seekTo(0);
            setCurrentFrame(0);
          }
          // Pass synthetic mouse event if available so Remotion warms up audio context
          activePlayer.play(e as any);
          setIsPlaying(true);
          setAudioPolicyBlocked(false);
        }
      } catch (err: any) {
        console.warn("Player play() exception, falling back to muted playback:", err);
        try {
          activePlayer.mute();
          setIsMuted(true);
          setAudioPolicyBlocked(true);
          activePlayer.play();
          setIsPlaying(true);
        } catch (retryErr) {
          console.error("Fatal playback error:", retryErr);
        }
      }
    },
    [player, totalFrames]
  );

  const handleSeek = useCallback(
    (frame: number) => {
      const activePlayer = playerRef.current || player;
      const target = Math.max(0, Math.min(totalFrames - 1, frame));
      setCurrentFrame(target);
      if (activePlayer) {
        activePlayer.seekTo(target);
      }
    },
    [totalFrames, player]
  );

  const stepFrame = useCallback(
    (delta: number) => {
      handleSeek(currentFrame + delta);
    },
    [currentFrame, handleSeek]
  );

  const handleRestart = useCallback(
    (e?: React.MouseEvent) => {
      const activePlayer = playerRef.current || player;
      if (!activePlayer) return;
      activePlayer.seekTo(0);
      setCurrentFrame(0);
      activePlayer.play(e as any);
      setIsPlaying(true);
    },
    [player]
  );

  const toggleMute = useCallback(() => {
    const activePlayer = playerRef.current || player;
    if (!activePlayer) return;
    if (isMuted) {
      activePlayer.unmute();
      setIsMuted(false);
      setAudioPolicyBlocked(false);
    } else {
      activePlayer.mute();
      setIsMuted(true);
    }
  }, [isMuted, player]);

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

  // Global Keyboard Shortcuts (Space, Arrows, M, Home)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
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

  // SMPTE Timecode Formatter MM:SS:FF
  const formatTimecode = (frame: number) => {
    const totalSecs = frame / fps;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const frames = Math.floor(frame % fps);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

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
            <span
              className={`w-2 h-2 rounded-full ${
                isPlaying
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"
                  : "bg-studio-accent"
              }`}
            />
            <span className="font-bold text-white text-xs tracking-tight">
              {isPlaying ? "Playing Live" : "Studio Canvas"}
            </span>
          </div>

          <span className="text-white/20">•</span>

          <span className="font-mono text-indigo-300 text-[11px] bg-studio-900 px-2 py-0.5 rounded border border-white/[0.08]">
            {isPortrait ? "9:16 Vertical" : "16:9 Landscape"} ({state.metadata.width}×
            {state.metadata.height})
          </span>

          <span className="text-white/20 hidden sm:inline">•</span>

          <span className="text-cyan-400 font-semibold text-[11px] hidden sm:inline flex items-center gap-1">
            <Box className="w-3 h-3 inline mr-1" />
            Three.js WebGL + Remotion 4.0
          </span>
        </div>

        {/* Viewport Action Toggles */}
        <div className="flex items-center gap-2">
          {audioPolicyBlocked && (
            <button
              onClick={toggleMute}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 animate-pulse hover:bg-amber-500/25 transition-all"
            >
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              <span>Click to Unmute Audio</span>
            </button>
          )}

          {currentScene?.threeDScene && currentScene.threeDScene !== "none" && (
            <span className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold uppercase hidden lg:inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              3D: {currentScene.threeDScene}
            </span>
          )}

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
        {/* Studio dot matrix backdrop */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Remotion Player Frame with Studio Matte Bezel */}
        <div
          className={`relative rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/[0.12] bg-black flex items-center justify-center transition-all select-none group ${
            isPortrait
              ? "h-[94%] max-h-[740px] aspect-[9/16]"
              : "w-[94%] max-w-[960px] aspect-[16/9]"
          }`}
        >
          {isMounted ? (
            <Player
              ref={setPlayerRef}
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
              clickToPlay={false}
              spaceKeyToPlayOrPause={false}
              loop={isLooping}
              autoPlay={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-mono">
              Initializing Remotion + WebGL Engine...
            </div>
          )}

          {/* Master Canvas Click-to-Play Overlay */}
          <div
            onClick={togglePlay}
            className="absolute inset-0 z-20 cursor-pointer flex items-center justify-center transition-all"
          >
            {/* When Paused: Prominent Studio Glassmorphic Play Badge */}
            {!isPlaying && (
              <div className="w-16 h-16 rounded-3xl bg-studio-accent/90 hover:bg-studio-accent hover:scale-110 active:scale-95 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/50 transition-all duration-150">
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              </div>
            )}

            {/* When Playing: Subtle Hover Pause Badge */}
            {isPlaying && (
              <div className="w-14 h-14 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <Pause className="w-6 h-6 fill-white" />
              </div>
            )}
          </div>

          {/* Optional Safe Area Overlay Mask for Vertical Video */}
          {showSafeMargins && isPortrait && <div className="safe-area-overlay pointer-events-none z-30" />}
        </div>
      </div>

      {/* Multi-Segment Timeline & Studio Transport Bar */}
      <div className="border-t border-white/[0.08] bg-studio-950/95 backdrop-blur-2xl p-4 space-y-3 select-none z-30 shadow-2xl">
        {/* Multi-scene Proportional Segmented Track */}
        <div className="space-y-1.5">
          <div className="relative w-full h-6 bg-studio-900 rounded-lg overflow-hidden border border-white/[0.08] flex items-center cursor-pointer group shadow-inner">
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
                  title={`Scene ${idx + 1}: ${scene.scriptText.slice(0, 45)}...`}
                  style={{
                    position: "absolute",
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    height: "100%",
                  }}
                  className={`border-r border-studio-950 flex items-center justify-between px-2 transition-all z-20 hover:brightness-125 ${
                    isActiveScene
                      ? "bg-studio-accent/40"
                      : isSelected
                      ? "bg-studio-accent/25"
                      : "bg-studio-800/40 hover:bg-studio-750/60"
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-200">
                    S{idx + 1}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 opacity-60 hidden md:inline">
                    {(scene.durationInFrames / fps).toFixed(1)}s
                  </span>
                </div>
              );
            })}

            {/* Playhead Progress Fill */}
            <div
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
              className="h-full bg-gradient-to-r from-indigo-500/30 via-studio-accent/45 to-studio-accent pointer-events-none"
            />

            {/* Draggable Scrubber Range Input */}
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-30"
            />

            {/* Playhead Cursor Needle */}
            <div
              style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_#ffffff] pointer-events-none -ml-0.5 z-40"
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
                Frame {currentFrame} / {totalFrames}
              </span>
            </div>

            <div className="text-slate-400 text-[11px] flex items-center gap-2">
              <span>
                Total Duration:{" "}
                <strong className="text-white tabular-nums font-mono">
                  {(totalFrames / fps).toFixed(1)}s
                </strong>
              </span>
              <span className="text-white/20">•</span>
              <span className="text-slate-400">
                Avg:{" "}
                <strong className="text-slate-200 font-mono">
                  {(totalFrames / (state.scenes.length || 1) / fps).toFixed(1)}s
                </strong>
                /slide
              </span>
            </div>
          </div>
        </div>

        {/* Transport Controls Dock */}
        <div className="flex items-center justify-between pt-1">
          {/* Left Transport: Jump, Step, Play, Loop */}
          <div className="flex items-center gap-2">
            {/* Jump Scene Prev */}
            <button
              onClick={() => jumpScene(-1)}
              className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Jump to Previous Scene"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Step 1 Frame Back */}
            <button
              onClick={() => stepFrame(-1)}
              className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Step -1 Frame (←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Primary Play / Pause Button */}
            <button
              onClick={togglePlay}
              className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg border border-white/20 transition-all active:scale-95 ${
                isPlaying
                  ? "bg-studio-800 hover:bg-studio-750 text-white shadow-black/40"
                  : "bg-gradient-to-r from-studio-accent via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/35"
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white translate-x-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Step 1 Frame Forward */}
            <button
              onClick={() => stepFrame(1)}
              className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Step +1 Frame (→)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Jump Scene Next */}
            <button
              onClick={() => jumpScene(1)}
              className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Jump to Next Scene"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Restart from Frame 0 */}
            <button
              onClick={handleRestart}
              className="p-2.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-white/[0.08] text-slate-300 hover:text-white transition-all active:scale-95"
              title="Restart Video (Home)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Transport: Mute, Loop */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                isMuted
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  : "bg-studio-900 border-white/[0.08] text-slate-400 hover:text-white"
              }`}
              title={isMuted ? "Unmute Audio (M)" : "Mute Audio (M)"}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
                isLooping
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                  : "bg-studio-900 border-white/[0.08] text-slate-400 hover:text-white"
              }`}
              title={isLooping ? "Loop Enabled" : "Loop Disabled"}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
