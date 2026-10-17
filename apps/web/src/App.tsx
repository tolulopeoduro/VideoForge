import { useEffect, useState } from "react";
import {
  canOverwrite,
  defaultTransform,
  evalProp,
  makeClip,
  regenerableClips,
  rippleDelete,
  secToUs,
  usToSec,
} from "@vf/schema";
import {
  buildGenerateFromScriptOp,
  buildRegenerateSceneOp,
  rankShotsForIntent,
} from "./generator";
import { formatTimecode, Preview } from "./Preview";
import { DEFAULT_SCRIPT, useEditor } from "./store";
import { Timeline } from "./timeline/Timeline";
import {
  buildKokoroNeuralVoiceoverOp,
  buildKokoroVoiceoverOp,
  KOKORO_VOICES,
  type KokoroVoiceId,
} from "./tts";

export function App() {
  const {
    dispatch,
    undo,
    redo,
    selection,
    select,
    project,
    playhead,
    setPlayhead,
    setPlaying,
    pxPerSec,
    setPxPerSec,
    kokoroVoice,
    setKokoroVoice,
    kokoroSpeed,
    setKokoroSpeed,
    past,
    future,
    editEvents,
    logEditEvent,
    lastError,
    clearError,
  } = useEditor();

  const [scriptText, setScriptText] = useState(DEFAULT_SCRIPT);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<string>("Initializing Kokoro-82M neural TTS...");
  const selectedClipId = selection[0];
  const selectedClip = selectedClipId ? project.clips[selectedClipId] : undefined;
  const selectedScene = selectedClip?.sceneId
    ? project.scenes.find((s) => s.id === selectedClip.sceneId)
    : undefined;

  const count = Object.keys(project.clips).length;

  const splitSelected = () => {
    const state = useEditor.getState();
    const clipId = state.selection[0];
    const clip = clipId ? state.project.clips[clipId] : undefined;
    if (!clip) return;
    const splitAt =
      state.playhead > clip.start && state.playhead < clip.start + clip.duration
        ? state.playhead
        : clip.start + Math.floor(clip.duration / 2);
    state.dispatch({
      type: "splitClip",
      id: clip.id,
      at: splitAt,
      newId: `${clip.id}_b_${Date.now().toString(36).slice(-3)}`,
    });
  };

  const rippleDeleteSelected = () => {
    const state = useEditor.getState();
    const clipId = state.selection[0];
    const clip = clipId ? state.project.clips[clipId] : undefined;
    if (!clip) return;
    if (state.dispatch(rippleDelete(state.project, clip.id), "user")) {
      state.select([]);
    }
  };

  // Global NLE keyboard shortcuts when not typing in inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const state = useEditor.getState();
      const frameStepUs = Math.round(secToUs(1) / state.project.canvas.fps);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        state.redo();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        state.setPlaying((p) => !p);
        return;
      }
      if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        splitSelected();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        rippleDeleteSelected();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        state.setPlaying(false);
        state.setPlayhead(Math.max(0, state.playhead - frameStepUs));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        state.setPlaying(false);
        state.setPlayhead(state.playhead + frameStepUs);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runNeuralKokoroSynthesis = async (targetProject = useEditor.getState().project) => {
    const state = useEditor.getState();
    setTtsBusy(true);
    try {
      const op = await buildKokoroNeuralVoiceoverOp(targetProject, {
        voice: state.kokoroVoice,
        speed: state.kokoroSpeed,
        onProgress: setTtsStatus,
      });
      state.dispatch(op, "ai");
      setTtsStatus(`Kokoro-82M (${state.kokoroVoice}) neural audio ready ✓`);
    } catch (err) {
      setTtsStatus(`Kokoro-82M error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTtsBusy(false);
    }
  };

  // Automatically synthesize neural Kokoro-82M voiceover on initial studio load
  useEffect(() => {
    void runNeuralKokoroSynthesis(useEditor.getState().project);
  }, []);

  const handleGenerateFromScript = async () => {
    setPlaying(false);
    const scriptOp = buildGenerateFromScriptOp(project, scriptText);
    if (dispatch(scriptOp, "ai")) {
      const afterScript = useEditor.getState().project;
      const placeholderTtsOp = buildKokoroVoiceoverOp(afterScript, {
        voice: kokoroVoice,
        speed: kokoroSpeed,
      });
      dispatch(placeholderTtsOp, "ai");
      setPlayhead(0);
      await runNeuralKokoroSynthesis(useEditor.getState().project);
    }
  };

  const handleSynthesizeKokoroTts = async () => {
    setPlaying(false);
    await runNeuralKokoroSynthesis(project);
  };

  const handleRegenerateScene = (sceneId: string) => {
    const op = buildRegenerateSceneOp(project, sceneId);
    if (op) {
      dispatch(op, "ai");
    }
  };

  const handleToggleSceneLock = (sceneIdx: number, currentLocked: boolean) => {
    dispatch({ type: "setProp", path: ["scenes", String(sceneIdx), "locked"], value: !currentLocked }, "user");
  };

  const addDemoClip = () => {
    const v1Clips = Object.values(project.clips).filter((c) => c.trackId === "v1");
    const start = v1Clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const assetId = count % 2 === 0 ? "a1" : "a2";
    dispatch(
      {
        type: "addClip",
        clip: makeClip({
          id: `clip_${count + 1}`,
          trackId: "v1",
          start,
          duration: secToUs(3),
          source: { assetId, in: 0, speed: 1 },
          provenance: { origin: "ai", locked: false, userModified: false },
        }),
      },
      "ai",
    );
  };

  const addDemoText = () => {
    const t1Clips = Object.values(project.clips).filter((c) => c.trackId === "t1");
    const start = t1Clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    dispatch(
      {
        type: "addClip",
        clip: makeClip({
          id: `text_${count + 1}`,
          trackId: "t1",
          kind: "text",
          start,
          duration: secToUs(3),
          text: {
            text: `Scene Title ${count + 1}`,
            fontFamily: "sans-serif",
            fontSize: 56,
            color: "#ffffff",
            align: "center",
          },
          transform: {
            ...defaultTransform(),
            y: { value: 0.25 },
            scale: {
              keys: [
                { t: 0, v: 0.7, ease: "linear" },
                { t: secToUs(2), v: 1.15, ease: "linear" },
              ],
            },
          },
        }),
      },
      "user",
    );
  };

  const rankedCandidates = selectedClip
    ? rankShotsForIntent(selectedScene?.intent ?? { literal: "", keywords: [] })
    : [];

  return (
    <main className="vf-app">
      {/* Studio Top Header */}
      <header className="vf-header">
        <div>
          <div className="vf-title-row">
            <span className="vf-logo-badge">VF</span>
            <h1 className="vf-title">{project.meta.title}</h1>
          </div>
          <p className="vf-subtitle">
            Script-to-Video NLE • Kokoro-82M Voiceover • User edits protect AI clips from regeneration
          </p>
        </div>

        <div className="vf-header-metrics">
          <div className="vf-metric-pill" title="Current playhead timecode">
            <span>TC</span>
            <strong>{formatTimecode(playhead, project.canvas.fps)}</strong>
          </div>
          <div className="vf-metric-pill" title="Total timeline clips">
            <span>Clips</span>
            <strong>{count}</strong>
          </div>
          <div className="vf-metric-pill" title="Edit events logged for ranking training">
            <span>Edit Events</span>
            <strong style={{ color: "#38bdf8" }}>{editEvents.length}</strong>
          </div>
          <button onClick={undo} disabled={!past.length} title="Undo last operation (Cmd/Ctrl+Z)">
            Undo ({past.length}) <span className="vf-kbd">⌘Z</span>
          </button>
          <button onClick={redo} disabled={!future.length} title="Redo operation (Shift+Cmd/Ctrl+Z)">
            Redo ({future.length}) <span className="vf-kbd">⇧⌘Z</span>
          </button>
        </div>
      </header>

      {lastError && (
        <div className="vf-alert-error" role="alert">
          <span>
            <strong>Invariant Guard Blocked Op:</strong> {lastError}
          </span>
          <button className="vf-btn-sm" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="vf-workspace-grid">
        {/* Left Dock: Script Input + Kokoro TTS + AI Scene Breakdown */}
        <section className="vf-panel">
          <div className="vf-panel-title">
            <span>1. Script, Kokoro-82M TTS &amp; Scene Director</span>
            <span className="vf-badge vf-badge-ai">{project.scenes.length} scenes</span>
          </div>
          <textarea
            aria-label="Narration script"
            rows={4}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Write your narration script here (one sentence per scene)..."
            style={{ width: "100%", marginBottom: 10 }}
          />

          {/* Kokoro-82M Voice & Speed Controls */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <label htmlFor="kokoro-voice-select" style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>
              Kokoro Voice:
            </label>
            <select
              id="kokoro-voice-select"
              name="kokoroVoice"
              className="vf-select"
              value={kokoroVoice}
              onChange={(e) => setKokoroVoice(e.target.value as KokoroVoiceId)}
              style={{ flex: 1, minWidth: 145 }}
            >
              {KOKORO_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} [{v.id}]
                </option>
              ))}
            </select>

            <label htmlFor="kokoro-speed-select" style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>
              Pace:
            </label>
            <select
              id="kokoro-speed-select"
              name="kokoroSpeed"
              className="vf-select"
              value={String(kokoroSpeed)}
              onChange={(e) => setKokoroSpeed(Number(e.target.value))}
              style={{ width: 78 }}
            >
              <option value="0.85">0.85×</option>
              <option value="1">1.00×</option>
              <option value="1.15">1.15×</option>
            </select>
          </div>

          <div
            style={{
              fontSize: 11,
              color: ttsBusy ? "#38bdf8" : "#86efac",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            aria-live="polite"
          >
            <span>{ttsStatus}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              className="vf-btn-primary"
              onClick={() => void handleGenerateFromScript()}
              disabled={ttsBusy}
              style={{ flex: 1 }}
            >
              {ttsBusy ? "Synthesizing..." : "Generate First Cut + TTS"}
            </button>
            <button
              onClick={() => void handleSynthesizeKokoroTts()}
              disabled={ttsBusy}
              title="Re-synthesize Kokoro-82M voiceover on unlocked scenes"
            >
              Re-Synthesize TTS
            </button>
          </div>

          <div className="vf-scene-list vf-scroller">
            {project.scenes.map((scene, idx) => {
              const sceneClips = scene.clipIds
                .map((id) => project.clips[id])
                .filter((c): c is NonNullable<typeof c> => Boolean(c));
              const firstMediaClip = sceneClips.find((c) => c.kind === "media") ?? sceneClips[0];
              const sceneStartUs = firstMediaClip?.start ?? 0;
              const sceneEndUs = firstMediaClip ? firstMediaClip.start + firstMediaClip.duration : 0;
              const isPlayheadInScene =
                firstMediaClip !== undefined && playhead >= sceneStartUs && playhead < sceneEndUs;
              const isSelectedScene = selectedScene?.id === scene.id || isPlayheadInScene;
              const regenCount = regenerableClips(project, scene.id).filter((c) => c.kind === "media").length;

              return (
                <div
                  key={scene.id}
                  className={`vf-scene-card ${scene.locked ? "is-locked" : ""} ${isSelectedScene ? "is-active" : ""}`}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <button
                      className="vf-btn-sm"
                      style={{ background: "transparent", border: "none", padding: 0, fontWeight: 700, fontSize: 12 }}
                      onClick={() => {
                        if (firstMediaClip) {
                          setPlayhead(firstMediaClip.start);
                          select([firstMediaClip.id]);
                        }
                      }}
                      title="Jump playhead to scene & select clip"
                    >
                      Scene {idx + 1} {scene.locked ? "🔒" : ""}{" "}
                      <span style={{ color: "#64748b", fontWeight: 400 }}>
                        ({usToSec(sceneStartUs).toFixed(1)}s)
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="vf-btn-sm"
                        onClick={() => handleToggleSceneLock(idx, scene.locked)}
                      >
                        {scene.locked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        className="vf-btn-sm"
                        onClick={() => handleRegenerateScene(scene.id)}
                        disabled={scene.locked || regenCount === 0}
                        title={
                          regenCount === 0
                            ? "All media clips in this scene are user-modified or locked (canOverwrite = false)"
                            : "Cycle to next ranked AI shot for untouched clips"
                        }
                      >
                        Swap AI Shot ({regenCount})
                      </button>
                    </div>
                  </div>
                  <div style={{ color: "#e2e8f0", marginBottom: 7, lineHeight: 1.45 }}>{scene.narration}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {scene.intent.keywords.map((kw) => (
                      <span key={kw} className="vf-keyword-tag">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Dock: Program Monitor + Selected Clip Inspector */}
        <div className="vf-right-column">
          <Preview />

          {selectedClip ? (
            <section className="vf-panel">
              <div className="vf-panel-title">
                <span>
                  3. Clip Inspector: <strong style={{ color: "#f8fafc" }}>{selectedClip.id}</strong> (
                  {selectedClip.kind})
                </span>
                <span
                  className={`vf-badge ${
                    canOverwrite(project, selectedClip)
                      ? "vf-badge-ai"
                      : selectedClip.provenance.origin === "user"
                        ? "vf-badge-user"
                        : "vf-badge-protected"
                  }`}
                >
                  {canOverwrite(project, selectedClip)
                    ? "AI • Overwritable"
                    : selectedClip.provenance.locked
                      ? "Locked • Protected"
                      : selectedClip.provenance.origin === "user"
                        ? "User Clip • Protected"
                        : "User Modified • Protected"}
                </span>
              </div>

              {/* Clip Metadata Readout */}
              <div className="vf-inspector-grid">
                <div className="vf-prop-box">
                  <span>Timeline Range</span>
                  <strong>
                    {usToSec(selectedClip.start).toFixed(2)}s –{" "}
                    {usToSec(selectedClip.start + selectedClip.duration).toFixed(2)}s
                  </strong>
                </div>
                <div className="vf-prop-box">
                  <span>Duration</span>
                  <strong>{usToSec(selectedClip.duration).toFixed(2)}s</strong>
                </div>
                <div className="vf-prop-box">
                  <span>Opacity @ Playhead</span>
                  <strong>
                    {Math.round(
                      evalProp(selectedClip.transform.opacity, Math.max(0, playhead - selectedClip.start)) * 100,
                    )}
                    %
                  </strong>
                </div>
              </div>

              {/* Clip Action Toolbar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                <button
                  className="vf-btn-sm"
                  onClick={() =>
                    dispatch({
                      type: "setProp",
                      path: ["clips", selectedClip.id, "provenance", "locked"],
                      value: !selectedClip.provenance.locked,
                    })
                  }
                >
                  {selectedClip.provenance.locked ? "Unlock Clip" : "Lock Clip"}
                </button>
                <button
                  className="vf-btn-sm"
                  onClick={() =>
                    dispatch({
                      type: "moveClip",
                      id: selectedClip.id,
                      start: Math.max(0, selectedClip.start - 500_000),
                    })
                  }
                >
                  Move -0.5s
                </button>
                <button
                  className="vf-btn-sm"
                  onClick={() =>
                    dispatch({
                      type: "moveClip",
                      id: selectedClip.id,
                      start: selectedClip.start + 500_000,
                    })
                  }
                >
                  Move +0.5s
                </button>
                <button
                  className="vf-btn-sm"
                  onClick={() =>
                    dispatch({
                      type: "trimClip",
                      id: selectedClip.id,
                      edge: "out",
                      deltaUs: -500_000,
                    })
                  }
                >
                  Trim Out -0.5s
                </button>
                <button
                  className="vf-btn-sm"
                  onClick={() =>
                    dispatch({
                      type: "trimClip",
                      id: selectedClip.id,
                      edge: "out",
                      deltaUs: 500_000,
                    })
                  }
                >
                  Trim Out +0.5s
                </button>
                <button className="vf-btn-sm" onClick={splitSelected} title="Split clip at playhead or midpoint (S)">
                  Split Clip <span className="vf-kbd">S</span>
                </button>
                <button
                  className="vf-btn-danger vf-btn-sm"
                  onClick={rippleDeleteSelected}
                  title="Ripple delete selected clip (Delete)"
                >
                  Ripple Delete <span className="vf-kbd">⌫</span>
                </button>
              </div>

              {selectedClip.kind === "text" && selectedClip.text && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <label htmlFor="clip-text-input" style={{ fontSize: 12, color: "#94a3b8" }}>
                    Caption Text:
                  </label>
                  <input
                    id="clip-text-input"
                    type="text"
                    value={selectedClip.text.text}
                    onChange={(e) =>
                      dispatch({
                        type: "setProp",
                        path: ["clips", selectedClip.id, "text", "text"],
                        value: e.target.value,
                      })
                    }
                    style={{ flex: 1 }}
                  />
                </div>
              )}

              {selectedClip.kind === "media" && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}>
                    Matched Stock Candidates (Selecting logs `edit_events` &amp; protects clip from AI overwrite):
                  </div>
                  <div className="vf-candidate-grid">
                    {rankedCandidates.slice(0, 6).map(({ spec, score }) => {
                      const isCurrent = selectedClip.source?.assetId === spec.assetId;
                      return (
                        <button
                          key={spec.assetId}
                          className={`vf-candidate-card ${isCurrent ? "is-current" : ""}`}
                          onClick={() => {
                            const prevAsset = selectedClip.source?.assetId;
                            if (
                              dispatch(
                                {
                                  type: "replaceMedia",
                                  clipId: selectedClip.id,
                                  assetId: spec.assetId,
                                  in: 0,
                                },
                                "user",
                              )
                            ) {
                              logEditEvent(isCurrent ? "kept" : "replaced_candidate", selectedClip.sceneId, {
                                clipId: selectedClip.id,
                                previousAssetId: prevAsset,
                                chosenAssetId: spec.assetId,
                                score,
                              });
                            }
                          }}
                        >
                          <div
                            className="vf-candidate-swatch"
                            style={{
                              background: `linear-gradient(90deg, #38bdf8 ${Math.round(score * 100)}%, #1e293b ${Math.round(score * 100)}%)`,
                            }}
                          />
                          <div style={{ fontWeight: 600, fontSize: 11.5, color: "#f8fafc" }}>{spec.title}</div>
                          <div style={{ fontSize: 10.5, color: isCurrent ? "#38bdf8" : "#94a3b8" }}>
                            Match {(score * 100).toFixed(0)}% • {spec.mood} {isCurrent ? "• Active" : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <div
              className="vf-panel"
              style={{
                fontSize: 12.5,
                color: "#94a3b8",
                textAlign: "center",
                padding: "16px",
              }}
            >
              Select any clip on the timeline below to inspect properties, drag to move/trim, split (
              <span className="vf-kbd">S</span>), or swap its AI-matched footage.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Dock: Multi-Track Timeline */}
      <section className="vf-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#94a3b8",
                marginRight: 6,
              }}
            >
              4. Multi-Track Timeline
            </span>
            <button className="vf-btn-sm" onClick={addDemoClip}>
              + Add AI Clip
            </button>
            <button className="vf-btn-sm" onClick={addDemoText}>
              + Add Text Overlay
            </button>
            <button className="vf-btn-sm" onClick={splitSelected} disabled={!selection.length}>
              Split <span className="vf-kbd">S</span>
            </button>
            <button
              className="vf-btn-danger vf-btn-sm"
              onClick={rippleDeleteSelected}
              disabled={!selection.length}
            >
              Ripple Delete <span className="vf-kbd">⌫</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#94a3b8" }}>
            <span>Zoom:</span>
            <button
              className="vf-btn-icon"
              onClick={() => setPxPerSec(pxPerSec - 20)}
              title="Zoom Out Timeline"
            >
              −
            </button>
            <span style={{ minWidth: 52, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {pxPerSec}px/s
            </span>
            <button
              className="vf-btn-icon"
              onClick={() => setPxPerSec(pxPerSec + 20)}
              title="Zoom In Timeline"
            >
              +
            </button>
          </div>
        </div>

        <Timeline />
      </section>
    </main>
  );
}
