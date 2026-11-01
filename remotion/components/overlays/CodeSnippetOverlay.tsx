import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface CodeSnippetProps {
  filename?: string;
  code?: string;
  language?: string;
}

export const CodeSnippetOverlay: React.FC<CodeSnippetProps> = ({
  filename = "timeline.ts",
  code = `// Semantic Anchoring
const duration = whisper.getDuration();
state.lockFrames(duration * 30);`,
  language = "typescript",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 100 },
  });

  const translateY = interpolate(entrance, [0, 1], [50, 0]);
  const opacity = interpolate(entrance, [0, 0.3, 1], [0, 0.8, 1]);

  // Typing effect
  const codeLines = code.split("\n");
  const cursorBlink = Math.floor(frame / 12) % 2 === 0;

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        background: "#0d1117",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.15)",
        minWidth: 340,
        maxWidth: 520,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Window Title Bar */}
      <div
        style={{
          background: "#161b22",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
        </div>
        <div style={{ fontSize: 13, color: "#8b949e", fontWeight: 500 }}>
          {filename}
        </div>
      </div>

      {/* Code Body */}
      <div style={{ padding: "18px 20px", fontSize: 15, lineHeight: 1.6 }}>
        {codeLines.map((line, idx) => (
          <div key={idx} style={{ display: "flex", gap: 14 }}>
            <span style={{ color: "#484f58", userSelect: "none", width: 20, textAlign: "right" }}>
              {idx + 1}
            </span>
            <span style={{ color: line.startsWith("//") ? "#8b949e" : "#58a6ff" }}>
              {line}
              {idx === codeLines.length - 1 && cursorBlink && (
                <span style={{ color: "#38bdf8", marginLeft: 2, fontWeight: 700 }}>▎</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
