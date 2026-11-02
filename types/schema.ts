export type SlideTransitionStyle =
  | "fade"
  | "slide-left"
  | "zoom-punch"
  | "wipe-up"
  | "flip-3d"
  | "cut";

export type ThreeDScenePreset =
  | "none"
  | "cyber-globe"
  | "floating-cubes"
  | "neural-network"
  | "energy-torus"
  | "starfield-warp"
  | "trophy-arena";

export type CaptionVisualStyle =
  | "hormozi"
  | "karaoke-pill"
  | "cinema-minimal"
  | "neon-cyber";

export type CaptionPresetId =
  | "veed-box"
  | "hormozi"
  | "karaoke"
  | "neon-glow"
  | "word-slam"
  | "editorial";

export type CaptionFontFamily =
  | "Inter"
  | "Montserrat"
  | "Space Grotesk"
  | "Playfair Display"
  | "JetBrains Mono"
  | "Bangers";

export type CaptionHighlightStyle =
  | "box-highlight"
  | "pop-scale"
  | "karaoke-fill"
  | "underline-slide"
  | "neon-pulse";

export type CaptionBackgroundStyle =
  | "glass-pill"
  | "solid-dark"
  | "none";

export interface CaptionStyleConfig {
  preset: CaptionPresetId;
  fontFamily: CaptionFontFamily;
  fontSize: number;
  highlightStyle: CaptionHighlightStyle;
  highlightColor: string;
  textColor: string;
  upcomingOpacity: number;
  backgroundStyle: CaptionBackgroundStyle;
  textTransform: "uppercase" | "capitalize" | "none";
  wordsPerChunk: number;
  verticalPosition: "bottom" | "middle" | "top";
  syncOffsetFrames: number;
  strokeWidth: number;
}

export const DEFAULT_CAPTION_CONFIG: CaptionStyleConfig = {
  preset: "veed-box",
  fontFamily: "Montserrat",
  fontSize: 42,
  highlightStyle: "box-highlight",
  highlightColor: "#6366f1",
  textColor: "#ffffff",
  upcomingOpacity: 0.5,
  backgroundStyle: "glass-pill",
  textTransform: "uppercase",
  wordsPerChunk: 4,
  verticalPosition: "bottom",
  syncOffsetFrames: 0,
  strokeWidth: 0,
};

export type CameraMotionType =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "tilt-3d"
  | "static";

export type GraphicOverlayType =
  | "stat-counter"
  | "lower-third"
  | "progress-ring"
  | "code-snippet"
  | "bar-chart"
  | "versus-battle"
  | "quote-card"
  | "timeline-milestone"
  | "kinetic-title";

export interface MasterVideoState {
  id: string;
  metadata: {
    title: string;
    fps: number;
    width: number; // e.g., 1080
    height: number; // e.g., 1920
    totalDurationInFrames: number;
  };
  audio: {
    voiceTrackUrl: string; // The Kokoro-generated .wav
    backgroundMusicUrl?: string;
    musicVolume: number; // For auto-ducking (e.g., 0.2)
  };
  captionConfig?: CaptionStyleConfig;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  // Timing is strictly governed by the Whisper audio timestamps
  startFrame: number;
  durationInFrames: number;

  // The spoken text for this specific scene block
  scriptText: string;
  wordTokens: WordToken[];

  // Slide transition & 3D WebGL scene options
  transitionStyle?: SlideTransitionStyle;
  threeDScene?: ThreeDScenePreset;
  threeDColor?: string;
  captionStyle?: CaptionVisualStyle;

  // Visual layers (Base -> 3D -> Overlays -> Mascot -> Captions)
  background: {
    type: "flux_klein" | "stock" | "color";
    src: string; // URL or local path or hex color
    motion: CameraMotionType;
    prompt?: string;
  };

  mascot: {
    isVisible: boolean;
    pose: "neutral" | "explaining" | "shocked" | "pointing";
    position: "left" | "center" | "right";
    entranceAnimation: "slide-up" | "pop-in" | "fade";
  };

  // Dynamic generic overlays that Remotion will render based on 'type'
  overlays: GraphicOverlay[];
}

export interface WordToken {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface GraphicOverlay {
  id: string;
  type: GraphicOverlayType;
  // Allows the LLM and UI to pass arbitrary data to the React component
  props: Record<string, any>;
}

export interface VisualReferenceItem {
  id: string;
  sceneId: string;
  title: string;
  description: string;
  reason: string;
  assetType: "brand_logo" | "person_photo" | "product_ui" | "style_reference";
  providedUrl?: string;
  status: "pending" | "provided" | "using_ai_fallback";
}

export interface ScriptOptimizationResult {
  title: string;
  summary: string;
  tone: string;
  factChecks: Array<{
    claim: string;
    sourceOrData: string;
    injectedStat?: string;
  }>;
  scenes: Scene[];
  visualReferences: VisualReferenceItem[];
}

export interface PipelineProgressEvent {
  type: "progress" | "complete" | "error";
  stage?: "synthesizing_speech" | "transcribing_alignment" | "packaging_assets" | "done";
  percent?: number;
  message?: string;
  audioUrl?: string;
  scenes?: Scene[];
  totalDurationInFrames?: number;
  error?: string;
}
