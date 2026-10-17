export const QUEUES = { generate: "generate", render: "render" } as const;
export interface RenderJob { projectId: string; version: number; preset: "1080p" | "720p" | "vertical-1080" }
