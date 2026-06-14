-- Add generated_files column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS generated_files JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
