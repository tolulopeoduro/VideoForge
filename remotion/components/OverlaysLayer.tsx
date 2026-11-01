import React from "react";
import { GraphicOverlay, Scene } from "@/types/schema";
import { StatCounterOverlay } from "./overlays/StatCounterOverlay";
import { LowerThirdOverlay } from "./overlays/LowerThirdOverlay";
import { ProgressRingOverlay } from "./overlays/ProgressRingOverlay";
import { CodeSnippetOverlay } from "./overlays/CodeSnippetOverlay";
import { useVideoConfig } from "remotion";

interface OverlaysLayerProps {
  overlays: GraphicOverlay[];
  mascot: Scene["mascot"];
}

export const OverlaysLayer: React.FC<OverlaysLayerProps> = ({ overlays, mascot }) => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  if (!overlays || overlays.length === 0) {
    return null;
  }

  const topOverlays = overlays.filter((o) => o.type !== "lower-third");
  const lowerThirdOverlays = overlays.filter((o) => o.type === "lower-third");

  // Top overlays placement (opposite to mascot)
  let topAlignment: React.CSSProperties = {
    position: "absolute",
    top: isPortrait ? "15%" : "12%",
    right: isPortrait ? "6%" : "10%",
    zIndex: 25,
  };

  if (mascot.isVisible && mascot.position === "right") {
    topAlignment = {
      position: "absolute",
      top: isPortrait ? "15%" : "12%",
      left: isPortrait ? "6%" : "10%",
      zIndex: 25,
    };
  } else if (!mascot.isVisible) {
    topAlignment = {
      position: "absolute",
      top: isPortrait ? "18%" : "14%",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 25,
    };
  }

  // Lower Third overlays placement (situated above bottom captions)
  let lowerAlignment: React.CSSProperties = {
    position: "absolute",
    bottom: isPortrait ? 400 : 130,
    left: isPortrait ? "6%" : "8%",
    zIndex: 26,
  };

  if (mascot.isVisible && mascot.position === "left") {
    lowerAlignment = {
      position: "absolute",
      bottom: isPortrait ? 400 : 130,
      right: isPortrait ? "6%" : "8%",
      zIndex: 26,
    };
  }

  return (
    <>
      {topOverlays.length > 0 && (
        <div style={topAlignment}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {topOverlays.map((overlay) => {
              switch (overlay.type) {
                case "stat-counter":
                  return <StatCounterOverlay key={overlay.id} {...overlay.props} />;
                case "progress-ring":
                  return <ProgressRingOverlay key={overlay.id} {...overlay.props} />;
                case "code-snippet":
                  return <CodeSnippetOverlay key={overlay.id} {...overlay.props} />;
                default:
                  return null;
              }
            })}
          </div>
        </div>
      )}

      {lowerThirdOverlays.length > 0 && (
        <div style={lowerAlignment}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lowerThirdOverlays.map((overlay) => (
              <LowerThirdOverlay key={overlay.id} {...overlay.props} />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
