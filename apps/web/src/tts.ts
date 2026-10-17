import { KokoroTTS } from "kokoro-js";
import { canOverwrite, evalProp, makeClip, type Asset, type Clip, type Op, type Project } from "@vf/schema";

export type KokoroVoiceId =
  | "af_heart"
  | "af_bella"
  | "af_nicole"
  | "af_sarah"
  | "am_adam"
  | "am_michael"
  | "am_fenrir"
  | "bf_emma"
  | "bm_george"
  | "bm_fable";

export interface KokoroVoiceInfo {
  id: KokoroVoiceId;
  name: string;
  langCode: "a" | "b";
  gender: "female" | "male";
  grade: string;
}

export const KOKORO_VOICES: readonly KokoroVoiceInfo[] = [
  { id: "af_heart", name: "Heart (US Female)", langCode: "a", gender: "female", grade: "A" },
  { id: "af_bella", name: "Bella (US Female)", langCode: "a", gender: "female", grade: "A-" },
  { id: "af_nicole", name: "Nicole (US Female)", langCode: "a", gender: "female", grade: "B-" },
  { id: "af_sarah", name: "Sarah (US Female)", langCode: "a", gender: "female", grade: "C+" },
  { id: "am_fenrir", name: "Fenrir (US Male)", langCode: "a", gender: "male", grade: "C+" },
  { id: "am_michael", name: "Michael (US Male)", langCode: "a", gender: "male", grade: "C+" },
  { id: "am_adam", name: "Adam (US Male)", langCode: "a", gender: "male", grade: "D" },
  { id: "bf_emma", name: "Emma (UK Female)", langCode: "b", gender: "female", grade: "B-" },
  { id: "bm_fable", name: "Fable (UK Male)", langCode: "b", gender: "male", grade: "C" },
  { id: "bm_george", name: "George (UK Male)", langCode: "b", gender: "male", grade: "C" },
] as const;

export interface WordTiming {
  text: string;
  startUs: number;
  endUs: number;
}

export interface KokoroSceneSynthesis {
  voice: KokoroVoiceId;
  sampleRate: number;
  durationUs: number;
  waveformPeaks: number[];
  words: WordTiming[];
  samples?: Float32Array;
}

export interface CachedKokoroAudio {
  samples: Float32Array;
  sampleRate: number;
  voice: KokoroVoiceId;
  text: string;
}

const kokoroAudioCache = new Map<string, CachedKokoroAudio>();

export function getCachedKokoroAudio(assetId: string): CachedKokoroAudio | undefined {
  return kokoroAudioCache.get(assetId);
}

export function hasAnyCachedKokoroAudio(project: Project): boolean {
  for (const clip of Object.values(project.clips)) {
    if (clip.trackId === "a1" && clip.source && kokoroAudioCache.has(clip.source.assetId)) {
      return true;
    }
  }
  return false;
}

let kokoroModelPromise: Promise<KokoroTTS> | null = null;

export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export async function getKokoroModel(
  onProgress?: (statusText: string) => void,
): Promise<KokoroTTS> {
  if (!kokoroModelPromise) {
    onProgress?.("Downloading Kokoro-82M ONNX model (q8)...");
    kokoroModelPromise = KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (info: any) => {
        if (info && typeof info.progress === "number") {
          const file = typeof info.file === "string" ? info.file.split("/").pop() : "model";
          onProgress?.(`Loading Kokoro-82M (${file}: ${Math.round(info.progress)}%)...`);
        }
      },
    }).catch((err) => {
      kokoroModelPromise = null;
      throw err;
    });
  }
  return kokoroModelPromise;
}

export function estimateSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 1;
  const groups = cleaned.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (cleaned.endsWith("e") && !cleaned.endsWith("le") && count > 1) {
    count -= 1;
  }
  return Math.max(1, count);
}

export function computePeaksFromFloat32(samples: Float32Array, numBins = 40): number[] {
  if (samples.length === 0 || numBins <= 0) return [];
  const binSize = Math.max(1, Math.floor(samples.length / numBins));
  const peaks: number[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = i === numBins - 1 ? samples.length : Math.min(samples.length, (i + 1) * binSize);
    let maxAbs = 0;
    for (let j = start; j < end; j++) {
      const a = Math.abs(samples[j]!);
      if (a > maxAbs) maxAbs = a;
    }
    peaks.push(Number(Math.min(1, Math.max(0.05, maxAbs)).toFixed(3)));
  }
  return peaks;
}

export function alignWordsToDuration(text: string, totalDurationUs: number): WordTiming[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const weights = tokens.map((tok) => {
    const syl = estimateSyllables(tok);
    const pauseWeight = /[.!?]$/.test(tok) ? 0.9 : /[,;:—]$/.test(tok) ? 0.45 : 0.15;
    return { tok, speechWeight: syl, totalWeight: syl + pauseWeight };
  });

  const sumWeights = weights.reduce((acc, w) => acc + w.totalWeight, 0);
  const leadInUs = Math.min(60_000, Math.round(totalDurationUs * 0.03));
  const usableUs = Math.max(100_000, totalDurationUs - leadInUs * 2);

  let cursorUs = leadInUs;
  const words: WordTiming[] = [];
  for (const w of weights) {
    const slotUs = Math.round((w.totalWeight / sumWeights) * usableUs);
    const wordDurUs = Math.max(60_000, Math.round(slotUs * (w.speechWeight / w.totalWeight)));
    const startUs = cursorUs;
    const endUs = Math.min(totalDurationUs, startUs + wordDurUs);
    words.push({ text: w.tok, startUs, endUs });
    cursorUs += slotUs;
  }
  return words;
}

export function synthesizeKokoroScene(
  text: string,
  voice: KokoroVoiceId = "af_heart",
  speed = 1.0,
): KokoroSceneSynthesis {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  const sampleRate = 24_000;

  if (tokens.length === 0) {
    return {
      voice,
      sampleRate,
      durationUs: 500_000,
      waveformPeaks: Array.from({ length: 40 }, () => 0.08),
      words: [],
    };
  }

  let cursorUs = Math.round(80_000 / clampedSpeed);
  for (const token of tokens) {
    const syllables = estimateSyllables(token);
    const alphaLen = token.replace(/\W/g, "").length;
    const charBonusUs = Math.max(0, alphaLen - 3) * 14_000;
    const rawWordUs = 145_000 * syllables + charBonusUs;
    const wordDurUs = Math.max(90_000, Math.round(rawWordUs / clampedSpeed));
    let pauseUs = Math.round(42_000 / clampedSpeed);
    if (/[.!?]$/.test(token)) {
      pauseUs = Math.round(220_000 / clampedSpeed);
    } else if (/[,;:—]$/.test(token)) {
      pauseUs = Math.round(110_000 / clampedSpeed);
    }
    cursorUs += wordDurUs + pauseUs;
  }

  const tailUs = Math.round(100_000 / clampedSpeed);
  const rawTotalUs = cursorUs + tailUs;
  const numSamples = Math.max(1, Math.round((rawTotalUs / 1_000_000) * sampleRate));
  const durationUs = Math.round((numSamples / sampleRate) * 1_000_000);
  const words = alignWordsToDuration(text, durationUs);

  const numBins = 40;
  const waveformPeaks: number[] = [];
  for (let i = 0; i < numBins; i++) {
    const binMidUs = ((i + 0.5) / numBins) * durationUs;
    const activeWord = words.find((w) => binMidUs >= w.startUs && binMidUs <= w.endUs);
    if (!activeWord) {
      waveformPeaks.push(0.06);
      continue;
    }
    const u = (binMidUs - activeWord.startUs) / Math.max(1, activeWord.endUs - activeWord.startUs);
    const env = Math.pow(Math.sin(Math.PI * u), 0.5);
    const syllables = estimateSyllables(activeWord.text);
    const mod = 0.6 + 0.4 * Math.pow(Math.sin(Math.PI * syllables * u), 2);
    waveformPeaks.push(Number(Math.min(1, Math.max(0.12, env * mod * 0.92)).toFixed(3)));
  }

  return {
    voice,
    sampleRate,
    durationUs,
    waveformPeaks,
    words,
  };
}

/**
 * Runs real neural Kokoro-82M (`kokoro-js` ONNX) synthesis for a single scene narration.
 */
export async function synthesizeKokoroSceneNeural(
  text: string,
  voice: KokoroVoiceId = "af_heart",
  speed = 1.0,
  onProgress?: (statusText: string) => void,
): Promise<KokoroSceneSynthesis> {
  const tts = await getKokoroModel(onProgress);
  const rawAudio = await tts.generate(text, {
    voice,
    speed,
  });
  const samples = rawAudio.audio;
  const sampleRate = rawAudio.sampling_rate || 24_000;
  const durationUs = Math.max(100_000, Math.round((samples.length / sampleRate) * 1_000_000));
  const waveformPeaks = computePeaksFromFloat32(samples, 40);
  const words = alignWordsToDuration(text, durationUs);

  return {
    voice,
    sampleRate,
    durationUs,
    waveformPeaks,
    words,
    samples,
  };
}

export function parseWaveformPeaksUri(uri?: string): { voice: KokoroVoiceId; peaks: number[] } | null {
  if (!uri || !uri.startsWith("kokoro:")) return null;
  const parts = uri.split(":");
  if (parts.length < 3) return null;
  const voice = (parts[1] as KokoroVoiceId) || "af_heart";
  const peaks = parts[2]!
    .split(",")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  return { voice, peaks };
}

export function buildKokoroVoiceoverOpFromSyntheses(
  project: Project,
  sceneSyntheses: Map<string, KokoroSceneSynthesis>,
  voice: KokoroVoiceId,
): Op {
  const ops: Op[] = [];
  const captionWords: Array<{ text: string; start: number; end: number; sceneId?: string }> = [];
  let timelineCursorUs = 0;

  for (let idx = 0; idx < project.scenes.length; idx++) {
    const scene = project.scenes[idx]!;
    const synth =
      sceneSyntheses.get(scene.id) ?? synthesizeKokoroScene(scene.narration, voice, 1.0);

    const existingVoiceClip = scene.voiceClipId ? project.clips[scene.voiceClipId] : undefined;
    const canReplaceVoice =
      !scene.locked && (!existingVoiceClip || canOverwrite(project, existingVoiceClip));

    const sceneMediaClip = scene.clipIds
      .map((id) => project.clips[id])
      .find((c): c is Clip => Boolean(c && c.kind === "media"));
    const sceneTextClip = scene.clipIds
      .map((id) => project.clips[id])
      .find((c): c is Clip => Boolean(c && c.kind === "text"));

    const canRetimeMedia = Boolean(sceneMediaClip && canOverwrite(project, sceneMediaClip));
    const sceneStartUs = canRetimeMedia ? timelineCursorUs : (sceneMediaClip?.start ?? timelineCursorUs);
    const sceneDurationUs = canRetimeMedia
      ? synth.durationUs
      : (sceneMediaClip?.duration ?? synth.durationUs);

    if (canReplaceVoice) {
      if (existingVoiceClip) {
        ops.push({ type: "removeClip", id: existingVoiceClip.id });
      }
      const assetId = `tts_${scene.id}_${voice}`;
      if (synth.samples) {
        kokoroAudioCache.set(assetId, {
          samples: synth.samples,
          sampleRate: synth.sampleRate,
          voice,
          text: scene.narration,
        });
      }
      const asset: Asset = {
        id: assetId,
        type: "audio",
        uri: `s3://videoforge/tts/${assetId}.wav`,
        durationUs: synth.durationUs,
        origin: "generated",
        waveformPeaksUri: `kokoro:${voice}:${synth.waveformPeaks.join(",")}`,
      };
      ops.push({ type: "setProp", path: ["assets", assetId], value: asset });

      if (canRetimeMedia && sceneMediaClip) {
        ops.push({ type: "moveClip", id: sceneMediaClip.id, start: sceneStartUs });
        ops.push({
          type: "trimClip",
          id: sceneMediaClip.id,
          edge: "out",
          deltaUs: synth.durationUs - sceneMediaClip.duration,
        });
      }
      if (canRetimeMedia && sceneTextClip && canOverwrite(project, sceneTextClip)) {
        ops.push({ type: "moveClip", id: sceneTextClip.id, start: sceneStartUs });
        ops.push({
          type: "trimClip",
          id: sceneTextClip.id,
          edge: "out",
          deltaUs: synth.durationUs - sceneTextClip.duration,
        });
      }

      const voiceClipId = `voice_${scene.id}`;
      const voiceClip = makeClip({
        id: voiceClipId,
        trackId: "a1",
        kind: "media",
        start: sceneStartUs,
        duration: synth.durationUs,
        sceneId: scene.id,
        source: { assetId, in: 0, speed: 1 },
        audio: {
          gain: { value: 1 },
          fadeIn: 40_000,
          fadeOut: 60_000,
        },
        provenance: {
          origin: "ai",
          locked: false,
          userModified: false,
          generator: { step: "tts", score: 1 },
        },
      });
      ops.push({ type: "addClip", clip: voiceClip });
      ops.push({ type: "setProp", path: ["scenes", String(idx), "voiceClipId"], value: voiceClipId });
    }

    for (const w of synth.words) {
      captionWords.push({
        text: w.text,
        start: sceneStartUs + w.startUs,
        end: sceneStartUs + w.endUs,
        sceneId: scene.id,
      });
    }

    timelineCursorUs = sceneStartUs + sceneDurationUs;
  }

  if (captionWords.length > 0) {
    ops.push({
      type: "setProp",
      path: ["captions"],
      value: {
        words: captionWords,
        styleId: project.captions?.styleId ?? "default_karaoke",
        overrides: project.captions?.overrides ?? {},
      },
    });
  }

  return {
    type: "batch",
    label: `Synthesize Kokoro-82M voiceover (${voice})`,
    ops,
  };
}

/**
 * Synchronous op builder for initial project seeding before neural weights finish loading.
 */
export function buildKokoroVoiceoverOp(
  project: Project,
  opts: { voice?: KokoroVoiceId; speed?: number } = {},
): Op {
  const voice = opts.voice ?? "af_heart";
  const speed = opts.speed ?? 1.0;
  const map = new Map<string, KokoroSceneSynthesis>();
  for (const scene of project.scenes) {
    map.set(scene.id, synthesizeKokoroScene(scene.narration, voice, speed));
  }
  return buildKokoroVoiceoverOpFromSyntheses(project, map, voice);
}

/**
 * Asynchronous neural Kokoro-82M synthesis across all unlocked scenes in `project`.
 * Generates real 24kHz PCM neural speech via `kokoro-js`, caches the audio buffers,
 * and returns a single validated `batch` Op.
 */
export async function buildKokoroNeuralVoiceoverOp(
  project: Project,
  opts: {
    voice?: KokoroVoiceId;
    speed?: number;
    onProgress?: (statusText: string) => void;
  } = {},
): Promise<Op> {
  const voice = opts.voice ?? "af_heart";
  const speed = opts.speed ?? 1.0;
  const map = new Map<string, KokoroSceneSynthesis>();

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i]!;
    if (scene.locked) continue;
    opts.onProgress?.(`Synthesizing Scene ${i + 1}/${project.scenes.length} with Kokoro-82M (${voice})...`);
    const synth = await synthesizeKokoroSceneNeural(scene.narration, voice, speed, opts.onProgress);
    map.set(scene.id, synth);
  }

  return buildKokoroVoiceoverOpFromSyntheses(project, map, voice);
}

/**
 * Mixes cached neural Kokoro-82M `Float32Array` samples for all `a1` voice clips
 * into a single Web Audio `AudioBuffer` (24 kHz mono) aligned to the timeline.
 * Returns `null` if no neural audio has been synthesized yet (never plays synthetic tone oscillators).
 */
export function mixProjectVoiceoverSamples(
  project: Project,
  totalDurationUs: number,
): Float32Array | null {
  const voiceTrack = project.tracks.find((t) => t.id === "a1" || t.kind === "audio");
  if (!voiceTrack || voiceTrack.muted) return null;

  const voiceClips = Object.values(project.clips).filter(
    (c) => c.trackId === voiceTrack.id && c.duration > 0 && c.source && kokoroAudioCache.has(c.source.assetId),
  );
  if (voiceClips.length === 0) return null;

  const sampleRate = 24_000;
  const totalSamples = Math.max(1, Math.ceil((totalDurationUs / 1_000_000) * sampleRate));
  const channel = new Float32Array(totalSamples);

  for (const clip of voiceClips) {
    const cached = clip.source ? kokoroAudioCache.get(clip.source.assetId) : undefined;
    if (!cached) continue;

    const srcInSamples = Math.max(0, Math.round(((clip.source?.in ?? 0) / 1_000_000) * cached.sampleRate));
    const dstStartSamples = Math.max(0, Math.round((clip.start / 1_000_000) * sampleRate));
    const clipDurationSamples = Math.max(0, Math.round((clip.duration / 1_000_000) * sampleRate));
    const maxCopy = Math.min(
      clipDurationSamples,
      cached.samples.length - srcInSamples,
      totalSamples - dstStartSamples,
    );

    const fadeInUs = clip.audio?.fadeIn ?? 0;
    const fadeOutUs = clip.audio?.fadeOut ?? 0;

    for (let i = 0; i < maxCopy; i++) {
      const clipLocalUs = (i / sampleRate) * 1_000_000;
      const gainVal = clip.audio ? evalProp(clip.audio.gain, clipLocalUs) : 1;
      let env = 1;
      if (fadeInUs > 0 && clipLocalUs < fadeInUs) {
        env *= clipLocalUs / fadeInUs;
      }
      const remUs = clip.duration - clipLocalUs;
      if (fadeOutUs > 0 && remUs < fadeOutUs) {
        env *= Math.max(0, remUs / fadeOutUs);
      }
      channel[dstStartSamples + i]! += cached.samples[srcInSamples + i]! * gainVal * env;
    }
  }

  return channel;
}

export function renderProjectVoiceoverBuffer(
  audioCtx: AudioContext,
  project: Project,
  totalDurationUs: number,
): AudioBuffer | null {
  const mixed = mixProjectVoiceoverSamples(project, totalDurationUs);
  if (!mixed) return null;
  const sampleRate = 24_000;
  const buffer = audioCtx.createBuffer(1, mixed.length, sampleRate);
  buffer.getChannelData(0).set(mixed);
  return buffer;
}

/**
 * Encodes the mixed 24 kHz Kokoro-82M voiceover track into a base64-encoded 16-bit PCM WAV
 * so the MP4 export endpoint can mux the exact neural voiceover audio into the exported MP4.
 */
export function encodeProjectVoiceoverWavBase64(
  project: Project,
  totalDurationUs: number,
): string | null {
  const samples = mixProjectVoiceoverSamples(project, totalDurationUs);
  if (!samples) return null;

  const sampleRate = 24_000;
  const numSamples = samples.length;
  const dataBytes = numSamples * 2;
  const wav = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wav);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    const pcm = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    view.setInt16(44 + i * 2, pcm, true);
  }

  const bytes = new Uint8Array(wav);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
