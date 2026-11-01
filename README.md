# ZeroTrack Studio 🎬

> **Local-First, Script-Driven AI Video Studio powered by Semantic Anchoring**

ZeroTrack replaces traditional complex multitrack video editors with **"Semantic Anchoring"**—the narrative script is the single source of truth that drives frame durations, voice synthesis, word-level subtitle alignment, visual layers, and physics animations.

---

## ⚡ Tech Stack & Architecture

- **Frontend & UI**: Next.js 14 (App Router), Tailwind CSS, Lucide Icons.
- **Video Composition & Engine**: Remotion 4.0 (`@remotion/player` for 30 FPS real-time web preview, `@remotion/renderer` for local MP4 export).
- **Text-to-Speech**: Kokoro-82M vocal synthesizer (local Python child process with frame-locked acoustic fallback).
- **Audio Alignment**: `faster-whisper` for word-level millisecond timestamps (`startFrame`, `endFrame`).
- **Background Generation**: fal.ai FLUX Klein API with built-in procedural visualizer fallback.
- **IPC Orchestration**: Node.js `child_process.spawn()` communicating with Python via bidirectional JSON streams (`sys.stdout.flush()`).

---

## 🧭 The Conversational Onboarding Workflow (Step-by-Step)

Before landing in the 3-panel studio, ZeroTrack guides users through a 4-step conversational setup:

```
[ Step 1: Idea / Script ] ➔ [ Step 2: LLM Optimization ] ➔ [ Step 3: Visual References ] ➔ [ Step 4: Pre-Flight Check & Launch ]
```

1. **Step 1: Prompt or Draft Submission**:
   - Submit a raw topic prompt or paste an unformatted script draft.
   - Choose tone & pacing (*Viral Hook*, *Tech Deep Dive*, *Product Launch*, *Case Study*).
   - Select canvas format (9:16 Vertical for TikTok/Shorts or 16:9 Landscape for YouTube).
2. **Step 2: LLM Script Optimization & Fact Injection**:
   - Restructures raw thoughts into high-retention scenes (Hook ➔ Proof ➔ CTA).
   - Injects verified data points, statistics, and fact-checked citations.
   - Assigns brand mascot avatar poses (`neutral`, `explaining`, `shocked`, `pointing`) and Remotion graphic overlays (`stat-counter`, `lower-third`, `progress-ring`, `code-snippet`).
3. **Step 3: Visual References & Legal Trademark Assets**:
   - Detects specific people, brands, logos, or proprietary software UIs that FLUX Klein cannot legally or accurately generate.
   - Allows users to provide authentic legal copies (image URLs, custom uploads) or select from curated royalty-free presets.
4. **Step 4: Pre-Flight Check & Studio Launch**:
   - Validates script cadence, avatar choreography, overlay readiness, and canvas resolution.
   - Loads the Universal JSON State into the studio and triggers Kokoro-82M TTS and Faster-Whisper audio alignment automatically.

---

The entire video is represented by a single immutable TypeScript schema (`types/schema.ts`):

```typescript
export interface MasterVideoState {
  id: string;
  metadata: {
    title: string;
    fps: number;
    width: number;
    height: number;
    totalDurationInFrames: number;
  };
  audio: {
    voiceTrackUrl: string;
    backgroundMusicUrl?: string;
    musicVolume: number;
  };
  scenes: Scene[];
}
```

---

## 🎨 Brand Mascot (Lightbulb Character)

ZeroTrack does **NOT** use inconsistent generative AI characters. Instead, it utilizes a consistent, high-fidelity brand mascot:
- **Design**: Comic-ink lightbulb-headed character in a navy blue suit jacket, white turtleneck sweater, brass collar, and formal white gloves.
- **Poses**:
  - `neutral`: Relaxed posture, confident friendly smile.
  - `explaining`: Hand open palm upwards, articulate speaking mouth, warm radiant filament.
  - `shocked`: Wide eyes with pinhead pupils, electric filament zaps, hands raised in surprise.
  - `pointing`: Arm extended across frame with gloved finger pointing at the overlay!
- **Physics**: Governed by Remotion `spring()` with configurable entrance animations (`slide-up`, `pop-in`, `fade`) and organic idle sway.

---

## 🚀 Graphic Overlays

Scene overlays mount seamlessly over the video canvas:
- `stat-counter`: Animated numeric count-up with configurable prefix/suffix and label.
- `lower-third`: Broadcast title, subtitle, and category tag with animated gradient bar.
- `progress-ring`: Circular SVG progress indicator with animated percentage.
- `code-snippet`: Syntax-styled macOS terminal card with line numbers and blinking cursor.
- **Karaoke Captions**: Real-time active-word highlighted captions synchronized to Whisper word tokens.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Next.js Development Studio
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the 3-panel studio.

### 3. Audio Synchronization (Python IPC)
Click **"Sync Audio & Timing"** in the top navigation or left panel. ZeroTrack spawns `scripts/pipeline.py`, streams progress events to the live modal, and locks the scene frames and word tokens.

### 4. Export MP4 Video
Click **"Export MP4"** in the studio navbar, or run via CLI:
```bash
npm run remotion:render
```
The rendered video will be saved to `public/renders/`.

---

## 🧪 Testing Endpoints

- **Python IPC Pipeline**:
```bash
curl -N -X POST http://localhost:3000/api/pipeline \
  -H "Content-Type: application/json" \
  -d '{"scenes":[{"id":"test-1","scriptText":"ZeroTrack script-driven video generation."}]}'
```

- **FLUX Background Generation**:
```bash
curl -X POST http://localhost:3000/api/generate-background \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Futuristic minimalist neon data center, 8k"}'
```
