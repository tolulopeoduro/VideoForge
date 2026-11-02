import React from "react";
import { Composition, registerRoot } from "remotion";
import { ZeroTrackComposition } from "./ZeroTrackComposition";
import { DEFAULT_CAPTION_CONFIG, MasterVideoState } from "@/types/schema";

export const DEFAULT_DEMO_STATE: MasterVideoState = {
  id: "project_zero_track_demo",
  metadata: {
    title: "ZeroTrack AI Studio",
    fps: 30,
    width: 1080,
    height: 1920, // 9:16 vertical TikTok/Reels/Shorts standard
    totalDurationInFrames: 405,
  },
  audio: {
    voiceTrackUrl: "/generated/voice_demo_locked.wav",
    backgroundMusicUrl: "/audio/chill-beat.wav",
    musicVolume: 0.18,
  },
  captionConfig: DEFAULT_CAPTION_CONFIG,
  scenes: [
    {
      id: "scene-1",
      startFrame: 0,
      durationInFrames: 139,
      scriptText: "Welcome to ZeroTrack. Narrative text anchors our entire video studio.",
      transitionStyle: "zoom-punch",
      threeDScene: "cyber-globe",
      threeDColor: "#6366f1",
      wordTokens: [
        { text: "Welcome", startFrame: 0, endFrame: 18 },
        { text: "to", startFrame: 18, endFrame: 28 },
        { text: "ZeroTrack.", startFrame: 28, endFrame: 46 },
        { text: "Narrative", startFrame: 61, endFrame: 69 },
        { text: "text", startFrame: 69, endFrame: 80 },
        { text: "anchors", startFrame: 80, endFrame: 89 },
        { text: "our", startFrame: 89, endFrame: 101 },
        { text: "entire", startFrame: 101, endFrame: 112 },
        { text: "video", startFrame: 112, endFrame: 122 },
        { text: "studio.", startFrame: 122, endFrame: 133 },
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
          type: "kinetic-title",
          props: {
            topKicker: "SEMANTIC ANCHORING",
            mainTitle: "ZERO TRACK 3D",
            bottomSub: "Remotion + Three.js Engine",
            accentColor: "#6366f1",
          },
        },
      ],
    },
    {
      id: "scene-2",
      startFrame: 139,
      durationInFrames: 134,
      scriptText: "Kokoro neural speech and Whisper lock timestamps down to the exact frame.",
      transitionStyle: "slide-left",
      threeDScene: "neural-network",
      threeDColor: "#06b6d4",
      wordTokens: [
        { text: "Kokoro", startFrame: 0, endFrame: 21 },
        { text: "neural", startFrame: 21, endFrame: 31 },
        { text: "speech", startFrame: 31, endFrame: 40 },
        { text: "and", startFrame: 40, endFrame: 48 },
        { text: "Whisper", startFrame: 48, endFrame: 57 },
        { text: "lock", startFrame: 57, endFrame: 64 },
        { text: "timestamps", startFrame: 64, endFrame: 85 },
        { text: "down", startFrame: 93, endFrame: 99 },
        { text: "to", startFrame: 99, endFrame: 105 },
        { text: "the", startFrame: 105, endFrame: 109 },
        { text: "exact", startFrame: 109, endFrame: 117 },
        { text: "frame.", startFrame: 117, endFrame: 128 },
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
      startFrame: 273,
      durationInFrames: 132,
      scriptText: "Each slide transitions briskly every few seconds with seamless voiceover.",
      transitionStyle: "flip-3d",
      threeDScene: "energy-torus",
      threeDColor: "#10b981",
      wordTokens: [
        { text: "Each", startFrame: 0, endFrame: 18 },
        { text: "slide", startFrame: 18, endFrame: 27 },
        { text: "transitions", startFrame: 27, endFrame: 41 },
        { text: "briskly", startFrame: 41, endFrame: 70 },
        { text: "every", startFrame: 70, endFrame: 75 },
        { text: "few", startFrame: 75, endFrame: 82 },
        { text: "seconds", startFrame: 82, endFrame: 91 },
        { text: "with", startFrame: 91, endFrame: 100 },
        { text: "seamless", startFrame: 100, endFrame: 109 },
        { text: "voiceover.", startFrame: 109, endFrame: 126 },
      ],
      background: {
        type: "color",
        src: "#064e3b",
        motion: "tilt-3d",
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
          type: "bar-chart",
          props: {
            title: "RETENTION VELOCITY",
            subtitle: "3D + Fast Pacing vs Static Slides",
            unit: "%",
            bar1Label: "ZeroTrack 3D Engine",
            bar1Value: 98,
            bar1Color: "#10b981",
            bar2Label: "Dynamic Captions",
            bar2Value: 86,
            bar2Color: "#6366f1",
            bar3Label: "Standard Slides",
            bar3Value: 42,
            bar3Color: "#f59e0b",
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
