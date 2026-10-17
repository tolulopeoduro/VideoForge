CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE projects (
  id         text PRIMARY KEY,
  version    int  NOT NULL DEFAULT 0,        -- optimistic concurrency counter
  doc        jsonb NOT NULL,                 -- the Project document (see packages/schema)
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id          text PRIMARY KEY,
  provider    text NOT NULL,                 -- 'pexels' | 'upload' | ...
  provider_id text,
  uri         text NOT NULL,
  kind        text NOT NULL,                 -- 'video' | 'image' | 'audio'
  duration_us bigint,
  width int, height int,
  license     jsonb,                         -- keep terms per asset, you will need them
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per detected SHOT (match shots, not whole files).
-- vector(512) matches OpenCLIP ViT-B-32. Change it if you change the model.
CREATE TABLE shots (
  id          bigserial PRIMARY KEY,
  asset_id    text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  start_us    bigint NOT NULL,
  end_us      bigint NOT NULL,
  embedding   vector(512),
  caption     text,
  tags        text[] NOT NULL DEFAULT '{}',
  search_text text NOT NULL DEFAULT '',      -- caption + tags, filled by the indexer
  quality     jsonb  NOT NULL DEFAULT '{}'   -- sharpness, motion, stability, has_text, brightness...
);
CREATE INDEX shots_embedding_hnsw ON shots USING hnsw (embedding vector_cosine_ops);
CREATE INDEX shots_fts ON shots USING gin (to_tsvector('english', search_text));

-- Feedback signal for learning-to-rank later. Log from day one.
CREATE TABLE edit_events (
  id         bigserial PRIMARY KEY,
  project_id text NOT NULL,
  scene_id   text,
  event      text NOT NULL,                  -- 'kept' | 'replaced_candidate' | 'replaced_upload' | 'intent_edited'
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
