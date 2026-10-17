import { create } from "zustand";
import {
  applyChecked,
  applyPatches,
  createEmptyProject,
  type Actor,
  type Op,
  type Patch,
  type Project,
} from "@vf/schema";
import { buildGenerateFromScriptOp, catalogAssetsRecord } from "./generator";
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

export const DEFAULT_SCRIPT = [
  "Our team starts every morning with a quick planning session.",
  "Revenue grew steadily throughout the year.",
  "Then we shipped the first version to happy customers.",
].join(" ");

function createInitialProject(): Project {
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

interface EditorState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: string[];
  playhead: number; // microseconds
  playing: boolean;
  pxPerSec: number;
  kokoroVoice: KokoroVoiceId;
  kokoroSpeed: number;
  editEvents: EditEventRecord[];
  lastError: string | null;
  dispatch: (op: Op, actor?: Actor) => boolean;
  logEditEvent: (event: EditEventType, sceneId: string | undefined, payload: Record<string, unknown>) => void;
  clearError: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPxPerSec: (px: number) => void;
  setKokoroVoice: (voice: KokoroVoiceId) => void;
  setKokoroSpeed: (speed: number) => void;
}

/** The UI never mutates the project directly. Everything goes through dispatch(op). */
export const useEditor = create<EditorState>((set, get) => ({
  project: createInitialProject(),
  past: [],
  future: [],
  selection: [],
  playhead: 0,
  playing: false,
  pxPerSec: 80,
  kokoroVoice: "af_heart",
  kokoroSpeed: 1.0,
  editEvents: [],
  lastError: null,

  dispatch: (op, actor = "user") => {
    const { project, past } = get();
    try {
      const { next, patches, inverse } = applyChecked(project, op, { actor });
      set({ project: next, past: [...past, { patches, inverse }], future: [], lastError: null });
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
  },
  clearError: () => set({ lastError: null }),
  undo: () => {
    const { past, future, project } = get();
    const e = past[past.length - 1];
    if (!e) return;
    set({
      project: applyPatches(project, e.inverse),
      past: past.slice(0, -1),
      future: [e, ...future],
      lastError: null,
    });
  },
  redo: () => {
    const { past, future, project } = get();
    const e = future[0];
    if (!e) return;
    set({
      project: applyPatches(project, e.patches),
      past: [...past, e],
      future: future.slice(1),
      lastError: null,
    });
  },
  select: (ids) => set({ selection: ids }),
  setPlayhead: (t) => set({ playhead: Math.max(0, Math.round(t)) }),
  setPlaying: (v) => set((s) => ({ playing: typeof v === "function" ? v(s.playing) : v })),
  setPxPerSec: (px) => set({ pxPerSec: Math.max(30, Math.min(240, Math.round(px))) }),
  setKokoroVoice: (voice) => set({ kokoroVoice: voice }),
  setKokoroSpeed: (speed) => set({ kokoroSpeed: Math.max(0.5, Math.min(2.0, speed)) }),
}));
