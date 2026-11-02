import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface QuoteCardOverlayProps {
  quote?: string;
  author?: string;
  role?: string;
  accentColor?: string;
}

export const QuoteCardOverlay: React.FC<QuoteCardOverlayProps> = ({
  quote = "Success isn't an accident. It is engineered through relentless precision.",
  author = "Studio Insight",
  role = "Key Takeaway",
  accentColor = "#f59e0b",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 115 },
  });

  const translateY = interpolate(enter, [0, 1], [40, 0]);
  const opacity = interpolate(enter, [0, 0.35, 1], [0, 1, 1]);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        background: "rgba(10, 15, 29, 0.9)",
        backdropFilter: "blur(20px)",
        padding: isPortrait ? "26px 30px" : "20px 24px",
        borderRadius: 24,
        borderLeft: `6px solid ${accentColor}`,
        borderTop: "1px solid rgba(255,255,255,0.14)",
        borderRight: "1px solid rgba(255,255,255,0.14)",
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.7)",
        maxWidth: isPortrait ? 520 : 440,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: isPortrait ? 44 : 32,
          lineHeight: 0.8,
          fontWeight: 900,
          color: accentColor,
          marginBottom: 8,
        }}
      >
        “
      </div>
      <div
        style={{
          fontSize: isPortrait ? 23 : 17,
          fontWeight: 700,
          color: "#f8fafc",
          lineHeight: 1.4,
          fontStyle: "italic",
        }}
      >
        {quote}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 2,
            background: accentColor,
          }}
        />
        <div>
          <span style={{ fontSize: isPortrait ? 16 : 13, fontWeight: 800, color: "#ffffff" }}>
            {author}
          </span>
          {role && (
            <span style={{ fontSize: isPortrait ? 14 : 12, color: "#94a3b8", marginLeft: 8 }}>
              • {role}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
