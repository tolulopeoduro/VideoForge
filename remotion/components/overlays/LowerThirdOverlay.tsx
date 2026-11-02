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

  const translateY = interpolate(entrance, [0, 1], [-40, 0]);
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 0.85, 1]);
  const lineWidth = interpolate(frame, [5, 30], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 6,
        padding: "20px 34px",
        background: "rgba(10, 15, 29, 0.9)",
        backdropFilter: "blur(20px)",
        border: "1.5px solid rgba(255, 255, 255, 0.14)",
        borderRadius: 22,
        minWidth: 360,
        maxWidth: 640,
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.55)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "#818cf8",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          background: "rgba(99, 102, 241, 0.16)",
          padding: "4px 12px",
          borderRadius: 999,
        }}
      >
        {category}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
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
          height: 3,
          width: `${lineWidth}%`,
          background: "linear-gradient(90deg, #6366f1 0%, #ec4899 100%)",
          marginTop: 6,
          borderRadius: 999,
        }}
      />
    </div>
  );
};
