-- TCDX ISO SaaS v4 - Phase 3 operational onboarding forward-fix.
-- Additive, tenant-scoped and reversible by import batch.

BEGIN;

INSERT INTO permissions (
  permission_key, permission_group, display_name, description
) VALUES (
  'operations.import',
  'operations',
  'Importar datos operacionales',
  'Previsualiza, confirma y revierte lotes de activación operacional.'
)
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, 'operations.import', TRUE
FROM app_roles r
WHERE r.role_key IN (
  'admin', 'tenant_admin', 'admin_cumplimiento', 'compliance_admin'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET
  is_allowed = TRUE,
  updated_at = now();

CREATE TABLE IF NOT EXISTS grc_phase3_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN (
    'organizations', 'processes', 'services', 'bia',
    'continuity_plans', 'metrics'
  )),
  template_version text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'preview_ready', 'confirmed', 'partial', 'rolled_back', 'rollback_partial'
  )),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  imported_rows integer NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  failed_rows integer NOT NULL DEFAULT 0 CHECK (failed_rows >= 0),
  rolled_back_rows integer NOT NULL DEFAULT 0 CHECK (rolled_back_rows >= 0),
  rollback_blocked_rows integer NOT NULL DEFAULT 0
    CHECK (rollback_blocked_rows >= 0),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  rolled_back_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_rows + invalid_rows = total_rows),
  CHECK (imported_rows + failed_rows <= valid_rows),
  CHECK (rolled_back_rows + rollback_blocked_rows <= imported_rows)
);

CREATE TABLE IF NOT EXISTS grc_phase3_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES grc_phase3_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 1),
  raw_data jsonb NOT NULL,
  normalized_data jsonb NOT NULL,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN (
    'valid', 'invalid', 'imported', 'failed', 'rolled_back', 'rollback_blocked'
  )),
  created_entity_type text,
  created_entity_id uuid,
  processed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, batch_id, row_number),
  CHECK (
    (status IN ('imported', 'rolled_back', 'rollback_blocked')
      AND created_entity_id IS NOT NULL)
    OR status IN ('valid', 'invalid', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase3_import_batches_tenant
  ON grc_phase3_import_batches (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phase3_import_rows_batch
  ON grc_phase3_import_rows (tenant_id, batch_id, row_number);

COMMENT ON TABLE grc_phase3_import_batches IS
  'Tenant-scoped operational onboarding batches. Confirmation is explicit.';

COMMENT ON TABLE grc_phase3_import_rows IS
  'Validated import rows with per-column errors and reversible created entity IDs.';

COMMIT;
