import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface BarChartOverlayProps {
  title?: string;
  subtitle?: string;
  bars?: Array<{ label: string; value: number; color?: string }>;
  bar1Label?: string;
  bar1Value?: number;
  bar1Color?: string;
  bar2Label?: string;
  bar2Value?: number;
  bar2Color?: string;
  bar3Label?: string;
  bar3Value?: number;
  bar3Color?: string;
  unit?: string;
}

export const BarChartOverlay: React.FC<BarChartOverlayProps> = ({
  title = "Performance Comparison",
  subtitle,
  bars,
  bar1Label,
  bar1Value,
  bar1Color,
  bar2Label,
  bar2Value,
  bar2Color,
  bar3Label,
  bar3Value,
  bar3Color,
  unit = "%",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  // Support both flat inspector props (bar1Label/bar1Value) and array props (bars)
  const effectiveBars =
    bar1Label !== undefined || bar2Label !== undefined || bar3Label !== undefined
      ? [
          {
            label: bar1Label || "Leader",
            value: typeof bar1Value === "number" ? bar1Value : 94,
            color: bar1Color || "#10b981",
          },
          {
            label: bar2Label || "Challenger",
            value: typeof bar2Value === "number" ? bar2Value : 68,
            color: bar2Color || "#6366f1",
          },
          {
            label: bar3Label || "Baseline",
            value: typeof bar3Value === "number" ? bar3Value : 36,
            color: bar3Color || "#f59e0b",
          },
        ]
      : bars || [
          { label: "Leader", value: 94, color: "#6366f1" },
          { label: "Industry Avg", value: 62, color: "#38bdf8" },
          { label: "Legacy", value: 31, color: "#64748b" },
        ];

  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 120 },
  });

  const scale = interpolate(cardSpring, [0, 1], [0.85, 1]);
  const opacity = interpolate(cardSpring, [0, 0.4, 1], [0, 1, 1]);
  const maxVal = Math.max(...effectiveBars.map((b) => b.value), 10);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: "rgba(10, 15, 29, 0.88)",
        backdropFilter: "blur(18px)",
        padding: isPortrait ? "24px 30px" : "18px 26px",
        borderRadius: 24,
        border: "1.5px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.65)",
        width: isPortrait ? 520 : 440,
        maxWidth: "100%",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: isPortrait ? 18 : 14,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#f8fafc",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: isPortrait ? 13 : 11,
              fontWeight: 500,
              color: "#94a3b8",
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {effectiveBars.map((bar, idx) => {
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
