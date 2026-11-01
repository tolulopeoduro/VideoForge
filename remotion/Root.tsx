import React from "react";
import { Composition, registerRoot } from "remotion";
import { ZeroTrackComposition } from "./ZeroTrackComposition";
import { MasterVideoState } from "@/types/schema";

export const DEFAULT_DEMO_STATE: MasterVideoState = {
  id: "project_zero_track_demo",
  metadata: {
    title: "ZeroTrack AI Studio",
    fps: 30,
    width: 1080,
    height: 1920, // 9:16 vertical TikTok/Reels/Shorts standard
    totalDurationInFrames: 360,
  },
  audio: {
    voiceTrackUrl: "/generated/voice_1793492195.wav",
    backgroundMusicUrl: "/audio/chill-beat.wav",
    musicVolume: 0.18,
  },
  scenes: [
    {
      id: "scene-1",
      startFrame: 0,
      durationInFrames: 120,
      scriptText: "Welcome to ZeroTrack. Narrative script anchors our entire video studio.",
      wordTokens: [
        { text: "Welcome", startFrame: 4, endFrame: 16 },
        { text: "to", startFrame: 18, endFrame: 24 },
        { text: "ZeroTrack.", startFrame: 26, endFrame: 44 },
        { text: "Narrative", startFrame: 50, endFrame: 66 },
        { text: "script", startFrame: 68, endFrame: 78 },
        { text: "anchors", startFrame: 80, endFrame: 92 },
        { text: "our", startFrame: 94, endFrame: 100 },
        { text: "entire", startFrame: 102, endFrame: 112 },
        { text: "studio.", startFrame: 114, endFrame: 120 },
      ],
      background: {
        type: "color",
        src: "#0f172a",
        motion: "zoom-in",
        prompt: "Futuristic dark neon creative studio, volumetric lighting, minimalist cinematic",
      },
      mascot: {
        isVisible: true,
        pose: "explaining",
        position: "left",
        entranceAnimation: "slide-up",
      },
      overlays: [
        {
          id: "overlay-1",
          type: "stat-counter",
          props: {
            label: "Frame Accuracy",
            targetValue: 100,
            prefix: "",
            suffix: "%",
            accentColor: "#6366f1",
          },
        },
      ],
    },
    {
      id: "scene-2",
      startFrame: 120,
      durationInFrames: 120,
      scriptText: "Kokoro TTS and Whisper lock timestamps down to the exact millisecond.",
      wordTokens: [
        { text: "Kokoro", startFrame: 124, endFrame: 138 },
        { text: "TTS", startFrame: 140, endFrame: 150 },
        { text: "and", startFrame: 152, endFrame: 158 },
        { text: "Whisper", startFrame: 160, endFrame: 174 },
        { text: "lock", startFrame: 176, endFrame: 186 },
        { text: "timestamps", startFrame: 188, endFrame: 204 },
        { text: "down", startFrame: 206, endFrame: 214 },
        { text: "to", startFrame: 216, endFrame: 222 },
        { text: "the", startFrame: 224, endFrame: 230 },
        { text: "millisecond.", startFrame: 232, endFrame: 240 },
      ],
      background: {
        type: "color",
        src: "#1e1b4b",
        motion: "pan-left",
        prompt: "Cyberpunk server room with glowing fiber optics and blue ambient mist",
      },
      mascot: {
        isVisible: true,
        pose: "pointing",
        position: "left",
        entranceAnimation: "pop-in",
      },
      overlays: [
        {
          id: "overlay-2",
          type: "code-snippet",
          props: {
            filename: "semantic-sync.ts",
            code: `// Audio-anchored timing\nconst tokens = whisper.align();\nscene.duration = tokens.duration * 30;`,
          },
        },
      ],
    },
    {
      id: "scene-3",
      startFrame: 240,
      durationInFrames: 120,
      scriptText: "No multitrack confusion. Pure semantic video generation at thirty frames per second.",
      wordTokens: [
        { text: "No", startFrame: 244, endFrame: 252 },
        { text: "multitrack", startFrame: 254, endFrame: 270 },
        { text: "confusion.", startFrame: 272, endFrame: 288 },
        { text: "Pure", startFrame: 294, endFrame: 304 },
        { text: "semantic", startFrame: 306, endFrame: 320 },
        { text: "video", startFrame: 322, endFrame: 332 },
        { text: "generation", startFrame: 334, endFrame: 348 },
        { text: "studio.", startFrame: 350, endFrame: 360 },
      ],
      background: {
        type: "color",
        src: "#064e3b",
        motion: "zoom-in",
        prompt: "Emerald glowing crystal cavern, high octane 3d render",
      },
      mascot: {
        isVisible: true,
        pose: "shocked",
        position: "center",
        entranceAnimation: "pop-in",
      },
      overlays: [
        {
          id: "overlay-3",
          type: "progress-ring",
          props: {
            label: "Export Pipeline",
            percentage: 100,
            color: "#10b981",
          },
        },
      ],
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ZeroTrackMain"
        component={ZeroTrackComposition as any}
        durationInFrames={DEFAULT_DEMO_STATE.metadata.totalDurationInFrames}
        fps={DEFAULT_DEMO_STATE.metadata.fps}
        width={DEFAULT_DEMO_STATE.metadata.width}
        height={DEFAULT_DEMO_STATE.metadata.height}
        defaultProps={{
          state: DEFAULT_DEMO_STATE,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
