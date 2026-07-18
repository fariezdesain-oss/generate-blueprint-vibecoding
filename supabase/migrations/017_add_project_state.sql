ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS project_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rolling_summary text NOT NULL DEFAULT '';
