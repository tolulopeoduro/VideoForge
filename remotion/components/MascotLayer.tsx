import React from "react";
import { spring, useCurrentFrame, useVideoConfig, Img, interpolate, staticFile } from "remotion";
import { Scene } from "@/types/schema";

interface MascotLayerProps {
  mascot: Scene["mascot"];
}

const POSE_SRC_MAP: Record<Scene["mascot"]["pose"], string> = {
  neutral: "/mascot/neutral.svg",
  explaining: "/mascot/explaining.svg",
  shocked: "/mascot/shocked.svg",
  pointing: "/mascot/pointing.svg",
};

export const MascotLayer: React.FC<MascotLayerProps> = ({ mascot }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (!mascot.isVisible) {
    return null;
  }

  const rawSrc = POSE_SRC_MAP[mascot.pose] || POSE_SRC_MAP.neutral;
  const poseSrc = rawSrc.startsWith("/") ? staticFile(rawSrc) : rawSrc;

  // Spring physics for entrance animation
  const springProgress = spring({
    frame,
    fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 120,
    },
  });

  // Calculate transform and opacity based on entranceAnimation
  let transform = "";
  let opacity = 1;

  // Organic idle bobbing (subtle breathing sway)
  const idleY = Math.sin(frame / 8) * 6;
  const idleRotate = Math.sin(frame / 14) * 1.2;

  if (mascot.entranceAnimation === "slide-up") {
    const translateY = interpolate(springProgress, [0, 1], [300, 0]) + idleY;
    opacity = interpolate(springProgress, [0, 0.4, 1], [0, 0.8, 1]);
    transform = `translateY(${translateY}px) rotate(${idleRotate}deg)`;
  } else if (mascot.entranceAnimation === "pop-in") {
    const scale = interpolate(springProgress, [0, 1], [0.3, 1.0]);
    opacity = interpolate(springProgress, [0, 0.2, 1], [0, 1, 1]);
    transform = `scale(${scale}) translateY(${idleY}px) rotate(${idleRotate}deg)`;
  } else {
    // fade
    opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
    transform = `translateY(${idleY}px) rotate(${idleRotate}deg)`;
  }

  // Positioning in Portrait (1080x1920) vs Landscape (1920x1080)
  // Using a full-width flex wrapper guarantees exact horizontal alignment without transform-origin drift
  const isPortrait = height > width;
  const mascotWidth = isPortrait ? 430 : 340;
  const mascotHeight = isPortrait ? 570 : 450;

  let horizontalOffsetPx = 0;
  if (mascot.position === "left") {
    horizontalOffsetPx = isPortrait ? -190 : -590;
  } else if (mascot.position === "right") {
    horizontalOffsetPx = isPortrait ? 190 : 590;
  }

  const bottomOffsetPx = isPortrait
    ? 300
    : mascot.position === "center"
    ? 170
    : 48;

  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffsetPx,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: mascotWidth,
          height: mascotHeight,
          transform: `translateX(${horizontalOffsetPx}px) ${transform}`,
          opacity,
          transformOrigin: "bottom center",
          filter: "drop-shadow(0 20px 30px rgba(0, 0, 0, 0.55))",
        }}
      >
        <img
          src={poseSrc}
          alt="Brand Mascot"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
};
