import path from "node:path";
import { Worker } from "bullmq";
import pg from "pg";
import { Project, QUEUES, type RenderJob } from "@vf/schema";
import { exportProjectToMp4 } from "./export";

export { encodeMonoPcm16Wav, exportProjectToMp4, projectDurationUs, resolveFfmpegBin } from "./export";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR ?? path.resolve(process.cwd(), "renders");

export function startRenderWorker() {
  const worker = new Worker<RenderJob>(
    QUEUES.render,
    async (job) => {
      const { projectId, version } = job.data;
      const r = await pool.query("SELECT version, doc FROM projects WHERE id = $1", [projectId]);
      if (!r.rowCount) {
        throw new Error(`Project ${projectId} not found`);
      }
      const project = Project.parse(r.rows[0].doc);
      const outputPath = path.join(OUTPUT_DIR, `${projectId}_v${version}.mp4`);

      const result = await exportProjectToMp4(project, {
        outputPath,
        onProgress: (done, total) => {
          void job.updateProgress(Math.round((done / total) * 100));
        },
      });

      return {
        status: "completed",
        outputPath: result.outputPath,
        frames: result.frames,
        durationUs: result.durationUs,
      };
    },
    { connection: { url: process.env.REDIS_URL ?? "redis://localhost:6379" } },
  );
  return worker;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startRenderWorker();
  console.log("render worker listening");
}
