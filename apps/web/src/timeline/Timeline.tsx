import { useEffect, useRef, useState } from "react";
import { canOverwrite, secToUs, usToSec, type Clip, type Project } from "@vf/schema";
import { getAllCatalogSpecs } from "../generator";
import { onMediaCacheUpdated, resolveAssetThumbnailUrl } from "../mediaCache";
import { useEditor } from "../store";
import { parseWaveformPeaksUri } from "../tts";

function clipLabel(c: Clip, project: Project): string {
  if (c.kind === "text" && c.text) {
    return `"${c.text.text}"`;
  }
  if (c.source) {
    const asset = project.assets[c.source.assetId];
    const parsed = parseWaveformPeaksUri(asset?.waveformPeaksUri);
    if (parsed) {
      const scene = c.sceneId ? project.scenes.find((s) => s.id === c.sceneId) : undefined;
      return `Kokoro (${parsed.voice}) — ${scene?.narration ?? c.id}`;
    }
    const spec = getAllCatalogSpecs().find((s) => s.assetId === c.source?.assetId);
    return spec ? spec.title : c.source.assetId;
  }
  return c.id;
}

interface DragState {
  mode: "move" | "trim-in" | "trim-out";
  clipId: string;
  startClientX: number;
  initialStartUs: number;
  initialDurationUs: number;
  previewDeltaUs: number;
}

export function Timeline() {
  const {
    project,
    pxPerSec,
    selection,
    selectClipAndOpenPanel,
    playhead,
    setPlayhead,
    setPlaying,
    dispatch,
  } = useEditor();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [, setMediaTick] = useState(0);

  useEffect(() => {
    return onMediaCacheUpdated(() => setMediaTick((n) => n + 1));
  }, []);

  const x = (us: number) => usToSec(us) * pxPerSec;

  const maxEndUs = Object.values(project.clips).reduce((m, c) => Math.max(m, c.start + c.duration), secToUs(12));
  const totalWidthPx = Math.max(720, Math.ceil(x(maxEndUs) + 140));
  const totalSecs = Math.ceil(usToSec(maxEndUs) + 1);

  const snapTimeUs = (targetUs: number, clipId: string, trackId: string): number => {
    const thresholdUs = secToUs(10 / pxPerSec); // 10px magnetic snap radius
    const candidates = [0, playhead];
    for (const other of Object.values(project.clips)) {
      if (other.id === clipId) continue;
      if (other.trackId === trackId) {
        candidates.push(other.start, other.start + other.duration);
      }
    }
    let best = Math.max(0, Math.round(targetUs));
    let minDiff = thresholdUs + 1;
    for (const pt of candidates) {
      const diff = Math.abs(targetUs - pt);
      if (diff <= thresholdUs && diff < minDiff) {
        minDiff = diff;
        best = pt;
      }
    }
    return best;
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPlaying(false);
    const updateFromEvent = (clientX: number, el: HTMLDivElement) => {
      const rect = el.getBoundingClientRect();
      const clickX = Math.max(0, clientX - rect.left);
      setPlayhead(secToUs(clickX / pxPerSec));
    };
    updateFromEvent(e.clientX, e.currentTarget);

    const onMove = (moveEvt: PointerEvent) => {
      if (scrollRef.current) {
        const rect = scrollRef.current.getBoundingClientRect();
        const clickX = Math.max(0, moveEvt.clientX - rect.left + scrollRef.current.scrollLeft);
        setPlayhead(secToUs(clickX / pxPerSec));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startClipDrag = (
    e: React.PointerEvent,
    clip: Clip,
    mode: "move" | "trim-in" | "trim-out",
  ) => {
    e.stopPropagation();
    selectClipAndOpenPanel(clip.id);
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked || clip.provenance.locked) return;

    const startClientX = e.clientX;
    const state: DragState = {
      mode,
      clipId: clip.id,
      startClientX,
      initialStartUs: clip.start,
      initialDurationUs: clip.duration,
      previewDeltaUs: 0,
    };
    setDrag(state);

    let latestDeltaUs = 0;

    const onMove = (moveEvt: PointerEvent) => {
      const dxPx = moveEvt.clientX - startClientX;
      let rawDeltaUs = secToUs(dxPx / pxPerSec);
      if (mode === "move") {
        const snappedStart = snapTimeUs(clip.start + rawDeltaUs, clip.id, clip.trackId);
        rawDeltaUs = snappedStart - clip.start;
      } else if (mode === "trim-in") {
        const maxTrimIn = clip.duration - 200_000;
        const minTrimIn = -clip.start;
        rawDeltaUs = Math.max(minTrimIn, Math.min(maxTrimIn, rawDeltaUs));
      } else if (mode === "trim-out") {
        const minTrimOut = -(clip.duration - 200_000);
        rawDeltaUs = Math.max(minTrimOut, rawDeltaUs);
      }
      latestDeltaUs = Math.round(rawDeltaUs);
      setDrag((prev) => (prev ? { ...prev, previewDeltaUs: latestDeltaUs } : null));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);
      if (Math.abs(latestDeltaUs) < 10_000) return; // ignore micro-clicks

      if (mode === "move") {
        dispatch({
          type: "moveClip",
          id: clip.id,
          start: Math.max(0, clip.start + latestDeltaUs),
        });
      } else if (mode === "trim-in") {
        dispatch({
          type: "trimClip",
          id: clip.id,
          edge: "in",
          deltaUs: latestDeltaUs,
        });
      } else if (mode === "trim-out") {
        dispatch({
          type: "trimClip",
          id: clip.id,
          edge: "out",
          deltaUs: latestDeltaUs,
        });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="vf-timeline-shell">
      {/* Sticky Left Track Headers */}
      <div className="vf-track-headers">
        <div className="vf-track-header-ruler">
          <span>Tracks</span>
          <span>M / H / L</span>
        </div>
        {project.tracks.map((t, idx) => (
          <div key={t.id} className="vf-track-header-row" style={{ height: t.height }}>
            <div>
              <div style={{ fontWeight: 600, color: t.hidden ? "#64748b" : "#e2e8f0" }}>{t.name}</div>
              <div style={{ fontSize: 9.5, color: "#64748b", textTransform: "uppercase" }}>{t.kind}</div>
            </div>
            <div className="vf-track-controls">
              <button
                className={`vf-track-toggle ${t.muted ? "is-on" : ""}`}
                title={t.muted ? "Unmute track" : "Mute track"}
                onClick={() =>
                  dispatch({ type: "setProp", path: ["tracks", String(idx), "muted"], value: !t.muted })
                }
              >
                M
              </button>
              <button
                className={`vf-track-toggle ${t.hidden ? "is-on" : ""}`}
                title={t.hidden ? "Show track" : "Hide track"}
                onClick={() =>
                  dispatch({ type: "setProp", path: ["tracks", String(idx), "hidden"], value: !t.hidden })
                }
              >
                H
              </button>
              <button
                className={`vf-track-toggle ${t.locked ? "is-on" : ""}`}
                title={t.locked ? "Unlock track" : "Lock track"}
                onClick={() =>
                  dispatch({ type: "setProp", path: ["tracks", String(idx), "locked"], value: !t.locked })
                }
              >
                L
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable Timeline Lanes */}
      <div
        ref={scrollRef}
        className="vf-timeline-scroll vf-scroller"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
            setPlayhead(secToUs(clickX / pxPerSec));
          }
        }}
      >
        {/* Time ruler */}
        <div
          className="vf-ruler"
          style={{ width: totalWidthPx }}
          onPointerDown={handleRulerPointerDown}
        >
          {Array.from({ length: totalSecs + 1 }, (_, s) => (
            <span
              key={s}
              style={{
                position: "absolute",
                left: s * pxPerSec,
                top: 6,
                paddingLeft: 4,
                borderLeft: "1px solid #2b3a55",
              }}
            >
              {s}s
            </span>
          ))}
        </div>

        {/* Track Lanes */}
        {project.tracks.map((t) => (
          <div
            key={t.id}
            className="vf-track-lane"
            style={{
              height: t.height,
              width: totalWidthPx,
              backgroundSize: `${pxPerSec}px 100%`,
              opacity: t.hidden ? 0.45 : 1,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                setPlayhead(secToUs(clickX / pxPerSec));
              }
            }}
          >
            {Object.values(project.clips)
              .filter((c) => c.trackId === t.id)
              .map((c) => {
                const isSelected = selection.includes(c.id);
                const overwritable = canOverwrite(project, c);

                let displayStart = c.start;
                let displayDuration = c.duration;
                if (drag && drag.clipId === c.id) {
                  if (drag.mode === "move") {
                    displayStart = Math.max(0, c.start + drag.previewDeltaUs);
                  } else if (drag.mode === "trim-in") {
                    displayStart = c.start + drag.previewDeltaUs;
                    displayDuration = c.duration - drag.previewDeltaUs;
                  } else if (drag.mode === "trim-out") {
                    displayDuration = c.duration + drag.previewDeltaUs;
                  }
                }

                let bg = "linear-gradient(180deg, rgba(34, 197, 94, 0.24), rgba(21, 128, 61, 0.22))";
                let borderColor = "rgba(34, 197, 94, 0.55)";
                if (c.provenance.origin === "ai") {
                  if (overwritable) {
                    bg = "linear-gradient(180deg, rgba(56, 189, 248, 0.22), rgba(2, 132, 199, 0.2))";
                    borderColor = "rgba(56, 189, 248, 0.52)";
                  } else {
                    bg = "linear-gradient(180deg, rgba(245, 158, 11, 0.24), rgba(180, 83, 9, 0.2))";
                    borderColor = "rgba(245, 158, 11, 0.58)";
                  }
                }
                const statusTag = c.provenance.locked
                  ? "LOCKED"
                  : c.provenance.origin === "ai"
                    ? c.provenance.userModified
                      ? "AI•EDITED"
                      : "AI"
                    : "USER";

                const asset = c.source ? project.assets[c.source.assetId] : undefined;
                const parsedWave = parseWaveformPeaksUri(asset?.waveformPeaksUri);
                const isVisualMediaClip =
                  c.kind === "media" && t.kind === "video" && asset?.type !== "audio";
                const thumbUrl = isVisualMediaClip
                  ? resolveAssetThumbnailUrl(c.source?.assetId)
                  : undefined;

                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    className={`vf-clip-block ${isSelected ? "is-selected" : ""}`}
                    onPointerDown={(e) => startClipDrag(e, c, "move")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectClipAndOpenPanel(c.id);
                      }
                    }}
                    style={{
                      left: x(displayStart),
                      width: Math.max(12, x(displayDuration)),
                      height: t.height - 10,
                      border: isSelected ? "2px solid #38bdf8" : `1px solid ${borderColor}`,
                      background: bg,
                      boxShadow: isSelected ? "0 0 0 2px rgba(56, 189, 248, 0.25)" : "0 2px 6px rgba(0,0,0,0.35)",
                    }}
                    title={`${clipLabel(c, project)} (${statusTag}) — click to open ${
                      t.kind === "audio" ? "Voice" : t.kind === "text" ? "Text" : "Clip & Stock"
                    } panel`}
                  >
                    {parsedWave && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: "2px 8px",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          opacity: 0.35,
                          pointerEvents: "none",
                        }}
                      >
                        {parsedWave.peaks.slice(0, 32).map((p, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: `${Math.max(12, Math.round(p * 100))}%`,
                              background: "#38bdf8",
                              borderRadius: 1,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div
                      className="vf-clip-handle vf-clip-handle-left"
                      title="Drag left edge to trim In-point"
                      onPointerDown={(e) => startClipDrag(e, c, "trim-in")}
                    />
                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="vf-clip-thumb"
                      />
                    )}
                    <strong style={{ color: overwritable ? "#7dd3fc" : "#fcd34d", fontSize: 10, position: "relative" }}>
                      [{statusTag}]
                    </strong>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", position: "relative" }}>
                      {clipLabel(c, project)}
                    </span>
                    <div
                      className="vf-clip-handle vf-clip-handle-right"
                      title="Drag right edge to trim Out-point"
                      onPointerDown={(e) => startClipDrag(e, c, "trim-out")}
                    />
                  </div>
                );
              })}
          </div>
        ))}

        {/* Playhead Line & Cap */}
        <div className="vf-playhead-line" style={{ left: x(playhead) }}>
          <div className="vf-playhead-cap" />
        </div>
      </div>
    </div>
  );
}
