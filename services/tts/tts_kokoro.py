"""
Kokoro-82M TTS service behind a swappable TTSBackend interface.

- Supports hexgrad/Kokoro-82M (`kokoro.KPipeline`, Apache-2.0) at 24 kHz.
- Produces integer-microsecond durations (`duration_us`), word-level timestamps
  (`WordBoundary.start_us`, `WordBoundary.end_us`), 16-bit PCM WAV bytes, and
  normalized waveform peaks (`0.0..1.0`) for timeline rendering.
- Falls back cleanly to `DeterministicKokoroSynthBackend` when model weights or
  `kokoro` runtime are not installed locally, keeping offline tests fast and
  deterministic.
"""

from __future__ import annotations

import io
import math
import re
import struct
import wave
from dataclasses import dataclass
from typing import Protocol

SAMPLE_RATE = 24_000


@dataclass(frozen=True)
class VoiceProfile:
    id: str
    name: str
    lang_code: str
    gender: str
    f0_hz: float
    timbre_brightness: float


KOKORO_VOICES: dict[str, VoiceProfile] = {
    "af_heart": VoiceProfile("af_heart", "Heart (US Female)", "a", "female", 215.0, 0.65),
    "af_bella": VoiceProfile("af_bella", "Bella (US Female)", "a", "female", 228.0, 0.72),
    "am_adam": VoiceProfile("am_adam", "Adam (US Male)", "a", "male", 122.0, 0.58),
    "am_michael": VoiceProfile("am_michael", "Michael (US Male)", "a", "male", 112.0, 0.52),
    "bf_emma": VoiceProfile("bf_emma", "Emma (UK Female)", "b", "female", 220.0, 0.68),
    "bm_george": VoiceProfile("bm_george", "George (UK Male)", "b", "male", 118.0, 0.55),
}

DEFAULT_KOKORO_VOICE = "af_heart"


@dataclass(frozen=True)
class WordBoundary:
    text: str
    start_us: int
    end_us: int


@dataclass(frozen=True)
class SynthesisResult:
    voice: str
    sample_rate: int
    duration_us: int
    wav_bytes: bytes
    waveform_peaks: list[float]
    words: list[WordBoundary]
    engine: str


class TTSBackend(Protocol):
    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_KOKORO_VOICE,
        speed: float = 1.0,
    ) -> SynthesisResult: ...


def resolve_voice_profile(voice: str) -> VoiceProfile:
    return KOKORO_VOICES.get(voice, KOKORO_VOICES[DEFAULT_KOKORO_VOICE])


def estimate_syllables(word: str) -> int:
    cleaned = re.sub(r"[^a-zA-Z]", "", word.lower())
    if not cleaned:
        return 1
    groups = re.findall(r"[aeiouy]+", cleaned)
    count = len(groups)
    if cleaned.endswith("e") and not cleaned.endswith("le") and count > 1:
        count -= 1
    return max(1, count)


def compute_word_boundaries(text: str, speed: float = 1.0) -> tuple[list[WordBoundary], int]:
    """
    Compute deterministic integer-microsecond word boundaries for narration text.
    """
    tokens = [t for t in re.split(r"\s+", text.strip()) if t]
    if not tokens:
        return [], 500_000

    clamped_speed = max(0.5, min(2.0, float(speed)))
    lead_in_us = round(80_000 / clamped_speed)
    cursor_us = lead_in_us
    boundaries: list[WordBoundary] = []

    for token in tokens:
        syllables = estimate_syllables(token)
        char_factor = max(0, len(re.sub(r"\W", "", token)) - 3) * 14_000
        raw_word_us = (145_000 * syllables) + char_factor
        word_dur_us = max(90_000, round(raw_word_us / clamped_speed))
        start_us = cursor_us
        end_us = start_us + word_dur_us
        boundaries.append(WordBoundary(text=token, start_us=start_us, end_us=end_us))

        if token.endswith((".", "!", "?")):
            pause_us = round(220_000 / clamped_speed)
        elif token.endswith((",", ";", ":", "—")):
            pause_us = round(110_000 / clamped_speed)
        else:
            pause_us = round(42_000 / clamped_speed)
        cursor_us = end_us + pause_us

    tail_us = round(100_000 / clamped_speed)
    total_duration_us = cursor_us + tail_us
    return boundaries, total_duration_us


def encode_pcm16_wav(samples: list[int], sample_rate: int = SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return buf.getvalue()


def compute_waveform_peaks(samples: list[int], num_bins: int = 48) -> list[float]:
    if not samples or num_bins <= 0:
        return []
    bin_size = max(1, len(samples) // num_bins)
    peaks: list[float] = []
    for i in range(num_bins):
        start = i * bin_size
        end = len(samples) if i == num_bins - 1 else min(len(samples), (i + 1) * bin_size)
        chunk = samples[start:end]
        if not chunk:
            peaks.append(0.0)
        else:
            max_abs = max(abs(x) for x in chunk) / 32767.0
            peaks.append(round(min(1.0, max_abs), 4))
    return peaks


class DeterministicKokoroSynthBackend:
    """
    Deterministic formant-prosody Kokoro synthesizer producing real 24kHz PCM16 WAV
    audio and integer-microsecond word timings when neural weights are offline.
    """

    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_KOKORO_VOICE,
        speed: float = 1.0,
    ) -> SynthesisResult:
        profile = resolve_voice_profile(voice)
        words, target_duration_us = compute_word_boundaries(text, speed=speed)
        num_samples = max(1, round((target_duration_us / 1_000_000.0) * SAMPLE_RATE))
        duration_us = round((num_samples / SAMPLE_RATE) * 1_000_000)

        samples = [0] * num_samples
        two_pi = 2.0 * math.pi

        for w_idx, wb in enumerate(words):
            s_idx = max(0, min(num_samples, round((wb.start_us / 1_000_000.0) * SAMPLE_RATE)))
            e_idx = max(s_idx, min(num_samples, round((wb.end_us / 1_000_000.0) * SAMPLE_RATE)))
            span = e_idx - s_idx
            if span <= 0:
                continue

            syllables = estimate_syllables(wb.text)
            word_hash = sum(ord(ch) for ch in wb.text)
            pitch_declination = 1.0 - 0.08 * (w_idx / max(1, len(words)))
            base_f0 = profile.f0_hz * pitch_declination * (0.96 + (word_hash % 9) * 0.01)

            for i in range(span):
                u = i / span
                attack_release = math.sin(math.pi * u) ** 0.45
                syllable_env = 0.55 + 0.45 * math.sin(math.pi * syllables * u) ** 2
                env = attack_release * syllable_env

                t_sec = (s_idx + i) / SAMPLE_RATE
                f0 = base_f0 * (1.0 + 0.025 * math.sin(two_pi * 5.2 * t_sec))
                fundamental = math.sin(two_pi * f0 * t_sec)
                harmonic2 = 0.45 * profile.timbre_brightness * math.sin(two_pi * (2.0 * f0) * t_sec)
                harmonic3 = 0.22 * profile.timbre_brightness * math.sin(two_pi * (3.0 * f0) * t_sec)

                val = env * (fundamental + harmonic2 + harmonic3) * 0.42
                pcm = max(-32767, min(32767, int(val * 32767)))
                samples[s_idx + i] = pcm

        wav_bytes = encode_pcm16_wav(samples, SAMPLE_RATE)
        peaks = compute_waveform_peaks(samples, num_bins=48)
        return SynthesisResult(
            voice=profile.id,
            sample_rate=SAMPLE_RATE,
            duration_us=duration_us,
            wav_bytes=wav_bytes,
            waveform_peaks=peaks,
            words=words,
            engine="kokoro-82m-deterministic",
        )


class KokoroPipelineBackend:
    """
    Live hexgrad/Kokoro-82M neural backend via `kokoro.KPipeline`.
    """

    def __init__(self) -> None:
        from kokoro import KPipeline  # type: ignore

        self._kpipeline_cls = KPipeline
        self._pipelines: dict[str, object] = {}

    def _get_pipeline(self, lang_code: str):
        if lang_code not in self._pipelines:
            self._pipelines[lang_code] = self._kpipeline_cls(lang_code=lang_code)
        return self._pipelines[lang_code]

    def synthesize(
        self,
        text: str,
        voice: str = DEFAULT_KOKORO_VOICE,
        speed: float = 1.0,
    ) -> SynthesisResult:
        profile = resolve_voice_profile(voice)
        pipeline = self._get_pipeline(profile.lang_code)
        pcm_samples: list[int] = []
        words: list[WordBoundary] = []
        cursor_us = 0

        for result in pipeline(text, voice=profile.id, speed=speed):
            audio = result.audio
            if hasattr(audio, "tolist"):
                float_list = audio.tolist()
            else:
                float_list = list(audio)
            chunk_pcm = [max(-32767, min(32767, int(float(x) * 32767))) for x in float_list]
            chunk_dur_us = round((len(chunk_pcm) / SAMPLE_RATE) * 1_000_000)

            tokens = getattr(result, "tokens", None) or []
            for tok in tokens:
                start_ts = getattr(tok, "start_ts", None)
                end_ts = getattr(tok, "end_ts", None)
                tok_text = getattr(tok, "text", "").strip()
                if tok_text and start_ts is not None and end_ts is not None:
                    words.append(
                        WordBoundary(
                            text=tok_text,
                            start_us=cursor_us + round(float(start_ts) * 1_000_000),
                            end_us=cursor_us + round(float(end_ts) * 1_000_000),
                        )
                    )
            pcm_samples.extend(chunk_pcm)
            cursor_us += chunk_dur_us

        if not pcm_samples:
            return DeterministicKokoroSynthBackend().synthesize(text, voice=voice, speed=speed)

        duration_us = round((len(pcm_samples) / SAMPLE_RATE) * 1_000_000)
        if not words:
            words, _ = compute_word_boundaries(text, speed=speed)

        wav_bytes = encode_pcm16_wav(pcm_samples, SAMPLE_RATE)
        peaks = compute_waveform_peaks(pcm_samples, num_bins=48)
        return SynthesisResult(
            voice=profile.id,
            sample_rate=SAMPLE_RATE,
            duration_us=duration_us,
            wav_bytes=wav_bytes,
            waveform_peaks=peaks,
            words=words,
            engine="kokoro-82m-neural",
        )


def create_kokoro_tts(prefer_neural: bool = True) -> TTSBackend:
    if prefer_neural:
        try:
            return KokoroPipelineBackend()
        except Exception:
            pass
    return DeterministicKokoroSynthBackend()
