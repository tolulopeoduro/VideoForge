import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface TimelineMilestoneOverlayProps {
  year?: string;
  eventTitle?: string;
  detail?: string;
  accentColor?: string;
}

export const TimelineMilestoneOverlay: React.FC<TimelineMilestoneOverlayProps> = ({
  year = "1999",
  eventTitle = "Historic Milestone",
  detail = "Pivotal turning point in modern history",
  accentColor = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const progress = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 120 },
  });

  const lineLength = interpolate(progress, [0, 1], [0, 100]);
  const scale = interpolate(progress, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity: progress,
        background: "rgba(10, 15, 29, 0.9)",
        backdropFilter: "blur(18px)",
        padding: isPortrait ? "22px 28px" : "16px 22px",
        borderRadius: 24,
        border: "1.5px solid rgba(255,255,255,0.15)",
        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.7)",
        minWidth: isPortrait ? 400 : 330,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Glowing Timeline Axis */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            background: accentColor,
            color: "#090d16",
            fontWeight: 900,
            fontSize: isPortrait ? 20 : 15,
            boxShadow: `0 0 20px ${accentColor}`,
          }}
        >
          {year}
        </div>
        <div
          style={{
            flex: 1,
            height: 3,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${lineLength}%`,
              height: "100%",
              background: accentColor,
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: isPortrait ? 24 : 18, fontWeight: 900, color: "#ffffff" }}>
        {eventTitle}
      </div>
      {detail && (
        <div style={{ fontSize: isPortrait ? 16 : 13, color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>
          {detail}
        </div>
      )}
    </div>
  );
};
