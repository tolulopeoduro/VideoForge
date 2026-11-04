import React from "react";
import { interpolate, useCurrentFrame, Img, Video, staticFile } from "remotion";
import { Scene } from "@/types/schema";

interface BackgroundLayerProps {
  background: Scene["background"];
  sceneDurationInFrames: number;
}

const resolveMediaSrc = (src: string) => {
  if (!src) return "";
  if (src.startsWith("/generated/")) {
    return `/api/media/${src.replace("/generated/", "")}`;
  }
  if (src.startsWith("/")) return staticFile(src);
  return src;
};

const isVideoSource = (type: string, src: string) => {
  if (type === "video") return true;
  if (!src) return false;
  const clean = src.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mov") ||
    src.startsWith("data:video/")
  );
};

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
  background,
  sceneDurationInFrames,
}) => {
  const frame = useCurrentFrame();
  const dur = Math.max(1, sceneDurationInFrames);

  // Dynamic Ken Burns & 3D Camera Motion calculations
  let transform = "scale(1.0)";
  if (background.motion === "zoom-in") {
    const scale = interpolate(frame, [0, dur], [1.0, 1.18], {
      extrapolateRight: "clamp",
    });
    transform = `scale(${scale})`;
  } else if (background.motion === "zoom-out") {
    const scale = interpolate(frame, [0, dur], [1.18, 1.0], {
      extrapolateRight: "clamp",
    });
    transform = `scale(${scale})`;
  } else if (background.motion === "pan-left") {
    const translateX = interpolate(frame, [0, dur], [30, -45], {
      extrapolateRight: "clamp",
    });
    transform = `scale(1.12) translateX(${translateX}px)`;
  } else if (background.motion === "pan-right") {
    const translateX = interpolate(frame, [0, dur], [-30, 45], {
      extrapolateRight: "clamp",
    });
    transform = `scale(1.12) translateX(${translateX}px)`;
  } else if (background.motion === "tilt-3d") {
    const rotX = interpolate(frame, [0, dur], [4, -4], {
      extrapolateRight: "clamp",
    });
    const rotY = interpolate(frame, [0, dur], [-5, 5], {
      extrapolateRight: "clamp",
    });
    const scale = interpolate(frame, [0, dur], [1.06, 1.15], {
      extrapolateRight: "clamp",
    });
    transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`;
  }

  // Animated light orb coordinates for rich studio atmosphere
  const orb1X = interpolate(frame, [0, dur], [25, 75], { extrapolateRight: "clamp" });
  const orb1Y = interpolate(frame, [0, dur], [20, 45], { extrapolateRight: "clamp" });
  const orb2X = interpolate(frame, [0, dur], [80, 30], { extrapolateRight: "clamp" });

  if (background.type === "color") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          backgroundColor: background.src || "#0f172a",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "-10%",
            transform,
            transformOrigin: "center center",
            backgroundImage: `
              radial-gradient(circle at ${orb1X}% ${orb1Y}%, rgba(99, 102, 241, 0.28) 0%, transparent 55%),
              radial-gradient(circle at ${orb2X}% 75%, rgba(245, 158, 11, 0.16) 0%, transparent 50%),
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "100% 100%, 100% 100%, 64px 64px, 64px 64px",
          }}
        />
        {/* Studio Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 45%, transparent 35%, rgba(5, 8, 17, 0.72) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>
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
        }}
      >
        {isVideoSource(background.type, background.src) ? (
          <Video
            src={resolveMediaSrc(background.src)}
            muted
            loop
            pauseWhenBuffering={false}
            acceptableTimeShiftInSeconds={2}
            onError={(err) => console.warn("B-Roll video background warning:", err)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : background.src.startsWith("<svg") ? (
          <div
            style={{ width: "100%", height: "100%" }}
            dangerouslySetInnerHTML={{ __html: background.src }}
          />
        ) : background.src.endsWith(".svg") || background.src.includes(".svg") ? (
          <img
            src={resolveMediaSrc(background.src)}
            alt="Background"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Img
            src={resolveMediaSrc(background.src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      {/* Cinematic vignette & contrast gradient for foreground readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(9, 13, 22, 0.45) 0%, rgba(9, 13, 22, 0.15) 45%, rgba(9, 13, 22, 0.85) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
