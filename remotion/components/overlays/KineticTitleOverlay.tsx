import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface KineticTitleOverlayProps {
  topTag?: string;
  headline?: string;
  accentColor?: string;
}

export const KineticTitleOverlay: React.FC<KineticTitleOverlayProps> = ({
  topTag = "BREAKING ANALYSIS",
  headline = "UNSTOPPABLE MOMENTUM",
  accentColor = "#6366f1",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const words = headline.trim().split(/\s+/);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {topTag && (
        <div
          style={{
            background: accentColor,
            color: "#ffffff",
            fontWeight: 900,
            fontSize: isPortrait ? 15 : 12,
            letterSpacing: "0.16em",
            padding: "6px 16px",
            borderRadius: 999,
            marginBottom: 12,
            textTransform: "uppercase",
            boxShadow: `0 0 24px ${accentColor}88`,
          }}
        >
          {topTag}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: isPortrait ? "10px 14px" : "8px 12px",
          maxWidth: isPortrait ? 680 : 600,
        }}
      >
        {words.map((word, idx) => {
          const wordSpring = spring({
            frame: Math.max(0, frame - idx * 4),
            fps,
            config: { damping: 12, mass: 0.75, stiffness: 150 },
          });

          const scale = interpolate(wordSpring, [0, 1], [1.6, 1.0]);
          const opacity = interpolate(wordSpring, [0, 0.4, 1], [0, 1, 1]);

          return (
            <span
              key={idx}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                opacity,
                fontSize: isPortrait ? 44 : 32,
                fontWeight: 900,
                color: idx % 2 === 1 ? "#fbbf24" : "#ffffff",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                textShadow: "0 10px 30px rgba(0,0,0,0.85)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
