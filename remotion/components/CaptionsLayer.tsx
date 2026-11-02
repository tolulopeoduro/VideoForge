import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, WordToken } from "@/types/schema";

interface CaptionsLayerProps {
  scene: Scene;
}

export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const isPortrait = height > width;
  const duration = Math.max(1, scene.durationInFrames);

  // 1. Build a guaranteed normalized array of word tokens
  let tokens: Array<{ text: string; start: number; end: number }> = [];

  if (scene.wordTokens && scene.wordTokens.length > 0) {
    tokens = scene.wordTokens.map((t) => {
      let s = t.startFrame;
      let e = t.endFrame;

      // Handle global timestamps by converting to scene-relative
      if (scene.startFrame > 0 && s >= scene.startFrame) {
        s -= scene.startFrame;
        e -= scene.startFrame;
      } else if (scene.startFrame > 0 && s > scene.startFrame - 15) {
        // Minor Whisper start jitter at scene boundary
        s = 0;
        e = Math.max(2, e - scene.startFrame);
      }

      const clampedStart = Math.max(0, Math.min(duration - 2, s));
      const clampedEnd = Math.max(clampedStart + 2, Math.min(duration, e));
      return {
        text: t.text,
        start: clampedStart,
        end: clampedEnd,
      };
    });
  } else {
    // Fallback: distribute scriptText words proportionally across the scene duration
    const words = scene.scriptText.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const framesPerWord = duration / words.length;
      tokens = words.map((w, i) => {
        const s = Math.round(i * framesPerWord);
        const e = Math.min(duration, Math.round((i + 1) * framesPerWord));
        return {
          text: w,
          start: s,
          end: Math.max(s + 2, e),
        };
      });
    }
  }

  if (tokens.length === 0) {
    return null;
  }

  // 2. Identify the active word at current frame
  let activeIdx = tokens.findIndex((t) => frame >= t.start && frame <= t.end);

  if (activeIdx === -1) {
    // If between words (short pause or leading/trailing gap), hold on the closest word
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (frame >= tokens[i].end) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx === -1 && frame < tokens[0].start) {
      activeIdx = 0;
    }
  }

  const safeIdx = Math.max(0, activeIdx);

  // 3. Compact chunking: 4 words in vertical portrait (TikTok/Reels), 6 in landscape
  const CHUNK_SIZE = isPortrait ? 4 : 6;
  const chunkStart = Math.floor(safeIdx / CHUNK_SIZE) * CHUNK_SIZE;
  const visibleTokens = tokens.slice(chunkStart, chunkStart + CHUNK_SIZE);

  // 4. Dedicated bottom stage placement: always 100% horizontally centered
  // Mascot sits above this stage (bottom: 300px in portrait), so captions never shift off-center.
  const captionBottom = isPortrait ? 110 : 44;

  return (
    <div
      style={{
        position: "absolute",
        bottom: captionBottom,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: isPortrait ? "0 48px" : "0 120px",
        boxSizing: "border-box",
        textAlign: "center",
        zIndex: 35,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: isPortrait ? "10px 16px" : "8px 14px",
          background: "rgba(10, 15, 29, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: isPortrait ? "20px 32px" : "14px 26px",
          borderRadius: 26,
          border: "1.5px solid rgba(255, 255, 255, 0.18)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
      >
        {visibleTokens.map((token, idx) => {
          const globalIdx = chunkStart + idx;
          const isActive = frame >= token.start && frame <= token.end;
          const isPast = frame > token.end;

          return (
            <span
              key={`${globalIdx}-${token.text}`}
              style={{
                fontSize: isPortrait ? 42 : 30,
                fontWeight: 900,
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                color: isActive
                  ? "#fbbf24"
                  : isPast
                  ? "#ffffff"
                  : "rgba(255, 255, 255, 0.45)",
                transform: isActive ? "scale(1.15) translateY(-2px)" : "scale(1.0)",
                display: "inline-block",
                transition: "transform 0.06s cubic-bezier(0.2, 0, 0, 1), color 0.06s ease",
                textShadow: isActive
                  ? "0 0 28px rgba(251, 191, 36, 0.95), 0 2px 6px rgba(0,0,0,0.9)"
                  : "0 2px 6px rgba(0, 0, 0, 0.75)",
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
