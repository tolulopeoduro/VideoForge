import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { OpError, OpSchema, Project, applyChecked, createEmptyProject, type Op } from "@vf/schema";
import {
  DefaultKokoroTtsProvider,
  KOKORO_VOICES,
  buildKokoroProjectVoiceoverOp,
  type KokoroVoiceId,
  type TtsProvider,
} from "./tts";

export interface DbQueryResult<T = any> {
  rowCount: number | null;
  rows: T[];
}

export interface DbClientLike {
  query<T = any>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  release(): void;
}

export interface DbPoolLike {
  query<T = any>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  connect(): Promise<DbClientLike>;
}

export interface RenderJobStateLike {
  id?: string;
  progress?: unknown;
  returnvalue?: unknown;
  getState(): Promise<string>;
}

export interface RenderQueueLike {
  add(name: string, data: { projectId: string; version: number; preset: "720p" | "1080p" }): Promise<{ id?: string }>;
  getJob?(jobId: string): Promise<RenderJobStateLike | undefined | null>;
}

const EditEventBodySchema = z.object({
  sceneId: z.string().min(1).optional(),
  event: z.enum(["kept", "replaced_candidate", "replaced_upload", "intent_edited"]),
  payload: z.record(z.unknown()).default({}),
});

const KokoroVoiceEnum = z.enum(["af_heart", "af_bella", "am_adam", "am_michael", "bf_emma", "bm_george"]);

const TtsSynthesizeBodySchema = z.object({
  text: z.string().min(1),
  voice: KokoroVoiceEnum.default("af_heart"),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

export function buildApp(deps: {
  pool: DbPoolLike;
  renderQueue: RenderQueueLike;
  ttsProvider?: TtsProvider;
  logger?: boolean;
}): FastifyInstance {
  const { pool, renderQueue, ttsProvider = new DefaultKokoroTtsProvider(), logger = true } = deps;
  const app = Fastify({ logger });

  app.get("/health", async () => ({ ok: true }));

  app.get("/tts/voices", async () => ({
    model: "hexgrad/Kokoro-82M",
    voices: KOKORO_VOICES,
  }));

  app.post("/tts/synthesize", async (req) => {
    const body = TtsSynthesizeBodySchema.parse(req.body);
    return ttsProvider.synthesize({
      text: body.text,
      voice: body.voice as KokoroVoiceId,
      speed: body.speed,
    });
  });

  app.post("/projects", async (req, reply) => {
    const { title } = z.object({ title: z.string().min(1) }).parse(req.body);
    const doc = createEmptyProject({ id: crypto.randomUUID(), title });
    await pool.query("INSERT INTO projects (id, doc) VALUES ($1, $2)", [doc.id, doc]);
    return reply.code(201).send({ id: doc.id, version: 0, doc });
  });

  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await pool.query("SELECT version, doc FROM projects WHERE id = $1", [id]);
    if (!r.rowCount) return reply.code(404).send({ error: "not found" });
    return r.rows[0];
  });

  /**
   * The ONLY write path for edits. Clients send ops, the server applies the same reducer
   * the browser uses, validates invariants, and bumps the version (optimistic concurrency).
   */
  app.post("/projects/:id/ops", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        expectedVersion: z.number().int(),
        actor: z.enum(["user", "ai"]).default("user"),
        ops: z.array(OpSchema).min(1),
      })
      .parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query("SELECT version, doc FROM projects WHERE id = $1 FOR UPDATE", [id]);
      if (!r.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "not found" });
      }
      if (r.rows[0].version !== body.expectedVersion) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "version conflict", currentVersion: r.rows[0].version });
      }
      let doc: Project = Project.parse(r.rows[0].doc);
      for (const op of body.ops as Op[]) doc = applyChecked(doc, op, { actor: body.actor }).next;
      const version = body.expectedVersion + 1;
      await client.query("UPDATE projects SET doc = $1, version = $2, updated_at = now() WHERE id = $3", [
        doc,
        version,
        id,
      ]);
      await client.query("COMMIT");
      return { version, doc };
    } catch (e) {
      await client.query("ROLLBACK");
      if (e instanceof OpError) return reply.code(422).send({ error: e.message });
      throw e;
    } finally {
      client.release();
    }
  });

  /**
   * Synthesizes Kokoro-82M voiceover clips on track `a1` for unlocked scenes
   * and applies the resulting batch op via `applyChecked(doc, op, { actor: "ai" })`.
   */
  app.post("/projects/:id/tts", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        expectedVersion: z.number().int(),
        voice: KokoroVoiceEnum.default("af_heart"),
        speed: z.number().min(0.5).max(2.0).default(1.0),
      })
      .parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query("SELECT version, doc FROM projects WHERE id = $1 FOR UPDATE", [id]);
      if (!r.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "not found" });
      }
      if (r.rows[0].version !== body.expectedVersion) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "version conflict", currentVersion: r.rows[0].version });
      }
      const currentDoc: Project = Project.parse(r.rows[0].doc);
      const op = await buildKokoroProjectVoiceoverOp(currentDoc, ttsProvider, {
        voice: body.voice as KokoroVoiceId,
        speed: body.speed,
      });
      const nextDoc = applyChecked(currentDoc, op, { actor: "ai" }).next;
      const version = body.expectedVersion + 1;
      await client.query("UPDATE projects SET doc = $1, version = $2, updated_at = now() WHERE id = $3", [
        nextDoc,
        version,
        id,
      ]);
      await client.query("COMMIT");
      return { version, doc: nextDoc, voice: body.voice };
    } catch (e) {
      await client.query("ROLLBACK");
      if (e instanceof OpError) return reply.code(422).send({ error: e.message });
      throw e;
    } finally {
      client.release();
    }
  });

  /**
   * Log edit feedback events (`kept` | `replaced_candidate` | `replaced_upload` | `intent_edited`)
   * into `edit_events` (Rule 8: training data for ranking).
   */
  app.post("/projects/:id/events", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = EditEventBodySchema.parse(req.body);
    const exists = await pool.query("SELECT 1 FROM projects WHERE id = $1", [id]);
    if (!exists.rowCount) return reply.code(404).send({ error: "not found" });

    const r = await pool.query(
      "INSERT INTO edit_events (project_id, scene_id, event, payload) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
      [id, body.sceneId ?? null, body.event, body.payload],
    );
    return reply.code(201).send({
      id: r.rows[0]?.id,
      projectId: id,
      sceneId: body.sceneId ?? null,
      event: body.event,
      payload: body.payload,
      createdAt: r.rows[0]?.created_at,
    });
  });

  app.get("/projects/:id/events", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await pool.query(
      "SELECT id, project_id, scene_id, event, payload, created_at FROM edit_events WHERE project_id = $1 ORDER BY id DESC",
      [id],
    );
    return { events: r.rows };
  });

  app.post("/projects/:id/render", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await pool.query("SELECT version FROM projects WHERE id = $1", [id]);
    if (!r.rowCount) return reply.code(404).send({ error: "not found" });
    const job = await renderQueue.add("render", { projectId: id, version: r.rows[0].version, preset: "1080p" });
    return reply.code(202).send({ jobId: job.id });
  });

  app.get("/projects/:id/render/:jobId", async (req, reply) => {
    const { jobId } = req.params as { id: string; jobId: string };
    if (!renderQueue.getJob) {
      return reply.code(501).send({ error: "job status lookup not supported" });
    }
    const job = await renderQueue.getJob(jobId);
    if (!job) return reply.code(404).send({ error: "job not found" });
    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      progress: typeof job.progress === "number" ? job.progress : 0,
      result: job.returnvalue ?? null,
    };
  });

  return app;
}
