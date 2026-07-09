ALTER TABLE sessions ADD COLUMN IF NOT EXISTS generation_progress JSONB;

UPDATE sessions
SET generation_progress = generated_files -> '_progress'
WHERE generation_progress IS NULL
  AND generated_files ? '_progress';

UPDATE sessions
SET generated_files = generated_files - '_progress'
WHERE generated_files ? '_progress';
