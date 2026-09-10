-- TCDX SaaSv2 runtime contract closeout V2.
-- Forward-only, idempotent, zero-tenant-specific: aligns fresh baseline and
-- V1-upgraded databases with active backend evidence/lifecycle contracts.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090902) THEN
    RAISE EXCEPTION 'TCDX SaaSv2 runtime contract closeout V2 lock unavailable';
  END IF;
END $$;

ALTER TABLE tenant_standards
  ADD COLUMN IF NOT EXISTS catalog_mode text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS initialized_at timestamptz,
  ADD COLUMN IF NOT EXISTS contracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS permanently_deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'tenant_standards'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%catalog_mode%'
  LIMIT 1;

  IF constraint_name IS NULL THEN
    ALTER TABLE tenant_standards
      ADD CONSTRAINT tenant_standards_catalog_mode_check
      CHECK (catalog_mode IN ('generic','personalized','mixed'));
  END IF;
END $$;

ALTER TABLE tenant_nonconformities
  ADD COLUMN IF NOT EXISTS control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS control_description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE tenant_nonconformities
  ALTER COLUMN title DROP NOT NULL;

ALTER TABLE evidences
  ADD COLUMN IF NOT EXISTS control_id uuid REFERENCES controls_catalog(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_mime_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS content_fingerprint text,
  ADD COLUMN IF NOT EXISTS document_extraction_status text,
  ADD COLUMN IF NOT EXISTS last_extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_last_error text,
  ADD COLUMN IF NOT EXISTS ai_model_name text,
  ADD COLUMN IF NOT EXISTS ai_model_version text;

ALTER TABLE evidences
  ALTER COLUMN title DROP NOT NULL;

UPDATE tenant_nonconformities
SET
  control_id = COALESCE(tenant_nonconformities.control_id, tc.control_id),
  control_description = COALESCE(tenant_nonconformities.control_description, cc.description, cc.title, cc.code),
  description = COALESCE(tenant_nonconformities.description, tenant_nonconformities.control_description, cc.description, cc.title, cc.code),
  title = COALESCE(tenant_nonconformities.title, tenant_nonconformities.control_description, tenant_nonconformities.description, cc.description, cc.title, cc.code, 'No conformidad'),
  updated_at = now()
FROM tenant_controls tc
JOIN controls_catalog cc ON cc.id = tc.control_id
WHERE tenant_nonconformities.tenant_id = tc.tenant_id
  AND tenant_nonconformities.tenant_control_id = tc.id;

UPDATE tenant_nonconformities
SET
  title = COALESCE(tenant_nonconformities.title, tenant_nonconformities.control_description, tenant_nonconformities.description, 'No conformidad'),
  description = COALESCE(tenant_nonconformities.description, tenant_nonconformities.control_description, tenant_nonconformities.title),
  updated_at = now()
WHERE title IS NULL
   OR description IS NULL;

UPDATE evidences
SET
  control_id = COALESCE(evidences.control_id, evidences.catalog_control_id, tc.control_id),
  catalog_control_id = COALESCE(evidences.catalog_control_id, evidences.control_id, tc.control_id),
  title = COALESCE(evidences.title, evidences.description, evidences.file_name, 'Evidencia'),
  description = COALESCE(evidences.description, evidences.title, evidences.file_name),
  updated_at = now()
FROM tenant_controls tc
WHERE evidences.tenant_id = tc.tenant_id
  AND evidences.tenant_control_id = tc.id;

UPDATE evidences
SET
  catalog_control_id = COALESCE(evidences.catalog_control_id, evidences.control_id),
  control_id = COALESCE(evidences.control_id, evidences.catalog_control_id),
  title = COALESCE(evidences.title, evidences.description, evidences.file_name, 'Evidencia'),
  description = COALESCE(evidences.description, evidences.title, evidences.file_name),
  updated_at = now()
WHERE title IS NULL
   OR description IS NULL
   OR control_id IS NULL
   OR catalog_control_id IS NULL;

CREATE TABLE IF NOT EXISTS evidence_document_extracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_engine text,
  file_type text,
  mime_type text,
  raw_text text,
  structured_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  text_char_count integer NOT NULL DEFAULT 0 CHECK (text_char_count >= 0),
  ocr_used boolean NOT NULL DEFAULT false,
  detected_language text,
  page_count integer,
  sheet_count integer,
  image_count integer,
  extraction_notes text,
  started_at timestamptz,
  extracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_document_extracts_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_ai_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  extract_id uuid,
  is_current boolean NOT NULL DEFAULT true,
  analysis_status text NOT NULL DEFAULT 'pending',
  validity_result text,
  contribution_level text,
  pertinence_score numeric NOT NULL DEFAULT 0,
  sufficiency_score numeric NOT NULL DEFAULT 0,
  freshness_score numeric NOT NULL DEFAULT 0,
  traceability_score numeric NOT NULL DEFAULT 0,
  consistency_score numeric NOT NULL DEFAULT 0,
  compliance_impact_score numeric NOT NULL DEFAULT 0,
  recommended_standard_code text,
  recommended_clause text,
  recommended_control_id uuid,
  recommended_operation_id uuid,
  headline text,
  narrative text,
  risks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_entities_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  control_fit text,
  gap_summary text,
  duplicate_of_evidence_id uuid,
  appears_expired boolean NOT NULL DEFAULT false,
  appears_complete boolean NOT NULL DEFAULT false,
  appears_authentic boolean,
  model_name text,
  model_version text,
  source_system text,
  raw_response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_trace_id uuid,
  ai_source_level text,
  ai_source_label text,
  ai_confidence text,
  ai_confidence_score numeric,
  ai_orchestration_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_enhanced_answer_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_ai_assessments_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_ai_assessments_extract_same_tenant
    FOREIGN KEY (tenant_id, extract_id)
    REFERENCES evidence_document_extracts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ai_assessments_duplicate_same_tenant
    FOREIGN KEY (tenant_id, duplicate_of_evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ai_assessments_operation_same_tenant
    FOREIGN KEY (tenant_id, recommended_operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evidence_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','processing','retry','completed','failed','cancelled')),
  run_after timestamptz NOT NULL DEFAULT now(),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries integer NOT NULL DEFAULT 5 CHECK (max_retries >= 0),
  error_message text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz,
  locked_by text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_ai_jobs_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL,
  assessment_id uuid,
  extract_id uuid,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  chunk_type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  content_hash text NOT NULL,
  token_estimate integer NOT NULL DEFAULT 0 CHECK (token_estimate >= 0),
  embedding_status text NOT NULL DEFAULT 'pending',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_approved_signal boolean NOT NULL DEFAULT false,
  is_negative_signal boolean NOT NULL DEFAULT false,
  standard_code text,
  clause text,
  control_id uuid REFERENCES controls_catalog(id) ON DELETE SET NULL,
  tenant_control_id uuid,
  operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_id, chunk_index),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_evidence_knowledge_chunks_evidence_same_tenant
    FOREIGN KEY (tenant_id, evidence_id)
    REFERENCES evidences(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_knowledge_chunks_assessment_same_tenant
    FOREIGN KEY (tenant_id, assessment_id)
    REFERENCES evidence_ai_assessments(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_extract_same_tenant
    FOREIGN KEY (tenant_id, extract_id)
    REFERENCES evidence_document_extracts(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_tenant_control_same_tenant
    FOREIGN KEY (tenant_id, tenant_control_id)
    REFERENCES tenant_controls(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_knowledge_chunks_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_stage_catalog (
  stage_code text PRIMARY KEY,
  display_order integer NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO standard_lifecycle_stage_catalog (stage_code, display_order, is_terminal, is_active, metadata)
VALUES
  ('diagnostico', 10, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('diseno_planificacion', 20, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('implementacion', 30, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('verificacion_auditoria', 40, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('certificacion', 50, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('mejora_continua', 60, false, true, '{"source":"runtime_contract_v2"}'::jsonb),
  ('suspendida_fuera_alcance', 70, true, true, '{"source":"runtime_contract_v2"}'::jsonb)
ON CONFLICT (stage_code) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_terminal = EXCLUDED.is_terminal,
  is_active = EXCLUDED.is_active,
  metadata = standard_lifecycle_stage_catalog.metadata || EXCLUDED.metadata,
  updated_at = now();

CREATE TABLE IF NOT EXISTS standard_lifecycle_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  calculated_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  confirmed_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  effective_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  pending_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  pending_request_id uuid,
  pending_requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  pending_requested_at timestamptz,
  health_status text,
  maturity_score numeric,
  catalog_controls_count integer NOT NULL DEFAULT 0,
  enabled_controls_count integer NOT NULL DEFAULT 0,
  controls_enabled_pct numeric,
  controls_with_evidence_count integer NOT NULL DEFAULT 0,
  evidence_coverage_pct numeric,
  avg_health_score numeric,
  open_nonconformities_count integer NOT NULL DEFAULT 0,
  open_findings_count integer NOT NULL DEFAULT 0,
  open_action_plans_count integer NOT NULL DEFAULT 0,
  open_audits_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  last_snapshot_at timestamptz,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, standard_code, operation_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_status_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_status_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  calculated_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  confirmed_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  effective_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  health_status text,
  maturity_score numeric,
  catalog_controls_count integer NOT NULL DEFAULT 0,
  enabled_controls_count integer NOT NULL DEFAULT 0,
  controls_enabled_pct numeric,
  controls_with_evidence_count integer NOT NULL DEFAULT 0,
  evidence_coverage_pct numeric,
  avg_health_score numeric,
  open_nonconformities_count integer NOT NULL DEFAULT 0,
  open_findings_count integer NOT NULL DEFAULT 0,
  open_action_plans_count integer NOT NULL DEFAULT 0,
  open_audits_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_snapshots_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_snapshots_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_stage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  from_stage_code text REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  to_stage_code text NOT NULL REFERENCES standard_lifecycle_stage_catalog(stage_code) ON DELETE RESTRICT,
  request_status text NOT NULL DEFAULT 'por_confirmar' CHECK (request_status IN ('por_confirmar','confirmado','rechazado','devuelto')),
  request_source text NOT NULL DEFAULT 'manual',
  request_reason text,
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_requests_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_requests_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standard_lifecycle_ai_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text NOT NULL REFERENCES standards(standard_code) ON DELETE RESTRICT,
  operation_id uuid NOT NULL,
  event_type text NOT NULL,
  content_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_standard_lifecycle_ai_feed_tenant_standard
    FOREIGN KEY (tenant_id, standard_code)
    REFERENCES tenant_standards(tenant_id, standard_code) ON DELETE CASCADE,
  CONSTRAINT fk_standard_lifecycle_ai_feed_operation_same_tenant
    FOREIGN KEY (tenant_id, operation_id)
    REFERENCES tenant_operations(tenant_id, id) ON DELETE CASCADE
);

CREATE OR REPLACE VIEW public.vw_evidence_current_extracts AS
SELECT
  id, tenant_id, evidence_id, extraction_status, extraction_engine, file_type,
  mime_type, raw_text, structured_json, text_char_count, ocr_used,
  detected_language, page_count, sheet_count, image_count, extraction_notes,
  started_at, extracted_at, created_at, updated_at
FROM evidence_document_extracts
WHERE is_current IS TRUE;

CREATE OR REPLACE VIEW public.vw_evidence_current_ai_assessments AS
SELECT
  id, tenant_id, evidence_id, extract_id, analysis_status, validity_result,
  contribution_level, pertinence_score, sufficiency_score, freshness_score,
  traceability_score, consistency_score, compliance_impact_score,
  recommended_standard_code, recommended_clause, recommended_control_id,
  recommended_operation_id, headline, narrative, risks_json, next_steps_json,
  extracted_entities_json, control_fit, gap_summary, duplicate_of_evidence_id,
  appears_expired, appears_complete, appears_authentic, model_name, model_version,
  source_system, raw_response_json, ai_trace_id, ai_source_level, ai_source_label,
  ai_confidence, ai_confidence_score, ai_orchestration_json, ai_enhanced_answer_json,
  analyzed_at, created_at, updated_at
FROM evidence_ai_assessments
WHERE is_current IS TRUE;

CREATE OR REPLACE FUNCTION public.reconcile_tenant_nonconformity_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_from_tenant_control uuid;
  tenant_control_match_count integer;
  tenant_control_match_id uuid;
BEGIN
  IF NEW.tenant_control_id IS NOT NULL THEN
    SELECT tc.control_id INTO catalog_from_tenant_control
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.id = NEW.tenant_control_id;
    IF catalog_from_tenant_control IS NULL THEN
      RAISE EXCEPTION 'tenant_nonconformities.tenant_control_id does not belong to tenant %', NEW.tenant_id USING ERRCODE = '23503';
    END IF;
    IF NEW.control_id IS NULL THEN
      NEW.control_id := catalog_from_tenant_control;
    ELSIF NEW.control_id <> catalog_from_tenant_control THEN
      RAISE EXCEPTION 'tenant_nonconformities.control_id diverges from tenant_control_id for tenant %', NEW.tenant_id USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.control_id IS NOT NULL THEN
    SELECT count(*)::int, (array_agg(tc.id))[1]
    INTO tenant_control_match_count, tenant_control_match_id
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.control_id = NEW.control_id;
    IF tenant_control_match_count = 1 THEN
      NEW.tenant_control_id := tenant_control_match_id;
    END IF;
  END IF;
  IF NEW.control_description IS NULL AND NEW.control_id IS NOT NULL THEN
    SELECT COALESCE(cc.description, cc.title, cc.code) INTO NEW.control_description
    FROM controls_catalog cc
    WHERE cc.id = NEW.control_id;
  END IF;
  NEW.description := COALESCE(NULLIF(NEW.description, ''), NULLIF(NEW.control_description, ''), NEW.title);
  NEW.title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.control_description, ''), NULLIF(NEW.description, ''), 'No conformidad');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_evidence_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  catalog_from_tenant_control uuid;
  tenant_control_match_count integer;
  tenant_control_match_id uuid;
  effective_catalog_id uuid;
BEGIN
  IF NEW.control_id IS NOT NULL AND NEW.catalog_control_id IS NOT NULL AND NEW.control_id <> NEW.catalog_control_id THEN
    RAISE EXCEPTION 'evidences.control_id diverges from catalog_control_id for tenant %', NEW.tenant_id USING ERRCODE = '23514';
  END IF;
  effective_catalog_id := COALESCE(NEW.control_id, NEW.catalog_control_id);
  IF NEW.tenant_control_id IS NOT NULL THEN
    SELECT tc.control_id INTO catalog_from_tenant_control
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.id = NEW.tenant_control_id;
    IF catalog_from_tenant_control IS NULL THEN
      RAISE EXCEPTION 'evidences.tenant_control_id does not belong to tenant %', NEW.tenant_id USING ERRCODE = '23503';
    END IF;
    IF effective_catalog_id IS NULL THEN
      effective_catalog_id := catalog_from_tenant_control;
    ELSIF effective_catalog_id <> catalog_from_tenant_control THEN
      RAISE EXCEPTION 'evidences catalog control diverges from tenant_control_id for tenant %', NEW.tenant_id USING ERRCODE = '23514';
    END IF;
  ELSIF effective_catalog_id IS NOT NULL THEN
    SELECT count(*)::int, (array_agg(tc.id))[1]
    INTO tenant_control_match_count, tenant_control_match_id
    FROM tenant_controls tc
    WHERE tc.tenant_id = NEW.tenant_id
      AND tc.control_id = effective_catalog_id;
    IF tenant_control_match_count = 1 THEN
      NEW.tenant_control_id := tenant_control_match_id;
    END IF;
  END IF;
  NEW.control_id := effective_catalog_id;
  NEW.catalog_control_id := effective_catalog_id;
  NEW.description := COALESCE(NULLIF(NEW.description, ''), NULLIF(NEW.title, ''), NULLIF(NEW.file_name, ''));
  NEW.title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.description, ''), NULLIF(NEW.file_name, ''), 'Evidencia');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenant_nonconformities_contract_reconcile ON tenant_nonconformities;
CREATE TRIGGER trg_tenant_nonconformities_contract_reconcile
BEFORE INSERT OR UPDATE ON tenant_nonconformities
FOR EACH ROW EXECUTE FUNCTION public.reconcile_tenant_nonconformity_contract();

DROP TRIGGER IF EXISTS trg_evidences_contract_reconcile ON evidences;
CREATE TRIGGER trg_evidences_contract_reconcile
BEFORE INSERT OR UPDATE ON evidences
FOR EACH ROW EXECUTE FUNCTION public.reconcile_evidence_contract();

CREATE OR REPLACE FUNCTION public.enqueue_evidence_ai_job(
  p_tenant_id uuid,
  p_evidence_id uuid,
  p_job_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_priority smallint DEFAULT 50,
  p_run_after timestamp DEFAULT now(),
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO evidence_ai_jobs (
    tenant_id, evidence_id, job_type, payload, priority, status, run_after, created_by
  )
  VALUES (
    p_tenant_id,
    p_evidence_id,
    NULLIF(p_job_type, ''),
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_priority, 50),
    'pending',
    COALESCE(p_run_after::timestamptz, now()),
    p_created_by
  )
  RETURNING id INTO inserted_id;
  RETURN inserted_id;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_standards_lifecycle ON tenant_standards(tenant_id, standard_code, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_tenant_nonconformities_control ON tenant_nonconformities(tenant_id, control_id);
CREATE INDEX IF NOT EXISTS idx_evidences_control_id ON evidences(tenant_id, control_id);
CREATE INDEX IF NOT EXISTS idx_evidence_extracts_current ON evidence_document_extracts(tenant_id, evidence_id) WHERE is_current IS TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_extracts_one_current ON evidence_document_extracts(evidence_id) WHERE is_current IS TRUE;
CREATE INDEX IF NOT EXISTS idx_evidence_ai_assessments_current ON evidence_ai_assessments(tenant_id, evidence_id) WHERE is_current IS TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_ai_assessments_one_current ON evidence_ai_assessments(evidence_id) WHERE is_current IS TRUE;
CREATE INDEX IF NOT EXISTS idx_evidence_ai_jobs_claim ON evidence_ai_jobs(status, run_after, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_ai_jobs_tenant_evidence ON evidence_ai_jobs(tenant_id, evidence_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_knowledge_chunks_evidence ON evidence_knowledge_chunks(tenant_id, evidence_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_status_tenant_standard ON standard_lifecycle_status(tenant_id, standard_code, operation_id);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_snapshots_tenant_standard ON standard_lifecycle_snapshots(tenant_id, standard_code, operation_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_stage_requests_pending ON standard_lifecycle_stage_requests(tenant_id, standard_code, operation_id, request_status);
CREATE INDEX IF NOT EXISTS idx_standard_lifecycle_ai_feed_unprocessed ON standard_lifecycle_ai_feed(tenant_id, is_processed, created_at);

REVOKE EXECUTE ON FUNCTION
  public.reconcile_tenant_nonconformity_contract(),
  public.reconcile_evidence_contract(),
  public.enqueue_evidence_ai_job(uuid, uuid, text, jsonb, smallint, timestamp, uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.enqueue_evidence_ai_job(uuid, uuid, text, jsonb, smallint, timestamp, uuid)
TO tcdx_backend_runtime;

GRANT SELECT ON public.vw_evidence_current_extracts, public.vw_evidence_current_ai_assessments
TO tcdx_backend_runtime;

GRANT SELECT ON standard_lifecycle_stage_catalog TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  evidence_document_extracts, evidence_ai_assessments, evidence_ai_jobs, evidence_knowledge_chunks,
  standard_lifecycle_status, standard_lifecycle_snapshots, standard_lifecycle_stage_requests,
  standard_lifecycle_ai_feed
TO tcdx_backend_runtime;

COMMIT;
