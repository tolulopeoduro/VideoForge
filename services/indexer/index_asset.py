"""
Video asset indexer: detect shots, extract keyframes, compute quality metrics
(sharpness, brightness, motion, stability, watermark/text detection), generate
caption/tags + search_text, embed into 512-d vector, and insert into Postgres.

Usage: python3 index_asset.py <asset_id> <path-to-video>
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from typing import Any, Iterator, Optional, Protocol, Sequence

EMBEDDING_DIM = 512
WATERMARK_KEYWORDS = {"watermark", "shutterstock", "getty", "pond5", "adobe stock", "logo", "subtitles", "caption"}


class ShotCaptioner(Protocol):
    """Interface for VLM caption & tag extraction on a shot's keyframes."""

    def describe_shot(self, frames: Sequence[Any]) -> tuple[str, list[str]]:
        ...


class FrameEmbedder(Protocol):
    """Interface for 512-dim keyframe image embedding (OpenCLIP ViT-B-32 compatible)."""

    def embed_frames(self, frames: Sequence[Any]) -> list[float]:
        ...


def _to_grayscale_2d(frame: Any) -> list[list[float]]:
    """
    Convert a frame (NumPy array HxWxC / HxW or nested Python list) into a 2D
    grayscale float grid in 0..255.
    """
    if hasattr(frame, "tolist"):
        data = frame.tolist()
    else:
        data = frame

    if not data:
        return [[0.0]]

    rows: list[list[float]] = []
    for row in data:
        out_row: list[float] = []
        for px in row:
            if isinstance(px, (list, tuple)):
                if len(px) >= 3:
                    # BGR or RGB average luminance approximation
                    val = 0.114 * float(px[0]) + 0.587 * float(px[1]) + 0.299 * float(px[2])
                elif len(px) > 0:
                    val = float(px[0])
                else:
                    val = 0.0
            else:
                val = float(px)
            out_row.append(val)
        rows.append(out_row)
    return rows


def sharpness(frame: Any) -> float:
    """
    Compute normalized sharpness score in 0..1 using discrete Laplacian variance
    (uses OpenCV when available, with a pure-Python 2D Laplacian fallback).
    """
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        if isinstance(frame, np.ndarray):
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
            raw_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            return max(0.0, min(1.0, raw_var / 500.0))
    except ImportError:
        pass

    grid = _to_grayscale_2d(frame)
    h = len(grid)
    w = len(grid[0]) if h > 0 else 0
    if h < 3 or w < 3:
        return 0.0

    lap_vals: list[float] = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            center = grid[y][x]
            lap = (
                grid[y - 1][x]
                + grid[y + 1][x]
                + grid[y][x - 1]
                + grid[y][x + 1]
                - 4.0 * center
            )
            lap_vals.append(lap)

    mean = sum(lap_vals) / len(lap_vals)
    var = sum((v - mean) ** 2 for v in lap_vals) / len(lap_vals)
    return max(0.0, min(1.0, var / 500.0))


def compute_brightness(frame: Any) -> float:
    """Compute normalized mean brightness in 0..1."""
    grid = _to_grayscale_2d(frame)
    total = sum(sum(r) for r in grid)
    count = sum(len(r) for r in grid)
    if count == 0:
        return 0.0
    return max(0.0, min(1.0, (total / count) / 255.0))


def compute_motion_score(frames: Sequence[Any]) -> float:
    """
    Compute normalized frame-to-frame motion score in 0..1 from mean absolute
    pixel differences across consecutive keyframes.
    """
    if len(frames) < 2:
        return 0.0

    grids = [_to_grayscale_2d(f) for f in frames]
    diffs: list[float] = []
    for a, b in zip(grids[:-1], grids[1:]):
        h = min(len(a), len(b))
        w = min(len(a[0]) if h else 0, len(b[0]) if h else 0)
        if h == 0 or w == 0:
            continue
        delta_sum = 0.0
        for y in range(h):
            for x in range(w):
                delta_sum += abs(a[y][x] - b[y][x])
        diffs.append((delta_sum / (h * w)) / 255.0)

    if not diffs:
        return 0.0
    # Scale typical keyframe delta (0..0.25) into 0..1
    mean_diff = sum(diffs) / len(diffs)
    return max(0.0, min(1.0, mean_diff * 4.0))


def compute_stability_score(motion_score: float) -> float:
    """Estimate camera stability in 0..1 (penalizing extreme frame-to-frame shake)."""
    return max(0.0, min(1.0, 1.0 - max(0.0, motion_score - 0.3) / 0.7))


def detect_has_text_or_watermark(
    frames: Sequence[Any],
    caption: str = "",
    tags: Sequence[str] = (),
) -> bool:
    """
    Detect burned-in text / watermarks from caption/tags metadata or high-frequency
    high-contrast strokes in the frame interior/corners.
    """
    text_blob = f"{caption} {' '.join(tags)}".lower()
    for kw in WATERMARK_KEYWORDS:
        if kw in text_blob:
            return True

    if not frames:
        return False

    grid = _to_grayscale_2d(frames[0])
    h = len(grid)
    w = len(grid[0]) if h else 0
    if h < 4 or w < 4:
        return False

    # Count sharp adjacent binary-like contrast jumps (> 180 intensity delta)
    sharp_transitions = 0
    total_pairs = 0
    for y in range(h):
        for x in range(w - 1):
            total_pairs += 1
            if abs(grid[y][x + 1] - grid[y][x]) > 180.0:
                sharp_transitions += 1

    if total_pairs == 0:
        return False
    return (sharp_transitions / total_pairs) > 0.22


def build_search_text(caption: str, tags: Sequence[str]) -> str:
    """Normalize and combine caption and tags for Postgres full-text search (`search_text`)."""
    clean_caption = re.sub(r"\s+", " ", (caption or "").strip())
    seen = set(re.findall(r"[a-z0-9]+", clean_caption.lower()))
    extra_tags: list[str] = []
    for t in tags:
        clean_t = t.strip()
        if clean_t and clean_t.lower() not in seen:
            seen.add(clean_t.lower())
            extra_tags.append(clean_t)
    return " ".join(part for part in [clean_caption, " ".join(extra_tags)] if part).strip()


def analyze_shot_quality(
    frames: Sequence[Any],
    caption: str = "",
    tags: Sequence[str] = (),
) -> dict[str, Any]:
    """Compute the full `quality` JSONB dictionary for a shot."""
    if not frames:
        return {
            "sharpness": 0.0,
            "brightness": 0.0,
            "motion": 0.0,
            "stability": 1.0,
            "has_text": detect_has_text_or_watermark([], caption, tags),
        }

    sharp = sum(sharpness(f) for f in frames) / len(frames)
    bright = sum(compute_brightness(f) for f in frames) / len(frames)
    motion = compute_motion_score(frames)
    stability = compute_stability_score(motion)
    has_text = detect_has_text_or_watermark(frames, caption, tags)

    return {
        "sharpness": round(sharp, 4),
        "brightness": round(bright, 4),
        "motion": round(motion, 4),
        "stability": round(stability, 4),
        "has_text": has_text,
    }


def detect_shots(path: str) -> list[tuple[float, float]]:
    from scenedetect import ContentDetector, detect  # type: ignore

    return [(s.get_seconds(), e.get_seconds()) for s, e in detect(path, ContentDetector())]


def keyframes(path: str, start_s: float, end_s: float, every_s: float = 1.0) -> Iterator[Any]:
    import cv2  # type: ignore

    cap = cv2.VideoCapture(path)
    t = start_s
    while t < end_s:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if ok:
            yield frame
        t += every_s
    cap.release()


def index_shot_records(
    asset_id: str,
    shots_frames: Sequence[tuple[float, float, Sequence[Any]]],
    embedder: FrameEmbedder,
    captioner: Optional[ShotCaptioner] = None,
) -> list[dict[str, Any]]:
    """
    Pure indexing pipeline over detected `(start_s, end_s, frames)` tuples.
    Returns shot dicts ready for insertion into the Postgres `shots` table.
    """
    records: list[dict[str, Any]] = []
    for start_s, end_s, frames in shots_frames:
        if not frames:
            continue
        vec = embedder.embed_frames(frames)
        if len(vec) != EMBEDDING_DIM:
            raise ValueError(f"Expected {EMBEDDING_DIM}-dim embedding, got {len(vec)}")

        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]

        caption, tags = captioner.describe_shot(frames) if captioner else ("", [])
        search_text = build_search_text(caption, tags)
        quality = analyze_shot_quality(frames, caption=caption, tags=tags)

        records.append(
            {
                "asset_id": asset_id,
                "start_us": int(round(start_s * 1_000_000)),
                "end_us": int(round(end_s * 1_000_000)),
                "embedding": vec,
                "caption": caption,
                "tags": list(tags),
                "search_text": search_text,
                "quality": quality,
            }
        )
    return records


class OpenCLIPFrameEmbedder:
    """Default OpenCLIP ViT-B-32 frame embedder (512-dim, matching `vector(512)` in `init.sql`)."""

    def __init__(self, model_name: str = "ViT-B-32", pretrained: str = "laion2b_s34b_b79k") -> None:
        import open_clip  # type: ignore

        model, _, preprocess = open_clip.create_model_and_transforms(model_name, pretrained=pretrained)
        model.eval()
        self.model = model
        self.preprocess = preprocess

    def embed_frames(self, frames: Sequence[Any]) -> list[float]:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        import torch  # type: ignore
        from PIL import Image  # type: ignore

        imgs = torch.stack([self.preprocess(Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))) for f in frames])
        with torch.no_grad():
            emb = self.model.encode_image(imgs)
            emb = emb / emb.norm(dim=-1, keepdim=True)
        mean = emb.mean(dim=0).numpy().astype(np.float32)
        mean /= np.linalg.norm(mean)
        return [float(x) for x in mean.tolist()]


def main(asset_id: str, path: str) -> None:
    import psycopg  # type: ignore

    embedder = OpenCLIPFrameEmbedder()
    shot_tuples = [
        (start_s, end_s, list(keyframes(path, start_s, end_s)))
        for start_s, end_s in detect_shots(path)
    ]
    records = index_shot_records(asset_id, shot_tuples, embedder=embedder)

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        for rec in records:
            vec_literal = "[" + ",".join(f"{x:.6f}" for x in rec["embedding"]) + "]"
            conn.execute(
                "INSERT INTO shots (asset_id, start_us, end_us, embedding, caption, tags, search_text, quality) "
                "VALUES (%s, %s, %s, %s::vector, %s, %s, %s, %s::jsonb)",
                (
                    rec["asset_id"],
                    rec["start_us"],
                    rec["end_us"],
                    vec_literal,
                    rec["caption"],
                    rec["tags"],
                    rec["search_text"],
                    json.dumps(rec["quality"]),
                ),
            )


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
