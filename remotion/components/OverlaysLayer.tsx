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

export const OverlaysLayer: React.FC<OverlaysLayerProps> = ({ overlays }) => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  if (!overlays || overlays.length === 0) {
    return null;
  }

  // All overlays are rendered in a dead-center horizontal flex container in the upper stage
  // so they are never pushed off-center by the mascot.
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: isPortrait ? 115 : 64,
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: isPortrait ? "0 48px" : "0 80px",
    boxSizing: "border-box",
    zIndex: 25,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isPortrait ? 20 : 14,
          width: "100%",
          maxWidth: isPortrait ? 920 : 860,
        }}
      >
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
  );
};
