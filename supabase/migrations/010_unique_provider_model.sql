-- Drop old unique constraint (user_id, provider_name)
ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_user_id_provider_name_key;

-- Add new unique constraint (user_id, provider_name, model_name)
-- Allows same provider with different model names, but prevents duplicates
ALTER TABLE provider_configs ADD CONSTRAINT unique_user_provider_model UNIQUE (user_id, provider_name, model_name);
