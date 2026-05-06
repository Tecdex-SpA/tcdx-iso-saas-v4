-- =========================================================
-- TCDX ISO SaaS - ISO Document Generator
-- Fase 1.5: politicas y procedimientos multinorma.
--
-- Modo no destructivo:
-- - Crea solo tablas/vistas/indices iso_generated*/iso_document*.
-- - No modifica tablas operativas.
-- - No crea evidencias, findings ni action_plans.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  document_type text NOT NULL,
  template_code text,
  template_id uuid,
  source_assessment_id uuid REFERENCES iso_express_assessments(id),
  title text NOT NULL,
  document_status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  language text NOT NULL DEFAULT 'es',
  generated_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  archived_at timestamptz,
  archived_by uuid REFERENCES users(id),
  content_markdown text NOT NULL,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  variables_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_trace_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_used boolean NOT NULL DEFAULT false,
  ai_trace_id uuid,
  disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_iso_generated_document_type CHECK (
    document_type IN (
      'policy',
      'procedure',
      'transition_guidance',
      'ai_governance_document',
      'security_document',
      'quality_document'
    )
  ),
  CONSTRAINT chk_iso_generated_document_status CHECK (
    document_status IN ('draft', 'generated', 'reviewed', 'approved', 'archived')
  )
);

CREATE TABLE IF NOT EXISTS iso_generated_document_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES iso_generated_documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  section_order integer NOT NULL DEFAULT 0,
  section_key text NOT NULL,
  section_title text NOT NULL,
  section_content text NOT NULL,
  source_type text NOT NULL DEFAULT 'template',
  source_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_document_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  standard_code text NOT NULL,
  version_code text NOT NULL,
  document_type text NOT NULL,
  template_code text,
  source_assessment_id uuid,
  requested_by uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'success',
  ai_used boolean NOT NULL DEFAULT false,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_document_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES iso_generated_documents(id),
  tenant_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_generated_documents_tenant_standard
  ON iso_generated_documents(tenant_id, standard_code, version_code);

CREATE INDEX IF NOT EXISTS idx_iso_generated_documents_tenant_type
  ON iso_generated_documents(tenant_id, document_type);

CREATE INDEX IF NOT EXISTS idx_iso_generated_documents_tenant_status
  ON iso_generated_documents(tenant_id, document_status);

CREATE INDEX IF NOT EXISTS idx_iso_generated_documents_assessment
  ON iso_generated_documents(source_assessment_id);

CREATE INDEX IF NOT EXISTS idx_iso_generated_documents_created
  ON iso_generated_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_generated_document_sections_document
  ON iso_generated_document_sections(document_id);

CREATE INDEX IF NOT EXISTS idx_iso_document_generation_runs_tenant_created
  ON iso_document_generation_runs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_document_audit_log_tenant_created
  ON iso_document_audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE VIEW v_iso_generated_documents_latest AS
SELECT DISTINCT ON (
  tenant_id,
  standard_code,
  version_code,
  document_type,
  COALESCE(template_code, '')
)
  *
FROM iso_generated_documents
WHERE document_status IS DISTINCT FROM 'archived'
ORDER BY
  tenant_id,
  standard_code,
  version_code,
  document_type,
  COALESCE(template_code, ''),
  version DESC,
  created_at DESC;

CREATE OR REPLACE VIEW v_iso_document_summary_by_tenant AS
SELECT
  tenant_id,
  standard_code,
  version_code,
  COUNT(*)::integer AS total_documents,
  COUNT(*) FILTER (WHERE document_type = 'policy')::integer AS policies_count,
  COUNT(*) FILTER (WHERE document_type = 'procedure')::integer AS procedures_count,
  COUNT(*) FILTER (WHERE document_status = 'approved')::integer AS approved_count,
  COUNT(*) FILTER (WHERE document_status IN ('draft', 'generated'))::integer AS draft_count,
  COUNT(*) FILTER (WHERE document_status = 'archived')::integer AS archived_count,
  MAX(created_at) AS last_generated_at
FROM iso_generated_documents
GROUP BY tenant_id, standard_code, version_code;

COMMENT ON TABLE iso_generated_documents IS
  'Documentos ISO generados por tenant desde plantillas iso_* y diagnostico express. No modifica datos operativos.';

COMMENT ON TABLE iso_generated_document_sections IS
  'Secciones trazables de documentos generados.';

COMMENT ON TABLE iso_document_generation_runs IS
  'Trazabilidad de ejecuciones del generador documental.';

COMMENT ON VIEW v_iso_generated_documents_latest IS
  'Ultima version activa de documentos ISO generados por tenant/norma/tipo/template.';
