import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface ProgressRingProps {
  label?: string;
  percentage?: number;
  color?: string;
}

export const ProgressRingOverlay: React.FC<ProgressRingProps> = ({
  label = "Export Quality",
  percentage = 99,
  color = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.6, stiffness: 100 },
  });

  const progress = interpolate(frame, [10, 50], [0, percentage], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const scale = interpolate(entrance, [0, 1], [0.6, 1]);
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 0.8, 1]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(16px)",
        border: "1.5px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 24,
        padding: "24px 30px",
        display: "inline-flex",
        alignItems: "center",
        gap: 20,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${color}88)`,
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>
      <div>
        <div style={{ fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          STATUS
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
};
