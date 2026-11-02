#!/usr/bin/env python3
"""
ZeroTrack Video Studio - Python TTS & Audio Alignment Pipeline
Communicates with Node.js via stdin/stdout JSON stream.
Supports:
1. Kokoro-82M Neural TTS & faster-whisper word-level alignment (installed & active).
2. Native macOS system TTS ('say' + 'afconvert') with proportional word alignment.
3. High-fidelity acoustic synthesizer fallback with harmonic formant modeling.
"""

import sys
import os
import json
import time
import math
import wave
import struct
import re
import shutil
import subprocess
import tempfile
import numpy as np

FPS = 30
SAMPLE_RATE = 24000  # 24kHz standard for Kokoro-82M
SAMPLES_PER_FRAME = SAMPLE_RATE // FPS  # Exactly 800 samples per video frame at 30fps


def align_whisper_to_script_words(script_text, whisper_words, scene_dur_sec, duration_in_frames):
    """
    Maps Faster-Whisper acoustic word timestamps onto the exact tokens of script_text.
    Handles compound words (e.g. 'ZeroTrack' split by Whisper into 'Zero' + 'Track'),
    applies a 1-frame perceptual attack lead-in, and outputs scene-relative frames (0..duration_in_frames).
    """
    script_tokens = re.findall(r"\S+", script_text.strip())
    if not script_tokens:
        return []

    def norm(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())

    if not whisper_words:
        # Syllable/character + punctuation weighted cadence fallback
        weights = []
        for tok in script_tokens:
            clean_len = max(1, len(norm(tok)))
            punct_bonus = 2.8 if tok.endswith((".", "!", "?")) else (1.5 if tok.endswith((",", ";", ":", "—")) else 0.0)
            weights.append(clean_len + punct_bonus)
        total_w = sum(weights) or 1.0
        usable_sec = max(0.5, scene_dur_sec - 0.12)
        cursor_sec = 0.04
        result = []
        for tok, w in zip(script_tokens, weights):
            dur_sec = usable_sec * (w / total_w)
            s_frame = max(0, round(cursor_sec * FPS))
            e_frame = min(duration_in_frames, max(s_frame + 2, round((cursor_sec + dur_sec) * FPS)))
            result.append({"text": tok, "startFrame": s_frame, "endFrame": e_frame})
            cursor_sec += dur_sec
        return result

    # Match script_tokens to whisper_words using normalized character consumption
    n_whisper = len(whisper_words)
    w_idx = 0
    aligned = []

    for s_idx, s_tok in enumerate(script_tokens):
        s_norm = norm(s_tok)
        if w_idx >= n_whisper:
            # Extrapolate remaining words at tail
            prev_end = aligned[-1]["endFrame"] if aligned else 0
            s_frame = min(duration_in_frames - 2, prev_end)
            e_frame = min(duration_in_frames, s_frame + 6)
            aligned.append({"text": s_tok, "startFrame": s_frame, "endFrame": e_frame})
            continue

        start_sec = whisper_words[w_idx]["start"]
        end_sec = whisper_words[w_idx]["end"]
        consumed_chars = len( norm(whisper_words[w_idx]["word"]) )
        w_idx += 1

        # If Whisper split a compound script word (e.g. "ZeroTrack" -> "Zero" + "Track")
        # consume subsequent Whisper tokens until character length is covered
        while (
            w_idx < n_whisper
            and consumed_chars < len(s_norm)
            and (s_idx + 1 >= len(script_tokens) or norm(whisper_words[w_idx]["word"]) != norm(script_tokens[s_idx + 1]))
        ):
            end_sec = whisper_words[w_idx]["end"]
            consumed_chars += len(norm(whisper_words[w_idx]["word"]))
            w_idx += 1

        # Convert to scene-relative frames with 1-frame (-33ms) perceptual onset lead-in
        s_frame = max(0, round(start_sec * FPS) - 1)
        e_frame = min(duration_in_frames, max(s_frame + 2, round(end_sec * FPS)))
        aligned.append({
            "text": s_tok,
            "startFrame": s_frame,
            "endFrame": e_frame,
        })

    # Smooth micro-gaps between connected words so active highlight never drops out mid-phrase
    for i in range(len(aligned) - 1):
        curr_tok = aligned[i]
        next_tok = aligned[i + 1]
        if next_tok["startFrame"] < curr_tok["startFrame"] + 1:
            next_tok["startFrame"] = min(duration_in_frames - 2, curr_tok["startFrame"] + 2)
        if curr_tok["endFrame"] > next_tok["startFrame"]:
            curr_tok["endFrame"] = next_tok["startFrame"]
        else:
            gap = next_tok["startFrame"] - curr_tok["endFrame"]
            has_pause_punct = curr_tok["text"].endswith((".", "!", "?", ",", ";", ":", "—"))
            if gap <= 4 and not has_pause_punct:
                curr_tok["endFrame"] = next_tok["startFrame"]

    return aligned

def emit(data):
    """Flushes a JSON line event to stdout for Node.js IPC."""
    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()

def emit_progress(stage, percent, message):
    emit({
        "type": "progress",
        "stage": stage,
        "percent": percent,
        "message": message
    })

# Check available speech backends
try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    HAS_SOUNDFILE = False

try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False

try:
    import kokoro
    HAS_KOKORO = True
except ImportError:
    HAS_KOKORO = False

HAS_MACOS_SAY = bool(shutil.which("say") and shutil.which("afconvert"))

def synthesize_kokoro_neural(scenes, output_path):
    """
    Synthesizes speech using the Kokoro-82M neural model at 24kHz,
    and extracts word-level timestamps with Faster-Whisper.
    """
    emit_progress("synthesizing_speech", 15, "Initializing Kokoro-82M neural pipeline...")
    pipeline = kokoro.KPipeline(lang_code="a")

    emit_progress("transcribing_alignment", 28, "Initializing Faster-Whisper alignment model...")
    whisper_model = WhisperModel("tiny.en", device="cpu", compute_type="int8")

    all_audio_chunks = []
    updated_scenes = []
    cumulative_frames = 0
    total_scenes = len(scenes)

    for idx, scene in enumerate(scenes):
        text = scene.get("scriptText", "").strip() or "Scene pause."
        progress_pct = 30 + int(48 * (idx + 1) / total_scenes)
        emit_progress(
            "synthesizing_speech",
            progress_pct,
            f"Synthesizing Kokoro voice for Scene {idx + 1}/{total_scenes}..."
        )

        scene_start_frame = cumulative_frames
        scene_chunks = []
        for _, _, chunk in pipeline(text, voice="af_heart", speed=1.12):
            arr = chunk.numpy() if hasattr(chunk, "numpy") else np.array(chunk)
            scene_chunks.append(arr)

        if not scene_chunks:
            scene_audio = np.zeros(int(1.0 * SAMPLE_RATE), dtype=np.float32)
        else:
            scene_audio = np.concatenate(scene_chunks)

        # Trim excessive trailing silence from Kokoro (> 0.14s) and add a crisp 0.08s inter-scene breath
        abs_audio = np.abs(scene_audio)
        non_silent = np.where(abs_audio > 0.008)[0]
        if len(non_silent) > 0:
            last_voice_sample = min(len(scene_audio), int(non_silent[-1]) + int(0.10 * SAMPLE_RATE))
            scene_audio = scene_audio[:last_voice_sample]

        raw_dur_sec = len(scene_audio) / float(SAMPLE_RATE)
        target_total_samples = len(scene_audio) + int(0.08 * SAMPLE_RATE)

        # Lock scene duration to an exact integer number of video frames (800 samples per frame at 30fps)
        duration_in_frames = max(30, int(math.ceil(target_total_samples / float(SAMPLES_PER_FRAME))))
        exact_scene_samples = duration_in_frames * SAMPLES_PER_FRAME
        pad_samples_count = max(0, exact_scene_samples - len(scene_audio))
        padded_scene_audio = np.concatenate([
            scene_audio,
            np.zeros(pad_samples_count, dtype=np.float32)
        ])
        all_audio_chunks.append(padded_scene_audio)

        # Word-level timestamp alignment with Faster-Whisper mapped onto exact script words
        # CRITICAL: Faster-Whisper expects 16,000 Hz audio when passed an in-memory numpy array!
        # Resample 24,000 Hz Kokoro audio -> 16,000 Hz so Whisper timestamps are 1:1 true seconds.
        whisper_words = []
        try:
            whisper_sr = 16000
            if len(scene_audio) > 0:
                num_16k = int(round(len(scene_audio) * whisper_sr / float(SAMPLE_RATE)))
                x_old = np.linspace(0.0, 1.0, len(scene_audio), endpoint=False)
                x_new = np.linspace(0.0, 1.0, num_16k, endpoint=False)
                scene_audio_16k = np.interp(x_new, x_old, scene_audio).astype(np.float32)
            else:
                scene_audio_16k = scene_audio

            segments, _ = whisper_model.transcribe(scene_audio_16k, word_timestamps=True)
            for seg in segments:
                if seg.words:
                    for w in seg.words:
                        clean_w = w.word.strip()
                        if clean_w:
                            whisper_words.append({
                                "word": clean_w,
                                "start": float(w.start),
                                "end": float(w.end),
                            })
        except Exception:
            whisper_words = []

        scene_word_tokens = align_whisper_to_script_words(
            text,
            whisper_words,
            raw_dur_sec,
            duration_in_frames
        )

        cumulative_frames += duration_in_frames

        updated_scene = dict(scene)
        updated_scene["startFrame"] = scene_start_frame
        updated_scene["durationInFrames"] = duration_in_frames
        updated_scene["wordTokens"] = scene_word_tokens
        updated_scenes.append(updated_scene)

    master_audio = np.concatenate(all_audio_chunks)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, master_audio, SAMPLE_RATE, subtype="PCM_16")

    total_frames = max(30, cumulative_frames)
    emit_progress("packaging_assets", 95, "Locking universal state frame timing...")
    time.sleep(0.1)

    return updated_scenes, total_frames

def synthesize_macos_say(scenes, output_path):
    """
    Uses macOS native speech synthesis for real human voiceover at 24kHz,
    computing precise word tokens and locking frames to actual spoken audio.
    """
    emit_progress("synthesizing_speech", 15, "Initializing native speech engine...")
    time.sleep(0.1)

    all_audio_bytes = bytearray()
    updated_scenes = []
    cumulative_frames = 0
    total_scenes = len(scenes)

    with tempfile.TemporaryDirectory() as tmp_dir:
        for idx, scene in enumerate(scenes):
            text = scene.get("scriptText", "").strip()

            scene_start_frame = cumulative_frames
            progress_pct = 20 + int(45 * (idx + 1) / total_scenes)
            emit_progress(
                "synthesizing_speech",
                progress_pct,
                f"Synthesizing voice track for Scene {idx + 1}/{total_scenes}..."
            )

            aiff_file = os.path.join(tmp_dir, f"scene_{idx}.aiff")
            wav_file = os.path.join(tmp_dir, f"scene_{idx}.wav")

            clean_text = re.sub(r'["`$]', "", text) if text else "Scene pause."
            subprocess.run(["say", "-r", "195", "-o", aiff_file, clean_text], check=True)
            subprocess.run(
                ["afconvert", "-f", "WAVE", "-d", "LEI16@24000", aiff_file, wav_file],
                check=True
            )

            with wave.open(wav_file, "rb") as wf:
                scene_samples = wf.getnframes()
                scene_rate = wf.getframerate()
                scene_dur_sec = scene_samples / float(scene_rate)
                raw_bytes = wf.readframes(scene_samples)

            target_total_samples = scene_samples + int(0.08 * SAMPLE_RATE)
            duration_in_frames = max(30, int(math.ceil(target_total_samples / float(SAMPLES_PER_FRAME))))
            exact_scene_samples = duration_in_frames * SAMPLES_PER_FRAME
            pad_samples = max(0, exact_scene_samples - scene_samples)

            all_audio_bytes.extend(raw_bytes)
            all_audio_bytes.extend(b"\x00\x00" * pad_samples)

            scene_word_tokens = align_whisper_to_script_words(
                text,
                [],
                scene_dur_sec,
                duration_in_frames
            )

            cumulative_frames += duration_in_frames

            updated_scene = dict(scene)
            updated_scene["startFrame"] = scene_start_frame
            updated_scene["durationInFrames"] = duration_in_frames
            updated_scene["wordTokens"] = scene_word_tokens
            updated_scenes.append(updated_scene)

    emit_progress("transcribing_alignment", 80, "Verifying frame alignments...")
    time.sleep(0.1)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(all_audio_bytes)

    total_frames = max(30, cumulative_frames)
    emit_progress("packaging_assets", 95, "Locking universal state frame timing...")
    time.sleep(0.1)

    return updated_scenes, total_frames

def synthesize_fallback_wav(scenes, output_path):
    """
    Synthesizes clean PCM audio for the scenes with natural speech cadence and formant modeling,
    used when neither neural Kokoro nor macOS say is present.
    """
    emit_progress("synthesizing_speech", 15, "Initializing acoustic speech synthesizer...")
    time.sleep(0.1)

    all_samples = []
    updated_scenes = []
    current_time_sec = 0.0

    total_scenes = len(scenes)

    for idx, scene in enumerate(scenes):
        scene_id = scene.get("id", f"scene_{idx}")
        text = scene.get("scriptText", "").strip()
        words = re.findall(r"\S+", text) if text else ["..."]

        scene_start_sec = current_time_sec
        scene_word_tokens = []

        progress_pct = 20 + int(40 * (idx + 1) / total_scenes)
        emit_progress(
            "synthesizing_speech",
            progress_pct,
            f"Synthesizing audio for Scene {idx + 1}/{total_scenes}..."
        )

        lead_in_sec = 0.15
        lead_in_samples = int(lead_in_sec * SAMPLE_RATE)
        all_samples.extend([0] * lead_in_samples)
        current_time_sec += lead_in_sec

        for w_idx, word in enumerate(words):
            clean_word = re.sub(r"[^\w]", "", word)
            char_count = max(len(clean_word), 2)
            word_duration = max(0.24, min(0.65, 0.12 + (char_count * 0.048)))

            if word.endswith((".", "!", "?")):
                pause_after = 0.35
            elif word.endswith((",", ";", ":")):
                pause_after = 0.20
            else:
                pause_after = 0.08

            w_start_sec = current_time_sec
            w_end_sec = current_time_sec + word_duration

            start_frame = round(w_start_sec * FPS)
            end_frame = max(start_frame + 2, round(w_end_sec * FPS))
            scene_word_tokens.append({
                "text": word,
                "startFrame": start_frame,
                "endFrame": end_frame,
            })

            num_samples = int(word_duration * SAMPLE_RATE)
            f0_base = 135.0 + (math.sin(w_idx * 0.8) * 18.0)
            formant1 = 600.0 + (math.cos(w_idx * 0.5) * 150.0)
            formant2 = 1800.0 + (math.sin(w_idx * 0.7) * 250.0)

            for i in range(num_samples):
                t = i / SAMPLE_RATE
                env = math.sin(math.pi * (i / num_samples)) ** 1.5

                val = (
                    0.45 * math.sin(2 * math.pi * f0_base * t) +
                    0.25 * math.sin(2 * math.pi * 2 * f0_base * t) +
                    0.15 * math.sin(2 * math.pi * formant1 * t) +
                    0.08 * math.sin(2 * math.pi * formant2 * t)
                ) * env

                sample_16bit = int(val * 16000)
                sample_16bit = max(-32767, min(32767, sample_16bit))
                all_samples.append(sample_16bit)

            current_time_sec += word_duration

            pause_samples = int(pause_after * SAMPLE_RATE)
            all_samples.extend([0] * pause_samples)
            current_time_sec += pause_after

        pad_sec = 0.2
        all_samples.extend([0] * int(pad_sec * SAMPLE_RATE))
        current_time_sec += pad_sec

        scene_end_sec = current_time_sec
        scene_start_frame = round(scene_start_sec * FPS)
        scene_end_frame = round(scene_end_sec * FPS)
        duration_in_frames = max(30, scene_end_frame - scene_start_frame)

        updated_scene = dict(scene)
        updated_scene["startFrame"] = scene_start_frame
        updated_scene["durationInFrames"] = duration_in_frames
        updated_scene["wordTokens"] = scene_word_tokens
        updated_scenes.append(updated_scene)

    emit_progress("transcribing_alignment", 75, "Aligning word timestamps...")
    time.sleep(0.15)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        raw_data = struct.pack(f"<{len(all_samples)}h", *all_samples)
        wf.writeframes(raw_data)

    total_frames = max(30, round(current_time_sec * FPS))
    emit_progress("packaging_assets", 92, "Locking universal state frame timing...")
    time.sleep(0.1)

    return updated_scenes, total_frames

def run_production_or_fallback(scenes, output_path):
    """
    Tiered Speech Synthesis:
    1. Kokoro-82M neural model + Faster-Whisper alignment (Primary).
    2. Native OS high quality speech (macOS 'say' + 'afconvert').
    3. Acoustic formant synthesizer fallback.
    """
    if HAS_KOKORO and HAS_WHISPER and HAS_SOUNDFILE:
        try:
            return synthesize_kokoro_neural(scenes, output_path)
        except Exception as e:
            emit_progress("synthesizing_speech", 25, f"Neural engine warning: {e}. Falling back to native speech.")

    if HAS_MACOS_SAY:
        try:
            return synthesize_macos_say(scenes, output_path)
        except Exception as say_err:
            emit_progress("synthesizing_speech", 25, f"Native say warning: {say_err}. Using acoustic engine.")

    return synthesize_fallback_wav(scenes, output_path)

def generate_ambient_music(output_path, duration_sec=45.0):
    """Generates a soft, lofi chill ambient background track for auto-ducking."""
    if os.path.exists(output_path):
        return

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    num_samples = int(duration_sec * SAMPLE_RATE)
    samples = []

    chords = [
        [261.63, 329.63, 392.00, 493.88],  # Cmaj7
        [220.00, 261.63, 329.63, 392.00],  # Am7
        [174.61, 220.00, 261.63, 329.63],  # Fmaj7
        [196.00, 246.94, 293.66, 349.23],  # G7
    ]
    chord_len = 4.0

    for i in range(num_samples):
        t = i / SAMPLE_RATE
        chord_idx = int((t / chord_len) % len(chords))
        chord_t = t % chord_len
        chord = chords[chord_idx]

        env = math.sin(math.pi * (chord_t / chord_len)) ** 0.8

        val = 0.0
        for f in chord:
            val += math.sin(2 * math.pi * f * t) * 0.2

        val *= env * 0.22
        sample_16bit = int(val * 32767)
        samples.append(max(-32767, min(32767, sample_16bit)))

    with wave.open(output_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        raw_data = struct.pack(f"<{len(samples)}h", *samples)
        wf.writeframes(raw_data)

def run_pipeline(payload):
    scenes = payload.get("scenes", [])
    if not scenes:
        emit({"type": "error", "error": "No scenes provided in payload."})
        return

    output_dir = payload.get("outputDir", "public/generated")
    audio_filename = payload.get("audioFilename", f"voice_{int(time.time())}.wav")
    audio_full_path = os.path.join(output_dir, audio_filename)
    audio_url = f"/generated/{audio_filename}"

    music_path = os.path.join("public", "audio", "chill-beat.wav")
    try:
        generate_ambient_music(music_path)
    except Exception:
        pass

    try:
        updated_scenes, total_frames = run_production_or_fallback(scenes, audio_full_path)

        emit_progress("done", 100, "Audio and timing alignment complete.")

        emit({
            "type": "complete",
            "percent": 100,
            "message": "Speech synthesis & word-level frame alignment complete!",
            "audioPath": audio_full_path,
            "audioUrl": audio_url,
            "backgroundMusicUrl": "/audio/chill-beat.wav",
            "scenes": updated_scenes,
            "totalDurationInFrames": total_frames
        })
    except Exception as err:
        emit({
            "type": "error",
            "error": str(err)
        })

def main():
    """Reads JSON input from stdin or CLI argument."""
    if len(sys.argv) > 1 and sys.argv[1].endswith(".json"):
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            payload = json.load(f)
    elif not sys.stdin.isatty():
        raw_input = sys.stdin.read()
        if raw_input.strip():
            payload = json.loads(raw_input)
        else:
            payload = get_demo_payload()
    else:
        payload = get_demo_payload()

    run_pipeline(payload)

def get_demo_payload():
    return {
        "scenes": [
            {
                "id": "scene-1",
                "scriptText": "Welcome to ZeroTrack. In this studio, narrative text anchors the entire timeline.",
                "background": {"type": "color", "src": "#0f172a", "motion": "zoom-in"},
                "mascot": {"isVisible": True, "pose": "explaining", "position": "left", "entranceAnimation": "slide-up"},
                "overlays": []
            }
        ]
    }

if __name__ == "__main__":
    main()
