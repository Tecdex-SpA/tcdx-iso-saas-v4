-- =========================================================
-- TCDX ISO SaaS - Audit Preparation Packages
-- ISO 9001 documentary audit folder foundation.
--
-- Non destructive:
-- - Creates audit_preparation_* tables only.
-- - Does not modify operational audit, evidence or report tables.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_preparation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  audit_id uuid NULL REFERENCES audits(id),
  standard_code varchar(50) NOT NULL,
  period_year integer NOT NULL,
  package_name varchar(255) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'draft',
  package_source varchar(50) NOT NULL DEFAULT 'generated',
  original_zip_file_url text NULL,
  latest_export_file_url text NULL,
  generated_by uuid NULL REFERENCES users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_audit_preparation_packages_year CHECK (period_year BETWEEN 2000 AND 2100),
  CONSTRAINT chk_audit_preparation_packages_status CHECK (
    status IN ('draft', 'in_review', 'approved', 'exported', 'archived')
  ),
  CONSTRAINT chk_audit_preparation_packages_source CHECK (
    package_source IN ('generated', 'uploaded_zip', 'uploaded_zip_updated')
  )
);

CREATE TABLE IF NOT EXISTS audit_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code varchar(50) NOT NULL,
  template_key varchar(100) NOT NULL,
  document_name varchar(255) NOT NULL,
  document_type varchar(50) NOT NULL,
  output_format varchar(20) NOT NULL DEFAULT 'docx',
  folder_path varchar(500) NOT NULL,
  version varchar(50) NOT NULL DEFAULT '1.0',
  is_active boolean NOT NULL DEFAULT true,
  template_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_prompt_template text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_audit_document_templates_standard_key UNIQUE (standard_code, template_key),
  CONSTRAINT chk_audit_document_templates_type CHECK (
    document_type IN (
      'manual',
      'policy',
      'objective_plan',
      'context',
      'interested_parties',
      'process_map',
      'risk_matrix',
      'procedure',
      'record',
      'management_review',
      'audit_interview_guide',
      'evidence_index'
    )
  ),
  CONSTRAINT chk_audit_document_templates_output CHECK (
    output_format IN ('docx', 'xlsx', 'pptx', 'pdf', 'md')
  )
);

CREATE TABLE IF NOT EXISTS audit_package_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES audit_preparation_packages(id) ON DELETE CASCADE,
  audit_id uuid NULL REFERENCES audits(id),
  template_id uuid NULL REFERENCES audit_document_templates(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code varchar(50) NOT NULL,
  document_name varchar(255) NOT NULL,
  folder_path varchar(500) NOT NULL,
  document_status varchar(50) NOT NULL DEFAULT 'draft',
  original_file_url text NULL,
  updated_file_url text NULL,
  generated_content text NULL,
  generated_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_links_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_audit_package_documents_status CHECK (
    document_status IN (
      'draft',
      'imported',
      'analyzed',
      'generated',
      'updated_from_platform',
      'requires_validation',
      'approved',
      'exported'
    )
  )
);

CREATE TABLE IF NOT EXISTS audit_evidence_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES audit_preparation_packages(id) ON DELETE CASCADE,
  audit_id uuid NULL REFERENCES audits(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code varchar(50) NOT NULL,
  evidence_name varchar(255) NOT NULL,
  evidence_type varchar(100) NULL,
  folder_path varchar(500) NOT NULL,
  source_module varchar(100) NULL,
  source_id uuid NULL,
  source_reference text NULL,
  related_document_id uuid NULL REFERENCES audit_package_documents(id) ON DELETE SET NULL,
  related_requirement varchar(100) NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  notes text NULL,
  file_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_audit_evidence_index_status CHECK (
    status IN ('complete', 'partial', 'pending', 'requires_validation')
  )
);

CREATE TABLE IF NOT EXISTS audit_document_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES audit_preparation_packages(id) ON DELETE CASCADE,
  audit_id uuid NULL REFERENCES audits(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code varchar(50) NOT NULL,
  run_type varchar(100) NOT NULL,
  ai_engine_request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_engine_response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(50) NOT NULL DEFAULT 'completed',
  error_message text NULL,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_audit_document_generation_runs_type CHECK (
    run_type IN (
      'package_generation',
      'document_generation',
      'zip_analysis',
      'zip_update',
      'evidence_index_generation',
      'gap_analysis',
      'management_review_generation'
    )
  ),
  CONSTRAINT chk_audit_document_generation_runs_status CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

CREATE TABLE IF NOT EXISTS audit_uploaded_zip_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NULL REFERENCES audit_preparation_packages(id) ON DELETE SET NULL,
  audit_id uuid NULL REFERENCES audits(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code varchar(50) NULL,
  period_year integer NULL,
  original_filename varchar(255) NOT NULL,
  file_url text NOT NULL,
  extracted_path text NULL,
  file_hash varchar(255) NULL,
  analysis_status varchar(50) NOT NULL DEFAULT 'pending',
  inventory_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_structure_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  gaps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_audit_uploaded_zip_files_year CHECK (
    period_year IS NULL OR period_year BETWEEN 2000 AND 2100
  ),
  CONSTRAINT chk_audit_uploaded_zip_files_status CHECK (
    analysis_status IN ('pending', 'analyzed', 'updated', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_audit_prep_packages_tenant_standard
  ON audit_preparation_packages(tenant_id, standard_code, period_year);

CREATE INDEX IF NOT EXISTS idx_audit_prep_packages_audit
  ON audit_preparation_packages(audit_id);

CREATE INDEX IF NOT EXISTS idx_audit_document_templates_standard
  ON audit_document_templates(standard_code, is_active);

CREATE INDEX IF NOT EXISTS idx_audit_package_documents_package
  ON audit_package_documents(package_id, document_status);

CREATE INDEX IF NOT EXISTS idx_audit_package_documents_tenant_standard
  ON audit_package_documents(tenant_id, standard_code);

CREATE INDEX IF NOT EXISTS idx_audit_evidence_index_package
  ON audit_evidence_index(package_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_evidence_index_tenant_standard
  ON audit_evidence_index(tenant_id, standard_code);

CREATE INDEX IF NOT EXISTS idx_audit_document_generation_runs_package
  ON audit_document_generation_runs(package_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_uploaded_zip_files_package
  ON audit_uploaded_zip_files(package_id, analysis_status);

CREATE INDEX IF NOT EXISTS idx_audit_uploaded_zip_files_tenant_standard
  ON audit_uploaded_zip_files(tenant_id, standard_code, period_year);

COMMENT ON TABLE audit_preparation_packages IS
  'Carpetas documentales de preparacion de auditoria por tenant/norma/auditoria/periodo.';

COMMENT ON TABLE audit_document_templates IS
  'Plantillas documentales reutilizables para paquetes de auditoria ISO.';

COMMENT ON TABLE audit_package_documents IS
  'Documentos generados, importados o actualizados dentro de un paquete documental de auditoria.';

COMMENT ON TABLE audit_evidence_index IS
  'Indice trazable de evidencias requeridas o disponibles para un paquete documental.';

COMMENT ON TABLE audit_uploaded_zip_files IS
  'Historial de ZIP documentales subidos, inventariados y analizados sin modificar el original.';
