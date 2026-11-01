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
          bottom: isPortrait ? 280 : 80,
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: isPortrait ? "85%" : "70%",
          textAlign: "center",
          zIndex: 30,
          background: "rgba(10, 15, 29, 0.75)",
          backdropFilter: "blur(12px)",
          padding: "16px 28px",
          borderRadius: 20,
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <span
          style={{
            fontSize: isPortrait ? 36 : 28,
            fontWeight: 700,
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
            lineHeight: 1.3,
          }}
        >
          {scene.scriptText}
        </span>
      </div>
    );
  }

  // Find currently active word index or display in readable chunks
  return (
    <div
      style={{
        position: "absolute",
        bottom: isPortrait ? 300 : 70,
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
          gap: isPortrait ? "8px 12px" : "6px 10px",
          background: "rgba(10, 15, 29, 0.82)",
          backdropFilter: "blur(14px)",
          padding: isPortrait ? "18px 30px" : "14px 24px",
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {scene.wordTokens.map((token, idx) => {
          // Normalize frame offset relative to this scene sequence
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
              key={idx}
              style={{
                fontSize: isPortrait ? 38 : 28,
                fontWeight: 800,
                fontFamily: "Inter, sans-serif",
                color: isActive
                  ? "#fbbf24"
                  : isPast
                  ? "#ffffff"
                  : "rgba(255, 255, 255, 0.45)",
                transform: isActive ? "scale(1.16)" : "scale(1.0)",
                display: "inline-block",
                transition: "transform 0.08s ease-out, color 0.08s ease-out",
                textShadow: isActive
                  ? "0 0 20px rgba(251, 191, 36, 0.8), 0 2px 4px rgba(0,0,0,0.8)"
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
