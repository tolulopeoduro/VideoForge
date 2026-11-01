import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

type BackgroundGenre =
  | "sports"
  | "finance"
  | "history"
  | "space"
  | "nature"
  | "cyber"
  | "warm"
  | "cinema"
  | "studio";

function detectGenre(prompt: string): BackgroundGenre {
  const p = prompt.toLowerCase();
  if (/sport|stadium|football|soccer|pitch|arena|match|athletic|manchester|chelsea|arsenal|nba|nfl|race|marathon|trophy|champion/i.test(p)) {
    return "sports";
  }
  if (/finance|wall street|stock|crypto|bitcoin|trading|market|banking|money|dollar|hedge fund|investment/i.test(p)) {
    return "finance";
  }
  if (/history|ancient|roman|empire|medieval|parchment|monument|vintage|museum|colosseum|pyramid|castle|antiquity/i.test(p)) {
    return "history";
  }
  if (/space|galaxy|cosmic|astronomy|universe|planet|nebula|starfield|orbit|apollo|interstellar/i.test(p)) {
    return "space";
  }
  if (/nature|forest|mountain|emerald|jungle|ocean|river|organic|foliage|leaves|tree/i.test(p)) {
    return "nature";
  }
  if (/cyber|tech|code|futur|neon|matrix|software|hacker|ai|server|digital|circuit/i.test(p)) {
    return "cyber";
  }
  if (/warm|amber|sun|sunrise|sunset|fire|flame|gold|golden/i.test(p)) {
    return "warm";
  }
  if (/cinema|film|dramatic|noir|theatre|stage|mystery|spotlight/i.test(p)) {
    return "cinema";
  }
  return "studio";
}

function generateProceduralSvg(genre: BackgroundGenre, width: number, height: number, prompt: string): string {
  switch (genre) {
    case "sports": {
      // Dynamic stadium atmosphere: floodlight beams, dark arena grandstand, electric emerald/crimson stadium glow
      const isCrimson = /manchester|red|arsenal|bulls|ferrari|fire/i.test(prompt);
      const accent = isCrimson ? "#dc2626" : "#22c55e";
      const secondary = isCrimson ? "#991b1b" : "#15803d";
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="arenaFloodlight" cx="50%" cy="15%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="25%" stop-color="${accent}" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#020617" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#020617" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="pitchGrad" x1="0%" y1="100%" x2="0%" y2="55%">
      <stop offset="0%" stop-color="${secondary}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="beamLeft" x1="0%" y1="0%" x2="45%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
      <stop offset="70%" stop-color="${accent}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="beamRight" x1="100%" y1="0%" x2="55%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
      <stop offset="70%" stop-color="${accent}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="40" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#050814" />
  <rect width="100%" height="100%" fill="url(#arenaFloodlight)" />
  <polygon points="0,0 200,0 ${width * 0.45},${height} ${width * 0.25},${height}" fill="url(#beamLeft)" />
  <polygon points="${width},0 ${width - 200},0 ${width * 0.55},${height} ${width * 0.75},${height}" fill="url(#beamRight)" />
  <circle cx="${width * 0.15}" cy="40" r="12" fill="#ffffff" filter="url(#glow)" />
  <circle cx="${width * 0.85}" cy="40" r="12" fill="#ffffff" filter="url(#glow)" />
  <!-- Pitch turf perspective -->
  <rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#pitchGrad)" />
  <ellipse cx="${width * 0.5}" cy="${height * 0.88}" rx="${width * 0.4}" ry="60" fill="none" stroke="${accent}" stroke-width="2" opacity="0.3" />
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="65%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "finance": {
      // Boardroom / Wall Street dark graphite with glowing gold & emerald trading tickers
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="finGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#064e3b" stop-opacity="0.3" />
      <stop offset="50%" stop-color="#0f172a" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#020617" stop-opacity="1" />
    </radialGradient>
    <filter id="blurFast">
      <feGaussianBlur stdDeviation="60" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#090d16" />
  <rect width="100%" height="100%" fill="url(#finGrad)" />
  <!-- Candlestick / chart vector silhouettes -->
  <g opacity="0.18" stroke="#10b981" stroke-width="2">
    <line x1="${width * 0.15}" y1="${height * 0.55}" x2="${width * 0.15}" y2="${height * 0.7}" stroke-width="8" />
    <line x1="${width * 0.3}" y1="${height * 0.48}" x2="${width * 0.3}" y2="${height * 0.62}" stroke-width="8" stroke="#f59e0b" />
    <line x1="${width * 0.45}" y1="${height * 0.38}" x2="${width * 0.45}" y2="${height * 0.52}" stroke-width="8" />
    <line x1="${width * 0.6}" y1="${height * 0.32}" x2="${width * 0.6}" y2="${height * 0.45}" stroke-width="8" />
    <line x1="${width * 0.75}" y1="${height * 0.25}" x2="${width * 0.75}" y2="${height * 0.4}" stroke-width="8" />
    <line x1="${width * 0.9}" y1="${height * 0.18}" x2="${width * 0.9}" y2="${height * 0.35}" stroke-width="8" />
    <!-- Trend curve -->
    <path d="M 0,${height * 0.75} Q ${width * 0.4},${height * 0.6} ${width * 0.7},${height * 0.32} T ${width},${height * 0.15}" fill="none" stroke="#10b981" stroke-width="3" opacity="0.5" />
  </g>
  <circle cx="${width * 0.75}" cy="${height * 0.25}" r="${width * 0.35}" fill="#10b981" opacity="0.15" filter="url(#blurFast)" />
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "history": {
      // Antique classical sepia / deep parchment / monumental chiaroscuro
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="histGrad" cx="45%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#78350f" stop-opacity="0.45" />
      <stop offset="50%" stop-color="#27150a" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0c0704" stop-opacity="1" />
    </radialGradient>
    <filter id="histBlur">
      <feGaussianBlur stdDeviation="70" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#0e0704" />
  <rect width="100%" height="100%" fill="url(#histGrad)" />
  <circle cx="${width * 0.3}" cy="${height * 0.3}" r="${width * 0.4}" fill="#d97706" opacity="0.2" filter="url(#histBlur)" />
  <!-- Classical Roman column silhouettes -->
  <g opacity="0.12" fill="#fde68a">
    <rect x="${width * 0.08}" y="${height * 0.3}" width="${width * 0.08}" height="${height * 0.7}" rx="4" />
    <rect x="${width * 0.84}" y="${height * 0.3}" width="${width * 0.08}" height="${height * 0.7}" rx="4" />
    <line x1="0" y1="${height * 0.3}" x2="${width}" y2="${height * 0.3}" stroke="#fde68a" stroke-width="6" />
  </g>
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="50%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.9" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "space": {
      // Deep cosmic void, interstellar nebula dust, stellar stars
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="nebula1" cx="60%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#06b6d4" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#030712" stop-opacity="0" />
    </radialGradient>
    <filter id="cosmicBlur">
      <feGaussianBlur stdDeviation="90" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#030712" />
  <circle cx="${width * 0.65}" cy="${height * 0.35}" r="${width * 0.5}" fill="url(#nebula1)" filter="url(#cosmicBlur)" />
  <circle cx="${width * 0.25}" cy="${height * 0.65}" r="${width * 0.4}" fill="#ec4899" opacity="0.15" filter="url(#cosmicBlur)" />
  <!-- Starfield points -->
  <g fill="#ffffff">
    ${[
      [0.1, 0.15, 2.5, 0.9],
      [0.25, 0.08, 1.5, 0.7],
      [0.4, 0.22, 2.0, 0.85],
      [0.75, 0.12, 3.0, 0.95],
      [0.85, 0.28, 1.8, 0.7],
      [0.15, 0.45, 1.5, 0.6],
      [0.9, 0.6, 2.2, 0.8],
      [0.35, 0.75, 2.8, 0.9],
      [0.7, 0.82, 1.6, 0.65],
      [0.5, 0.92, 2.0, 0.75],
    ]
      .map(([x, y, r, op]) => `<circle cx="${width * (x as number)}" cy="${height * (y as number)}" r="${r}" opacity="${op}" />`)
      .join("\n    ")}
  </g>
  <!-- Planetary orbital arc -->
  <ellipse cx="${width * 0.85}" cy="${height * 0.2}" rx="${width * 0.45}" ry="${width * 0.15}" fill="none" stroke="#67e8f9" stroke-width="1.5" opacity="0.25" transform="rotate(-25 ${width * 0.85} ${height * 0.2})" />
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "nature": {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="natureGrad" cx="30%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#059669" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#064e3b" stop-opacity="0.85" />
      <stop offset="100%" stop-color="#022c22" stop-opacity="1" />
    </radialGradient>
    <filter id="natureBlur"><feGaussianBlur stdDeviation="75" /></filter>
  </defs>
  <rect width="100%" height="100%" fill="#022c22" />
  <rect width="100%" height="100%" fill="url(#natureGrad)" />
  <circle cx="${width * 0.3}" cy="${height * 0.3}" r="${width * 0.4}" fill="#34d399" opacity="0.2" filter="url(#natureBlur)" />
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "warm": {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="warmGrad" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ea580c" stop-opacity="0.45" />
      <stop offset="50%" stop-color="#7c2d12" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#311005" stop-opacity="1" />
    </radialGradient>
    <filter id="warmBlur"><feGaussianBlur stdDeviation="70" /></filter>
  </defs>
  <rect width="100%" height="100%" fill="#311005" />
  <rect width="100%" height="100%" fill="url(#warmGrad)" />
  <circle cx="${width * 0.4}" cy="${height * 0.3}" r="${width * 0.45}" fill="#f59e0b" opacity="0.3" filter="url(#warmBlur)" />
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }

    case "cyber":
    default: {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="cyberGrad" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
      <stop offset="60%" stop-color="#1e1b4b" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
    </radialGradient>
    <filter id="blurFilter"><feGaussianBlur stdDeviation="80" /></filter>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a" />
  <rect width="100%" height="100%" fill="url(#cyberGrad)" />
  <circle cx="${width * 0.25}" cy="${height * 0.3}" r="${width * 0.45}" fill="#6366f1" opacity="0.25" filter="url(#blurFilter)" />
  <circle cx="${width * 0.8}" cy="${height * 0.7}" r="${width * 0.4}" fill="#4f46e5" opacity="0.35" filter="url(#blurFilter)" />
  <!-- Subtle perspective grid -->
  <g opacity="0.12" stroke="#818cf8" stroke-width="1.5">
    ${Array.from({ length: 8 })
      .map((_, i) => `<line x1="0" y1="${(height / 8) * i}" x2="${width}" y2="${(height / 8) * i}" />`)
      .join("\n    ")}
    ${Array.from({ length: 6 })
      .map((_, i) => `<line x1="${(width / 6) * i}" y1="0" x2="${(width / 6) * i}" y2="${height}" />`)
      .join("\n    ")}
  </g>
  <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
    <stop offset="60%" stop-color="#000000" stop-opacity="0" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
  </radialGradient>
  <rect width="100%" height="100%" fill="url(#vignette)" />
</svg>`;
    }
  }
}

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

    // 2. High-aesthetic genre-aware procedural background generator fallback
    const timestamp = Date.now();
    const filename = `bg_env_${timestamp}.svg`;
    const outputDir = path.join(process.cwd(), "public", "generated");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const genre = detectGenre(prompt || "");
    const svgContent = generateProceduralSvg(genre, width, height, prompt || "");

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, svgContent, "utf-8");

    return NextResponse.json({
      imageUrl: `/generated/${filename}`,
      source: "procedural_klein",
      genre,
      prompt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate background" },
      { status: 500 }
    );
  }
}
