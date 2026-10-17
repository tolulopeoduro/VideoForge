import { Queue } from "bullmq";
import { QUEUES, type RenderJob } from "@vf/schema";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };
export const renderQueue = new Queue<RenderJob>(QUEUES.render, { connection });
export const generateQueue = new Queue(QUEUES.generate, { connection });
