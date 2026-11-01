import React, { useRef, useState, useEffect } from "react";
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

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const handleSeek = (frame: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(frame);
    setCurrentFrame(frame);
  };

  const handleRestart = () => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(0);
    playerRef.current.play();
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unmute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const formatTime = (frame: number) => {
    const totalSecs = frame / fps;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    const frames = Math.floor(frame % fps);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  };

  return (
    <main className="flex-1 h-[calc(100vh-4rem)] bg-studio-950 flex flex-col overflow-hidden relative">
      {/* Player Top Meta Bar */}
      <div className="h-11 px-5 border-b border-studio-800 bg-studio-900/30 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-200">Universal Player Preview</span>
          <span className="text-studio-700">•</span>
          <span className="font-mono text-indigo-400">@remotion/player 4.0</span>
          <span className="text-studio-700">•</span>
          <span className="text-emerald-400 font-semibold">30 FPS Smooth</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-studio-900 px-2 py-0.5 rounded border border-studio-800 font-mono text-[11px] text-slate-300">
            {state.metadata.width} × {state.metadata.height}
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-gradient-to-b from-studio-950 via-[#0d1017] to-studio-950 overflow-hidden">
        {/* Subtle grid background to highlight video boundary */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* Remotion Player Container */}
        <div
          className={`relative rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-studio-700/60 bg-black flex items-center justify-center transition-all ${
            isPortrait
              ? "h-[94%] max-h-[760px] aspect-[9/16]"
              : "w-[94%] max-w-[940px] aspect-[16/9]"
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
            loop
            autoPlay={false}
          />
        </div>
      </div>

      {/* Timeline Scrubber & Transport Bar */}
      <div className="border-t border-studio-800 bg-studio-900/80 backdrop-blur-md p-4 space-y-3 select-none z-30">
        {/* Multi-scene Segmented Timeline Scrubber */}
        <div className="space-y-1.5">
          <div className="relative w-full h-4 bg-studio-950 rounded-lg overflow-hidden border border-studio-800 flex items-center cursor-pointer group">
            {/* Scene Boundary Segments */}
            {state.scenes.map((scene, idx) => {
              const startPct = (scene.startFrame / totalFrames) * 100;
              const widthPct = (scene.durationInFrames / totalFrames) * 100;
              const isSelected = scene.id === selectedSceneId;

              return (
                <div
                  key={scene.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScene(scene.id);
                    handleSeek(scene.startFrame);
                  }}
                  title={`Scene ${idx + 1}: ${scene.scriptText.slice(0, 30)}...`}
                  style={{
                    position: "absolute",
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    height: "100%",
                  }}
                  className={`border-r border-studio-900 transition-colors ${
                    isSelected
                      ? "bg-studio-accent/40"
                      : "bg-studio-800/40 hover:bg-studio-700/50"
                  }`}
                />
              );
            })}

            {/* Playhead Progress Fill */}
            <div
              style={{ width: `${(currentFrame / totalFrames) * 100}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 to-studio-accent pointer-events-none opacity-80"
            />

            {/* Scrubber Draggable Range Input */}
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            {/* Playhead Needle Pin */}
            <div
              style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none transition-transform"
            />
          </div>

          {/* Time Labels */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
            <span className="font-semibold text-slate-200">{formatTime(currentFrame)}</span>
            <span>
              Frame <strong className="text-white">{currentFrame}</strong> / {totalFrames}
            </span>
            <span>{formatTime(totalFrames)}</span>
          </div>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="p-2 rounded-lg bg-studio-800/80 hover:bg-studio-800 text-slate-300 hover:text-white transition-all"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-studio-accent to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
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

            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-studio-800/80 hover:bg-studio-800 text-slate-300 hover:text-white transition-all"
              title={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-300" />
              )}
            </button>
          </div>

          {/* Video state info */}
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Semantic Preview Active</span>
          </div>
        </div>
      </div>
    </main>
  );
};
