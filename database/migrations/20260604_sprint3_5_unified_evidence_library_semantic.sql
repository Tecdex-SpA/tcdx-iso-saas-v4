-- =========================================================
-- TCDX ISO SaaS
-- Sprint 3.5 - Unified evidence library and semantic evidence
-- Non-destructive/idempotent migration proposal
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenant_document_object_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_label text NULL,
  evidence_usage text NOT NULL DEFAULT 'supporting_evidence',
  relation_type text NOT NULL DEFAULT 'associated',
  status text NOT NULL DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamp without time zone NULL,
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_document_object_links
  ADD COLUMN IF NOT EXISTS document_key text NULL,
  ADD COLUMN IF NOT EXISTS target_label text NULL,
  ADD COLUMN IF NOT EXISTS evidence_usage text NOT NULL DEFAULT 'supporting_evidence',
  ADD COLUMN IF NOT EXISTS relation_type text NOT NULL DEFAULT 'associated',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp without time zone NULL,
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_document_object_links_source_type_check'
      AND conrelid = 'public.tenant_document_object_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_document_object_links
      ADD CONSTRAINT tenant_document_object_links_source_type_check
      CHECK (source_type IN ('document_index', 'evidence'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_document_object_links_target_type_check'
      AND conrelid = 'public.tenant_document_object_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_document_object_links
      ADD CONSTRAINT tenant_document_object_links_target_type_check
      CHECK (target_type IN ('control', 'nonconformity', 'finding', 'process', 'operation', 'risk', 'action'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenant_document_object_links_usage_check'
      AND conrelid = 'public.tenant_document_object_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_document_object_links
      ADD CONSTRAINT tenant_document_object_links_usage_check
      CHECK (
        evidence_usage IN (
          'primary_evidence',
          'supporting_evidence',
          'remediation_evidence',
          'finding_evidence',
          'process_evidence',
          'operation_evidence',
          'risk_evidence',
          'action_evidence',
          'reference'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_document_object_links_active
  ON public.tenant_document_object_links (
    tenant_id,
    source_type,
    source_id,
    target_type,
    target_id,
    evidence_usage
  )
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_document_object_links_source
  ON public.tenant_document_object_links (tenant_id, source_type, source_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_document_object_links_target
  ON public.tenant_document_object_links (tenant_id, target_type, target_id, is_active);

CREATE TABLE IF NOT EXISTS public.tenant_evidence_semantic_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text NULL,
  document_type text NOT NULL DEFAULT 'unknown',
  semantic_status text NOT NULL DEFAULT 'not_processed',
  usefulness_score numeric(5,2) NULL,
  classification_confidence numeric(5,2) NULL,
  classification_method text NOT NULL DEFAULT 'rule_based',
  classification_reason text NULL,
  scoring_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  processed_at timestamp without time zone NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_evidence_semantic_profiles_source
  ON public.tenant_evidence_semantic_profiles (tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_semantic_profiles_status
  ON public.tenant_evidence_semantic_profiles (tenant_id, semantic_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_evidence_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text NULL,
  filename text NULL,
  page_number integer NULL,
  section_label text NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  chunk_hash text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_chunks_source
  ON public.tenant_evidence_chunks (tenant_id, source_type, source_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_chunks_hash
  ON public.tenant_evidence_chunks (tenant_id, chunk_hash);

CREATE TABLE IF NOT EXISTS public.tenant_evidence_applicability_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_key text NULL,
  target_type text NOT NULL,
  target_id uuid NULL,
  target_label text NULL,
  score numeric(5,2) NULL,
  confidence numeric(5,2) NULL,
  reason text NULL,
  chunk_id uuid NULL REFERENCES public.tenant_evidence_chunks(id) ON DELETE SET NULL,
  snippet text NULL,
  status text NOT NULL DEFAULT 'suggested',
  reviewed_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamp without time zone NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_suggestions_source
  ON public.tenant_evidence_applicability_suggestions (tenant_id, source_type, source_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_evidence_suggestions_target
  ON public.tenant_evidence_applicability_suggestions (tenant_id, target_type, target_id);

COMMENT ON TABLE public.tenant_document_object_links IS 'Sprint 3.5: human-reviewed document/evidence associations to controls, NCs, findings, processes, operations, risks, and actions.';
COMMENT ON TABLE public.tenant_evidence_chunks IS 'Sprint 3.5: traceable citeable fragments for tenant evidence/document semantic analysis.';
COMMENT ON TABLE public.tenant_evidence_semantic_profiles IS 'Sprint 3.5: latest semantic classification and usefulness profile per tenant document/evidence.';
COMMENT ON TABLE public.tenant_evidence_applicability_suggestions IS 'Sprint 3.5: human-reviewable semantic applicability suggestions with cited fragments.';
