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
    totalDurationInFrames: 435,
  },
  audio: {
    voiceTrackUrl: "/generated/voice_1793630508.wav",
    backgroundMusicUrl: "/audio/chill-beat.wav",
    musicVolume: 0.18,
  },
  scenes: [
    {
      id: "scene-1",
      startFrame: 0,
      durationInFrames: 149,
      scriptText: "Welcome to ZeroTrack. Narrative text anchors our entire video studio.",
      transitionStyle: "zoom-punch",
      threeDScene: "cyber-globe",
      threeDColor: "#6366f1",
      wordTokens: [
        { text: "Welcome", startFrame: 0, endFrame: 29 },
        { text: "to", startFrame: 29, endFrame: 43 },
        { text: "ZeroTrack.", startFrame: 43, endFrame: 68 },
        { text: "Narrative", startFrame: 72, endFrame: 86 },
        { text: "text", startFrame: 86, endFrame: 100 },
        { text: "anchors", startFrame: 100, endFrame: 112 },
        { text: "our", startFrame: 112, endFrame: 120 },
        { text: "entire", startFrame: 120, endFrame: 130 },
        { text: "video", startFrame: 130, endFrame: 139 },
        { text: "studio.", startFrame: 139, endFrame: 148 },
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
      startFrame: 149,
      durationInFrames: 144,
      scriptText: "Kokoro neural speech and Whisper lock timestamps down to the exact frame.",
      transitionStyle: "slide-left",
      threeDScene: "neural-network",
      threeDColor: "#06b6d4",
      wordTokens: [
        { text: "Kokoro", startFrame: 0, endFrame: 22 },
        { text: "neural", startFrame: 22, endFrame: 34 },
        { text: "speech", startFrame: 34, endFrame: 48 },
        { text: "and", startFrame: 48, endFrame: 56 },
        { text: "Whisper", startFrame: 56, endFrame: 70 },
        { text: "lock", startFrame: 70, endFrame: 82 },
        { text: "timestamps", startFrame: 82, endFrame: 100 },
        { text: "down", startFrame: 100, endFrame: 110 },
        { text: "to", startFrame: 110, endFrame: 116 },
        { text: "the", startFrame: 116, endFrame: 122 },
        { text: "exact", startFrame: 122, endFrame: 132 },
        { text: "frame.", startFrame: 132, endFrame: 143 },
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
      startFrame: 293,
      durationInFrames: 142,
      scriptText: "Each slide transitions briskly every few seconds with seamless voiceover.",
      transitionStyle: "flip-3d",
      threeDScene: "energy-torus",
      threeDColor: "#10b981",
      wordTokens: [
        { text: "Each", startFrame: 0, endFrame: 16 },
        { text: "slide", startFrame: 16, endFrame: 30 },
        { text: "transitions", startFrame: 30, endFrame: 52 },
        { text: "briskly", startFrame: 52, endFrame: 72 },
        { text: "every", startFrame: 75, endFrame: 86 },
        { text: "few", startFrame: 86, endFrame: 96 },
        { text: "seconds", startFrame: 96, endFrame: 110 },
        { text: "with", startFrame: 110, endFrame: 118 },
        { text: "seamless", startFrame: 118, endFrame: 130 },
        { text: "voiceover.", startFrame: 130, endFrame: 141 },
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
