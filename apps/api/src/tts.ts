import { canOverwrite, makeClip, type Asset, type Clip, type Op, type Project } from "@vf/schema";

export type KokoroVoiceId =
  | "af_heart"
  | "af_bella"
  | "am_adam"
  | "am_michael"
  | "bf_emma"
  | "bm_george";

export interface KokoroVoiceInfo {
  id: KokoroVoiceId;
  name: string;
  langCode: "a" | "b";
  gender: "female" | "male";
  f0Hz: number;
  brightness: number;
}

export const KOKORO_VOICES: readonly KokoroVoiceInfo[] = [
  { id: "af_heart", name: "Heart (US Female)", langCode: "a", gender: "female", f0Hz: 215, brightness: 0.65 },
  { id: "af_bella", name: "Bella (US Female)", langCode: "a", gender: "female", f0Hz: 228, brightness: 0.72 },
  { id: "am_adam", name: "Adam (US Male)", langCode: "a", gender: "male", f0Hz: 122, brightness: 0.58 },
  { id: "am_michael", name: "Michael (US Male)", langCode: "a", gender: "male", f0Hz: 112, brightness: 0.52 },
  { id: "bf_emma", name: "Emma (UK Female)", langCode: "b", gender: "female", f0Hz: 220, brightness: 0.68 },
  { id: "bm_george", name: "George (UK Male)", langCode: "b", gender: "male", f0Hz: 118, brightness: 0.55 },
] as const;

export interface WordTiming {
  text: string;
  startUs: number;
  endUs: number;
}

export interface KokoroSynthesisResult {
  voice: KokoroVoiceId;
  sampleRate: number;
  durationUs: number;
  waveformPeaks: number[];
  words: WordTiming[];
  engine: string;
}

export interface TtsProvider {
  synthesize(params: { text: string; voice?: KokoroVoiceId; speed?: number }): Promise<KokoroSynthesisResult>;
}

function estimateSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 1;
  const groups = cleaned.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 1;
  if (cleaned.endsWith("e") && !cleaned.endsWith("le") && count > 1) {
    count -= 1;
  }
  return Math.max(1, count);
}

export function computeKokoroWordTimings(
  text: string,
  speed = 1.0,
): { words: WordTiming[]; durationUs: number } {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return { words: [], durationUs: 500_000 };
  }

  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  let cursorUs = Math.round(80_000 / clampedSpeed);
  const words: WordTiming[] = [];

  for (const token of tokens) {
    const syllables = estimateSyllables(token);
    const alphaLen = token.replace(/\W/g, "").length;
    const charBonusUs = Math.max(0, alphaLen - 3) * 14_000;
    const rawWordUs = 145_000 * syllables + charBonusUs;
    const wordDurUs = Math.max(90_000, Math.round(rawWordUs / clampedSpeed));
    const startUs = cursorUs;
    const endUs = startUs + wordDurUs;
    words.push({ text: token, startUs, endUs });

    let pauseUs = Math.round(42_000 / clampedSpeed);
    if (/[.!?]$/.test(token)) {
      pauseUs = Math.round(220_000 / clampedSpeed);
    } else if (/[,;:—]$/.test(token)) {
      pauseUs = Math.round(110_000 / clampedSpeed);
    }
    cursorUs = endUs + pauseUs;
  }

  const tailUs = Math.round(100_000 / clampedSpeed);
  const sampleRate = 24_000;
  const rawTotalUs = cursorUs + tailUs;
  const numSamples = Math.max(1, Math.round((rawTotalUs / 1_000_000) * sampleRate));
  const durationUs = Math.round((numSamples / sampleRate) * 1_000_000);
  return { words, durationUs };
}

export function computeKokoroPeaks(words: WordTiming[], durationUs: number, numBins = 48): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < numBins; i++) {
    const binMidUs = ((i + 0.5) / numBins) * durationUs;
    const activeWord = words.find((w) => binMidUs >= w.startUs && binMidUs <= w.endUs);
    if (!activeWord) {
      peaks.push(0.06);
      continue;
    }
    const u = (binMidUs - activeWord.startUs) / Math.max(1, activeWord.endUs - activeWord.startUs);
    const env = Math.pow(Math.sin(Math.PI * u), 0.5);
    const syllables = estimateSyllables(activeWord.text);
    const mod = 0.6 + 0.4 * Math.pow(Math.sin(Math.PI * syllables * u), 2);
    peaks.push(Number(Math.min(1, Math.max(0.12, env * mod * 0.92)).toFixed(3)));
  }
  return peaks;
}

export class DefaultKokoroTtsProvider implements TtsProvider {
  async synthesize(params: {
    text: string;
    voice?: KokoroVoiceId;
    speed?: number;
  }): Promise<KokoroSynthesisResult> {
    const voiceInfo =
      KOKORO_VOICES.find((v) => v.id === params.voice) ?? KOKORO_VOICES[0]!;
    const speed = params.speed ?? 1.0;
    const { words, durationUs } = computeKokoroWordTimings(params.text, speed);
    const waveformPeaks = computeKokoroPeaks(words, durationUs, 48);
    return {
      voice: voiceInfo.id,
      sampleRate: 24_000,
      durationUs,
      waveformPeaks,
      words,
      engine: "kokoro-82m",
    };
  }
}

/**
 * Builds a single `batch` Op that synthesizes Kokoro-82M voiceover clips on track `a1`
 * for every unlocked scene, links `scene.voiceClipId`, populates `captions.words`,
 * and aligns untouched AI scene clips (`canOverwrite === true`) to the voiceover timing.
 */
export async function buildKokoroProjectVoiceoverOp(
  project: Project,
  provider: TtsProvider,
  opts: { voice?: KokoroVoiceId; speed?: number } = {},
): Promise<Op> {
  const voice = opts.voice ?? "af_heart";
  const speed = opts.speed ?? 1.0;
  const ops: Op[] = [];

  const captionWords: Array<{ text: string; start: number; end: number; sceneId?: string }> = [];
  let timelineCursorUs = 0;

  for (let idx = 0; idx < project.scenes.length; idx++) {
    const scene = project.scenes[idx]!;
    const synth = await provider.synthesize({ text: scene.narration, voice, speed });

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
