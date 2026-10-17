import { create } from "zustand";
import {
  applyChecked,
  applyPatches,
  createEmptyProject,
  Project as ProjectSchema,
  type Actor,
  type Op,
  type Patch,
  type Project,
} from "@vf/schema";
import { buildGenerateFromScriptOp, catalogAssetsRecord } from "./generator";
import { hydrateProjectUploadedAssets } from "./mediaCache";
import { buildKokoroVoiceoverOp, type KokoroVoiceId } from "./tts";

interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
}

export type EditEventType = "kept" | "replaced_candidate" | "replaced_upload" | "intent_edited";

export interface EditEventRecord {
  id: string;
  sceneId?: string;
  event: EditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type SyncStatus = "synced" | "syncing" | "local";

export type SidebarPanelId = "script" | "scenes" | "clip" | "voice" | "text" | "history";

export const DEFAULT_SCRIPT = [
  "Our team starts every morning with a quick planning session.",
  "Revenue grew steadily throughout the year.",
  "Then we shipped the first version to happy customers.",
].join("\n\n");

export function createInitialProject(): Project {
  const base = createEmptyProject({ id: "local", title: "VideoForge Studio" });
  const seeded: Project = {
    ...base,
    assets: catalogAssetsRecord(),
  };
  const initOp = buildGenerateFromScriptOp(seeded, DEFAULT_SCRIPT);
  const withScenes = applyChecked(seeded, initOp, { actor: "ai" }).next;
  const ttsOp = buildKokoroVoiceoverOp(withScenes, { voice: "af_heart", speed: 1.0 });
  return applyChecked(withScenes, ttsOp, { actor: "ai" }).next;
}

let syncChain: Promise<void> = Promise.resolve();

function enqueueSync(fn: () => Promise<void>): void {
  syncChain = syncChain.then(fn).catch(() => {
    // Keep queue alive
  });
}

interface EditorState {
  project: Project;
  version: number;
  syncStatus: SyncStatus;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: string[];
  activePanel: SidebarPanelId | null;
  playhead: number; // microseconds
  playing: boolean;
  pxPerSec: number;
  kokoroVoice: KokoroVoiceId;
  kokoroSpeed: number;
  editEvents: EditEventRecord[];
  lastError: string | null;
  dispatch: (op: Op, actor?: Actor) => boolean;
  logEditEvent: (event: EditEventType, sceneId: string | undefined, payload: Record<string, unknown>) => void;
  hydrateFromServer: () => Promise<Project>;
  resetDemoProject: () => Promise<Project>;
  clearError: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setActivePanel: (panel: SidebarPanelId | null) => void;
  selectClipAndOpenPanel: (clipId: string) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPxPerSec: (px: number) => void;
  setKokoroVoice: (voice: KokoroVoiceId) => void;
  setKokoroSpeed: (speed: number) => void;
}

/** The UI never mutates the project directly. Everything goes through dispatch(op). */
export const useEditor = create<EditorState>((set, get) => ({
  project: createInitialProject(),
  version: 0,
  syncStatus: "local",
  past: [],
  future: [],
  selection: [],
  activePanel: "script",
  playhead: 0,
  playing: false,
  pxPerSec: 80,
  kokoroVoice: "af_heart",
  kokoroSpeed: 1.0,
  editEvents: [],
  lastError: null,

  dispatch: (op, actor = "user") => {
    const { project, past, version } = get();
    try {
      const { next, patches, inverse } = applyChecked(project, op, { actor });
      const nextVer = version + 1;
      set({
        project: next,
        version: nextVer,
        syncStatus: "syncing",
        past: [...past, { patches, inverse }],
        future: [],
        lastError: null,
      });

      if (typeof window !== "undefined" && typeof fetch === "function") {
        enqueueSync(async () => {
          const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/ops`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedVersion: version,
              actor,
              ops: [op],
              baseDoc: project,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { version?: number };
            set({
              version: typeof data.version === "number" ? data.version : get().version,
              syncStatus: "synced",
            });
          } else {
            set({ syncStatus: "local" });
          }
        });
      }
      return true;
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
      return false;
    }
  },

  logEditEvent: (event, sceneId, payload) => {
    const entry: EditEventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sceneId,
      event,
      payload,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ editEvents: [entry, ...s.editEvents] }));

    const projectId = get().project.id;
    if (typeof window !== "undefined" && typeof fetch === "function") {
      enqueueSync(async () => {
        await fetch(`/api/projects/${encodeURIComponent(projectId)}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId, event, payload }),
        });
      });
    }
  },

  hydrateFromServer: async () => {
    if (typeof window === "undefined" || typeof fetch !== "function") {
      return get().project;
    }
    try {
      set({ syncStatus: "syncing" });
      const res = await fetch("/api/projects/local");
      if (res.ok) {
        const data = (await res.json()) as {
          version: number;
          doc: unknown;
          events?: EditEventRecord[];
        };
        const parsedDoc = ProjectSchema.parse(data.doc);
        set({
          project: parsedDoc,
          version: data.version ?? 0,
          editEvents: Array.isArray(data.events) ? data.events : [],
          past: [],
          future: [],
          syncStatus: "synced",
        });
        await hydrateProjectUploadedAssets(parsedDoc);
        return parsedDoc;
      }
      // First load: persist initial project to backend
      const initDoc = get().project;
      const putRes = await fetch("/api/projects/local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 0, doc: initDoc }),
      });
      if (putRes.ok) {
        set({ syncStatus: "synced", version: 0 });
      } else {
        set({ syncStatus: "local" });
      }
      return initDoc;
    } catch {
      set({ syncStatus: "local" });
      return get().project;
    }
  },

  resetDemoProject: async () => {
    const fresh = createInitialProject();
    set({
      project: fresh,
      version: 0,
      past: [],
      future: [],
      selection: [],
      playhead: 0,
      playing: false,
      editEvents: [],
      lastError: null,
      syncStatus: "syncing",
    });
    if (typeof window !== "undefined" && typeof fetch === "function") {
      enqueueSync(async () => {
        const res = await fetch("/api/projects/local", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: 0, doc: fresh, resetEvents: true }),
        });
        set({ syncStatus: res.ok ? "synced" : "local" });
      });
    }
    return fresh;
  },

  clearError: () => set({ lastError: null }),

  undo: () => {
    const { past, future, project, version } = get();
    const e = past[past.length - 1];
    if (!e) return;
    const prevDoc = applyPatches(project, e.inverse);
    const nextVer = version + 1;
    set({
      project: prevDoc,
      version: nextVer,
      past: past.slice(0, -1),
      future: [e, ...future],
      lastError: null,
      syncStatus: "syncing",
    });
    if (typeof window !== "undefined" && typeof fetch === "function") {
      enqueueSync(async () => {
        const res = await fetch(`/api/projects/${encodeURIComponent(prevDoc.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: nextVer, doc: prevDoc }),
        });
        set({ syncStatus: res.ok ? "synced" : "local" });
      });
    }
  },

  redo: () => {
    const { past, future, project, version } = get();
    const e = future[0];
    if (!e) return;
    const nextDoc = applyPatches(project, e.patches);
    const nextVer = version + 1;
    set({
      project: nextDoc,
      version: nextVer,
      past: [...past, e],
      future: future.slice(1),
      lastError: null,
      syncStatus: "syncing",
    });
    if (typeof window !== "undefined" && typeof fetch === "function") {
      enqueueSync(async () => {
        const res = await fetch(`/api/projects/${encodeURIComponent(nextDoc.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: nextVer, doc: nextDoc }),
        });
        set({ syncStatus: res.ok ? "synced" : "local" });
      });
    }
  },

  select: (ids) => {
    const firstId = ids[0];
    const clip = firstId ? get().project.clips[firstId] : undefined;
    if (clip) {
      const asset = clip.source ? get().project.assets[clip.source.assetId] : undefined;
      const isVoice =
        clip.trackId === "a1" || clip.id.startsWith("ai_vo_") || asset?.type === "audio";
      const isText = clip.kind === "text" || clip.trackId === "t1";
      const nextPanel: SidebarPanelId = isVoice ? "voice" : isText ? "text" : "clip";
      set({ selection: ids, activePanel: nextPanel });
    } else {
      set({ selection: ids });
    }
  },
  setActivePanel: (panel) => set({ activePanel: panel }),
  selectClipAndOpenPanel: (clipId) => {
    const clip = get().project.clips[clipId];
    if (!clip) {
      set({ selection: [clipId] });
      return;
    }
    const asset = clip.source ? get().project.assets[clip.source.assetId] : undefined;
    const isVoice =
      clip.trackId === "a1" || clip.id.startsWith("ai_vo_") || asset?.type === "audio";
    const isText = clip.kind === "text" || clip.trackId === "t1";
    const nextPanel: SidebarPanelId = isVoice ? "voice" : isText ? "text" : "clip";
    set({ selection: [clipId], activePanel: nextPanel });
  },
  setPlayhead: (t) => set({ playhead: Math.max(0, Math.round(t)) }),
  setPlaying: (v) => set((s) => ({ playing: typeof v === "function" ? v(s.playing) : v })),
  setPxPerSec: (px) => set({ pxPerSec: Math.max(30, Math.min(240, Math.round(px))) }),
  setKokoroVoice: (voice) => set({ kokoroVoice: voice }),
  setKokoroSpeed: (speed) => set({ kokoroSpeed: Math.max(0.5, Math.min(2.0, speed)) }),
}));
