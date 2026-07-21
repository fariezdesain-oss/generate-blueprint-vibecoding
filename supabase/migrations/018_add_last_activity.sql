ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS profiles_last_activity_at_idx
  ON profiles (last_activity_at);
