import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  CaptionFontFamily,
  CaptionStyleConfig,
  DEFAULT_CAPTION_CONFIG,
  Scene,
} from "@/types/schema";

interface CaptionsLayerProps {
  scene: Scene;
  captionConfig?: CaptionStyleConfig;
}

const FONT_FAMILY_MAP: Record<CaptionFontFamily, string> = {
  Montserrat: "'Montserrat', 'Inter', -apple-system, sans-serif",
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  "Space Grotesk": "'Space Grotesk', 'Inter', sans-serif",
  "Playfair Display": "'Playfair Display', Georgia, serif",
  "JetBrains Mono": "'JetBrains Mono', monospace",
  Bangers: "'Bangers', 'Montserrat', cursive",
};

/**
 * Computes contrast text color (dark vs white) for Veed-style box highlights
 */
function getContrastTextOnHighlight(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#ffffff";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#090d16" : "#ffffff";
}

export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({
  scene,
  captionConfig,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const isPortrait = height > width;
  const duration = Math.max(1, scene.durationInFrames);

  // Merge user captionConfig with defaults
  const cfg: CaptionStyleConfig = {
    ...DEFAULT_CAPTION_CONFIG,
    ...(captionConfig || {}),
  };

  // Apply user-configurable sync offset (in frames, positive delays captions, negative advances captions)
  const effectiveFrame = frame - (cfg.syncOffsetFrames || 0);

  // 1. Build a guaranteed scene-relative, drift-free array of word tokens
  let tokens: Array<{ text: string; start: number; end: number }> = [];

  if (scene.wordTokens && scene.wordTokens.length > 0) {
    // Determine ONCE at the array level if tokens are stored in global timeline frames vs scene-relative frames
    const firstTokenStart = scene.wordTokens[0].startFrame;
    const isGlobalFrameSpace =
      scene.startFrame > 0 && firstTokenStart >= scene.startFrame - 6;

    const rawNormalized = scene.wordTokens.map((t) => {
      const s = isGlobalFrameSpace ? t.startFrame - scene.startFrame : t.startFrame;
      const e = isGlobalFrameSpace ? t.endFrame - scene.startFrame : t.endFrame;
      return {
        text: t.text,
        start: Math.max(0, s),
        end: Math.max(s + 2, e),
      };
    });

    // If token span exceeds scene.durationInFrames (e.g. user manually shortened duration), scale proportionally
    const maxTokenEnd = Math.max(...rawNormalized.map((t) => t.end), 1);
    const scaleFactor =
      maxTokenEnd > duration + 4 ? (duration - 2) / maxTokenEnd : 1.0;

    tokens = rawNormalized.map((t) => {
      const s = Math.max(0, Math.min(duration - 2, Math.round(t.start * scaleFactor)));
      const e = Math.max(s + 2, Math.min(duration, Math.round(t.end * scaleFactor)));
      return {
        text: t.text,
        start: s,
        end: e,
      };
    });
  } else {
    // Syllable & punctuation-weighted natural cadence fallback when TTS hasn't been run yet
    const words = scene.scriptText.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const weights = words.map((w) => {
        const clean = w.replace(/[^a-zA-Z0-9]/g, "");
        const syllableEst = Math.max(1, clean.length * 0.75);
        const punctPause = /[.!?]$/.test(w)
          ? 2.8
          : /[,;:—]$/.test(w)
          ? 1.5
          : 0;
        return syllableEst + punctPause;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
      const leadInFrames = Math.min(3, Math.floor(duration * 0.03));
      const tailPadFrames = Math.min(5, Math.floor(duration * 0.05));
      const usableFrames = Math.max(10, duration - leadInFrames - tailPadFrames);

      let cursor = leadInFrames;
      tokens = words.map((w, i) => {
        const wFrames = usableFrames * (weights[i] / totalWeight);
        const s = Math.round(cursor);
        cursor += wFrames;
        const e = Math.min(duration, Math.max(s + 2, Math.round(cursor)));
        return {
          text: w,
          start: s,
          end: e,
        };
      });
    }
  }

  if (tokens.length === 0) {
    return null;
  }

  // 2. Identify the active word at effectiveFrame with 1-frame lookahead across micro-gaps
  let activeIdx = tokens.findIndex(
    (t) => effectiveFrame >= t.start && effectiveFrame <= t.end
  );

  if (activeIdx === -1) {
    // Check if we are within 1 frame of the next word's attack onset
    const upcomingIdx = tokens.findIndex(
      (t) => effectiveFrame >= t.start - 1 && effectiveFrame < t.start
    );
    if (upcomingIdx !== -1) {
      activeIdx = upcomingIdx;
    } else {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (effectiveFrame >= tokens[i].end) {
          activeIdx = i;
          break;
        }
      }
      if (activeIdx === -1 && effectiveFrame < tokens[0].start) {
        activeIdx = 0;
      }
    }
  }

  const safeIdx = Math.max(0, activeIdx);

  // 3. Configurable chunk size (1 = Word Slam, 2..6 = Phrase Chunk)
  const chunkSize = Math.max(
    1,
    cfg.wordsPerChunk || (isPortrait ? 4 : 6)
  );
  const chunkStart = Math.floor(safeIdx / chunkSize) * chunkSize;
  const visibleTokens = tokens.slice(chunkStart, chunkStart + chunkSize);

  // 4. Vertical placement (always 100% horizontally centered)
  let verticalStyle: React.CSSProperties = {
    bottom: isPortrait ? 110 : 44,
  };
  if (cfg.verticalPosition === "middle") {
    verticalStyle = {
      top: "50%",
      transform: "translateY(-50%)",
    };
  } else if (cfg.verticalPosition === "top") {
    verticalStyle = {
      top: isPortrait ? 120 : 64,
    };
  }

  // 5. Container background style (glass-pill | solid-dark | none)
  let containerBgStyle: React.CSSProperties = {};
  if (cfg.backgroundStyle === "glass-pill") {
    containerBgStyle = {
      background: "rgba(10, 15, 29, 0.86)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      padding: isPortrait ? "18px 30px" : "14px 26px",
      borderRadius: 26,
      border: "1.5px solid rgba(255, 255, 255, 0.16)",
      boxShadow:
        "0 20px 50px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
    };
  } else if (cfg.backgroundStyle === "solid-dark") {
    containerBgStyle = {
      background: "#090d16",
      padding: isPortrait ? "18px 30px" : "14px 26px",
      borderRadius: 20,
      border: `2px solid ${cfg.highlightColor}66`,
      boxShadow: "0 18px 40px rgba(0, 0, 0, 0.85)",
    };
  } else {
    // "none" - Floating viral captions (Hormozi / CapCut style)
    containerBgStyle = {
      background: "transparent",
      padding: "8px 16px",
    };
  }

  const baseFontSize = isPortrait
    ? cfg.fontSize || 42
    : Math.round((cfg.fontSize || 42) * 0.74);

  const fontFamily = FONT_FAMILY_MAP[cfg.fontFamily] || FONT_FAMILY_MAP.Montserrat;
  const strokePx = cfg.strokeWidth ?? (cfg.backgroundStyle === "none" ? 2.5 : 0);

  return (
    <div
      style={{
        position: "absolute",
        ...verticalStyle,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: isPortrait ? "0 44px" : "0 110px",
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
          gap: isPortrait ? "10px 14px" : "8px 12px",
          maxWidth: isPortrait ? 940 : 1140,
          ...containerBgStyle,
        }}
      >
        {visibleTokens.map((token, idx) => {
          const globalIdx = chunkStart + idx;
          const isActive = globalIdx === safeIdx;
          const isPast = globalIdx < safeIdx;

          // Intra-word progress (0 -> 1) for karaoke wipe & underline animations
          const wordSpan = Math.max(1, token.end - token.start);
          const wordProgress = isActive
            ? Math.max(0, Math.min(1, (effectiveFrame - token.start) / wordSpan))
            : isPast
            ? 1
            : 0;

          // Spring pop when word becomes active
          const bounce = isActive
            ? spring({
                frame: Math.max(0, effectiveFrame - token.start),
                fps,
                config: { damping: 11, mass: 0.45, stiffness: 240 },
              })
            : 0;

          // Compute style per Veed.io highlight mode
          let wordColor = isPast
            ? cfg.textColor
            : `rgba(255, 255, 255, ${cfg.upcomingOpacity ?? 0.48})`;
          let wordTransform = "scale(1.0)";
          let wordBg = "transparent";
          let wordPadding = "2px 6px";
          let wordRadius = 10;
          let wordShadow =
            strokePx > 0
              ? "0 6px 18px rgba(0, 0, 0, 0.95), 0 2px 4px rgba(0, 0, 0, 1)"
              : "0 2px 8px rgba(0, 0, 0, 0.75)";
          let extraStyle: React.CSSProperties = {};

          if (cfg.highlightStyle === "box-highlight") {
            if (isActive) {
              wordBg = cfg.highlightColor;
              wordColor = getContrastTextOnHighlight(cfg.highlightColor);
              wordPadding = isPortrait ? "4px 14px" : "3px 10px";
              wordRadius = 12;
              const s = 1 + 0.08 * bounce;
              wordTransform = `scale(${s}) translateY(-2px)`;
              wordShadow = "none";
              extraStyle = {
                boxShadow: `0 8px 24px ${cfg.highlightColor}80`,
              };
            }
          } else if (cfg.highlightStyle === "pop-scale") {
            if (isActive) {
              wordColor = cfg.highlightColor;
              const s = 1 + 0.18 * bounce;
              wordTransform = `scale(${s}) translateY(-3px)`;
              wordShadow = `0 0 26px ${cfg.highlightColor}aa, 0 6px 16px rgba(0,0,0,0.95)`;
            }
          } else if (cfg.highlightStyle === "karaoke-fill") {
            const pct = Math.round(wordProgress * 100);
            const unfilledColor = `rgba(255, 255, 255, ${cfg.upcomingOpacity ?? 0.45})`;
            extraStyle = {
              backgroundImage: `linear-gradient(90deg, ${cfg.highlightColor} ${pct}%, ${unfilledColor} ${pct}%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              transform: isActive ? `scale(${1 + 0.06 * bounce})` : "scale(1)",
              filter: isActive
                ? `drop-shadow(0 0 12px ${cfg.highlightColor}66)`
                : "none",
            };
          } else if (cfg.highlightStyle === "neon-pulse") {
            if (isActive) {
              wordColor = "#ffffff";
              const s = 1 + 0.12 * bounce;
              wordTransform = `scale(${s}) translateY(-2px)`;
              wordShadow = `0 0 10px ${cfg.highlightColor}, 0 0 24px ${cfg.highlightColor}, 0 0 44px ${cfg.highlightColor}`;
            }
          } else if (cfg.highlightStyle === "underline-slide") {
            if (isActive) {
              wordColor = cfg.highlightColor;
              wordTransform = `translateY(-2px)`;
            }
          }

          return (
            <span
              key={`${globalIdx}-${token.text}`}
              style={{
                position: "relative",
                fontSize: baseFontSize,
                fontWeight: cfg.fontFamily === "Bangers" ? 400 : 900,
                fontFamily,
                color: wordColor,
                background: wordBg,
                padding: wordPadding,
                borderRadius: wordRadius,
                transform: wordTransform,
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                textShadow: wordShadow,
                WebkitTextStroke:
                  strokePx > 0 && cfg.highlightStyle !== "box-highlight"
                    ? `${strokePx}px rgba(0, 0, 0, 0.92)`
                    : undefined,
                paintOrder: "stroke fill",
                letterSpacing:
                  cfg.fontFamily === "Bangers" ? "0.04em" : "-0.02em",
                textTransform: cfg.textTransform || "uppercase",
                lineHeight: 1.15,
                ...extraStyle,
              }}
            >
              {token.text}

              {/* Animated underline bar for underline-slide mode */}
              {cfg.highlightStyle === "underline-slide" && isActive && (
                <span
                  style={{
                    display: "block",
                    height: isPortrait ? 5 : 4,
                    width: `${Math.max(30, Math.round(wordProgress * 100))}%`,
                    background: cfg.highlightColor,
                    borderRadius: 999,
                    marginTop: 3,
                    boxShadow: `0 0 12px ${cfg.highlightColor}`,
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};
