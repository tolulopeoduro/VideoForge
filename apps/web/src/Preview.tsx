import { useEffect, useRef, useState } from "react";
import type { Canvas2DContextLike } from "@vf/render";
import { secToUs, usToSec } from "@vf/schema";
import { onMediaCacheUpdated } from "./mediaCache";
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

export interface PreviewProps {
  theaterMode?: boolean;
  onToggleTheater?: () => void;
  ttsBusy?: boolean;
  onSynthesizeVoiceover?: () => void;
}

export function Preview({
  theaterMode = false,
  onToggleTheater,
  ttsBusy = false,
  onSynthesizeVoiceover,
}: PreviewProps = {}) {
  const { project, playhead, setPlayhead, playing, setPlaying } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [mediaVersion, setMediaVersion] = useState(0);

  const maxClipEnd = Object.values(project.clips).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
  const durationUs = Math.max(secToUs(5), maxClipEnd);
  const frameStepUs = Math.round(secToUs(1) / project.canvas.fps);
  const clampedPlayhead = Math.min(playhead, durationUs);
  const neuralAudioReady = hasAnyCachedKokoroAudio(project);

  useEffect(() => {
    return onMediaCacheUpdated(() => setMediaVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderPreviewFrame(project, playhead, ctx as unknown as Canvas2DContextLike);
  }, [project, playhead, mediaVersion]);

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
    let lastStoreSyncMs = lastMs;
    let localPlayheadUs = useEditor.getState().playhead;
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
          const startOffsetSec = Math.max(0, Math.min(buf.duration, usToSec(localPlayheadUs)));
          sourceNode.start(0, startOffsetSec);
        }
      } catch {
        // AudioContext blocked or unavailable in headless test env
      }
    }

    const tick = (nowMs: number) => {
      const deltaUs = Math.round((nowMs - lastMs) * 1000);
      lastMs = nowMs;
      localPlayheadUs += deltaUs;
      if (localPlayheadUs >= durationUs) {
        setPlayhead(0);
        setPlaying(false);
        return;
      }

      // Render canvas directly at display frame rate without forcing a full React tree re-render every 8ms
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        renderPreviewFrame(project, localPlayheadUs, ctx as unknown as Canvas2DContextLike);
      }

      // Throttle Zustand/React state updates to ~18Hz (55ms) so Timeline & App stay silky smooth
      if (nowMs - lastStoreSyncMs >= 55) {
        lastStoreSyncMs = nowMs;
        setPlayhead(localPlayheadUs);
      }
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
    <section className="vf-stage-monitor" aria-label="Program Monitor">
      <div className="vf-monitor-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="vf-monitor-label">Program Monitor</span>
          <span className="vf-badge vf-badge-ai" style={{ fontVariantNumeric: "tabular-nums" }}>
            {project.canvas.width}×{project.canvas.height} • {project.canvas.fps}fps
          </span>
          <span
            className="vf-badge"
            style={{
              background: "rgba(34, 197, 94, 0.12)",
              color: "#86efac",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              fontSize: 10.5,
            }}
            title="Browser preview uses 360p low-res proxy videos and low-res proxy images while editing; full-resolution 720p/1080p media is downloaded only when exporting MP4"
          >
            ⚡ Low-Res Proxy Preview (Full-Res on Export)
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {neuralAudioReady ? (
            <span
              style={{
                fontSize: 11,
                fontVariantNumeric: "tabular-nums",
                color: "#22c55e",
              }}
            >
              ● Kokoro-82M 24kHz Audio Ready
            </span>
          ) : onSynthesizeVoiceover ? (
            <button
              type="button"
              className="vf-btn-sm"
              disabled={ttsBusy}
              onClick={onSynthesizeVoiceover}
              title="Run Kokoro-82M neural 24kHz voiceover synthesis on demand"
              style={{ borderColor: "rgba(56, 189, 248, 0.45)", color: "#7dd3fc" }}
            >
              {ttsBusy ? "Synthesizing..." : "🔊 Synthesize 24kHz Voiceover"}
            </button>
          ) : null}
          {onToggleTheater && (
            <button
              type="button"
              className="vf-btn-sm"
              onClick={onToggleTheater}
              aria-pressed={theaterMode}
            >
              {theaterMode ? "Show Panels" : "Theater View"}
            </button>
          )}
        </div>
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
          <div className="vf-monitor-karaoke" aria-label="Kokoro word-level captions">
            {currentSceneWords.map((w, i) => {
              const isSpoken = playhead >= w.start && playhead <= w.end;
              return (
                <span
                  key={`${w.start}_${i}`}
                  className={isSpoken ? "vf-karaoke-word is-spoken" : "vf-karaoke-word"}
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
          type="button"
          className="vf-btn-icon"
          onClick={() => {
            setPlaying(false);
            setPlayhead(0);
          }}
        >
          |&lt;
        </button>
        <button
          type="button"
          className="vf-btn-icon"
          onClick={() => {
            setPlaying(false);
            setPlayhead(Math.max(0, playhead - frameStepUs));
          }}
        >
          -1f
        </button>
        <button
          type="button"
          className="vf-btn-primary"
          onClick={() => setPlaying((p) => !p)}
          style={{ minWidth: 82 }}
        >
          {playing ? "Pause" : "Play"} <span className="vf-kbd">Space</span>
        </button>
        <button
          type="button"
          className="vf-btn-icon"
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
        <span className="vf-timecode">
          {formatTimecode(playhead, project.canvas.fps)} / {usToSec(durationUs).toFixed(1)}s
        </span>
      </div>
    </section>
  );
}
