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
  getAllCatalogSpecs,
  rankShotsForIntent,
  SCRIPT_PRESETS,
  type StockMediaMode,
  type StockShotSpec,
} from "./generator";
import {
  fetchLiveStockCandidatesForScene,
  fetchLiveStockForProject,
  getLoadedMediaEntries,
  hydrateAssetById,
  hydrateProjectUploadedAssets,
  onMediaCacheUpdated,
  resolveAssetThumbnailUrl,
  searchCustomStockCandidates,
  uploadAndDecodeMediaFile,
} from "./mediaCache";
import { formatTimecode, Preview } from "./Preview";
import { DEFAULT_SCRIPT, useEditor, type SidebarPanelId } from "./store";
import { Timeline } from "./timeline/Timeline";
import {
  buildKokoroNeuralVoiceoverOp,
  buildKokoroVoiceoverOp,
  encodeProjectVoiceoverWavBase64,
  KOKORO_VOICES,
  parseWaveformPeaksUri,
  type KokoroVoiceId,
} from "./tts";

const SIDEBAR_PANELS: Array<{
  id: SidebarPanelId;
  icon: string;
  shortLabel: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: "script",
    icon: "📝",
    shortLabel: "Script",
    title: "Script & AI Cut",
    subtitle: "Write script, pick stock mode & generate",
  },
  {
    id: "scenes",
    icon: "🎬",
    shortLabel: "Scenes",
    title: "Scene Storyboard",
    subtitle: "Inspect scenes, lock & quick-swap stock",
  },
  {
    id: "clip",
    icon: "🎞️",
    shortLabel: "Clip Stock",
    title: "Video Clip & Stock",
    subtitle: "Clip properties & stock thumbnail gallery",
  },
  {
    id: "voice",
    icon: "🎙️",
    shortLabel: "Voice",
    title: "Voiceover & Audio",
    subtitle: "Kokoro-82M voice, speed & clip audio",
  },
  {
    id: "text",
    icon: "🔤",
    shortLabel: "Text",
    title: "Text & Captions",
    subtitle: "Caption text, font size, color & layout",
  },
  {
    id: "history",
    icon: "📊",
    shortLabel: "Activity",
    title: "Ranking & Edit Log",
    subtitle: "Persisted edit_events for ML ranking",
  },
];

export function App() {
  const {
    dispatch,
    undo,
    redo,
    selection,
    select,
    selectClipAndOpenPanel,
    activePanel,
    setActivePanel,
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
  const [loadingSceneStock, setLoadingSceneStock] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState<string>("");
  const [customStockResults, setCustomStockResults] = useState<StockShotSpec[]>([]);
  const [exporting, setExporting] = useState(false);
  const [timelineMinimized, setTimelineMinimized] = useState(false);
  const [, setMediaTick] = useState(0);

  const lastCompositionEndAtRef = useRef<number | null>(null);
  const addMediaInputRef = useRef<HTMLInputElement | null>(null);
  const replaceMediaInputRef = useRef<HTMLInputElement | null>(null);
  const fetchedSceneIdsRef = useRef<Set<string>>(new Set());

  const selectedClipId = selection[0];
  const selectedClip = selectedClipId ? project.clips[selectedClipId] : undefined;
  const selectedScene = selectedClip?.sceneId
    ? project.scenes.find((s) => s.id === selectedClip.sceneId)
    : project.scenes[0];

  const allClips = Object.values(project.clips);
  const videoClips = allClips
    .filter((c) => c.trackId === "v1" && c.kind === "media")
    .sort((a, b) => a.start - b.start);
  const voiceClips = allClips
    .filter((c) => c.trackId === "a1" || c.id.startsWith("ai_vo_"))
    .sort((a, b) => a.start - b.start);
  const textClips = allClips
    .filter((c) => c.trackId === "t1" || c.kind === "text")
    .sort((a, b) => a.start - b.start);

  const count = allClips.length;
  const uploadedEntries = getLoadedMediaEntries();
  const theaterMode = activePanel === null;

  useEffect(() => {
    return onMediaCacheUpdated(() => setMediaTick((t) => t + 1));
  }, []);

  // When a media clip is selected, ensure its proxy/thumbnail is hydrated and its scene has live stock candidates
  useEffect(() => {
    if (!selectedClip || selectedClip.kind !== "media") return;
    const assetId = selectedClip.source?.assetId;
    if (assetId) {
      const asset = project.assets[assetId];
      const isLive =
        assetId.startsWith("pxv_") ||
        assetId.startsWith("pxi_") ||
        assetId.startsWith("wiki_");
      if (isLive || asset?.origin === "upload") {
        const kind: "video" | "image" = asset?.type === "image" ? "image" : "video";
        void hydrateAssetById(assetId, kind, assetId);
      }
    }
    if (
      selectedScene &&
      stockMediaMode !== "synthetic_seed" &&
      !fetchedSceneIdsRef.current.has(selectedScene.id)
    ) {
      fetchedSceneIdsRef.current.add(selectedScene.id);
      setLoadingSceneStock(true);
      void fetchLiveStockCandidatesForScene(selectedScene, stockMediaMode).finally(() => {
        setLoadingSceneStock(false);
      });
    }
  }, [selectedClip?.id, selectedClip?.source?.assetId, selectedScene?.id, stockMediaMode]);

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

      if (e.key === "Escape") {
        state.setActivePanel(null);
        return;
      }
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
    runNeuralTts = false,
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
          for (const s of workingProject.scenes) {
            fetchedSceneIdsRef.current.add(s.id);
          }
        }
      }

      if (runNeuralTts) {
        const op = await buildKokoroNeuralVoiceoverOp(workingProject, {
          voice: state.kokoroVoice,
          speed: state.kokoroSpeed,
          onProgress: setTtsStatus,
        });
        state.dispatch(op, "ai");
        setTtsStatus(
          `Ready ✓ • Low-Res Proxy Preview + Kokoro-82M 24kHz (${state.kokoroVoice})`,
        );
      } else {
        const fastOp = buildKokoroVoiceoverOp(workingProject, {
          voice: state.kokoroVoice,
          speed: state.kokoroSpeed,
        });
        state.dispatch(fastOp, "ai");
        setTtsStatus(
          `Ready ✓ • Low-Res Proxy Preview (${mode.replace(/_/g, " ")}) • Full-Res on Export`,
        );
      }
    } catch (err) {
      setTtsStatus(`Status error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTtsBusy(false);
    }
  };

  // Hydrate persisted project from backend on startup, then fetch lightweight stock thumbnails
  useEffect(() => {
    void (async () => {
      const hydrated = await hydrateFromServer();
      if (hydrated.scenes.length > 0) {
        setScriptText(hydrated.scenes.map((s) => s.narration).join("\n\n"));
      }
      await runLiveStockAndKokoro(hydrated, "videos_and_photos", true, false);
    })();
  }, []);

  const handleGenerateFromScript = async () => {
    setPlaying(false);
    fetchedSceneIdsRef.current.clear();
    const scriptOp = buildGenerateFromScriptOp(project, scriptText, { preferredMood });
    if (dispatch(scriptOp, "ai")) {
      const afterScript = useEditor.getState().project;
      const placeholderTtsOp = buildKokoroVoiceoverOp(afterScript, {
        voice: kokoroVoice,
        speed: kokoroSpeed,
      });
      dispatch(placeholderTtsOp, "ai");
      setPlayhead(0);
      await runLiveStockAndKokoro(useEditor.getState().project, stockMediaMode, false, false);
    }
  };

  const handleSynthesizeKokoroTts = async () => {
    setPlaying(false);
    await runLiveStockAndKokoro(project, "synthetic_seed", false, true);
  };

  const handleChangeStockMode = async (nextMode: StockMediaMode) => {
    setStockMediaMode(nextMode);
    fetchedSceneIdsRef.current.clear();
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

  const handleRefreshSceneStock = async () => {
    if (!selectedScene) return;
    setLoadingSceneStock(true);
    try {
      await fetchLiveStockCandidatesForScene(selectedScene, stockMediaMode);
    } finally {
      setLoadingSceneStock(false);
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
        selectClipAndOpenPanel(newClipId);
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
    const curProject = useEditor.getState().project;
    const op = buildRegenerateSceneOp(curProject, sceneId);
    if (op && dispatch(op, "ai")) {
      const nextProject = useEditor.getState().project;
      const sceneClips = Object.values(nextProject.clips).filter(
        (c) => c.sceneId === sceneId && c.kind === "media",
      );
      for (const sc of sceneClips) {
        if (sc.source?.assetId) {
          const kind: "video" | "image" =
            nextProject.assets[sc.source.assetId]?.type === "image" ? "image" : "video";
          void hydrateAssetById(sc.source.assetId, kind, sc.source.assetId);
        }
      }
      if (sceneClips[0]) {
        selectClipAndOpenPanel(sceneClips[0].id);
        setPlayhead(sceneClips[0].start);
      }
    }
  };

  const handleToggleSceneLock = (sceneIdx: number, currentLocked: boolean) => {
    dispatch({ type: "setProp", path: ["scenes", String(sceneIdx), "locked"], value: !currentLocked }, "user");
  };

  const activeClipForMediaPanel =
    selectedClip?.kind === "media" && selectedClip.trackId === "v1"
      ? selectedClip
      : videoClips[0];

  const activeSceneForMediaPanel = activeClipForMediaPanel?.sceneId
    ? project.scenes.find((s) => s.id === activeClipForMediaPanel.sceneId)
    : selectedScene;

  const rankedCandidates = rankShotsForIntent(
    activeSceneForMediaPanel?.intent ?? { literal: "", keywords: [] },
  );

  const displayedCandidates: Array<{ spec: StockShotSpec; score: number }> = (() => {
    const seen = new Set<string>();
    const list: Array<{ spec: StockShotSpec; score: number }> = [];
    for (const spec of customStockResults) {
      if (!seen.has(spec.assetId)) {
        seen.add(spec.assetId);
        list.push({ spec, score: 0.96 });
      }
    }
    for (const item of rankedCandidates) {
      if (!seen.has(item.spec.assetId)) {
        seen.add(item.spec.assetId);
        list.push(item);
      }
    }
    return list.slice(0, 10);
  })();

  const buildAssetRecordForSpec = (spec: StockShotSpec, minDurationUs = secToUs(30)) => {
    const catalogAsset = catalogAssetsRecord()[spec.assetId];
    const kind = spec.kind ?? (spec.assetId.startsWith("pxi_") || spec.assetId.startsWith("wiki_") ? "image" : "video");
    const safeDurationUs = Math.max(
      spec.durationUs || secToUs(30),
      catalogAsset?.durationUs || secToUs(30),
      secToUs(30),
      minDurationUs,
    );
    return {
      id: spec.assetId,
      type: kind,
      uri:
        spec.uri ??
        catalogAsset?.uri ??
        `s3://vf/stock/${spec.assetId}.${kind === "image" ? "jpg" : "mp4"}`,
      durationUs: safeDurationUs,
      width: spec.width ?? catalogAsset?.width ?? 1280,
      height: spec.height ?? catalogAsset?.height ?? 720,
      fps: kind === "video" ? 30 : undefined,
      origin: spec.isUpload ? ("upload" as const) : ("stock" as const),
      license: spec.license ?? catalogAsset?.license,
    };
  };

  const triggerHydrateForSpec = (spec: StockShotSpec) => {
    const isReal =
      Boolean(spec.isLiveStock) ||
      Boolean(spec.isUpload) ||
      spec.assetId.startsWith("pxv_") ||
      spec.assetId.startsWith("pxi_") ||
      spec.assetId.startsWith("wiki_") ||
      spec.assetId.startsWith("upload_");
    if (isReal) {
      const kind: "video" | "image" =
        spec.kind ??
        (spec.assetId.startsWith("pxi_") || spec.assetId.startsWith("wiki_") ? "image" : "video");
      void hydrateAssetById(spec.assetId, kind, spec.title);
    }
  };

  const handleSwapStockCandidate = (spec: StockShotSpec, score = 0.9) => {
    if (!activeClipForMediaPanel) {
      handleAddStockClipToTimeline(spec);
      return;
    }
    const prevAsset = activeClipForMediaPanel.source?.assetId;
    const isCurrent = prevAsset === spec.assetId;
    const assetObj = buildAssetRecordForSpec(spec, activeClipForMediaPanel.duration * 2);

    const ops: Parameters<typeof dispatch>[0][] = [
      {
        type: "setProp",
        path: ["assets", spec.assetId],
        value: assetObj,
      },
      {
        type: "replaceMedia",
        clipId: activeClipForMediaPanel.id,
        assetId: spec.assetId,
        in: 0,
      },
    ];

    if (dispatch({ type: "batch", ops, label: `Swap clip to ${spec.title}` }, "user")) {
      triggerHydrateForSpec(spec);
      if (
        playhead < activeClipForMediaPanel.start ||
        playhead >= activeClipForMediaPanel.start + activeClipForMediaPanel.duration
      ) {
        setPlayhead(activeClipForMediaPanel.start);
      }
      logEditEvent(
        isCurrent ? "kept" : spec.isUpload ? "replaced_upload" : "replaced_candidate",
        activeClipForMediaPanel.sceneId,
        {
          clipId: activeClipForMediaPanel.id,
          previousAssetId: prevAsset,
          chosenAssetId: spec.assetId,
          provider: spec.provider ?? "seed",
          score,
        },
      );
    }
  };

  const handleAddStockClipToTimeline = (spec: StockShotSpec) => {
    const cur = useEditor.getState().project;
    const v1Clips = Object.values(cur.clips).filter((c) => c.trackId === "v1");
    const start = v1Clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const clipDuration = secToUs(4);
    const newClipId = `stock_v_${Date.now().toString(36).slice(-4)}`;
    const assetObj = buildAssetRecordForSpec(spec, clipDuration * 2);

    const ok = dispatch(
      {
        type: "batch",
        label: `Add stock clip ${spec.title}`,
        ops: [
          { type: "setProp", path: ["assets", spec.assetId], value: assetObj },
          {
            type: "addClip",
            clip: makeClip({
              id: newClipId,
              trackId: "v1",
              kind: "media",
              start,
              duration: clipDuration,
              sceneId: activeSceneForMediaPanel?.id ?? cur.scenes[0]?.id,
              source: { assetId: spec.assetId, in: 0, speed: 1 },
              provenance: { origin: "user", locked: false, userModified: true },
            }),
          },
        ],
      },
      "user",
    );
    if (ok) {
      triggerHydrateForSpec(spec);
      selectClipAndOpenPanel(newClipId);
      setPlayhead(start);
    }
  };

  const handleCustomStockSearch = async () => {
    const q = stockSearchQuery.trim();
    if (!q) return;
    setLoadingSceneStock(true);
    try {
      const results = await searchCustomStockCandidates(q, stockMediaMode);
      setCustomStockResults(results);
    } finally {
      setLoadingSceneStock(false);
    }
  };

  const addDemoClip = () => {
    const usedIds = new Set(videoClips.map((c) => c.source?.assetId).filter(Boolean));
    const candidate =
      displayedCandidates.find((c) => !usedIds.has(c.spec.assetId))?.spec ??
      displayedCandidates[0]?.spec ??
      getAllCatalogSpecs()[count % Math.max(1, getAllCatalogSpecs().length)];
    if (candidate) {
      handleAddStockClipToTimeline(candidate);
    }
  };

  const addDemoText = () => {
    const t1Clips = Object.values(project.clips).filter((c) => c.trackId === "t1");
    const start = t1Clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const newId = `text_${count + 1}`;
    if (
      dispatch(
        {
          type: "addClip",
          clip: makeClip({
            id: newId,
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
      )
    ) {
      selectClipAndOpenPanel(newId);
    }
  };

  const activeClipForVoicePanel =
    selectedClip &&
    (selectedClip.trackId === "a1" ||
      selectedClip.id.startsWith("ai_vo_") ||
      project.assets[selectedClip.source?.assetId ?? ""]?.type === "audio")
      ? selectedClip
      : voiceClips[0];

  const activeClipForTextPanel =
    selectedClip && (selectedClip.kind === "text" || selectedClip.trackId === "t1")
      ? selectedClip
      : textClips[0];

  const currentPanelMeta = SIDEBAR_PANELS.find((p) => p.id === activePanel);

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

      {/* Studio Top Bar */}
      <header className="vf-header">
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
              ? `v${version} ✓`
              : syncStatus === "syncing"
                ? `Syncing v${version}...`
                : `Local v${version}`}
          </span>
          <span
            style={{ fontSize: 11, color: ttsBusy ? "#38bdf8" : "#94a3b8" }}
            aria-live="polite"
          >
            {ttsStatus}
          </span>
        </div>

        <div className="vf-header-metrics">
          <div className="vf-metric-pill" title="Current playhead timecode">
            <span>TC</span>
            <strong>{formatTimecode(playhead, project.canvas.fps)}</strong>
          </div>
          <button onClick={undo} disabled={!past.length} className="vf-btn-sm" title="Undo last operation (Cmd/Ctrl+Z)">
            Undo ({past.length}) <span className="vf-kbd">⌘Z</span>
          </button>
          <button onClick={redo} disabled={!future.length} className="vf-btn-sm" title="Redo operation (Shift+Cmd/Ctrl+Z)">
            Redo ({future.length}) <span className="vf-kbd">⇧⌘Z</span>
          </button>
          <button
            className="vf-btn-sm"
            onClick={() => {
              void (async () => {
                fetchedSceneIdsRef.current.clear();
                const fresh = await resetDemoProject();
                setScriptText(fresh.scenes.map((s) => s.narration).join("\n\n"));
                await runLiveStockAndKokoro(fresh, stockMediaMode, false);
              })();
            }}
            title="Reset project to clean default state"
          >
            Reset
          </button>
          <button
            className="vf-btn-primary vf-btn-sm"
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
            <strong>Operation Rejected:</strong> {lastError}
          </span>
          <button className="vf-btn-sm" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {/* Upper Workspace: Left Icon Rail + Contextual Collapsible Sidebar Panel + Hero Program Monitor */}
      <div className="vf-workspace">
        {/* Vertical Side Rail: Dedicated Toggle for Each Collapsible Panel */}
        <nav className="vf-side-rail" aria-label="Studio Panels">
          {SIDEBAR_PANELS.map((panel) => {
            const isOpen = activePanel === panel.id;
            const badgeCount =
              panel.id === "scenes"
                ? project.scenes.length
                : panel.id === "clip"
                  ? videoClips.length
                  : panel.id === "voice"
                    ? voiceClips.length
                    : panel.id === "text"
                      ? textClips.length
                      : panel.id === "history"
                        ? editEvents.length
                        : undefined;
            return (
              <button
                key={panel.id}
                type="button"
                className={`vf-rail-btn ${isOpen ? "is-active" : ""}`}
                aria-expanded={isOpen}
                onClick={() => setActivePanel(isOpen ? null : panel.id)}
                title={`${panel.title} — ${panel.subtitle} (click to ${isOpen ? "collapse" : "open"})`}
              >
                <span className="vf-rail-icon" aria-hidden="true">
                  {panel.icon}
                </span>
                <span className="vf-rail-label">{panel.shortLabel}</span>
                {typeof badgeCount === "number" && badgeCount > 0 && (
                  <span className="vf-rail-count">{badgeCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Contextual Collapsible Sidebar Panel (renders only when a panel is active) */}
        {activePanel && currentPanelMeta && (
          <aside className="vf-side-panel" aria-label={currentPanelMeta.title}>
            <div className="vf-side-panel-header">
              <div>
                <div className="vf-side-panel-title">
                  <span>{currentPanelMeta.icon}</span>
                  <span>{currentPanelMeta.title}</span>
                </div>
                <div className="vf-side-panel-subtitle">{currentPanelMeta.subtitle}</div>
              </div>
              <button
                type="button"
                className="vf-btn-sm"
                onClick={() => setActivePanel(null)}
                title="Collapse sidebar panel (Esc)"
              >
                ✕ Collapse
              </button>
            </div>

            <div className="vf-side-panel-body vf-scroller">
              {/* PANEL 1: SCRIPT & AI CUT */}
              {activePanel === "script" && (
                <div className="vf-panel-stack">
                  <div className="vf-panel-card">
                    <div className="vf-panel-card-header">
                      <strong>Script Prompt</strong>
                      <span className="vf-badge vf-badge-ai">{project.scenes.length} Scenes</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                      {Object.entries(SCRIPT_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          className="vf-btn-sm"
                          style={{ fontSize: 10.5, padding: "3px 8px" }}
                          onClick={() => setScriptText(preset.script)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      aria-label="Video script input"
                      value={scriptText}
                      onCompositionEnd={() => {
                        lastCompositionEndAtRef.current = performance.now();
                      }}
                      onChange={(e) => setScriptText(e.target.value)}
                      rows={5}
                      placeholder="Write your script. Separate scenes with blank lines or sentences..."
                      style={{ width: "100%", resize: "vertical", marginBottom: 8 }}
                    />

                    <div className="vf-field-row">
                      <label htmlFor="stock-media-mode-select">Stock Source:</label>
                      <select
                        id="stock-media-mode-select"
                        aria-label="Stock media source mode"
                        value={stockMediaMode}
                        onChange={(e) => void handleChangeStockMode(e.target.value as StockMediaMode)}
                        style={{ flex: 1 }}
                      >
                        <option value="videos_and_photos">Stock Videos + Photos (Default)</option>
                        <option value="videos_only">Stock Videos Only (Pixabay MP4)</option>
                        <option value="photos_only">Stock Photos Only (Pixabay + Wikimedia)</option>
                        <option value="wikimedia_only">Wikimedia Commons Only (No API Key)</option>
                        <option value="synthetic_seed">Offline Built-In Procedural Only</option>
                      </select>
                    </div>

                    <div className="vf-field-row" style={{ marginTop: 6 }}>
                      <label htmlFor="mood-select">Mood Override:</label>
                      <select
                        id="mood-select"
                        aria-label="Preferred scene mood"
                        value={preferredMood}
                        onChange={(e) => setPreferredMood(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="auto">Auto-detect per scene</option>
                        <option value="energetic">Energetic</option>
                        <option value="optimistic">Optimistic</option>
                        <option value="celebratory">Celebratory</option>
                        <option value="calm">Calm</option>
                        <option value="serious">Serious</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        className="vf-btn-primary"
                        style={{ flex: 1 }}
                        disabled={ttsBusy}
                        onClick={() => void handleGenerateFromScript()}
                      >
                        {ttsBusy ? "Generating..." : "Generate First Cut"}
                      </button>
                      <button
                        className="vf-btn-sm"
                        onClick={() => {
                          let changed = false;
                          for (const s of project.scenes) {
                            const op = buildRegenerateSceneOp(useEditor.getState().project, s.id);
                            if (op && dispatch(op, "ai")) changed = true;
                          }
                          if (changed) {
                            void hydrateProjectUploadedAssets(useEditor.getState().project);
                          }
                        }}
                        title="Swap AI clips to alternate stock candidates while preserving locked & user-edited clips"
                      >
                        Regen AI Only
                      </button>
                    </div>
                  </div>

                  <div className="vf-panel-card">
                    <div className="vf-panel-card-header">
                      <strong>Custom Media Upload</strong>
                      <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                        {uploadedEntries.length} cached
                      </span>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 8px 0" }}>
                      Upload your own `.mp4`, `.webm`, `.png`, or `.jpg` files to use alongside stock media.
                    </p>
                    <button
                      className="vf-btn-sm"
                      style={{ width: "100%" }}
                      disabled={uploadingMedia}
                      onClick={() => addMediaInputRef.current?.click()}
                    >
                      {uploadingMedia ? "Decoding Upload..." : "+ Upload Video or Photo to Timeline"}
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL 2: SCENE STORYBOARD */}
              {activePanel === "scenes" && (
                <div className="vf-panel-stack">
                  {project.scenes.map((scene, idx) => {
                    const sceneMediaClip = videoClips.find((c) => c.sceneId === scene.id);
                    const sceneAssetId = sceneMediaClip?.source?.assetId;
                    const sceneSpec = getAllCatalogSpecs().find((s) => s.assetId === sceneAssetId);
                    const sceneThumbUrl = resolveAssetThumbnailUrl(sceneAssetId, sceneSpec?.previewThumbUrl);
                    const regenCount = regenerableClips(project, scene.id).length;
                    const isEditing = editingSceneIdx === idx;

                    return (
                      <div key={scene.id} className="vf-scene-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <button
                            type="button"
                            className="vf-btn-sm"
                            style={{ fontWeight: 700, padding: "2px 8px" }}
                            onClick={() => {
                              if (sceneMediaClip) {
                                setPlayhead(sceneMediaClip.start);
                                selectClipAndOpenPanel(sceneMediaClip.id);
                              }
                            }}
                            title="Jump to scene clip and open Clip Stock panel"
                          >
                            Scene {idx + 1} ▸
                          </button>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span className="vf-badge vf-badge-ai">{scene.intent.mood ?? "neutral"}</span>
                            <button
                              className="vf-btn-sm"
                              style={{ padding: "2px 7px", fontSize: 10.5 }}
                              onClick={() => handleToggleSceneLock(idx, scene.locked)}
                            >
                              {scene.locked ? "🔒 Locked" : "🔓 Lock"}
                            </button>
                            <button
                              className="vf-btn-sm"
                              style={{ padding: "2px 7px", fontSize: 10.5 }}
                              disabled={scene.locked || regenCount === 0}
                              onClick={() => handleRegenerateScene(scene.id)}
                              title="Cycle to next ranked stock shot for this scene"
                            >
                              Swap Shot
                            </button>
                          </div>
                        </div>

                        {/* Scene Stock Thumbnail Reference */}
                        {sceneMediaClip && (
                          <div
                            className="vf-stock-ref-row"
                            onClick={() => {
                              setPlayhead(sceneMediaClip.start);
                              selectClipAndOpenPanel(sceneMediaClip.id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setPlayhead(sceneMediaClip.start);
                                selectClipAndOpenPanel(sceneMediaClip.id);
                              }
                            }}
                            title="Click to inspect this clip and browse all stock thumbnails"
                          >
                            {sceneThumbUrl ? (
                              <img
                                src={sceneThumbUrl}
                                alt={sceneSpec?.title ?? sceneAssetId ?? "Scene clip"}
                                className="vf-stock-ref-thumb"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="vf-stock-ref-thumb vf-stock-ref-placeholder">🎞️</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {sceneSpec?.title ?? sceneAssetId}
                              </div>
                              <div style={{ fontSize: 10, color: "#7dd3fc" }}>
                                Click to browse stock thumbnails ▸
                              </div>
                            </div>
                          </div>
                        )}

                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <textarea
                              value={editingSceneText}
                              onChange={(e) => setEditingSceneText(e.target.value)}
                              rows={2}
                              style={{ width: "100%", fontSize: 12 }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="vf-btn-primary vf-btn-sm" onClick={() => void handleSaveSceneEdit(idx)}>
                                Save &amp; Re-match
                              </button>
                              <button className="vf-btn-sm" onClick={() => setEditingSceneIdx(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.4, flex: 1 }}>
                              “{scene.narration}”
                            </div>
                            <button
                              className="vf-btn-sm"
                              style={{ padding: "2px 6px", fontSize: 10 }}
                              onClick={() => {
                                setEditingSceneIdx(idx);
                                setEditingSceneText(scene.narration);
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PANEL 3: VIDEO CLIP & STOCK THUMBNAIL MATCHER (Auto-opens on V1 clip click) */}
              {activePanel === "clip" && (
                <div className="vf-panel-stack">
                  {/* Quick Clip Switcher Bar */}
                  <div className="vf-clip-pill-strip">
                    {videoClips.map((vc, idx) => {
                      const isSel = activeClipForMediaPanel?.id === vc.id;
                      const vcThumb = resolveAssetThumbnailUrl(vc.source?.assetId);
                      return (
                        <button
                          key={vc.id}
                          type="button"
                          className={`vf-clip-pill ${isSel ? "is-active" : ""}`}
                          onClick={() => {
                            selectClipAndOpenPanel(vc.id);
                            setPlayhead(vc.start);
                          }}
                        >
                          {vcThumb && (
                            <img src={vcThumb} alt="" className="vf-clip-pill-thumb" loading="lazy" decoding="async" />
                          )}
                          <span>Shot {idx + 1}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeClipForMediaPanel ? (
                    <>
                      {/* Active Clip Stock Reference Card with Thumbnail */}
                      {(() => {
                        const clipAssetId = activeClipForMediaPanel.source?.assetId;
                        const clipSpec = getAllCatalogSpecs().find((s) => s.assetId === clipAssetId);
                        const clipThumbUrl = resolveAssetThumbnailUrl(clipAssetId, clipSpec?.previewThumbUrl);
                        const overwritable = canOverwrite(project, activeClipForMediaPanel);

                        return (
                          <div className="vf-panel-card">
                            <div className="vf-panel-card-header">
                              <strong>Active Clip: {activeClipForMediaPanel.id}</strong>
                              <span
                                className={`vf-badge ${
                                  overwritable
                                    ? "vf-badge-ai"
                                    : activeClipForMediaPanel.provenance.origin === "user"
                                      ? "vf-badge-user"
                                      : "vf-badge-protected"
                                }`}
                              >
                                {overwritable
                                  ? "AI • Overwritable"
                                  : activeClipForMediaPanel.provenance.locked
                                    ? "Locked • Protected"
                                    : "Edited • Protected"}
                              </span>
                            </div>

                            {/* Large 16:9 Stock Reference Thumbnail */}
                            <div className="vf-active-stock-preview">
                              {clipThumbUrl ? (
                                <img
                                  src={clipThumbUrl}
                                  alt={clipSpec?.title ?? clipAssetId ?? "Active clip"}
                                  className="vf-active-stock-img"
                                  loading="eager"
                                  decoding="async"
                                />
                              ) : (
                                <div className="vf-active-stock-fallback">No Thumbnail Available</div>
                              )}
                              <div className="vf-active-stock-overlay">
                                <span className="vf-badge vf-badge-ai">
                                  {clipSpec?.provider
                                    ? `${clipSpec.provider.toUpperCase()} ${clipSpec.kind?.toUpperCase() ?? ""}`
                                    : clipSpec?.isUpload
                                      ? "USER UPLOAD"
                                      : "STOCK SHOT"}
                                </span>
                                <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>
                                  {usToSec(activeClipForMediaPanel.start).toFixed(1)}s –{" "}
                                  {usToSec(activeClipForMediaPanel.start + activeClipForMediaPanel.duration).toFixed(1)}s (
                                  {usToSec(activeClipForMediaPanel.duration).toFixed(1)}s)
                                </span>
                              </div>
                            </div>

                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f8fafc", marginTop: 6 }}>
                              {clipSpec?.title ?? clipAssetId}
                            </div>
                            {activeSceneForMediaPanel && (
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                Scene: “{activeSceneForMediaPanel.narration}”
                              </div>
                            )}

                            {/* Clip Action Controls */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                              <button
                                className="vf-btn-primary vf-btn-sm"
                                disabled={uploadingMedia}
                                onClick={() => {
                                  select([activeClipForMediaPanel.id]);
                                  replaceMediaInputRef.current?.click();
                                }}
                              >
                                {uploadingMedia ? "Uploading..." : "Upload & Replace"}
                              </button>
                              <button
                                className="vf-btn-sm"
                                onClick={() =>
                                  dispatch({
                                    type: "setProp",
                                    path: ["clips", activeClipForMediaPanel.id, "provenance", "locked"],
                                    value: !activeClipForMediaPanel.provenance.locked,
                                  })
                                }
                              >
                                {activeClipForMediaPanel.provenance.locked ? "🔓 Unlock Clip" : "🔒 Lock Clip"}
                              </button>
                              <button
                                className="vf-btn-sm"
                                onClick={() =>
                                  dispatch({
                                    type: "trimClip",
                                    id: activeClipForMediaPanel.id,
                                    edge: "out",
                                    deltaUs: -500_000,
                                  })
                                }
                              >
                                Trim -0.5s
                              </button>
                              <button
                                className="vf-btn-sm"
                                onClick={() =>
                                  dispatch({
                                    type: "trimClip",
                                    id: activeClipForMediaPanel.id,
                                    edge: "out",
                                    deltaUs: 500_000,
                                  })
                                }
                              >
                                Trim +0.5s
                              </button>
                              <button
                                className="vf-btn-sm"
                                onClick={() => {
                                  select([activeClipForMediaPanel.id]);
                                  splitSelected();
                                }}
                              >
                                Split <span className="vf-kbd">S</span>
                              </button>
                              <button
                                className="vf-btn-danger vf-btn-sm"
                                onClick={() => {
                                  select([activeClipForMediaPanel.id]);
                                  rippleDeleteSelected();
                                }}
                              >
                                Delete <span className="vf-kbd">⌫</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Stock Search & Candidate Gallery with Live Thumbnails */}
                      <div className="vf-panel-card">
                        <div className="vf-panel-card-header">
                          <strong>Stock Library ({displayedCandidates.length})</strong>
                          <button
                            type="button"
                            className="vf-btn-sm"
                            style={{ padding: "2px 8px", fontSize: 10.5 }}
                            disabled={loadingSceneStock}
                            onClick={() => void handleRefreshSceneStock()}
                            title="Fetch fresh Pixabay & Wikimedia stock thumbnails for this scene"
                          >
                            {loadingSceneStock ? "Loading Stock..." : "↻ Refresh Scene Stock"}
                          </button>
                        </div>

                        {/* Search Stock Input Bar */}
                        <div style={{ display: "flex", gap: 5, marginTop: 4, marginBottom: 8 }}>
                          <input
                            type="text"
                            placeholder="Search stock video/photos (e.g. city, nature, tech)..."
                            value={stockSearchQuery}
                            onChange={(e) => setStockSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleCustomStockSearch();
                              }
                            }}
                            style={{ flex: 1, fontSize: 11.5, padding: "4px 8px" }}
                          />
                          <button
                            type="button"
                            className="vf-btn-primary vf-btn-sm"
                            style={{ fontSize: 11, padding: "4px 10px" }}
                            disabled={loadingSceneStock || !stockSearchQuery.trim()}
                            onClick={() => void handleCustomStockSearch()}
                          >
                            {loadingSceneStock ? "Searching..." : "Search"}
                          </button>
                          {customStockResults.length > 0 && (
                            <button
                              type="button"
                              className="vf-btn-sm"
                              style={{ fontSize: 11, padding: "4px 7px" }}
                              onClick={() => {
                                setStockSearchQuery("");
                                setCustomStockResults([]);
                              }}
                              title="Clear search results and show scene recommendations"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                          Click a thumbnail to swap onto <strong>{activeClipForMediaPanel.id}</strong>, or click <strong>+ Add Clip</strong> to append:
                        </div>

                        <div className="vf-candidate-grid">
                          {displayedCandidates.map(({ spec, score }) => {
                            const isCurrent = activeClipForMediaPanel.source?.assetId === spec.assetId;
                            const thumbSrc = resolveAssetThumbnailUrl(spec.assetId, spec.previewThumbUrl);
                            const badgePrefix = spec.isUpload
                              ? "📁 Upload"
                              : spec.provider === "pixabay"
                                ? spec.kind === "video"
                                  ? "🎬 Video"
                                  : "📷 Photo"
                                : spec.provider === "wikimedia"
                                  ? "🌐 Wiki"
                                  : "🎞️ Stock";
                            return (
                              <div
                                key={spec.assetId}
                                className={`vf-candidate-card ${isCurrent ? "is-current" : ""}`}
                              >
                                <div
                                  className="vf-candidate-thumb-wrap"
                                  onClick={() => handleSwapStockCandidate(spec, score)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      handleSwapStockCandidate(spec, score);
                                    }
                                  }}
                                  title={`Click to swap onto ${activeClipForMediaPanel.id}`}
                                >
                                  {thumbSrc ? (
                                    <img
                                      src={thumbSrc}
                                      alt={spec.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="vf-candidate-thumb-img"
                                    />
                                  ) : (
                                    <div className="vf-candidate-swatch" />
                                  )}
                                  <span className="vf-candidate-kind-tag">{badgePrefix}</span>
                                  {isCurrent && <span className="vf-candidate-active-tag">ACTIVE</span>}
                                </div>
                                <div className="vf-candidate-title" title={spec.title}>
                                  {spec.title}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: 10,
                                    color: isCurrent ? "#38bdf8" : "#94a3b8",
                                    marginTop: 2,
                                  }}
                                >
                                  <span>Match {(score * 100).toFixed(0)}%</span>
                                  <button
                                    type="button"
                                    className="vf-btn-sm"
                                    style={{
                                      fontSize: 9.5,
                                      padding: "1px 5px",
                                      background: "rgba(56, 189, 248, 0.15)",
                                      color: "#7dd3fc",
                                      border: "1px solid rgba(56, 189, 248, 0.3)",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddStockClipToTimeline(spec);
                                    }}
                                    title="Add this stock item as a new 4s clip on Track V1"
                                  >
                                    + Add Clip
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="vf-panel-card">
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                        No video clips on Track V1 yet. Generate a cut from the Script panel or upload media.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* PANEL 4: VOICEOVER & AUDIO (Auto-opens on A1 voice clip click) */}
              {activePanel === "voice" && (
                <div className="vf-panel-stack">
                  {/* Quick Voice Clip Switcher */}
                  {voiceClips.length > 0 && (
                    <div className="vf-clip-pill-strip">
                      {voiceClips.map((ac, idx) => {
                        const isSel = activeClipForVoicePanel?.id === ac.id;
                        return (
                          <button
                            key={ac.id}
                            type="button"
                            className={`vf-clip-pill ${isSel ? "is-active" : ""}`}
                            onClick={() => {
                              selectClipAndOpenPanel(ac.id);
                              setPlayhead(ac.start);
                            }}
                          >
                            <span>🎙️ Voice {idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeClipForVoicePanel && (() => {
                    const vAsset = activeClipForVoicePanel.source
                      ? project.assets[activeClipForVoicePanel.source.assetId]
                      : undefined;
                    const parsedWave = parseWaveformPeaksUri(vAsset?.waveformPeaksUri);
                    const vScene = activeClipForVoicePanel.sceneId
                      ? project.scenes.find((s) => s.id === activeClipForVoicePanel.sceneId)
                      : undefined;
                    const currentGain = evalProp(
                      activeClipForVoicePanel.audio?.gain ?? { value: 1 },
                      Math.max(0, playhead - activeClipForVoicePanel.start),
                    );
                    const fadeInSec = usToSec(activeClipForVoicePanel.audio?.fadeIn ?? 0);
                    const fadeOutSec = usToSec(activeClipForVoicePanel.audio?.fadeOut ?? 0);

                    return (
                      <div className="vf-panel-card">
                        <div className="vf-panel-card-header">
                          <strong>Voice Clip: {activeClipForVoicePanel.id}</strong>
                          <span className="vf-badge vf-badge-ai">
                            {parsedWave ? `Kokoro • ${parsedWave.voice}` : "Audio Track A1"}
                          </span>
                        </div>

                        {vScene && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#e2e8f0",
                              background: "rgba(15, 23, 42, 0.7)",
                              padding: "8px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(56, 189, 248, 0.25)",
                              marginBottom: 8,
                            }}
                          >
                            “{vScene.narration}”
                          </div>
                        )}

                        {parsedWave && (
                          <div
                            style={{
                              height: 36,
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              padding: "4px 8px",
                              background: "rgba(2, 6, 23, 0.75)",
                              borderRadius: 6,
                              marginBottom: 10,
                            }}
                          >
                            {parsedWave.peaks.slice(0, 40).map((p, i) => (
                              <div
                                key={i}
                                style={{
                                  flex: 1,
                                  height: `${Math.max(15, Math.round(p * 100))}%`,
                                  background: "#38bdf8",
                                  borderRadius: 2,
                                }}
                              />
                            ))}
                          </div>
                        )}

                        <div className="vf-field-row">
                          <label htmlFor="voice-gain-range">Clip Gain:</label>
                          <input
                            id="voice-gain-range"
                            type="range"
                            min={0}
                            max={2}
                            step={0.05}
                            value={currentGain}
                            onChange={(e) =>
                              dispatch({
                                type: "setProp",
                                path: ["clips", activeClipForVoicePanel.id, "audio"],
                                value: {
                                  gain: { value: Number(e.target.value) },
                                  fadeIn: activeClipForVoicePanel.audio?.fadeIn ?? 0,
                                  fadeOut: activeClipForVoicePanel.audio?.fadeOut ?? 0,
                                },
                              })
                            }
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: 11, minWidth: 40, textAlign: "right" }}>
                            {Math.round(currentGain * 100)}%
                          </span>
                        </div>

                        <div className="vf-field-row" style={{ marginTop: 6 }}>
                          <label htmlFor="voice-fadein-range">Fade In / Out:</label>
                          <button
                            type="button"
                            className="vf-btn-sm"
                            onClick={() =>
                              dispatch({
                                type: "setProp",
                                path: ["clips", activeClipForVoicePanel.id, "audio"],
                                value: {
                                  gain: activeClipForVoicePanel.audio?.gain ?? { value: 1 },
                                  fadeIn: fadeInSec > 0 ? 0 : 250_000,
                                  fadeOut: fadeOutSec > 0 ? 0 : 250_000,
                                },
                              })
                            }
                          >
                            {fadeInSec > 0 ? "Clear 0.25s Fades" : "Apply 0.25s Smooth Fades"}
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                          <button
                            className="vf-btn-sm"
                            onClick={() =>
                              dispatch({
                                type: "setProp",
                                path: ["clips", activeClipForVoicePanel.id, "provenance", "locked"],
                                value: !activeClipForVoicePanel.provenance.locked,
                              })
                            }
                          >
                            {activeClipForVoicePanel.provenance.locked ? "🔓 Unlock Voice" : "🔒 Lock Voice"}
                          </button>
                          <button
                            className="vf-btn-danger vf-btn-sm"
                            onClick={() => {
                              select([activeClipForVoicePanel.id]);
                              rippleDeleteSelected();
                            }}
                          >
                            Delete Voice Clip
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Global Kokoro-82M Voice & Pace Controls */}
                  <div className="vf-panel-card">
                    <div className="vf-panel-card-header">
                      <strong>Kokoro-82M Neural TTS</strong>
                      <span className="vf-badge vf-badge-user">Apache-2.0</span>
                    </div>

                    <div className="vf-field-row">
                      <label htmlFor="kokoro-voice-select">Voice Model:</label>
                      <select
                        id="kokoro-voice-select"
                        aria-label="Kokoro-82M Voice"
                        value={kokoroVoice}
                        disabled={ttsBusy}
                        onChange={(e) => setKokoroVoice(e.target.value as KokoroVoiceId)}
                        style={{ flex: 1 }}
                      >
                        {KOKORO_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} [Grade {v.grade}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="vf-field-row" style={{ marginTop: 8 }}>
                      <label htmlFor="kokoro-speed-range">Pace ({kokoroSpeed.toFixed(2)}x):</label>
                      <input
                        id="kokoro-speed-range"
                        aria-label="Kokoro-82M Speed"
                        type="range"
                        min={0.7}
                        max={1.4}
                        step={0.05}
                        disabled={ttsBusy}
                        value={kokoroSpeed}
                        onChange={(e) => setKokoroSpeed(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                    </div>

                    <button
                      className="vf-btn-primary"
                      style={{ width: "100%", marginTop: 10 }}
                      disabled={ttsBusy}
                      onClick={() => void handleSynthesizeKokoroTts()}
                    >
                      {ttsBusy ? "Synthesizing..." : "🎙️ Synthesize 24kHz Voiceover"}
                    </button>
                  </div>
                </div>
              )}

              {/* PANEL 5: TEXT & CAPTIONS (Auto-opens on T1 text clip click) */}
              {activePanel === "text" && (
                <div className="vf-panel-stack">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {textClips.length} Caption Clips on Track T1
                    </span>
                    <button className="vf-btn-primary vf-btn-sm" onClick={addDemoText}>
                      + Add Caption
                    </button>
                  </div>

                  {textClips.length > 0 && (
                    <div className="vf-clip-pill-strip">
                      {textClips.map((tc, idx) => {
                        const isSel = activeClipForTextPanel?.id === tc.id;
                        return (
                          <button
                            key={tc.id}
                            type="button"
                            className={`vf-clip-pill ${isSel ? "is-active" : ""}`}
                            onClick={() => {
                              selectClipAndOpenPanel(tc.id);
                              setPlayhead(tc.start);
                            }}
                          >
                            <span>🔤 Caption {idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeClipForTextPanel && activeClipForTextPanel.text ? (
                    <div className="vf-panel-card">
                      <div className="vf-panel-card-header">
                        <strong>Editing Caption: {activeClipForTextPanel.id}</strong>
                        <span className="vf-badge vf-badge-ai">
                          {usToSec(activeClipForTextPanel.start).toFixed(1)}s –{" "}
                          {usToSec(activeClipForTextPanel.start + activeClipForTextPanel.duration).toFixed(1)}s
                        </span>
                      </div>

                      <label
                        htmlFor="clip-text-input"
                        style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}
                      >
                        Caption Text:
                      </label>
                      <textarea
                        id="clip-text-input"
                        rows={3}
                        value={activeClipForTextPanel.text.text}
                        onChange={(e) =>
                          dispatch({
                            type: "setProp",
                            path: ["clips", activeClipForTextPanel.id, "text", "text"],
                            value: e.target.value,
                          })
                        }
                        style={{ width: "100%", marginBottom: 10 }}
                      />

                      <div className="vf-field-row">
                        <label htmlFor="text-fontsize-range">
                          Font Size ({activeClipForTextPanel.text.fontSize}px):
                        </label>
                        <input
                          id="text-fontsize-range"
                          type="range"
                          min={20}
                          max={96}
                          step={2}
                          value={activeClipForTextPanel.text.fontSize}
                          onChange={(e) =>
                            dispatch({
                              type: "setProp",
                              path: ["clips", activeClipForTextPanel.id, "text", "fontSize"],
                              value: Number(e.target.value),
                            })
                          }
                          style={{ flex: 1 }}
                        />
                      </div>

                      <div className="vf-field-row" style={{ marginTop: 8 }}>
                        <label htmlFor="text-color-input">Text Color:</label>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {["#ffffff", "#38bdf8", "#fde047", "#4ade80", "#f43f5e"].map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: "setProp",
                                  path: ["clips", activeClipForTextPanel.id, "text", "color"],
                                  value: hex,
                                })
                              }
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: hex,
                                border:
                                  activeClipForTextPanel.text?.color === hex
                                    ? "2px solid #38bdf8"
                                    : "1px solid rgba(255,255,255,0.3)",
                                padding: 0,
                              }}
                              title={`Set color ${hex}`}
                            />
                          ))}
                          <input
                            id="text-color-input"
                            type="color"
                            value={activeClipForTextPanel.text.color}
                            onChange={(e) =>
                              dispatch({
                                type: "setProp",
                                path: ["clips", activeClipForTextPanel.id, "text", "color"],
                                value: e.target.value,
                              })
                            }
                            style={{ width: 28, height: 24, padding: 0, border: "none", background: "transparent" }}
                          />
                        </div>
                      </div>

                      <div className="vf-field-row" style={{ marginTop: 8 }}>
                        <label>Alignment:</label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["left", "center", "right"] as const).map((align) => (
                            <button
                              key={align}
                              type="button"
                              className={`vf-btn-sm ${
                                activeClipForTextPanel.text?.align === align ? "vf-btn-primary" : ""
                              }`}
                              onClick={() =>
                                dispatch({
                                  type: "setProp",
                                  path: ["clips", activeClipForTextPanel.id, "text", "align"],
                                  value: align,
                                })
                              }
                            >
                              {align.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="vf-field-row" style={{ marginTop: 8 }}>
                        <label htmlFor="text-pos-y-range">Vertical Position:</label>
                        <input
                          id="text-pos-y-range"
                          type="range"
                          min={0.1}
                          max={0.92}
                          step={0.02}
                          value={evalProp(
                            activeClipForTextPanel.transform.y,
                            Math.max(0, playhead - activeClipForTextPanel.start),
                          )}
                          onChange={(e) =>
                            dispatch({
                              type: "setProp",
                              path: ["clips", activeClipForTextPanel.id, "transform", "y"],
                              value: { value: Number(e.target.value) },
                            })
                          }
                          style={{ flex: 1 }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                        <button
                          className="vf-btn-sm"
                          onClick={() =>
                            dispatch({
                              type: "setProp",
                              path: ["clips", activeClipForTextPanel.id, "provenance", "locked"],
                              value: !activeClipForTextPanel.provenance.locked,
                            })
                          }
                        >
                          {activeClipForTextPanel.provenance.locked ? "🔓 Unlock Text" : "🔒 Lock Text"}
                        </button>
                        <button
                          className="vf-btn-sm"
                          onClick={() => {
                            select([activeClipForTextPanel.id]);
                            splitSelected();
                          }}
                        >
                          Split <span className="vf-kbd">S</span>
                        </button>
                        <button
                          className="vf-btn-danger vf-btn-sm"
                          onClick={() => {
                            select([activeClipForTextPanel.id]);
                            rippleDeleteSelected();
                          }}
                        >
                          Delete Caption
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="vf-panel-card">
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                        Click any caption clip on Track T1 or click “+ Add Caption” above.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* PANEL 6: ACTIVITY & RANKING LOG (`edit_events`) */}
              {activePanel === "history" && (
                <div className="vf-panel-stack">
                  <div className="vf-panel-card">
                    <div className="vf-panel-card-header">
                      <strong>Persisted Edit Events ({editEvents.length})</strong>
                      <span className="vf-badge vf-badge-ai">Training Data</span>
                    </div>
                    {editEvents.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                        No edit events logged yet. Swap a stock candidate or edit a scene to log ranking training events.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {editEvents.slice(0, 20).map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              fontSize: 11,
                              padding: "6px 8px",
                              borderRadius: 6,
                              background: "var(--bg-input)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span className="vf-badge vf-badge-ai">{ev.event}</span>
                              <span style={{ color: "#64748b", fontSize: 10 }}>
                                {new Date(ev.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <code style={{ color: "#94a3b8", fontSize: 10.5, wordBreak: "break-all" }}>
                              {JSON.stringify(ev.payload)}
                            </code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* MAIN DISPLAY 1: Hero Program Monitor */}
        <Preview
          theaterMode={theaterMode}
          ttsBusy={ttsBusy}
          onSynthesizeVoiceover={() => void handleSynthesizeKokoroTts()}
          onToggleTheater={() => {
            setActivePanel(theaterMode ? "clip" : null);
          }}
        />
      </div>

      {/* MAIN DISPLAY 2: Full-Width Multi-Track Timeline Dock */}
      <section className="vf-timeline-dock" aria-label="Multi-Track Timeline">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className="vf-btn-sm"
              onClick={() => setTimelineMinimized((m) => !m)}
              title="Collapse or expand timeline tracks"
            >
              {timelineMinimized ? "▸ Expand Timeline" : "▾ Timeline"} ({count} clips)
            </button>
            <button
              className="vf-btn-primary vf-btn-sm"
              disabled={uploadingMedia}
              onClick={() => addMediaInputRef.current?.click()}
              title="Upload a local .mp4/.webm/.png/.jpg file, decode real frames into the canvas preview, and append to V1"
            >
              {uploadingMedia
                ? "Decoding Upload..."
                : `+ Upload Media${uploadedEntries.length ? ` (${uploadedEntries.length})` : ""}`}
            </button>
            <button className="vf-btn-sm" onClick={addDemoClip}>
              + AI Clip
            </button>
            <button className="vf-btn-sm" onClick={addDemoText}>
              + Text Overlay
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

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
            <span>Click any clip to pop up its panel • Zoom:</span>
            <button
              className="vf-btn-icon"
              onClick={() => setPxPerSec(pxPerSec - 20)}
              title="Zoom Out Timeline"
            >
              −
            </button>
            <span style={{ minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
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

        {!timelineMinimized && <Timeline />}
      </section>
    </main>
  );
}
