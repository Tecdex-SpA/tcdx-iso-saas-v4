-- Sprint 3.5: logical document index exclusions.
-- Non-destructive migration. It preserves indexed documents and associations.

ALTER TABLE document_index
  DROP CONSTRAINT IF EXISTS document_index_status_check;

ALTER TABLE document_index
  ADD CONSTRAINT document_index_status_check
  CHECK (status IN (
    'indexed',
    'updated',
    'missing',
    'ignored',
    'error',
    'pending_analysis',
    'analyzed',
    'excluded',
    'discarded'
  ));

UPDATE document_index
SET
  status = 'indexed',
  metadata_json = COALESCE(metadata_json, '{}'::jsonb)
    || jsonb_build_object(
      'last_sync_operation', 'updated',
      'status_normalized_from', 'updated',
      'status_normalized_at', NOW()
    )
WHERE provider = 'zoho_workdrive'
  AND status = 'updated';

CREATE TABLE IF NOT EXISTS tenant_document_index_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  source_id UUID NULL REFERENCES tenant_document_sources(id) ON DELETE SET NULL,
  document_index_id UUID NULL REFERENCES document_index(id) ON DELETE SET NULL,
  provider_file_id TEXT NOT NULL,
  exclusion_scope TEXT NOT NULL DEFAULT 'item',
  reason TEXT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  excluded_by_user_id UUID NULL,
  excluded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  restored_by_user_id UUID NULL,
  restored_at TIMESTAMP WITHOUT TIME ZONE NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_document_index_exclusions_scope_check
    CHECK (exclusion_scope IN ('item', 'subtree'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_document_index_exclusions_active_provider_file
  ON tenant_document_index_exclusions (tenant_id, provider, provider_file_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_document_index_exclusions_tenant_provider
  ON tenant_document_index_exclusions (tenant_id, provider, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_document_index_exclusions_document
  ON tenant_document_index_exclusions (document_index_id);
