import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface StatCounterProps {
  label?: string;
  targetValue?: number;
  prefix?: string;
  suffix?: string;
  accentColor?: string;
}

export const StatCounterOverlay: React.FC<StatCounterProps> = ({
  label = "Growth Metrics",
  targetValue = 87,
  prefix = "+",
  suffix = "%",
  accentColor = "#6366f1",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 100 },
  });

  const countProgress = interpolate(frame, [10, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const currentValue = Math.round(countProgress * targetValue);
  const translateY = interpolate(entrance, [0, 1], [60, 0]);
  const opacity = interpolate(entrance, [0, 0.5, 1], [0, 0.8, 1]);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(16px)",
        border: `1.5px solid ${accentColor}44`,
        borderRadius: 20,
        padding: "24px 32px",
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${accentColor}33`,
        display: "inline-flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 260,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#94a3b8",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 54,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          color: "#ffffff",
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          lineHeight: 1,
        }}
      >
        <span style={{ color: accentColor }}>{prefix}</span>
        <span>{currentValue}</span>
        <span style={{ color: accentColor, fontSize: 36 }}>{suffix}</span>
      </div>
    </div>
  );
};
