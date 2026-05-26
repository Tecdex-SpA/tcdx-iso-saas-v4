-- ============================================================
-- TCDX Compliance SaaS
-- Tenant-scoped document source connectors
-- Google Drive / Zoho WorkDrive / mounted shares / local sync agent
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Existing base tables are preserved. This migration widens the provider/status
-- contracts and adds the minimum fields needed for tenant-scoped sources.

ALTER TABLE tenant_integrations
  DROP CONSTRAINT IF EXISTS tenant_integrations_provider_check;

ALTER TABLE tenant_integrations
  ADD CONSTRAINT tenant_integrations_provider_check
  CHECK (provider IN (
    'google_drive',
    'zoho_workdrive',
    'microsoft_graph',
    'onedrive',
    'sharepoint',
    'local_agent',
    'mounted_share',
    'manual_upload'
  ));

ALTER TABLE tenant_document_sources
  DROP CONSTRAINT IF EXISTS tenant_document_sources_provider_check;

ALTER TABLE tenant_document_sources
  ADD CONSTRAINT tenant_document_sources_provider_check
  CHECK (provider IN (
    'google_drive',
    'zoho_workdrive',
    'microsoft_graph',
    'onedrive',
    'sharepoint',
    'local_agent',
    'mounted_share',
    'manual_upload'
  ));

ALTER TABLE tenant_document_sources
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS folder_display_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_account_email TEXT,
  ADD COLUMN IF NOT EXISTS provider_team_id TEXT,
  ADD COLUMN IF NOT EXISTS include_subfolders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS associated_standard_code TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID;

UPDATE tenant_document_sources
SET created_by = created_by_user_id
WHERE created_by IS NULL
  AND created_by_user_id IS NOT NULL;

ALTER TABLE tenant_document_sources
  DROP CONSTRAINT IF EXISTS tenant_document_sources_status_check;

ALTER TABLE tenant_document_sources
  ADD CONSTRAINT tenant_document_sources_status_check
  CHECK (status IN ('active', 'paused', 'disconnected', 'pending_agent', 'error'));

ALTER TABLE document_index
  DROP CONSTRAINT IF EXISTS document_index_provider_check;

ALTER TABLE document_index
  ADD CONSTRAINT document_index_provider_check
  CHECK (provider IN (
    'google_drive',
    'zoho_workdrive',
    'microsoft_graph',
    'onedrive',
    'sharepoint',
    'local_agent',
    'mounted_share',
    'manual_upload'
  ));

ALTER TABLE document_index
  ADD COLUMN IF NOT EXISTS relative_path TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS local_storage_path TEXT;

UPDATE document_index
SET
  content_hash = COALESCE(content_hash, checksum),
  file_hash = COALESCE(file_hash, checksum)
WHERE checksum IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_document_provider_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source_id UUID NULL REFERENCES tenant_document_sources(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_email TEXT NULL,
  access_token_encrypted TEXT NULL,
  refresh_token_encrypted TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,
  scopes TEXT[] NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_document_provider_credentials_provider_check
    CHECK (provider IN ('google_drive', 'zoho_workdrive'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_doc_credentials_tenant_provider
  ON tenant_document_provider_credentials (tenant_id, provider);

CREATE INDEX IF NOT EXISTS idx_tenant_doc_credentials_source
  ON tenant_document_provider_credentials (tenant_id, source_id);

CREATE TABLE IF NOT EXISTS tenant_sync_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source_id UUID NULL REFERENCES tenant_document_sources(id) ON DELETE CASCADE,
  agent_name TEXT NULL,
  device_name TEXT NULL,
  device_fingerprint TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  agent_token_hash TEXT NULL,
  last_seen_at TIMESTAMPTZ NULL,
  version TEXT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_sync_agents_status_check
    CHECK (status IN ('pending', 'active', 'revoked', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_sync_agents_tenant_source
  ON tenant_sync_agents (tenant_id, source_id);

CREATE INDEX IF NOT EXISTS idx_tenant_sync_agents_token_hash
  ON tenant_sync_agents (agent_token_hash)
  WHERE agent_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_sync_agent_pairing_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source_id UUID NOT NULL REFERENCES tenant_document_sources(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_sync_pairing_codes_hash
  ON tenant_sync_agent_pairing_codes (code_hash);

CREATE INDEX IF NOT EXISTS idx_tenant_sync_pairing_codes_tenant_source
  ON tenant_sync_agent_pairing_codes (tenant_id, source_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_document_sources_tenant_provider_status
  ON tenant_document_sources (tenant_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_document_index_tenant_source_provider
  ON document_index (tenant_id, source_id, provider);

CREATE INDEX IF NOT EXISTS idx_document_index_tenant_relative_path
  ON document_index (tenant_id, source_id, relative_path);

COMMENT ON TABLE tenant_document_provider_credentials IS 'OAuth credentials encrypted per tenant/source/provider. Tokens are never returned to frontend.';
COMMENT ON TABLE tenant_sync_agents IS 'Registered local sync agents bound to a tenant and document source.';
COMMENT ON TABLE tenant_sync_agent_pairing_codes IS 'Temporary pairing codes for local sync agents. Only hashes are stored.';
