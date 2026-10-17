import { useEffect, useRef, useState } from "react";
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
  catalogAssetsRecord,
  extractSceneIntent,
  rankShotsForIntent,
  SCRIPT_PRESETS,
  type StockMediaMode,
} from "./generator";
import {
  fetchLiveStockForProject,
  getLoadedMediaEntries,
  getLoadedMediaEntry,
  hydrateAssetById,
  hydrateProjectUploadedAssets,
  onMediaCacheUpdated,
  uploadAndDecodeMediaFile,
} from "./mediaCache";
import { formatTimecode, Preview } from "./Preview";
import { DEFAULT_SCRIPT, useEditor } from "./store";
import { Timeline } from "./timeline/Timeline";
import {
  buildKokoroNeuralVoiceoverOp,
  buildKokoroVoiceoverOp,
  encodeProjectVoiceoverWavBase64,
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
    version,
    syncStatus,
    hydrateFromServer,
    resetDemoProject,
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
  const [preferredMood, setPreferredMood] = useState<string>("auto");
  const [stockMediaMode, setStockMediaMode] = useState<StockMediaMode>("videos_and_photos");
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);
  const [editingSceneText, setEditingSceneText] = useState<string>("");
  const [ttsBusy, setTtsBusy] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<string>("Initializing studio & fetching stock media...");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showEventsLog, setShowEventsLog] = useState(false);
  const [, setMediaTick] = useState(0);

  const lastCompositionEndAtRef = useRef<number | null>(null);
  const addMediaInputRef = useRef<HTMLInputElement | null>(null);
  const replaceMediaInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClipId = selection[0];
  const selectedClip = selectedClipId ? project.clips[selectedClipId] : undefined;
  const selectedScene = selectedClip?.sceneId
    ? project.scenes.find((s) => s.id === selectedClip.sceneId)
    : undefined;

  const count = Object.keys(project.clips).length;
  const uploadedEntries = getLoadedMediaEntries();

  useEffect(() => {
    return onMediaCacheUpdated(() => setMediaTick((t) => t + 1));
  }, []);

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

  const runLiveStockAndKokoro = async (
    targetProject = useEditor.getState().project,
    mode: StockMediaMode = stockMediaMode,
    onlyIfSynthetic = false,
  ) => {
    const state = useEditor.getState();
    setTtsBusy(true);
    try {
      let workingProject = targetProject;
      const hasSyntheticMedia = Object.values(workingProject.clips).some(
        (c) => c.kind === "media" && (c.source?.assetId.startsWith("stock_") ?? false),
      );
      if (mode !== "synthetic_seed" && (!onlyIfSynthetic || hasSyntheticMedia)) {
        const stockOp = await fetchLiveStockForProject(workingProject, mode, setTtsStatus);
        if (stockOp && state.dispatch(stockOp, "ai")) {
          workingProject = useEditor.getState().project;
        }
      }

      const op = await buildKokoroNeuralVoiceoverOp(workingProject, {
        voice: state.kokoroVoice,
        speed: state.kokoroSpeed,
        onProgress: setTtsStatus,
      });
      state.dispatch(op, "ai");
      setTtsStatus(
        `Ready ✓ • Stock (${mode.replace(/_/g, " ")}) + Kokoro-82M (${state.kokoroVoice})`,
      );
    } catch (err) {
      setTtsStatus(`Status error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTtsBusy(false);
    }
  };

  // Hydrate persisted project from backend on startup, then fetch live stock (if still on synthetic seed) + Kokoro-82M audio
  useEffect(() => {
    void (async () => {
      const hydrated = await hydrateFromServer();
      if (hydrated.scenes.length > 0) {
        setScriptText(hydrated.scenes.map((s) => s.narration).join("\n\n"));
      }
      await runLiveStockAndKokoro(hydrated, "videos_and_photos", true);
    })();
  }, []);

  const handleGenerateFromScript = async () => {
    setPlaying(false);
    const scriptOp = buildGenerateFromScriptOp(project, scriptText, { preferredMood });
    if (dispatch(scriptOp, "ai")) {
      const afterScript = useEditor.getState().project;
      const placeholderTtsOp = buildKokoroVoiceoverOp(afterScript, {
        voice: kokoroVoice,
        speed: kokoroSpeed,
      });
      dispatch(placeholderTtsOp, "ai");
      setPlayhead(0);
      await runLiveStockAndKokoro(useEditor.getState().project, stockMediaMode, false);
    }
  };

  const handleSynthesizeKokoroTts = async () => {
    setPlaying(false);
    await runLiveStockAndKokoro(project, "synthetic_seed", false);
  };

  const handleChangeStockMode = async (nextMode: StockMediaMode) => {
    setStockMediaMode(nextMode);
    if (nextMode !== "synthetic_seed") {
      setTtsBusy(true);
      try {
        const stockOp = await fetchLiveStockForProject(useEditor.getState().project, nextMode, setTtsStatus);
        if (stockOp) {
          dispatch(stockOp, "ai");
        }
        setTtsStatus(`Stock media updated (${nextMode.replace(/_/g, " ")}) ✓`);
      } finally {
        setTtsBusy(false);
      }
    }
  };

  const handleUploadNewClip = async (file: File) => {
    setUploadingMedia(true);
    try {
      const { asset, entry } = await uploadAndDecodeMediaFile(file);
      const cur = useEditor.getState().project;
      const v1Clips = Object.values(cur.clips).filter((c) => c.trackId === "v1");
      const start = v1Clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      const clipDuration = Math.min(entry.durationUs, secToUs(6));
      const newClipId = `user_v_${Date.now().toString(36).slice(-4)}`;

      const ok = dispatch(
        {
          type: "batch",
          label: `Upload media ${file.name}`,
          ops: [
            { type: "setProp", path: ["assets", asset.id], value: asset },
            {
              type: "addClip",
              clip: makeClip({
                id: newClipId,
                trackId: "v1",
                kind: "media",
                start,
                duration: clipDuration,
                source: { assetId: asset.id, in: 0, speed: 1 },
                provenance: { origin: "user", locked: false, userModified: true },
              }),
            },
          ],
        },
        "user",
      );
      if (ok) {
        select([newClipId]);
        setPlayhead(start);
      }
    } catch (err) {
      alert(`Media upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleReplaceSelectedWithUpload = async (file: File) => {
    if (!selectedClip || selectedClip.kind !== "media") return;
    setUploadingMedia(true);
    try {
      const { asset, entry } = await uploadAndDecodeMediaFile(file);
      const prevAssetId = selectedClip.source?.assetId;
      const newDuration = Math.min(selectedClip.duration, entry.durationUs);
      const ops: Parameters<typeof dispatch>[0][] = [
        { type: "setProp", path: ["assets", asset.id], value: asset },
      ];
      if (newDuration < selectedClip.duration) {
        ops.push({
          type: "trimClip",
          id: selectedClip.id,
          edge: "out",
          deltaUs: newDuration - selectedClip.duration,
        });
      }
      ops.push({
        type: "replaceMedia",
        clipId: selectedClip.id,
        assetId: asset.id,
        in: 0,
      });

      if (dispatch({ type: "batch", label: `Replace clip with upload ${file.name}`, ops }, "user")) {
        logEditEvent("replaced_upload", selectedClip.sceneId, {
          clipId: selectedClip.id,
          previousAssetId: prevAssetId,
          uploadedAssetId: asset.id,
          fileName: file.name,
        });
      }
    } catch (err) {
      alert(`Media replace failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSaveSceneEdit = async (idx: number) => {
    const scene = project.scenes[idx];
    const trimmed = editingSceneText.trim();
    if (!scene || !trimmed) {
      setEditingSceneIdx(null);
      return;
    }
    const nextIntent = extractSceneIntent(trimmed, preferredMood);
    const ok = dispatch(
      {
        type: "batch",
        label: `Edit scene ${idx + 1} narration and intent`,
        ops: [
          { type: "setProp", path: ["scenes", String(idx), "narration"], value: trimmed },
          { type: "setProp", path: ["scenes", String(idx), "intent"], value: nextIntent },
        ],
      },
      "user",
    );
    if (ok) {
      logEditEvent("intent_edited", scene.id, {
        previousNarration: scene.narration,
        newNarration: trimmed,
        keywords: nextIntent.keywords,
        mood: nextIntent.mood,
      });
      setEditingSceneIdx(null);
      const updated = useEditor.getState().project;
      setScriptText(updated.scenes.map((s) => s.narration).join("\n\n"));
      await runLiveStockAndKokoro(updated, stockMediaMode, false);
    }
  };

  const handleExportMp4 = async () => {
    setPlaying(false);
    setExporting(true);
    try {
      const curProject = useEditor.getState().project;
      const maxEndUs = Object.values(curProject.clips).reduce(
        (m, c) => Math.max(m, c.start + c.duration),
        secToUs(5),
      );
      const audioWavBase64 = encodeProjectVoiceoverWavBase64(curProject, maxEndUs);
      const res = await fetch("/api/export/mp4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: curProject,
          audioWavBase64,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${curProject.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "videoforge"}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`MP4 Export Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleRegenerateScene = (sceneId: string) => {
    const op = buildRegenerateSceneOp(project, sceneId);
    if (op && dispatch(op, "ai")) {
      void hydrateProjectUploadedAssets(useEditor.getState().project);
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
      {/* Hidden File Inputs for Real Video/Image Upload */}
      <input
        ref={addMediaInputRef}
        type="file"
        accept="video/*,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUploadNewClip(f);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceMediaInputRef}
        type="file"
        accept="video/*,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleReplaceSelectedWithUpload(f);
          e.target.value = "";
        }}
      />

      {/* Studio Top Header */}
      <header className="vf-header">
        <div>
          <div className="vf-title-row">
            <span className="vf-logo-badge">VF</span>
            <h1 className="vf-title">{project.meta.title}</h1>
            <span
              className="vf-badge"
              style={{
                background: syncStatus === "synced" ? "rgba(34, 197, 94, 0.14)" : "rgba(56, 189, 248, 0.14)",
                color: syncStatus === "synced" ? "#86efac" : "#7dd3fc",
                border: `1px solid ${syncStatus === "synced" ? "rgba(34, 197, 94, 0.35)" : "rgba(56, 189, 248, 0.35)"}`,
              }}
              title="Project ops and edit_events are persisted to backend storage across page reloads"
            >
              {syncStatus === "synced"
                ? `Persisted v${version} ✓`
                : syncStatus === "syncing"
                  ? `Syncing v${version}...`
                  : `Local v${version}`}
            </span>
          </div>
          <p className="vf-subtitle">
            Script-to-Video NLE • Pixabay + Wikimedia Stock Videos/Photos • Kokoro-82M Voiceover • Persistent Ops
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
          <button
            className="vf-btn-sm"
            onClick={() => setShowEventsLog((s) => !s)}
            title="Inspect persisted edit_events ranking feedback log"
          >
            Edit Events (<strong style={{ color: "#38bdf8" }}>{editEvents.length}</strong>)
          </button>
          <button onClick={undo} disabled={!past.length} title="Undo last operation (Cmd/Ctrl+Z)">
            Undo ({past.length}) <span className="vf-kbd">⌘Z</span>
          </button>
          <button onClick={redo} disabled={!future.length} title="Redo operation (Shift+Cmd/Ctrl+Z)">
            Redo ({future.length}) <span className="vf-kbd">⇧⌘Z</span>
          </button>
          <button
            className="vf-btn-sm"
            onClick={() => {
              void (async () => {
                const fresh = await resetDemoProject();
                setScriptText(fresh.scenes.map((s) => s.narration).join("\n\n"));
                await runLiveStockAndKokoro(fresh, stockMediaMode, false);
              })();
            }}
            title="Reset project to clean default state"
          >
            Reset Demo
          </button>
          <button
            className="vf-btn-primary"
            onClick={() => void handleExportMp4()}
            disabled={exporting || count === 0}
            title="Render frames via shared renderFrame + FFmpeg and download H.264 MP4 with Kokoro-82M audio"
          >
            {exporting ? "Exporting MP4..." : "Export MP4"}
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

      {showEventsLog && (
        <section className="vf-panel" aria-label="Persisted edit_events log">
          <div className="vf-panel-title">
            <span>Persisted Ranking Feedback Log (`edit_events`)</span>
            <button className="vf-btn-sm" onClick={() => setShowEventsLog(false)}>
              Close
            </button>
          </div>
          {editEvents.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              No edit events logged yet. Swap a clip candidate, upload replacement footage, or edit a scene&apos;s script to log training events.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {editEvents.slice(0, 20).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11.5,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <span className="vf-badge vf-badge-ai" style={{ marginRight: 8 }}>
                      {ev.event}
                    </span>
                    {ev.sceneId && (
                      <strong style={{ color: "#e2e8f0", marginRight: 8 }}>{ev.sceneId}</strong>
                    )}
                    <code style={{ color: "#94a3b8", fontSize: 11 }}>{JSON.stringify(ev.payload)}</code>
                  </div>
                  <span style={{ color: "#64748b", fontSize: 10.5 }}>
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="vf-workspace-grid">
        {/* Left Dock: Script-to-First-Cut Prompt Box + Stock Provider Controls + Kokoro TTS */}
        <section className="vf-panel">
          <div className="vf-panel-title">
            <span>1. Script-to-First-Cut Prompt &amp; Scene Director</span>
            <span className="vf-badge vf-badge-ai">{project.scenes.length} scenes</span>
          </div>

          {/* Preset Script Templates & Mood Selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor="script-preset-select" style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
              Preset:
            </label>
            <select
              id="script-preset-select"
              className="vf-select"
              defaultValue=""
              onChange={(e) => {
                const preset = SCRIPT_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  setScriptText(preset.script);
                  setPreferredMood(preset.mood);
                }
              }}
              style={{ flex: 1, minWidth: 155 }}
            >
              <option value="" disabled>
                Load sample script template...
              </option>
              {SCRIPT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            <label htmlFor="script-mood-select" style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
              Mood:
            </label>
            <select
              id="script-mood-select"
              className="vf-select"
              value={preferredMood}
              onChange={(e) => setPreferredMood(e.target.value)}
              style={{ width: 102 }}
            >
              <option value="auto">Auto</option>
              <option value="energetic">Energetic</option>
              <option value="optimistic">Optimistic</option>
              <option value="focused">Focused</option>
              <option value="futuristic">Futuristic</option>
              <option value="inspiring">Inspiring</option>
              <option value="calm">Calm</option>
              <option value="warm">Warm</option>
            </select>
          </div>

          {/* Stock Media Source Selector (Default: Pixabay + Wikimedia Videos & Photos) */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
              padding: "6px 10px",
              borderRadius: 8,
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <label htmlFor="stock-mode-select" style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>
              Stock Media:
            </label>
            <select
              id="stock-mode-select"
              className="vf-select"
              value={stockMediaMode}
              onChange={(e) => void handleChangeStockMode(e.target.value as StockMediaMode)}
              style={{ flex: 1 }}
            >
              <option value="videos_and_photos">Pixabay + Wikimedia (Videos &amp; Photos • Default)</option>
              <option value="videos_only">Pixabay Stock Videos Only</option>
              <option value="photos_only">Pixabay + Wikimedia Photos Only</option>
              <option value="wikimedia_only">Wikimedia Commons Only (Public Domain/CC)</option>
              <option value="synthetic_seed">Offline Synthetic Seed Only</option>
            </select>
          </div>

          {/* Script Prompt Form (modern-web-guidance: form-fields-automatically-fit-contents + ime-safe-enter-submit) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleGenerateFromScript();
            }}
          >
            <label
              htmlFor="script-prompt-textarea"
              style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}
            >
              Narration Script (multi-paragraph • press Enter to generate, Shift+Enter for newline):
            </label>
            <textarea
              id="script-prompt-textarea"
              className="vf-script-textarea"
              aria-label="Narration script"
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              onCompositionEnd={(event) => {
                lastCompositionEndAtRef.current = event.timeStamp;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (event.nativeEvent.isComposing || event.keyCode === 229) {
                    return;
                  }
                  if (
                    lastCompositionEndAtRef.current !== null &&
                    Math.abs(event.timeStamp - lastCompositionEndAtRef.current) < 50
                  ) {
                    return;
                  }
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Write or paste a multi-paragraph narration script here (each sentence/paragraph becomes a scene)..."
              style={{ marginBottom: 10 }}
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
                type="submit"
                className="vf-btn-primary"
                disabled={ttsBusy}
                style={{ flex: 1 }}
              >
                {ttsBusy ? "Fetching Stock & TTS..." : "Generate First Cut + Stock + TTS"}
              </button>
              <button
                type="button"
                onClick={() => void handleSynthesizeKokoroTts()}
                disabled={ttsBusy}
                title="Re-synthesize Kokoro-82M voiceover on unlocked scenes"
              >
                Re-Synthesize TTS
              </button>
            </div>
          </form>

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
              const isEditingThis = editingSceneIdx === idx;
              const activeAssetId = firstMediaClip?.source?.assetId ?? "";
              const activeAsset = project.assets[activeAssetId];

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
                        ({usToSec(sceneStartUs).toFixed(1)}s • {activeAsset?.license?.provider ?? activeAsset?.origin ?? "stock"})
                      </span>
                    </button>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button
                        className="vf-btn-sm"
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingSceneIdx(null);
                          } else {
                            setEditingSceneIdx(idx);
                            setEditingSceneText(scene.narration);
                          }
                        }}
                      >
                        {isEditingThis ? "Cancel" : "Edit Line"}
                      </button>
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

                  {isEditingThis ? (
                    <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                      <input
                        type="text"
                        value={editingSceneText}
                        onChange={(e) => setEditingSceneText(e.target.value)}
                        aria-label={`Edit Scene ${idx + 1} narration`}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="vf-btn-primary vf-btn-sm"
                        onClick={() => void handleSaveSceneEdit(idx)}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "#e2e8f0", marginBottom: 7, lineHeight: 1.45 }}>{scene.narration}</div>
                  )}

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
                {selectedClip.kind === "media" && (
                  <button
                    className="vf-btn-primary vf-btn-sm"
                    disabled={uploadingMedia}
                    onClick={() => replaceMediaInputRef.current?.click()}
                    title="Upload a local .mp4/.webm/.png/.jpg file to replace this clip and log replaced_upload"
                  >
                    {uploadingMedia ? "Decoding Media..." : "Upload & Replace Footage..."}
                  </button>
                )}
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
                    Matched Pixabay, Wikimedia &amp; Uploaded Candidates (Selecting logs `edit_events` &amp; protects clip):
                  </div>
                  <div className="vf-candidate-grid">
                    {rankedCandidates.slice(0, 6).map(({ spec, score }) => {
                      const isCurrent = selectedClip.source?.assetId === spec.assetId;
                      const loadedEntry = getLoadedMediaEntry(spec.assetId);
                      const thumbSrc = loadedEntry?.thumbnailUrl ?? spec.previewThumbUrl;
                      const badgePrefix = spec.isUpload
                        ? "📁"
                        : spec.provider === "pixabay"
                          ? spec.kind === "video"
                            ? "🎬"
                            : "📷"
                          : spec.provider === "wikimedia"
                            ? "🌐"
                            : "🎞️";
                      return (
                        <button
                          key={spec.assetId}
                          className={`vf-candidate-card ${isCurrent ? "is-current" : ""}`}
                          onClick={() => {
                            const prevAsset = selectedClip.source?.assetId;
                            const allCatalogAssets = catalogAssetsRecord();
                            const ops: Parameters<typeof dispatch>[0][] = [];
                            if (!project.assets[spec.assetId] && allCatalogAssets[spec.assetId]) {
                              ops.push({
                                type: "setProp",
                                path: ["assets", spec.assetId],
                                value: allCatalogAssets[spec.assetId],
                              });
                            }
                            ops.push({
                              type: "replaceMedia",
                              clipId: selectedClip.id,
                              assetId: spec.assetId,
                              in: 0,
                            });
                            if (
                              dispatch(
                                ops.length === 1 ? ops[0]! : { type: "batch", ops, label: "Replace clip candidate" },
                                "user",
                              )
                            ) {
                              if (spec.isLiveStock) {
                                void hydrateAssetById(spec.assetId, spec.kind ?? "video", spec.title);
                              }
                              logEditEvent(
                                isCurrent ? "kept" : spec.isUpload ? "replaced_upload" : "replaced_candidate",
                                selectedClip.sceneId,
                                {
                                  clipId: selectedClip.id,
                                  previousAssetId: prevAsset,
                                  chosenAssetId: spec.assetId,
                                  provider: spec.provider ?? "seed",
                                  score,
                                },
                              );
                            }
                          }}
                        >
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={spec.title}
                              style={{
                                width: "100%",
                                height: 42,
                                objectFit: "cover",
                                borderRadius: 4,
                                marginBottom: 2,
                              }}
                            />
                          ) : (
                            <div
                              className="vf-candidate-swatch"
                              style={{
                                background: `linear-gradient(90deg, #38bdf8 ${Math.round(score * 100)}%, #1e293b ${Math.round(score * 100)}%)`,
                              }}
                            />
                          )}
                          <div style={{ fontWeight: 600, fontSize: 11.5, color: "#f8fafc" }}>
                            {badgePrefix} {spec.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: isCurrent ? "#38bdf8" : "#94a3b8" }}>
                            Match {(score * 100).toFixed(0)}% • {spec.provider ?? spec.mood}{" "}
                            {isCurrent ? "• Active" : ""}
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
              <span className="vf-kbd">S</span>), or swap between Pixabay videos/photos, Wikimedia Commons, and your uploads.
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
            <button
              className="vf-btn-primary vf-btn-sm"
              disabled={uploadingMedia}
              onClick={() => addMediaInputRef.current?.click()}
              title="Upload a local .mp4/.webm/.png/.jpg file, decode real frames into the canvas preview, and append to V1"
            >
              {uploadingMedia
                ? "Decoding Upload..."
                : `+ Upload Video / Image${uploadedEntries.length ? ` (${uploadedEntries.length})` : ""}`}
            </button>
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
              {pxPerSec} px/s
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
