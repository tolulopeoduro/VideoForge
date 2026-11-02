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
