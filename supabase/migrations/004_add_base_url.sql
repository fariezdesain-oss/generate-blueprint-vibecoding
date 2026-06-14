-- Add base_url column to provider_configs for custom OpenAI-compatible endpoints
ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS base_url TEXT;
