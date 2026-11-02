import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface VersusBattleOverlayProps {
  title?: string;
  heading?: string;
  leftName?: string;
  leftStat?: string;
  leftSub?: string;
  leftColor?: string;
  rightName?: string;
  rightStat?: string;
  rightSub?: string;
  rightColor?: string;
}

export const VersusBattleOverlay: React.FC<VersusBattleOverlayProps> = ({
  title,
  heading,
  leftName = "Contender A",
  leftStat = "20 Titles",
  leftSub,
  leftColor = "#ef4444",
  rightName = "Contender B",
  rightStat = "19 Titles",
  rightSub,
  rightColor = "#38bdf8",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const effectiveTitle = heading || title || "HEAD TO HEAD";

  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.85, stiffness: 130 },
  });

  const vsSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 10, stiffness: 160 },
  });

  const leftTx = interpolate(enterSpring, [0, 1], [-80, 0]);
  const rightTx = interpolate(enterSpring, [0, 1], [80, 0]);
  const opacity = interpolate(enterSpring, [0, 0.3, 1], [0, 1, 1]);
  const vsScale = interpolate(vsSpring, [0, 1], [0, 1.1]);

  return (
    <div
      style={{
        opacity,
        background: "rgba(10, 15, 29, 0.9)",
        backdropFilter: "blur(18px)",
        padding: isPortrait ? "24px 30px" : "18px 24px",
        borderRadius: 26,
        border: "1.5px solid rgba(255, 255, 255, 0.16)",
        boxShadow: "0 24px 50px rgba(0, 0, 0, 0.75)",
        fontFamily: "Inter, sans-serif",
        width: isPortrait ? 560 : 480,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontSize: isPortrait ? 15 : 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          color: "#fbbf24",
          marginBottom: 16,
          textTransform: "uppercase",
        }}
      >
        {effectiveTitle}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
        {/* Left Side */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${leftTx}px)`,
            background: `linear-gradient(135deg, ${leftColor}28, rgba(15,23,42,0.7))`,
            border: `1.5px solid ${leftColor}66`,
            borderRadius: 18,
            padding: isPortrait ? "16px" : "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: isPortrait ? 20 : 15, fontWeight: 800, color: "#ffffff" }}>
            {leftName}
          </div>
          <div
            style={{
              fontSize: isPortrait ? 28 : 20,
              fontWeight: 900,
              color: leftColor,
              marginTop: 4,
            }}
          >
            {leftStat}
          </div>
          {leftSub && (
            <div style={{ fontSize: isPortrait ? 12 : 10, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>
              {leftSub}
            </div>
          )}
        </div>

        {/* VS Badge */}
        <div
          style={{
            transform: `scale(${vsScale})`,
            width: isPortrait ? 52 : 42,
            height: isPortrait ? 52 : 42,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: isPortrait ? 18 : 14,
            color: "#ffffff",
            boxShadow: "0 0 24px rgba(245, 158, 11, 0.7)",
            flexShrink: 0,
          }}
        >
          VS
        </div>

        {/* Right Side */}
        <div
          style={{
            flex: 1,
            transform: `translateX(${rightTx}px)`,
            background: `linear-gradient(135deg, ${rightColor}28, rgba(15,23,42,0.7))`,
            border: `1.5px solid ${rightColor}66`,
            borderRadius: 18,
            padding: isPortrait ? "16px" : "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: isPortrait ? 20 : 15, fontWeight: 800, color: "#ffffff" }}>
            {rightName}
          </div>
          <div
            style={{
              fontSize: isPortrait ? 28 : 20,
              fontWeight: 900,
              color: rightColor,
              marginTop: 4,
            }}
          >
            {rightStat}
          </div>
          {rightSub && (
            <div style={{ fontSize: isPortrait ? 12 : 10, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>
              {rightSub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
