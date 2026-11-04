import React from "react";
import {
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Video,
  staticFile,
} from "remotion";

interface MediaCardOverlayProps {
  title?: string;
  caption?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "auto";
  badge?: string;
  accentColor?: string;
  tilt3D?: boolean;
}

const resolveSrc = (src: string) => {
  if (!src) return "";
  if (src.startsWith("/generated/")) {
    return `/api/media/${src.replace("/generated/", "")}`;
  }
  if (src.startsWith("/")) return staticFile(src);
  return src;
};

export const MediaCardOverlay: React.FC<MediaCardOverlayProps> = ({
  title = "Visual Evidence",
  caption = "Source Reference • Live Feed",
  mediaUrl = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
  mediaType = "auto",
  badge = "B-ROLL PIP",
  accentColor = "#6366f1",
  tilt3D = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;

  const enter = spring({
    frame,
    fps,
    config: { damping: 13, mass: 0.75, stiffness: 125 },
  });

  const scale = interpolate(enter, [0, 1], [0.75, 1]);
  const opacity = interpolate(enter, [0, 0.35, 1], [0, 1, 1]);
  const floatY = Math.sin(frame / 12) * 5;
  const rotY = tilt3D ? Math.sin(frame / 18) * 6 : 0;
  const rotX = tilt3D ? Math.cos(frame / 22) * 3 : 0;

  const cleanUrl = (mediaUrl || "").split("?")[0].toLowerCase();
  const isVideo =
    mediaType === "video" ||
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    (mediaUrl || "").startsWith("data:video/");

  const resolved = resolveSrc(mediaUrl);

  return (
    <div
      style={{
        transform: `perspective(1100px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(${floatY}px) scale(${scale})`,
        opacity,
        background: "rgba(10, 15, 29, 0.92)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        border: `1.5px solid ${accentColor}66`,
        boxShadow: `0 28px 60px rgba(0, 0, 0, 0.78), 0 0 36px ${accentColor}33`,
        overflow: "hidden",
        width: isPortrait ? 560 : 460,
        maxWidth: "100%",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Top Window Chrome & Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isPortrait ? "12px 18px" : "10px 16px",
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
          <span
            style={{
              fontSize: isPortrait ? 14 : 12,
              fontWeight: 800,
              color: "#f8fafc",
              marginLeft: 6,
            }}
          >
            {title}
          </span>
        </div>

        {badge && (
          <span
            style={{
              fontSize: isPortrait ? 11 : 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: accentColor,
              color: "#ffffff",
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Media Viewport */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: isPortrait ? 300 : 230,
          background: "#050811",
          overflow: "hidden",
        }}
      >
        {resolved ? (
          isVideo ? (
            <Video
              src={resolved}
              muted
              loop
              pauseWhenBuffering={false}
              acceptableTimeShiftInSeconds={2}
              onError={() => {}}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <img
              src={resolved}
              alt={title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Drop or select media
          </div>
        )}
      </div>

      {/* Caption Footer */}
      {caption && (
        <div
          style={{
            padding: isPortrait ? "12px 18px" : "10px 16px",
            fontSize: isPortrait ? 14 : 12,
            fontWeight: 600,
            color: "#cbd5e1",
            textAlign: "center",
            background: "rgba(10, 15, 29, 0.95)",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};
