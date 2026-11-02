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
      wordTokens: [
        { text: "Welcome", startFrame: 0, endFrame: 29 },
        { text: "to", startFrame: 29, endFrame: 43 },
        { text: "ZeroTrack.", startFrame: 43, endFrame: 68 },
        { text: "Narrative", startFrame: 92, endFrame: 104 },
        { text: "text", startFrame: 104, endFrame: 123 },
        { text: "anchors", startFrame: 123, endFrame: 136 },
        { text: "our", startFrame: 136, endFrame: 154 },
        { text: "entire", startFrame: 154, endFrame: 169 },
        { text: "video", startFrame: 169, endFrame: 184 },
        { text: "studio.", startFrame: 184, endFrame: 199 },
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
      startFrame: 149,
      durationInFrames: 144,
      scriptText: "Kokoro neural speech and Whisper lock timestamps down to the exact frame.",
      wordTokens: [
        { text: "Kokoro", startFrame: 149, endFrame: 182 },
        { text: "neural", startFrame: 182, endFrame: 193 },
        { text: "speech", startFrame: 193, endFrame: 211 },
        { text: "and", startFrame: 211, endFrame: 221 },
        { text: "Whisper", startFrame: 221, endFrame: 236 },
        { text: "lock", startFrame: 236, endFrame: 248 },
        { text: "timestamps", startFrame: 248, endFrame: 275 },
        { text: "down", startFrame: 275, endFrame: 299 },
        { text: "to", startFrame: 299, endFrame: 307 },
        { text: "the", startFrame: 307, endFrame: 314 },
        { text: "exact", startFrame: 314, endFrame: 328 },
        { text: "frame.", startFrame: 328, endFrame: 344 },
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
      wordTokens: [
        { text: "Each", startFrame: 293, endFrame: 320 },
        { text: "slide", startFrame: 320, endFrame: 333 },
        { text: "transitions", startFrame: 333, endFrame: 355 },
        { text: "briskly,", startFrame: 355, endFrame: 392 },
        { text: "every", startFrame: 399, endFrame: 406 },
        { text: "few", startFrame: 406, endFrame: 417 },
        { text: "seconds", startFrame: 417, endFrame: 429 },
        { text: "with", startFrame: 429, endFrame: 444 },
        { text: "seamless", startFrame: 444, endFrame: 457 },
        { text: "voiceover.", startFrame: 457, endFrame: 483 },
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
            label: "Pacing Index",
            percentage: 98,
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
