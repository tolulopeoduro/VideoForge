import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { Scene } from "@/types/schema";

interface BackgroundLayerProps {
  background: Scene["background"];
  sceneDurationInFrames: number;
}

const resolveImageSrc = (src: string) => {
  if (src.startsWith("/")) return staticFile(src);
  return src;
};

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  background,
  sceneDurationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Dynamic Ken Burns calculations based on motion type
  let transform = "scale(1.0)";
  if (background.motion === "zoom-in") {
    const scale = interpolate(
      frame,
      [0, Math.max(1, sceneDurationInFrames)],
      [1.0, 1.14],
      { extrapolateRight: "clamp" }
    );
    transform = `scale(${scale})`;
  } else if (background.motion === "pan-left") {
    const translateX = interpolate(
      frame,
      [0, Math.max(1, sceneDurationInFrames)],
      [0, -40],
      { extrapolateRight: "clamp" }
    );
    const scale = 1.08;
    transform = `scale(${scale}) translateX(${translateX}px)`;
  }

  // Render background according to type
  if (background.type === "color") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: background.src || "#0f172a",
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)",
        }}
      />
    );
  }

  // Stock or FLUX Klein generated background
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#090d16",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform,
          transformOrigin: "center center",
          transition: "transform 0.05s linear",
        }}
      >
        {background.src.startsWith("<svg") ? (
          <div
            style={{ width: "100%", height: "100%" }}
            dangerouslySetInnerHTML={{ __html: background.src }}
          />
        ) : background.src.endsWith(".svg") || background.src.includes(".svg") ? (
          <img
            src={resolveImageSrc(background.src)}
            alt="Background"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Img
            src={resolveImageSrc(background.src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      {/* Cinematic vignette & subtle contrast overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 0.2) 50%, rgba(15, 23, 42, 0.8) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
