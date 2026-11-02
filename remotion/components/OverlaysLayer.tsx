import React from "react";
import { GraphicOverlay, Scene } from "@/types/schema";
import { StatCounterOverlay } from "./overlays/StatCounterOverlay";
import { LowerThirdOverlay } from "./overlays/LowerThirdOverlay";
import { ProgressRingOverlay } from "./overlays/ProgressRingOverlay";
import { CodeSnippetOverlay } from "./overlays/CodeSnippetOverlay";
import { BarChartOverlay } from "./overlays/BarChartOverlay";
import { VersusBattleOverlay } from "./overlays/VersusBattleOverlay";
import { QuoteCardOverlay } from "./overlays/QuoteCardOverlay";
import { TimelineMilestoneOverlay } from "./overlays/TimelineMilestoneOverlay";
import { KineticTitleOverlay } from "./overlays/KineticTitleOverlay";
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

  // Top overlays placement (positioned cleanly in upper half of screen)
  let topAlignment: React.CSSProperties = {
    position: "absolute",
    top: isPortrait ? "10%" : "10%",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 25,
  };

  if (mascot.isVisible && mascot.position === "right") {
    topAlignment = {
      position: "absolute",
      top: isPortrait ? "10%" : "10%",
      left: isPortrait ? "6%" : "8%",
      zIndex: 25,
    };
  } else if (mascot.isVisible && mascot.position === "left") {
    topAlignment = {
      position: "absolute",
      top: isPortrait ? "10%" : "10%",
      right: isPortrait ? "6%" : "8%",
      zIndex: 25,
    };
  }

  // Lower Third overlays placement (situated safely above bottom captions)
  let lowerAlignment: React.CSSProperties = {
    position: "absolute",
    top: isPortrait ? "12%" : "14%",
    left: isPortrait ? "6%" : "8%",
    zIndex: 26,
  };

  if (mascot.isVisible && mascot.position === "left") {
    lowerAlignment = {
      position: "absolute",
      top: isPortrait ? "12%" : "14%",
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
                case "bar-chart":
                  return <BarChartOverlay key={overlay.id} {...overlay.props} />;
                case "versus-battle":
                  return <VersusBattleOverlay key={overlay.id} {...overlay.props} />;
                case "quote-card":
                  return <QuoteCardOverlay key={overlay.id} {...overlay.props} />;
                case "timeline-milestone":
                  return <TimelineMilestoneOverlay key={overlay.id} {...overlay.props} />;
                case "kinetic-title":
                  return <KineticTitleOverlay key={overlay.id} {...overlay.props} />;
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
