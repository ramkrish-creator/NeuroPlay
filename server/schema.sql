CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'player')),
  display_name TEXT NOT NULL,
  age_group TEXT NOT NULL CHECK (age_group IN ('18-39', '40-59', '60-74', '75+')),
  goal TEXT NOT NULL CHECK (goal IN ('memory', 'attention', 'overall')),
  avatar_color TEXT NOT NULL DEFAULT '#2dd4bf',
  difficulty JSONB NOT NULL DEFAULT '{}'::jsonb,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_profile_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  result JSONB NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS training_sessions_user_date_idx
  ON training_sessions (user_id, played_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions (expires_at);
