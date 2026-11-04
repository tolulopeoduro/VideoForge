import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface BRollItem {
  id: string;
  title: string;
  mediaType: "video" | "image";
  url: string;
  thumbnail: string;
  source: "Pexels" | "Pixabay" | "Wikimedia" | "Studio B-Roll";
  durationSec?: number;
  tags: string[];
}

const CURATED_BROLL_LIBRARY: BRollItem[] = [
  // Sports & Stadiums
  {
    id: "broll-vid-stadium-lights",
    title: "Stadium Floodlights & Night Pitch",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-soccer-stadium-at-night-41566-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 12,
    tags: ["sports", "football", "soccer", "stadium", "manchester", "arena", "match", "pitch"],
  },
  {
    id: "broll-vid-football-action",
    title: "Football Pitch Turf & Ball Kickoff",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-soccer-player-kicking-the-ball-on-the-field-43527-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 10,
    tags: ["sports", "football", "soccer", "player", "goal", "league", "trophy"],
  },
  {
    id: "broll-img-stadium-crowd",
    title: "Roaring Championship Arena",
    mediaType: "image",
    url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=85",
    thumbnail: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    tags: ["sports", "stadium", "crowd", "football", "fans", "arena"],
  },
  // Tech, AI & Code
  {
    id: "broll-vid-cyber-matrix",
    title: "Neural Network & Data Streams",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-blue-and-purple-lines-9979-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 14,
    tags: ["tech", "ai", "neural", "code", "data", "cyber", "software", "quantum"],
  },
  {
    id: "broll-vid-server-racks",
    title: "High-Density Compute Server Room",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-servers-in-a-data-center-41767-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 11,
    tags: ["tech", "server", "cloud", "ai", "compute", "hardware", "gpu"],
  },
  {
    id: "broll-img-circuit-core",
    title: "Quantum Silicon Microprocessor",
    mediaType: "image",
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    tags: ["tech", "chip", "ai", "computer", "circuit"],
  },
  // Finance, Markets & Business
  {
    id: "broll-vid-stock-market",
    title: "Financial Trading Candlesticks & Tickers",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-man-analyzing-stock-market-charts-on-a-screen-41715-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 12,
    tags: ["finance", "market", "stocks", "trading", "money", "business", "wall street", "crypto"],
  },
  {
    id: "broll-vid-city-skyline",
    title: "Financial District Night Skyline Timelapse",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 15,
    tags: ["city", "finance", "business", "skyline", "night", "urban", "economy"],
  },
  {
    id: "broll-img-wallstreet",
    title: "Algorithmic Market Terminal",
    mediaType: "image",
    url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=85",
    thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    tags: ["finance", "trading", "chart", "stocks", "market"],
  },
  // Space, Science & History
  {
    id: "broll-vid-deep-space",
    title: "Orbital Planet & Cosmic Nebula",
    mediaType: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    durationSec: 14,
    tags: ["space", "galaxy", "stars", "planet", "universe", "science", "earth"],
  },
  {
    id: "broll-img-earth-orbit",
    title: "Earth Horizon From Low Orbit",
    mediaType: "image",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    tags: ["space", "earth", "global", "world", "network"],
  },
  {
    id: "broll-img-ancient-rome",
    title: "Classical Monumental Architecture",
    mediaType: "image",
    url: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=85",
    thumbnail: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80",
    source: "Studio B-Roll",
    tags: ["history", "rome", "ancient", "empire", "architecture", "monument"],
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "cinematic").trim();
  const filterType = searchParams.get("type") || "all"; // "all" | "video" | "image"

  const results: BRollItem[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY;
  const pixabayKey = process.env.PIXABAY_API_KEY;

  // 1. Pexels Video & Photo API (if PEXELS_API_KEY is configured)
  if (pexelsKey) {
    try {
      if (filterType !== "image") {
        const vRes = await fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=4&orientation=portrait`,
          { headers: { Authorization: pexelsKey } }
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          for (const v of vData.videos || []) {
            const mp4File =
              v.video_files?.find((f: any) => f.quality === "hd" && f.file_type === "video/mp4") ||
              v.video_files?.[0];
            if (mp4File?.link) {
              results.push({
                id: `pexels-vid-${v.id}`,
                title: `Pexels HD Clip #${v.id}`,
                mediaType: "video",
                url: mp4File.link,
                thumbnail: v.image,
                source: "Pexels",
                durationSec: v.duration,
                tags: [query],
              });
            }
          }
        }
      }
      if (filterType !== "video") {
        const pRes = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=4`,
          { headers: { Authorization: pexelsKey } }
        );
        if (pRes.ok) {
          const pData = await pRes.json();
          for (const p of pData.photos || []) {
            results.push({
              id: `pexels-img-${p.id}`,
              title: p.alt || `Pexels Photo #${p.id}`,
              mediaType: "image",
              url: p.src?.large2x || p.src?.large,
              thumbnail: p.src?.medium,
              source: "Pexels",
              tags: [query],
            });
          }
        }
      }
    } catch (e) {
      console.warn("Pexels API fetch warning:", e);
    }
  }

  // 2. Pixabay Video API (if PIXABAY_API_KEY is configured)
  if (pixabayKey && filterType !== "image") {
    try {
      const pxRes = await fetch(
        `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=4`
      );
      if (pxRes.ok) {
        const pxData = await pxRes.json();
        for (const hit of pxData.hits || []) {
          const med = hit.videos?.medium || hit.videos?.small;
          if (med?.url) {
            results.push({
              id: `pixabay-vid-${hit.id}`,
              title: hit.tags || `Pixabay Clip #${hit.id}`,
              mediaType: "video",
              url: med.url,
              thumbnail: `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg`,
              source: "Pixabay",
              durationSec: hit.duration,
              tags: (hit.tags || "").split(",").map((s: string) => s.trim()),
            });
          }
        }
      }
    } catch (e) {
      console.warn("Pixabay API fetch warning:", e);
    }
  }

  // 3. Zero-Key Wikimedia Commons Live Image Search
  if (filterType !== "video") {
    try {
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `filetype:bitmap ${query}`
      )}&gsrlimit=4&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(3500) });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = wikiData?.query?.pages || {};
        for (const page of Object.values(pages) as any[]) {
          const info = page?.imageinfo?.[0];
          const thumbUrl = info?.thumburl || info?.url;
          if (thumbUrl && /\.(jpg|jpeg|png|webp)$/i.test(thumbUrl)) {
            const cleanTitle = (page.title || "")
              .replace(/^File:/i, "")
              .replace(/\.[^.]+$/, "")
              .replace(/_/g, " ")
              .slice(0, 48);
            results.push({
              id: `wiki-${page.pageid}`,
              title: cleanTitle || query,
              mediaType: "image",
              url: thumbUrl,
              thumbnail: thumbUrl,
              source: "Wikimedia",
              tags: [query],
            });
          }
        }
      }
    } catch {
      // Offline or timeout - gracefully rely on curated library
    }
  }

  // 4. Rank & append Curated Studio B-Roll Library (always available offline & zero-key)
  const qWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scoredCurated = CURATED_BROLL_LIBRARY.filter((item) => {
    if (filterType === "video" && item.mediaType !== "video") return false;
    if (filterType === "image" && item.mediaType !== "image") return false;
    return true;
  })
    .map((item) => {
      let score = 0;
      const hay = `${item.title} ${item.tags.join(" ")}`.toLowerCase();
      for (const w of qWords) {
        if (hay.includes(w)) score += 3;
      }
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);

  return NextResponse.json({
    query,
    items: [...results, ...scoredCurated],
  });
}
