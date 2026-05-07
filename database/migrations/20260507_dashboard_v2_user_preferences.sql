-- Fase 1.14E2 - preferencias visuales Dashboard v2 por usuario
-- Migracion idempotente y no destructiva.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  dashboard_key text NOT NULL,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_dashboard_preferences_dashboard_key_check
    CHECK (dashboard_key IN ('dashboard_v2')),
  CONSTRAINT user_dashboard_preferences_layout_object_check
    CHECK (jsonb_typeof(layout_json) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS user_dashboard_preferences_user_tenant_key_idx
  ON user_dashboard_preferences (tenant_id, user_id, dashboard_key);

CREATE INDEX IF NOT EXISTS user_dashboard_preferences_tenant_idx
  ON user_dashboard_preferences (tenant_id);

CREATE INDEX IF NOT EXISTS user_dashboard_preferences_user_idx
  ON user_dashboard_preferences (user_id);
