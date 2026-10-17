import { useEffect, useRef } from "react";
import type { Canvas2DContextLike } from "@vf/render";
import { secToUs, usToSec } from "@vf/schema";
import { renderPreviewFrame } from "./previewRender";
import { useEditor } from "./store";
import { hasAnyCachedKokoroAudio, renderProjectVoiceoverBuffer } from "./tts";

export { renderPreviewFrame };

export function formatTimecode(tUs: number, fps = 30): string {
  const totalSecs = Math.max(0, usToSec(tUs));
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  const frame = Math.floor((totalSecs - Math.floor(totalSecs)) * fps);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
}

export function Preview() {
  const { project, playhead, setPlayhead, playing, setPlaying } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const maxClipEnd = Object.values(project.clips).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  const durationUs = Math.max(secToUs(5), maxClipEnd);
  const frameStepUs = Math.round(secToUs(1) / project.canvas.fps);
  const clampedPlayhead = Math.min(playhead, durationUs);
  const neuralAudioReady = hasAnyCachedKokoroAudio(project);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderPreviewFrame(project, playhead, ctx as unknown as Canvas2DContextLike);
  }, [project, playhead]);

  // Sync CSS custom properties for range track fill progress (modern-web-guidance: slider)
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.style.setProperty("--attr-min", "0");
    el.style.setProperty("--attr-max", String(durationUs));
    el.style.setProperty("--control-value", String(clampedPlayhead));
  }, [clampedPlayhead, durationUs]);

  // Playhead animation + synchronized Kokoro-82M Web Audio playback
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let lastMs = performance.now();
    let sourceNode: AudioBufferSourceNode | null = null;

    if (typeof window !== "undefined" && "AudioContext" in window) {
      try {
        const ctx = audioCtxRef.current ?? new window.AudioContext({ sampleRate: 24_000 });
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        const buf = renderProjectVoiceoverBuffer(ctx, project, durationUs);
        if (buf) {
          sourceNode = ctx.createBufferSource();
          sourceNode.buffer = buf;
          sourceNode.connect(ctx.destination);
          const startOffsetSec = Math.max(0, Math.min(buf.duration, usToSec(useEditor.getState().playhead)));
          sourceNode.start(0, startOffsetSec);
        }
      } catch {
        // AudioContext blocked or unavailable in headless test env
      }
    }

    const tick = (nowMs: number) => {
      const deltaUs = Math.round((nowMs - lastMs) * 1000);
      lastMs = nowMs;
      const nextUs = useEditor.getState().playhead + deltaUs;
      if (nextUs >= durationUs) {
        setPlayhead(0);
        setPlaying(false);
        return;
      }
      setPlayhead(nextUs);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (sourceNode) {
        try {
          sourceNode.stop();
          sourceNode.disconnect();
        } catch {
          // ignore if already stopped
        }
      }
    };
  }, [playing, durationUs, project, setPlayhead, setPlaying]);

  const timeText = `${usToSec(playhead).toFixed(2)} seconds of ${usToSec(durationUs).toFixed(2)} seconds`;

  const allWords = project.captions?.words ?? [];
  const activeWord = allWords.find((w) => playhead >= w.start && playhead <= w.end);
  const activeSceneId =
    activeWord?.sceneId ??
    allWords.find((w) => Math.abs(w.start - playhead) < 350_000)?.sceneId;
  const currentSceneWords = activeSceneId
    ? allWords.filter((w) => w.sceneId === activeSceneId)
    : [];

  return (
    <section className="vf-panel">
      <div className="vf-panel-title">
        <span>2. Canvas2D Program Monitor + Kokoro-82M Audio</span>
        <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: neuralAudioReady ? "#22c55e" : "#38bdf8" }}>
          {project.canvas.width}×{project.canvas.height} • {project.canvas.fps}fps •{" "}
          {neuralAudioReady ? "Kokoro-82M 24kHz Ready" : "Click Synthesize TTS for Neural Audio"}
        </span>
      </div>
      <div className="vf-monitor-frame">
        <canvas
          ref={canvasRef}
          className="vf-monitor-canvas"
          width={project.canvas.width}
          height={project.canvas.height}
          style={{
            aspectRatio: `${project.canvas.width} / ${project.canvas.height}`,
            background: project.canvas.bg,
          }}
        />
        {currentSceneWords.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "5px 10px",
              borderRadius: 6,
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid #1e293b",
              fontSize: 12,
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              justifyContent: "center",
            }}
            aria-label="Kokoro word-level captions"
          >
            {currentSceneWords.map((w, i) => {
              const isSpoken = playhead >= w.start && playhead <= w.end;
              return (
                <span
                  key={`${w.start}_${i}`}
                  style={{
                    padding: "1px 4px",
                    borderRadius: 4,
                    fontWeight: isSpoken ? 700 : 400,
                    color: isSpoken ? "#090d16" : "#cbd5e1",
                    background: isSpoken ? "#38bdf8" : "transparent",
                    transition: "background-color 0.08s ease",
                  }}
                >
                  {w.text}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="vf-transport-bar">
        <button
          className="vf-btn-icon"
          title="Jump to start (0.00s)"
          onClick={() => {
            setPlaying(false);
            setPlayhead(0);
          }}
        >
          |&lt;
        </button>
        <button
          className="vf-btn-icon"
          title="Step back 1 frame (Left Arrow)"
          onClick={() => {
            setPlaying(false);
            setPlayhead(Math.max(0, playhead - frameStepUs));
          }}
        >
          -1f
        </button>
        <button
          className="vf-btn-primary"
          onClick={() => setPlaying((p) => !p)}
          style={{ minWidth: 74 }}
          title="Play / Pause with Kokoro voiceover (Space)"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          className="vf-btn-icon"
          title="Step forward 1 frame (Right Arrow)"
          onClick={() => {
            setPlaying(false);
            setPlayhead(Math.min(durationUs, playhead + frameStepUs));
          }}
        >
          +1f
        </button>
        <label
          htmlFor="playhead-slider"
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        >
          Playhead time
        </label>
        <input
          ref={sliderRef}
          id="playhead-slider"
          className="vf-slider"
          type="range"
          min={0}
          max={durationUs}
          step={frameStepUs}
          value={clampedPlayhead}
          aria-valuetext={timeText}
          onChange={(e) => {
            setPlaying(false);
            setPlayhead(Number(e.target.value));
          }}
          style={{ flex: 1 }}
        />
        <span className="vf-timecode" title="MM:SS:FF / Total Duration">
          {formatTimecode(playhead, project.canvas.fps)} / {usToSec(durationUs).toFixed(1)}s
        </span>
      </div>
    </section>
  );
}
