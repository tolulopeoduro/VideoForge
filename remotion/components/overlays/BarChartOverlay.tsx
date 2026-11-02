import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface BarChartOverlayProps {
  title?: string;
  bars?: Array<{ label: string; value: number; color?: string }>;
  unit?: string;
}

export const BarChartOverlay: React.FC<BarChartOverlayProps> = ({
  title = "Performance Comparison",
  bars = [
    { label: "Leader", value: 94, color: "#6366f1" },
    { label: "Industry Avg", value: 62, color: "#38bdf8" },
    { label: "Legacy", value: 31, color: "#64748b" },
  ],
  unit = "%",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 120 },
  });

  const scale = interpolate(cardSpring, [0, 1], [0.8, 1]);
  const opacity = interpolate(cardSpring, [0, 0.4, 1], [0, 1, 1]);
  const maxVal = Math.max(...bars.map((b) => b.value), 100);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: "rgba(10, 15, 29, 0.88)",
        backdropFilter: "blur(18px)",
        padding: isPortrait ? "24px 28px" : "18px 24px",
        borderRadius: 24,
        border: "1.5px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.65)",
        minWidth: isPortrait ? 420 : 360,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: isPortrait ? 18 : 14,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#94a3b8",
          marginBottom: 16,
        }}
      >
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {bars.map((bar, idx) => {
          const barSpring = spring({
            frame: Math.max(0, frame - idx * 5 - 4),
            fps,
            config: { damping: 15, stiffness: 100 },
          });
          const pct = Math.min(100, (bar.value / maxVal) * 100) * barSpring;
          const displayVal = Math.round(bar.value * barSpring);

          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: isPortrait ? 20 : 15, fontWeight: 700, color: "#f8fafc" }}>
                  {bar.label}
                </span>
                <span
                  style={{
                    fontSize: isPortrait ? 22 : 16,
                    fontWeight: 900,
                    color: bar.color || "#6366f1",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {displayVal}
                  {unit}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: isPortrait ? 16 : 12,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: bar.color || "#6366f1",
                    borderRadius: 999,
                    boxShadow: `0 0 16px ${bar.color || "#6366f1"}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
