import io
import unittest
import wave

from tts_kokoro import (
    KOKORO_VOICES,
    SAMPLE_RATE,
    DeterministicKokoroSynthBackend,
    create_kokoro_tts,
)


class TestKokoroTTS(unittest.TestCase):
    def test_synthesizes_valid_24khz_wav_and_integer_microseconds(self) -> None:
        tts = create_kokoro_tts(prefer_neural=False)
        res = tts.synthesize(
            "Our team starts every morning with a quick planning session.",
            voice="af_heart",
            speed=1.0,
        )
        self.assertEqual(res.voice, "af_heart")
        self.assertEqual(res.sample_rate, SAMPLE_RATE)
        self.assertIsInstance(res.duration_us, int)
        self.assertGreater(res.duration_us, 1_000_000)
        self.assertEqual(len(res.words), 10)
        self.assertEqual(res.words[0].text, "Our")
        self.assertEqual(res.words[-1].text, "session.")

        for wb in res.words:
            self.assertIsInstance(wb.start_us, int)
            self.assertIsInstance(wb.end_us, int)
            self.assertGreater(wb.end_us, wb.start_us)

        with wave.open(io.BytesIO(res.wav_bytes), "rb") as wf:
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2)
            self.assertEqual(wf.getframerate(), SAMPLE_RATE)
            expected_us = round((wf.getnframes() / SAMPLE_RATE) * 1_000_000)
            self.assertEqual(res.duration_us, expected_us)

    def test_supports_all_kokoro_voices_and_speed_scaling(self) -> None:
        tts = DeterministicKokoroSynthBackend()
        slow = tts.synthesize("Revenue grew steadily throughout the year.", voice="am_adam", speed=0.8)
        fast = tts.synthesize("Revenue grew steadily throughout the year.", voice="bf_emma", speed=1.25)

        self.assertIn("am_adam", KOKORO_VOICES)
        self.assertIn("bf_emma", KOKORO_VOICES)
        self.assertGreater(slow.duration_us, fast.duration_us)
        self.assertEqual(len(slow.waveform_peaks), 48)
        self.assertTrue(any(p > 0.05 for p in slow.waveform_peaks))


if __name__ == "__main__":
    unittest.main()
