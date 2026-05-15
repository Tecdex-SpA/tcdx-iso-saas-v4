CREATE TABLE IF NOT EXISTS audit_documentary_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NULL,
  audit_id UUID NULL,
  tenant_id UUID NOT NULL,
  standard_code VARCHAR(50) NOT NULL,
  period_year INTEGER NOT NULL,
  source_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status VARCHAR(50) DEFAULT 'requires_validation',
  source_origin VARCHAR(50) DEFAULT 'manual',
  source_file_name VARCHAR(255) NULL,
  source_file_url TEXT NULL,
  extracted_text_preview TEXT NULL,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(5,2) NULL,
  created_by UUID NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_documentary_sources_tenant
  ON audit_documentary_sources (tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_documentary_sources_package
  ON audit_documentary_sources (package_id);

CREATE INDEX IF NOT EXISTS idx_audit_documentary_sources_standard_period
  ON audit_documentary_sources (standard_code, period_year);

CREATE INDEX IF NOT EXISTS idx_audit_documentary_sources_type
  ON audit_documentary_sources (source_type);
