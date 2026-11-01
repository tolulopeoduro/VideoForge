import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { prompt, motion = "zoom-in", width = 1080, height = 1920 } = await req.json();

    const falKey = process.env.FAL_KEY;

    // 1. If user provided a real fal.ai API key, query FLUX Klein
    if (falKey) {
      try {
        const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt || "Cinematic moody dark studio interior, 8k wallpaper",
            image_size: { width: Math.min(width, 1024), height: Math.min(height, 1024) },
            num_inference_steps: 4,
            enable_safety_checker: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.images && data.images.length > 0) {
            return NextResponse.json({
              imageUrl: data.images[0].url,
              source: "flux_klein",
              prompt,
            });
          }
        }
      } catch (falErr) {
        console.warn("fal.ai API request failed, falling back to procedural generator:", falErr);
      }
    }

    // 2. High-aesthetic procedural background generator fallback
    const timestamp = Date.now();
    const filename = `bg_env_${timestamp}.svg`;
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate artistic SVG background tailored to the prompt keywords
    const isCyber = /cyber|tech|code|futur|neon/i.test(prompt || "");
    const isNature = /nature|forest|water|emerald|organic/i.test(prompt || "");
    const isWarm = /warm|amber|sun|fire|gold/i.test(prompt || "");

    const col1 = isCyber ? "#0f172a" : isNature ? "#022c22" : isWarm ? "#311005" : "#0f0728";
    const col2 = isCyber ? "#1e1b4b" : isNature ? "#064e3b" : isWarm ? "#7c2d12" : "#1e1b4b";
    const accent = isCyber ? "#6366f1" : isNature ? "#10b981" : isWarm ? "#f59e0b" : "#a855f7";

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="grad1" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="60%" stop-color="${col2}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${col1}" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="neonBeam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <filter id="blurFilter">
      <feGaussianBlur stdDeviation="80" />
    </filter>
  </defs>

  <!-- Deep base -->
  <rect width="100%" height="100%" fill="${col1}" />
  <rect width="100%" height="100%" fill="url(#grad1)" />

  <!-- Ambient light orbs -->
  <circle cx="${width * 0.25}" cy="${height * 0.3}" r="${width * 0.45}" fill="${accent}" opacity="0.25" filter="url(#blurFilter)" />
  <circle cx="${width * 0.8}" cy="${height * 0.7}" r="${width * 0.4}" fill="${col2}" opacity="0.4" filter="url(#blurFilter)" />

  <!-- Subtle Perspective Grid -->
  <g opacity="0.12" stroke="${accent}" stroke-width="2">
    ${Array.from({ length: 12 })
      .map(
        (_, i) =>
          `<line x1="0" y1="${(height / 12) * i}" x2="${width}" y2="${(height / 12) * i}" />`
      )
      .join("\n    ")}
    ${Array.from({ length: 10 })
      .map(
        (_, i) =>
          `<line x1="${(width / 10) * i}" y1="0" x2="${(width / 10) * i}" y2="${height}" />`
      )
      .join("\n    ")}
  </g>

  <!-- Vignette -->
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.75" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, svgContent, "utf-8");

    return NextResponse.json({
      imageUrl: `/generated/${filename}`,
      source: "procedural_klein",
      prompt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate background" },
      { status: 500 }
    );
  }
}
