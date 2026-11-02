import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideTransitionStyle } from "@/types/schema";

interface SlideTransitionWrapperProps {
  style?: SlideTransitionStyle;
  durationInFrames: number;
  children: React.ReactNode;
}

export const SlideTransitionWrapper: React.FC<SlideTransitionWrapperProps> = ({
  style = "fade",
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const enterProgress = spring({
    frame,
    fps,
    config: {
      damping: 16,
      mass: 0.85,
      stiffness: 130,
    },
  });

  // Subtle exit fade on the final 8 frames of the slide
  const exitStart = Math.max(10, durationInFrames - 8);
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let transform = "none";
  let opacity = exitOpacity;
  let clipPath = "none";

  if (style === "fade") {
    const fadeIn = interpolate(frame, [0, 12], [0, 1], {
      extrapolateRight: "clamp",
    });
    opacity = fadeIn * exitOpacity;
  } else if (style === "slide-left") {
    const tx = interpolate(enterProgress, [0, 1], [width * 0.65, 0]);
    const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
    transform = `translateX(${tx}px)`;
    opacity = fadeIn * exitOpacity;
  } else if (style === "zoom-punch") {
    const scale = interpolate(enterProgress, [0, 1], [1.32, 1.0]);
    const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
    transform = `scale(${scale})`;
    opacity = fadeIn * exitOpacity;
  } else if (style === "wipe-up") {
    const ty = interpolate(enterProgress, [0, 1], [height * 0.45, 0]);
    const insetTop = interpolate(enterProgress, [0, 1], [100, 0]);
    transform = `translateY(${ty}px)`;
    clipPath = `inset(${insetTop}% 0% 0% 0%)`;
  } else if (style === "flip-3d") {
    const rotY = interpolate(enterProgress, [0, 1], [75, 0]);
    const scale = interpolate(enterProgress, [0, 1], [0.82, 1.0]);
    const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
    transform = `perspective(1400px) rotateY(${rotY}deg) scale(${scale})`;
    opacity = fadeIn * exitOpacity;
  }

  return (
    <AbsoluteFill
      style={{
        transform,
        opacity,
        clipPath: clipPath !== "none" ? clipPath : undefined,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
