BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE grc_phase3_import_batches
  DROP CONSTRAINT IF EXISTS grc_phase3_import_batches_entity_type_check;

ALTER TABLE grc_phase3_import_batches
  ADD CONSTRAINT grc_phase3_import_batches_entity_type_check CHECK (entity_type IN (
    'organizations', 'processes', 'services', 'suppliers', 'bia',
    'continuity_plans', 'continuity_tests', 'metrics',
    'metric_measurements', 'quantitative_risks'
  ));

ALTER TABLE grc_phase3_import_batches
  ADD COLUMN IF NOT EXISTS definition_version text,
  ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'csv'
    CHECK (source_format IN ('xlsx', 'csv')),
  ADD COLUMN IF NOT EXISTS file_checksum char(64),
  ADD COLUMN IF NOT EXISTS duplicate_policy text NOT NULL DEFAULT 'create_only'
    CHECK (duplicate_policy IN (
      'create_only', 'update_existing', 'create_or_update', 'reject_duplicates'
    )),
  ADD COLUMN IF NOT EXISTS created_rows integer NOT NULL DEFAULT 0 CHECK (created_rows >= 0),
  ADD COLUMN IF NOT EXISTS updated_rows integer NOT NULL DEFAULT 0 CHECK (updated_rows >= 0),
  ADD COLUMN IF NOT EXISTS unchanged_rows integer NOT NULL DEFAULT 0 CHECK (unchanged_rows >= 0),
  ADD COLUMN IF NOT EXISTS warning_rows integer NOT NULL DEFAULT 0 CHECK (warning_rows >= 0),
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS upload_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE grc_phase3_import_batches
SET definition_version = template_version
WHERE definition_version IS NULL;

ALTER TABLE grc_phase3_import_batches
  ALTER COLUMN definition_version SET NOT NULL;

ALTER TABLE grc_phase3_import_rows
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS operation text NOT NULL DEFAULT 'create'
    CHECK (operation IN ('create', 'update', 'no_change')),
  ADD COLUMN IF NOT EXISTS previous_data jsonb,
  ADD COLUMN IF NOT EXISTS changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS imported_version integer CHECK (imported_version IS NULL OR imported_version > 0);

CREATE TABLE IF NOT EXISTS grc_import_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  version text NOT NULL,
  definition_checksum char(64) NOT NULL,
  definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, version)
);

CREATE TABLE IF NOT EXISTS grc_import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES grc_phase3_import_batches(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 char(64) NOT NULL,
  storage_status text NOT NULL CHECK (storage_status IN (
    'temporary', 'discarded_after_parse', 'quarantined'
  )),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, batch_id)
);

CREATE TABLE IF NOT EXISTS grc_import_cell_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES grc_phase3_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 1),
  column_name text NOT NULL,
  received_value text,
  error_code text NOT NULL,
  message text NOT NULL,
  suggestion text,
  valid_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grc_import_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES grc_phase3_import_batches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_tenant_entity_created
  ON grc_phase3_import_batches (tenant_id, entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_batches_checksum
  ON grc_phase3_import_batches (tenant_id, file_checksum)
  WHERE file_checksum IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_cell_errors_batch
  ON grc_import_cell_errors (tenant_id, batch_id, row_number);

CREATE INDEX IF NOT EXISTS idx_import_audit_events_batch
  ON grc_import_audit_events (tenant_id, batch_id, occurred_at);

COMMENT ON TABLE grc_import_files IS
  'Metadata and checksum for tenant import files. Uploaded binary content is not retained.';

COMMENT ON TABLE grc_import_cell_errors IS
  'Cell-level validation findings for universal imports.';

COMMENT ON TABLE grc_import_audit_events IS
  'Tenant-scoped audit trail for preview, confirmation and rollback.';

COMMIT;
