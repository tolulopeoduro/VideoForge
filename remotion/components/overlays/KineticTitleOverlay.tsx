import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface KineticTitleOverlayProps {
  topTag?: string;
  topKicker?: string;
  headline?: string;
  mainTitle?: string;
  bottomSub?: string;
  accentColor?: string;
}

export const KineticTitleOverlay: React.FC<KineticTitleOverlayProps> = ({
  topTag,
  topKicker,
  headline,
  mainTitle,
  bottomSub,
  accentColor = "#6366f1",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const effectiveKicker = topKicker || topTag || "BREAKING ANALYSIS";
  const effectiveHeadline = mainTitle || headline || "UNSTOPPABLE MOMENTUM";
  const words = effectiveHeadline.trim().split(/\s+/);

  const subSpring = spring({
    frame: Math.max(0, frame - words.length * 3 - 4),
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
        background: "rgba(10, 15, 29, 0.78)",
        backdropFilter: "blur(16px)",
        padding: isPortrait ? "26px 36px" : "20px 32px",
        borderRadius: 26,
        border: `1.5px solid ${accentColor}55`,
        boxShadow: `0 24px 50px rgba(0, 0, 0, 0.65), 0 0 32px ${accentColor}28`,
        maxWidth: isPortrait ? 820 : 720,
      }}
    >
      {effectiveKicker && (
        <div
          style={{
            background: accentColor,
            color: "#ffffff",
            fontWeight: 900,
            fontSize: isPortrait ? 15 : 12,
            letterSpacing: "0.16em",
            padding: "6px 18px",
            borderRadius: 999,
            marginBottom: 14,
            textTransform: "uppercase",
            boxShadow: `0 0 24px ${accentColor}88`,
          }}
        >
          {effectiveKicker}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: isPortrait ? "10px 14px" : "8px 12px",
          maxWidth: isPortrait ? 740 : 640,
        }}
      >
        {words.map((word, idx) => {
          const wordSpring = spring({
            frame: Math.max(0, frame - idx * 4),
            fps,
            config: { damping: 12, mass: 0.75, stiffness: 150 },
          });

          const scale = interpolate(wordSpring, [0, 1], [1.5, 1.0]);
          const opacity = interpolate(wordSpring, [0, 0.4, 1], [0, 1, 1]);

          return (
            <span
              key={idx}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                opacity,
                fontSize: isPortrait ? 46 : 34,
                fontWeight: 900,
                color: idx % 2 === 1 ? "#fbbf24" : "#ffffff",
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                textShadow: "0 10px 30px rgba(0,0,0,0.85)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {bottomSub && (
        <div
          style={{
            opacity: subSpring,
            transform: `translateY(${interpolate(subSpring, [0, 1], [10, 0])}px)`,
            marginTop: 12,
            fontSize: isPortrait ? 18 : 14,
            fontWeight: 600,
            color: "#cbd5e1",
            letterSpacing: "0.02em",
          }}
        >
          {bottomSub}
        </div>
      )}
    </div>
  );
};
