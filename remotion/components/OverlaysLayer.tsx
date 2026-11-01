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

  // Position overlay opposite to mascot or centered
  let overlayAlignment: React.CSSProperties = {
    position: "absolute",
    top: isPortrait ? "18%" : "14%",
    right: isPortrait ? "8%" : "12%",
    zIndex: 25,
  };

  if (mascot.isVisible && mascot.position === "right") {
    overlayAlignment = {
      position: "absolute",
      top: isPortrait ? "18%" : "14%",
      left: isPortrait ? "8%" : "12%",
      zIndex: 25,
    };
  } else if (!mascot.isVisible) {
    overlayAlignment = {
      position: "absolute",
      top: isPortrait ? "22%" : "18%",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 25,
    };
  }

  return (
    <div style={overlayAlignment}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {overlays.map((overlay) => {
          switch (overlay.type) {
            case "stat-counter":
              return <StatCounterOverlay key={overlay.id} {...overlay.props} />;
            case "lower-third":
              return <LowerThirdOverlay key={overlay.id} {...overlay.props} />;
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
  );
};
