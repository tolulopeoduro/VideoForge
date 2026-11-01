import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const DEFAULT_DEMO_STATE = {
  id: "project_zero_track_demo",
  metadata: {
    title: "ZeroTrack AI Studio",
    fps: 30,
    width: 1080,
    height: 1920,
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
      wordTokens: [],
      background: {
        type: "color",
        src: "#0f172a",
        motion: "zoom-in",
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
  ],
};

async function main() {
  console.log("🎬 [ZeroTrack CLI] Bundling Remotion video project...");

  const entryPoint = path.resolve(process.cwd(), "remotion", "Root.tsx");
  const bundleLocation = await bundle({
    entryPoint,
    publicDir: path.resolve(process.cwd(), "public"),
    webpackOverride: (config) => config,
  });

  console.log("📦 Bundle created at:", bundleLocation);

  const compositionId = "ZeroTrackMain";
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browserExecutable = fs.existsSync(chromePath) ? chromePath : undefined;

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    browserExecutable,
    inputProps: {
      state: DEFAULT_DEMO_STATE,
    },
  });

  const outputDir = path.resolve(process.cwd(), "public", "renders");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputLocation = path.join(outputDir, `zerotrack_export_${Date.now()}.mp4`);
  console.log("🚀 Starting MP4 render to:", outputLocation);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    browserExecutable,
    codec: "h264",
    outputLocation,
    timeoutInMilliseconds: 120000,
    concurrency: 2,
    inputProps: {
      state: DEFAULT_DEMO_STATE,
    },
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering: ${Math.round(progress * 100)}% complete`);
    },
  });

  console.log("\n✅ Video render completed successfully!");
  console.log("File saved:", outputLocation);
}

main().catch((err) => {
  console.error("❌ Render failed:", err);
  process.exit(1);
});
