import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { state } = await req.json();

    if (!state || !state.scenes) {
      return NextResponse.json({ error: "Missing state payload" }, { status: 400 });
    }

    const entryPoint = path.resolve(process.cwd(), "remotion", "Root.tsx");
    const bundleLocation = await bundle({
      entryPoint,
      publicDir: path.resolve(process.cwd(), "public"),
      webpackOverride: (config) => config,
    });

    const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const browserExecutable = fs.existsSync(chromePath) ? chromePath : undefined;

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "ZeroTrackMain",
      browserExecutable,
      inputProps: {
        state,
      },
    });

    const outputDir = path.resolve(process.cwd(), "public", "renders");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `zerotrack_${Date.now()}.mp4`;
    const outputLocation = path.join(outputDir, filename);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      browserExecutable,
      codec: "h264",
      outputLocation,
      timeoutInMilliseconds: 120000,
      concurrency: 2,
      inputProps: {
        state,
      },
    });

    return NextResponse.json({
      success: true,
      filename,
      downloadUrl: `/renders/${filename}`,
    });
  } catch (error: any) {
    console.error("Render API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to render video" },
      { status: 500 }
    );
  }
}
