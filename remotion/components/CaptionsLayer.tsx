import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Scene } from "@/types/schema";

interface CaptionsLayerProps {
  scene: Scene;
}

export const CaptionsLayer: React.FC<CaptionsLayerProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const isPortrait = height > width;

  if (!scene.wordTokens || scene.wordTokens.length === 0) {
    // If no word tokens yet, show clean script text
    return (
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 260 : 70,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: isPortrait ? "86%" : "72%",
          textAlign: "center",
          zIndex: 30,
          background: "rgba(10, 15, 29, 0.78)",
          backdropFilter: "blur(14px)",
          padding: isPortrait ? "18px 28px" : "14px 24px",
          borderRadius: 22,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        <span
          style={{
            fontSize: isPortrait ? 34 : 26,
            fontWeight: 700,
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
            lineHeight: 1.35,
          }}
        >
          {scene.scriptText}
        </span>
      </div>
    );
  }

  // Find currently active word or last spoken word for pagination
  const tokens = scene.wordTokens;
  let activeIdx = tokens.findIndex((t) => {
    const relStart = t.startFrame >= scene.startFrame ? t.startFrame - scene.startFrame : t.startFrame;
    const relEnd = t.endFrame >= scene.startFrame ? t.endFrame - scene.startFrame : t.endFrame;
    return frame >= relStart && frame <= relEnd;
  });

  if (activeIdx === -1) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const relEnd = tokens[i].endFrame >= scene.startFrame ? tokens[i].endFrame - scene.startFrame : tokens[i].endFrame;
      if (frame >= relEnd) {
        activeIdx = i;
        break;
      }
    }
  }

  const safeIdx = Math.max(0, activeIdx);
  const CHUNK_SIZE = isPortrait ? 6 : 8;
  const chunkStart = Math.floor(safeIdx / CHUNK_SIZE) * CHUNK_SIZE;
  const visibleTokens = tokens.length > CHUNK_SIZE ? tokens.slice(chunkStart, chunkStart + CHUNK_SIZE) : tokens;

  return (
    <div
      style={{
        position: "absolute",
        bottom: isPortrait ? 280 : 70,
        left: "50%",
        transform: "translateX(-50%)",
        width: isPortrait ? "88%" : "75%",
        textAlign: "center",
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isPortrait ? "8px 14px" : "6px 12px",
          background: "rgba(10, 15, 29, 0.85)",
          backdropFilter: "blur(16px)",
          padding: isPortrait ? "18px 30px" : "14px 24px",
          borderRadius: 24,
          border: "1.5px solid rgba(255, 255, 255, 0.16)",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.65)",
        }}
      >
        {visibleTokens.map((token, idx) => {
          const relStart =
            token.startFrame >= scene.startFrame
              ? token.startFrame - scene.startFrame
              : token.startFrame;
          const relEnd =
            token.endFrame >= scene.startFrame
              ? token.endFrame - scene.startFrame
              : token.endFrame;

          const isActive = frame >= relStart && frame <= relEnd;
          const isPast = frame > relEnd;

          return (
            <span
              key={`${chunkStart + idx}-${token.text}`}
              style={{
                fontSize: isPortrait ? 38 : 28,
                fontWeight: 800,
                fontFamily: "Inter, sans-serif",
                color: isActive
                  ? "#fbbf24"
                  : isPast
                  ? "#ffffff"
                  : "rgba(255, 255, 255, 0.45)",
                transform: isActive ? "scale(1.18)" : "scale(1.0)",
                display: "inline-block",
                transition: "transform 0.08s ease-out, color 0.08s ease-out",
                textShadow: isActive
                  ? "0 0 24px rgba(251, 191, 36, 0.9), 0 2px 4px rgba(0,0,0,0.8)"
                  : "0 2px 6px rgba(0, 0, 0, 0.7)",
                letterSpacing: "-0.01em",
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
