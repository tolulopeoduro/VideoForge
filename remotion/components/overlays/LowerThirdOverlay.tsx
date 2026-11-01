import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface LowerThirdProps {
  title?: string;
  subtitle?: string;
  category?: string;
}

export const LowerThirdOverlay: React.FC<LowerThirdProps> = ({
  title = "Semantic Anchoring Engine",
  subtitle = "Zero-latency narrative synchronization",
  category = "ARCHITECTURE",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.7, stiffness: 90 },
  });

  const translateX = interpolate(entrance, [0, 1], [-100, 0]);
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 0.8, 1]);
  const lineWidth = interpolate(frame, [5, 30], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `translateX(${translateX}px)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 28px",
        background: "rgba(10, 15, 29, 0.9)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderLeft: "6px solid #6366f1",
        borderRadius: "0 16px 16px 0",
        maxWidth: 580,
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.55)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#818cf8",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        {category}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "#94a3b8",
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          height: 2,
          width: `${lineWidth}%`,
          background: "linear-gradient(90deg, #6366f1 0%, #ec4899 100%)",
          marginTop: 6,
          borderRadius: 2,
        }}
      />
    </div>
  );
};
