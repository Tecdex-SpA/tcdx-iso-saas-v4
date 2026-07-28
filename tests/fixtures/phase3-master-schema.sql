-- Synthetic legacy masters required by the Phase 3 PostgreSQL contract gate.
-- Apply after phase2-master-schema.sql. No customer data or credentials.

ALTER TABLE tenant_processes
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE UNIQUE INDEX IF NOT EXISTS uq_phase3_fixture_process_code
  ON tenant_processes (tenant_id, code);

CREATE TABLE IF NOT EXISTS tenant_nonconformities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  control_id uuid,
  nonconformity_id uuid,
  detected_at timestamp DEFAULT now(),
  status text DEFAULT 'abierta',
  resolved_at timestamp,
  control_description text
);

CREATE TABLE IF NOT EXISTS iso_risk_matrix_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  risk_code text NOT NULL,
  risk_title text NOT NULL,
  risk_description text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, risk_code)
);

CREATE TABLE IF NOT EXISTS test_user_role_assignments (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES app_roles(role_key) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION user_has_permission(
  requested_user_id uuid,
  requested_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN test_user_role_assignments ura
      ON ura.user_id = u.id
    JOIN role_permissions rp
      ON rp.role_key = ura.role_key
      AND rp.permission_key = requested_permission
      AND rp.is_allowed = TRUE
    WHERE u.id = requested_user_id
  );
$$;
