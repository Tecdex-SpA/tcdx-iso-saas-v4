-- ============================================================
-- TCDX Compliance SaaS
-- Centro Inteligente de Evidencias - Etapa 1
-- Base documental multi-tenant para integraciones externas
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  provider VARCHAR(80) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'prepared',
  display_name VARCHAR(180),
  connected_by_user_id UUID,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMP,
  scopes TEXT,
  provider_account_email VARCHAR(255),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMP,
  disconnected_at TIMESTAMP,
  CONSTRAINT tenant_integrations_provider_check
    CHECK (provider IN ('google_drive', 'microsoft_graph', 'onedrive', 'sharepoint')),
  CONSTRAINT tenant_integrations_status_check
    CHECK (status IN ('prepared', 'connected', 'error', 'disabled', 'disconnected'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
  ON tenant_integrations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider_status
  ON tenant_integrations (tenant_id, provider, status);

CREATE TABLE IF NOT EXISTS tenant_document_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  integration_id UUID REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  provider VARCHAR(80) NOT NULL,
  source_name VARCHAR(180) NOT NULL,
  folder_id VARCHAR(500),
  folder_path TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scan_frequency VARCHAR(40) NOT NULL DEFAULT 'manual',
  last_sync_at TIMESTAMP,
  created_by_user_id UUID,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_document_sources_provider_check
    CHECK (provider IN ('google_drive', 'microsoft_graph', 'onedrive', 'sharepoint')),
  CONSTRAINT tenant_document_sources_scan_frequency_check
    CHECK (scan_frequency IN ('manual', 'hourly', 'daily', 'weekly'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_document_sources_tenant
  ON tenant_document_sources (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_document_sources_integration
  ON tenant_document_sources (integration_id);

CREATE TABLE IF NOT EXISTS document_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source_id UUID REFERENCES tenant_document_sources(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES tenant_integrations(id) ON DELETE SET NULL,
  provider VARCHAR(80) NOT NULL,
  provider_file_id VARCHAR(500) NOT NULL,
  provider_version_id VARCHAR(500),
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(255),
  file_extension VARCHAR(40),
  file_url TEXT,
  web_view_url TEXT,
  size_bytes BIGINT,
  checksum VARCHAR(255),
  modified_at TIMESTAMP,
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(40) NOT NULL DEFAULT 'indexed',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_index_provider_check
    CHECK (provider IN ('google_drive', 'microsoft_graph', 'onedrive', 'sharepoint')),
  CONSTRAINT document_index_status_check
    CHECK (status IN ('indexed', 'updated', 'missing', 'ignored', 'error', 'pending_analysis', 'analyzed')),
  CONSTRAINT document_index_unique_provider_file
    UNIQUE (tenant_id, provider, provider_file_id)
);

CREATE INDEX IF NOT EXISTS idx_document_index_tenant
  ON document_index (tenant_id);

CREATE INDEX IF NOT EXISTS idx_document_index_source
  ON document_index (source_id);

CREATE INDEX IF NOT EXISTS idx_document_index_status
  ON document_index (tenant_id, status);

CREATE TABLE IF NOT EXISTS document_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  source_id UUID REFERENCES tenant_document_sources(id) ON DELETE SET NULL,
  integration_id UUID REFERENCES tenant_integrations(id) ON DELETE SET NULL,
  provider VARCHAR(80),
  status VARCHAR(40) NOT NULL DEFAULT 'started',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP,
  files_seen INTEGER NOT NULL DEFAULT 0,
  files_indexed INTEGER NOT NULL DEFAULT 0,
  files_updated INTEGER NOT NULL DEFAULT 0,
  files_skipped INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT document_sync_logs_status_check
    CHECK (status IN ('started', 'completed', 'completed_with_warnings', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_document_sync_logs_tenant_started
  ON document_sync_logs (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS document_ai_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES document_index(id) ON DELETE CASCADE,
  detected_document_type VARCHAR(80),
  detected_standard_code VARCHAR(80),
  detected_control_refs TEXT[],
  summary TEXT,
  extracted_keywords TEXT[],
  confidence_score NUMERIC(5,2),
  evidence_quality VARCHAR(40),
  missing_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_ai_analysis_document
  ON document_ai_analysis (document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_ai_analysis_tenant
  ON document_ai_analysis (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_association_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES document_index(id) ON DELETE CASCADE,
  target_type VARCHAR(80) NOT NULL,
  target_id UUID,
  suggested_standard_code VARCHAR(80),
  suggested_control_ref VARCHAR(120),
  suggested_reason TEXT,
  confidence_score NUMERIC(5,2),
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT document_association_suggestions_target_type_check
    CHECK (target_type IN ('control', 'evidence', 'risk', 'finding', 'nonconformity', 'audit', 'action_plan', 'asset', 'lifecycle')),
  CONSTRAINT document_association_suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'))
);

CREATE INDEX IF NOT EXISTS idx_document_suggestions_tenant_status
  ON document_association_suggestions (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_suggestions_document
  ON document_association_suggestions (document_id);

CREATE TABLE IF NOT EXISTS evidence_document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  evidence_id UUID NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES document_index(id) ON DELETE CASCADE,
  relation_type VARCHAR(80) NOT NULL DEFAULT 'source_document',
  created_by_user_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_document_links_unique
    UNIQUE (evidence_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_document_links_tenant
  ON evidence_document_links (tenant_id);

CREATE INDEX IF NOT EXISTS idx_evidence_document_links_document
  ON evidence_document_links (document_id);

COMMENT ON TABLE tenant_integrations IS 'Integraciones documentales externas por tenant. Etapa 1 prepara Google Drive y Microsoft Graph sin OAuth real obligatorio.';
COMMENT ON TABLE tenant_document_sources IS 'Carpetas o fuentes documentales autorizadas por tenant.';
COMMENT ON TABLE document_index IS 'Índice de documentos externos detectados por fuente documental.';
COMMENT ON TABLE document_association_suggestions IS 'Sugerencias IA o manuales revisables antes de crear asociaciones formales.';
COMMENT ON TABLE evidence_document_links IS 'Tabla puente entre evidencias formales existentes y documentos externos indexados.';
