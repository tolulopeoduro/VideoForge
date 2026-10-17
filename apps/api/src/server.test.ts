import { describe, expect, it } from "vitest";
import { makeClip, secToUs, type Project } from "@vf/schema";
import { buildApp, type DbClientLike, type DbPoolLike, type DbQueryResult, type RenderQueueLike } from "./app";

function createInMemoryDbAndQueue() {
  const projects = new Map<string, { version: number; doc: Project }>();
  const events: {
    id: number;
    project_id: string;
    scene_id: string | null;
    event: string;
    payload: Record<string, unknown>;
    created_at: string;
  }[] = [];
  const jobs = new Map<
    string,
    { id: string; data: unknown; state: string; progress: number; returnvalue: unknown }
  >();

  async function executeQuery(sql: string, params: unknown[] = []): Promise<DbQueryResult> {
    const norm = sql.trim().toUpperCase();
    if (norm === "BEGIN" || norm === "COMMIT" || norm === "ROLLBACK") {
      return { rowCount: 0, rows: [] };
    }
    if (norm.startsWith("INSERT INTO PROJECTS")) {
      const [id, doc] = params as [string, Project];
      projects.set(id, { version: 0, doc: structuredClone(doc) });
      return { rowCount: 1, rows: [] };
    }
    if (norm.startsWith("SELECT VERSION, DOC FROM PROJECTS") || norm.startsWith("SELECT VERSION FROM PROJECTS") || norm.startsWith("SELECT 1 FROM PROJECTS")) {
      const [id] = params as [string];
      const row = projects.get(id);
      if (!row) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [structuredClone(row)] };
    }
    if (norm.startsWith("UPDATE PROJECTS SET DOC")) {
      const [doc, version, id] = params as [Project, number, string];
      projects.set(id, { version, doc: structuredClone(doc) });
      return { rowCount: 1, rows: [] };
    }
    if (norm.startsWith("INSERT INTO EDIT_EVENTS")) {
      const [project_id, scene_id, event, payload] = params as [
        string,
        string | null,
        string,
        Record<string, unknown>,
      ];
      const entry = {
        id: events.length + 1,
        project_id,
        scene_id,
        event,
        payload,
        created_at: new Date().toISOString(),
      };
      events.push(entry);
      return { rowCount: 1, rows: [{ id: entry.id, created_at: entry.created_at }] };
    }
    if (norm.startsWith("SELECT ID, PROJECT_ID, SCENE_ID, EVENT, PAYLOAD, CREATED_AT FROM EDIT_EVENTS")) {
      const [project_id] = params as [string];
      const matching = events.filter((e) => e.project_id === project_id).reverse();
      return { rowCount: matching.length, rows: matching };
    }
    throw new Error(`Unhandled SQL in mock: ${sql}`);
  }

  const client: DbClientLike = {
    query: executeQuery,
    release: () => {},
  };

  const pool: DbPoolLike = {
    query: executeQuery,
    connect: async () => client,
  };

  const renderQueue: RenderQueueLike = {
    add: async (_name, data) => {
      const id = `job_${jobs.size + 1}`;
      jobs.set(id, {
        id,
        data,
        state: "completed",
        progress: 100,
        returnvalue: { status: "completed", outputPath: `/tmp/${data.projectId}_v${data.version}.mp4` },
      });
      return { id };
    },
    getJob: async (jobId) => {
      const j = jobs.get(jobId);
      if (!j) return null;
      return {
        id: j.id,
        progress: j.progress,
        returnvalue: j.returnvalue,
        getState: async () => j.state,
      };
    },
  };

  return { pool, renderQueue };
}

describe("Fastify API server endpoints", () => {
  it("creates projects, applies ops with optimistic concurrency and invariant validation, logs edit_events, and tracks render jobs", async () => {
    const { pool, renderQueue } = createInMemoryDbAndQueue();
    const app = buildApp({ pool, renderQueue, logger: false });

    // 1. Health check
    const healthRes = await app.inject({ method: "GET", url: "/health" });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json()).toEqual({ ok: true });

    // 2. Create project
    const createRes = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { title: "API Test Project" },
    });
    expect(createRes.statusCode).toBe(201);
    const { id: projectId, version } = createRes.json() as { id: string; version: number };
    expect(version).toBe(0);

    // 3. Apply valid op (addClip)
    const opRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/ops`,
      payload: {
        expectedVersion: 0,
        actor: "ai",
        ops: [
          {
            type: "addClip",
            clip: makeClip({
              id: "c1",
              trackId: "v1",
              start: 0,
              duration: secToUs(4),
              provenance: { origin: "ai", locked: false, userModified: false },
            }),
          },
        ],
      },
    });
    expect(opRes.statusCode).toBe(200);
    expect(opRes.json().version).toBe(1);

    // 4. Optimistic concurrency conflict (stale expectedVersion = 0)
    const conflictRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/ops`,
      payload: {
        expectedVersion: 0,
        actor: "user",
        ops: [{ type: "moveClip", id: "c1", start: secToUs(1) }],
      },
    });
    expect(conflictRes.statusCode).toBe(409);

    // 5. Invariant violation (negative start time -> 422)
    const invalidRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/ops`,
      payload: {
        expectedVersion: 1,
        actor: "user",
        ops: [{ type: "moveClip", id: "c1", start: -1000 }],
      },
    });
    expect(invalidRes.statusCode).toBe(422);

    // 6. Log edit_events (Rule 8) and query them back
    const eventRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/events`,
      payload: {
        sceneId: "scene_1",
        event: "replaced_candidate",
        payload: { clipId: "c1", chosenAssetId: "stock_office", score: 0.91 },
      },
    });
    expect(eventRes.statusCode).toBe(201);

    const listEventsRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/events`,
    });
    expect(listEventsRes.statusCode).toBe(200);
    expect(listEventsRes.json().events.length).toBe(1);
    expect(listEventsRes.json().events[0].event).toBe("replaced_candidate");

    // 7. Enqueue render job and query its status
    const renderRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/render`,
    });
    expect(renderRes.statusCode).toBe(202);
    const { jobId } = renderRes.json() as { jobId: string };

    const jobStatusRes = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/render/${jobId}`,
    });
    expect(jobStatusRes.statusCode).toBe(200);
    expect(jobStatusRes.json()).toMatchObject({
      jobId: "job_1",
      state: "completed",
      progress: 100,
    });
  });

  it("synthesizes Kokoro-82M voiceover clips and word-level captions on /projects/:id/tts while respecting locked scenes", async () => {
    const { pool, renderQueue } = createInMemoryDbAndQueue();
    const app = buildApp({ pool, renderQueue, logger: false });

    const voicesRes = await app.inject({ method: "GET", url: "/tts/voices" });
    expect(voicesRes.statusCode).toBe(200);
    expect(voicesRes.json().model).toBe("hexgrad/Kokoro-82M");
    expect(voicesRes.json().voices.length).toBeGreaterThanOrEqual(6);

    const synthRes = await app.inject({
      method: "POST",
      url: "/tts/synthesize",
      payload: { text: "Revenue grew steadily throughout the year.", voice: "af_heart", speed: 1.0 },
    });
    expect(synthRes.statusCode).toBe(200);
    expect(synthRes.json().sampleRate).toBe(24_000);
    expect(synthRes.json().words.length).toBe(6);

    const createRes = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { title: "Kokoro TTS Project" },
    });
    const { id: projectId } = createRes.json() as { id: string };

    // Seed two scenes (scene_1 unlocked, scene_2 locked)
    await app.inject({
      method: "POST",
      url: `/projects/${projectId}/ops`,
      payload: {
        expectedVersion: 0,
        actor: "ai",
        ops: [
          {
            type: "setProp",
            path: ["scenes"],
            value: [
              {
                id: "scene_1",
                narration: "Our team starts every morning with a planning session.",
                intent: { literal: "office", keywords: ["team"] },
                clipIds: [],
                locked: false,
              },
              {
                id: "scene_2",
                narration: "Locked scene narration that should not get a voice clip.",
                intent: { literal: "chart", keywords: ["growth"] },
                clipIds: [],
                locked: true,
              },
            ],
          },
        ],
      },
    });

    const ttsRes = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tts`,
      payload: { expectedVersion: 1, voice: "am_adam", speed: 1.0 },
    });
    expect(ttsRes.statusCode).toBe(200);
    const updated = ttsRes.json().doc as Project;

    // Scene 1 (unlocked) gets a voice clip on track a1
    expect(updated.scenes[0]?.voiceClipId).toBe("voice_scene_1");
    expect(updated.clips.voice_scene_1?.trackId).toBe("a1");
    expect(updated.clips.voice_scene_1?.provenance.generator?.step).toBe("tts");

    // Scene 2 (locked) is untouched
    expect(updated.scenes[1]?.voiceClipId).toBeUndefined();
    expect(updated.clips.voice_scene_2).toBeUndefined();

    // Word-level captions are populated
    expect(updated.captions?.words.length).toBeGreaterThan(5);
  });
});
