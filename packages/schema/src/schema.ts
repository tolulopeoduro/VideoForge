import { z } from "zod";

export const Us = z.number().int();
export const Id = z.string().min(1);

const Ease = z.union([
  z.enum(["linear", "easeIn", "easeOut", "easeInOut"]),
  z.object({ bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]) }),
]);
export type EaseT = z.infer<typeof Ease>;

/** Animatable property: a constant, or keyframes. Keyframe `t` is CLIP-LOCAL time. */
export const Prop = <T extends z.ZodTypeAny>(v: T) =>
  z.union([
    z.object({ value: v }),
    z.object({ keys: z.array(z.object({ t: Us, v, ease: Ease })).min(1) }),
  ]);
export const NumProp = Prop(z.number());
export type NumProp = z.infer<typeof NumProp>;

export const Transform = z.object({
  x: NumProp, // fraction of canvas width, 0..1 (center)
  y: NumProp,
  scale: NumProp,
  rotation: NumProp,
  opacity: NumProp,
  crop: z.object({ l: z.number(), t: z.number(), r: z.number(), b: z.number() }).optional(),
  fit: z.enum(["cover", "contain", "stretch"]),
});
export type Transform = z.infer<typeof Transform>;

export const Effect = z.object({
  id: Id,
  type: z.string(),
  params: z.record(Prop(z.union([z.number(), z.string()]))),
  enabled: z.boolean(),
});

export const Transition = z.object({
  type: z.enum(["cut", "fade", "slide", "wipe"]),
  duration: Us,
  params: z.record(z.unknown()).optional(),
});

export const Provenance = z.object({
  origin: z.enum(["ai", "user"]),
  locked: z.boolean(),
  userModified: z.boolean(),
  generator: z
    .object({
      step: z.enum(["match", "tts", "script"]),
      candidateSetId: Id.optional(),
      score: z.number().optional(),
    })
    .optional(),
});
export type Provenance = z.infer<typeof Provenance>;

export const TextContent = z.object({
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number(),
  color: z.string(),
  align: z.enum(["left", "center", "right"]),
});

export const Clip = z.object({
  id: Id,
  trackId: Id,
  kind: z.enum(["media", "text", "shape", "caption-block"]),
  start: Us,
  duration: Us,
  source: z.object({ assetId: Id, in: Us, speed: z.number().positive() }).optional(),
  text: TextContent.optional(),
  transform: Transform,
  effects: z.array(Effect),
  transitionIn: Transition.optional(),
  transitionOut: Transition.optional(),
  audio: z
    .object({
      gain: NumProp,
      fadeIn: Us,
      fadeOut: Us,
      duckUnderVoice: z.boolean().optional(),
    })
    .optional(),
  provenance: Provenance,
  sceneId: Id.optional(),
});
export type Clip = z.infer<typeof Clip>;

export const Track = z.object({
  id: Id,
  kind: z.enum(["video", "audio", "text", "overlay"]),
  name: z.string(),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
  height: z.number(),
});
export type Track = z.infer<typeof Track>;

export const Asset = z.object({
  id: Id,
  type: z.enum(["video", "image", "audio"]),
  uri: z.string(), // storage key, never a signed URL
  durationUs: Us.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  origin: z.enum(["upload", "stock", "generated"]),
  license: z
    .object({ provider: z.string(), providerId: z.string(), terms: z.string(), attribution: z.string().optional() })
    .optional(),
  proxyUri: z.string().optional(),
  thumbsSprite: z.object({ uri: z.string(), intervalUs: Us, cols: z.number() }).optional(),
  waveformPeaksUri: z.string().optional(),
});
export type Asset = z.infer<typeof Asset>;

export const Scene = z.object({
  id: Id,
  narration: z.string(),
  intent: z.object({
    literal: z.string(),
    abstract: z.string().optional(),
    mood: z.string().optional(),
    keywords: z.array(z.string()),
    avoid: z.array(z.string()).optional(),
  }),
  clipIds: z.array(Id),
  voiceClipId: Id.optional(),
  locked: z.boolean(),
});
export type Scene = z.infer<typeof Scene>;

export const CaptionTrack = z.object({
  words: z.array(z.object({ text: z.string(), start: Us, end: Us, sceneId: Id.optional() })),
  styleId: Id,
  overrides: z.record(z.record(z.unknown())),
});

export const Marker = z.object({ id: Id, t: Us, label: z.string().optional() });

export const Project = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  meta: z.object({ title: z.string(), createdAt: z.string(), updatedAt: z.string() }),
  canvas: z.object({ width: z.number().int(), height: z.number().int(), fps: z.number(), bg: z.string() }),
  assets: z.record(Asset),
  tracks: z.array(Track), // bottom -> top (z-order)
  clips: z.record(Clip),
  scenes: z.array(Scene),
  captions: CaptionTrack.nullable(),
  markers: z.array(Marker),
  generation: z.object({
    runs: z.array(
      z.object({
        id: Id,
        at: z.string(),
        step: z.string(),
        model: z.string().optional(),
        params: z.record(z.unknown()).optional(),
      }),
    ),
  }),
});
export type Project = z.infer<typeof Project>;
