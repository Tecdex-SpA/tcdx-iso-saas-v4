BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS regulatory_semantic_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_key text NOT NULL UNIQUE,
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  from_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  to_version_id uuid NOT NULL REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  from_knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  to_knowledge_document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
  contract_version text NOT NULL,
  comparison_method text NOT NULL,
  structural_checksum text NOT NULL,
  content_checksum text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  ai_interpretation_status text NOT NULL DEFAULT 'not_used',
  human_review_status text NOT NULL DEFAULT 'pending_review',
  publication_status text NOT NULL DEFAULT 'not_published',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_semantic_diffs_version_order_check
    CHECK (from_version_id <> to_version_id),
  CONSTRAINT regulatory_semantic_diffs_checksum_check
    CHECK (structural_checksum ~ '^[a-f0-9]{64}$' AND content_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_semantic_diffs_status_check
    CHECK (status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulatory_semantic_diffs_ai_status_check
    CHECK (ai_interpretation_status IN ('not_used','draft','pending_review','reviewed','rejected')),
  CONSTRAINT regulatory_semantic_diffs_human_review_check
    CHECK (human_review_status IN ('pending_review','reviewed','rejected')),
  CONSTRAINT regulatory_semantic_diffs_publication_check
    CHECK (publication_status IN ('not_published','published','superseded'))
);

CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diffs_regulation
  ON regulatory_semantic_diffs(regulation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diffs_versions
  ON regulatory_semantic_diffs(from_version_id, to_version_id);

CREATE TABLE IF NOT EXISTS regulatory_semantic_diff_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_id uuid NOT NULL REFERENCES regulatory_semantic_diffs(id) ON DELETE CASCADE,
  change_key text NOT NULL,
  change_type text NOT NULL,
  object_type text NOT NULL,
  from_object_id uuid,
  to_object_id uuid,
  from_reference text,
  to_reference text,
  from_checksum text,
  to_checksum text,
  similarity numeric(8,6),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  temporal_semantics jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_semantic_diff_changes_type_check
    CHECK (change_type IN ('added','removed','modified','moved','unchanged','unaffected')),
  CONSTRAINT regulatory_semantic_diff_changes_object_check
    CHECK (object_type IN ('text_section','legal_obligation','version_temporality','reference_scope')),
  CONSTRAINT regulatory_semantic_diff_changes_checksum_check
    CHECK (
      (from_checksum IS NULL OR from_checksum ~ '^[a-f0-9]{64}$')
      AND (to_checksum IS NULL OR to_checksum ~ '^[a-f0-9]{64}$')
    ),
  CONSTRAINT regulatory_semantic_diff_changes_review_check
    CHECK (review_status IN ('pending_review','reviewed','rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_semantic_diff_changes_key
  ON regulatory_semantic_diff_changes(semantic_diff_id, change_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_semantic_diff_changes_type
  ON regulatory_semantic_diff_changes(object_type, change_type);

CREATE TABLE IF NOT EXISTS regulatory_obligation_change_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_diff_id uuid NOT NULL REFERENCES regulatory_semantic_diffs(id) ON DELETE CASCADE,
  regulation_id uuid NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  from_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  to_version_id uuid REFERENCES regulation_versions(id) ON DELETE RESTRICT,
  previous_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE RESTRICT,
  next_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE RESTRICT,
  lineage_type text NOT NULL,
  lineage_key text NOT NULL,
  evidence_change_id uuid REFERENCES regulatory_semantic_diff_changes(id) ON DELETE SET NULL,
  contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_obligation_lineage_type_check
    CHECK (lineage_type IN ('added','modified','removed','deprecated','unchanged','unaffected')),
  CONSTRAINT regulatory_obligation_lineage_review_check
    CHECK (review_status IN ('pending_review','reviewed','rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_obligation_change_lineage_key
  ON regulatory_obligation_change_lineage(semantic_diff_id, lineage_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_obligation_change_lineage_regulation
  ON regulatory_obligation_change_lineage(regulation_id, lineage_type);

CREATE TABLE IF NOT EXISTS regulatory_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL,
  scope text NOT NULL DEFAULT 'JURISDICTIONAL',
  tenant_id uuid,
  jurisdiction text,
  domain text,
  subject text,
  display_name text NOT NULL,
  description text,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  owner text NOT NULL DEFAULT 'CODEX_B_REGULATORY',
  model_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_packs_scope_check
    CHECK (scope IN ('GLOBAL','JURISDICTIONAL','TENANT_PRIVATE')),
  CONSTRAINT regulatory_packs_tenant_scope_check
    CHECK (
      (scope='TENANT_PRIVATE' AND tenant_id IS NOT NULL)
      OR (scope IN ('GLOBAL','JURISDICTIONAL') AND tenant_id IS NULL)
    ),
  CONSTRAINT regulatory_packs_lifecycle_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_packs_scope_key
  ON regulatory_packs(scope, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_packs_filters
  ON regulatory_packs(scope, jurisdiction, domain, lifecycle_status);

CREATE TABLE IF NOT EXISTS regulatory_pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  version_identifier text NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  effective_from timestamptz,
  effective_to timestamptz,
  supersedes_pack_version_id uuid REFERENCES regulatory_pack_versions(id) ON DELETE RESTRICT,
  composition_checksum text NOT NULL,
  source_registry_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  regulation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  regulation_version_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  obligation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  contract_version text NOT NULL,
  activation_contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_versions_lifecycle_check
    CHECK (lifecycle_status IN ('draft','reviewed','published','deprecated','rejected','error')),
  CONSTRAINT regulatory_pack_versions_checksum_check
    CHECK (composition_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT regulatory_pack_versions_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_versions_identity
  ON regulatory_pack_versions(regulatory_pack_id, version_identifier);

CREATE INDEX IF NOT EXISTS idx_regulatory_pack_versions_status
  ON regulatory_pack_versions(lifecycle_status, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS regulatory_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text NOT NULL,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE RESTRICT,
  regulation_id uuid REFERENCES regulations(id) ON DELETE CASCADE,
  regulation_version_id uuid REFERENCES regulation_versions(id) ON DELETE CASCADE,
  legal_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE CASCADE,
  semantic_diff_id uuid REFERENCES regulatory_semantic_diffs(id) ON DELETE SET NULL,
  reference text,
  lifecycle_status text NOT NULL DEFAULT 'active',
  effective_from timestamptz,
  effective_to timestamptz,
  applicability_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  mapping_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_items_type_check
    CHECK (item_type IN ('source','regulation','regulation_version','legal_obligation','semantic_diff')),
  CONSTRAINT regulatory_pack_items_lifecycle_check
    CHECK (lifecycle_status IN ('active','inactive','deprecated')),
  CONSTRAINT regulatory_pack_items_effective_range_check
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CONSTRAINT regulatory_pack_items_reference_check
    CHECK (
      (item_type='source' AND source_id IS NOT NULL)
      OR (item_type='regulation' AND regulation_id IS NOT NULL)
      OR (item_type='regulation_version' AND regulation_version_id IS NOT NULL)
      OR (item_type='legal_obligation' AND legal_obligation_id IS NOT NULL)
      OR (item_type='semantic_diff' AND semantic_diff_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_items_key
  ON regulatory_pack_items(regulatory_pack_version_id, item_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_pack_items_targets
  ON regulatory_pack_items(item_type, regulation_id, regulation_version_id, legal_obligation_id);

CREATE TABLE IF NOT EXISTS regulatory_pack_tenant_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  activation_status text NOT NULL DEFAULT 'draft',
  activated_at timestamptz,
  deactivated_at timestamptz,
  configured_by uuid,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  activation_contract_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_activation_status_check
    CHECK (activation_status IN ('draft','active','paused','deprecated','rejected')),
  CONSTRAINT regulatory_pack_activation_range_check
    CHECK (deactivated_at IS NULL OR activated_at IS NULL OR deactivated_at > activated_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_tenant_activation
  ON regulatory_pack_tenant_activations(tenant_id, regulatory_pack_version_id);

CREATE INDEX IF NOT EXISTS idx_regulatory_pack_tenant_activation_status
  ON regulatory_pack_tenant_activations(tenant_id, activation_status);

CREATE TABLE IF NOT EXISTS regulatory_pack_applicability_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  regulatory_pack_id uuid NOT NULL REFERENCES regulatory_packs(id) ON DELETE CASCADE,
  regulatory_pack_version_id uuid NOT NULL REFERENCES regulatory_pack_versions(id) ON DELETE CASCADE,
  activation_id uuid REFERENCES regulatory_pack_tenant_activations(id) ON DELETE SET NULL,
  evaluation_key text NOT NULL,
  evaluation_status text NOT NULL DEFAULT 'draft',
  recommendation text NOT NULL,
  confidence numeric(8,6) NOT NULL DEFAULT 0,
  human_confirmation_required boolean NOT NULL DEFAULT true,
  contract_version text NOT NULL,
  evaluated_by uuid,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  inputs_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_applicability_status_check
    CHECK (evaluation_status IN ('draft','reviewed','confirmed','rejected','error')),
  CONSTRAINT regulatory_pack_applicability_recommendation_check
    CHECK (recommendation IN ('applicable','not_applicable','needs_review','insufficient_data')),
  CONSTRAINT regulatory_pack_applicability_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_regulatory_pack_applicability_evaluation
  ON regulatory_pack_applicability_evaluations(tenant_id, regulatory_pack_version_id, evaluation_key);

CREATE INDEX IF NOT EXISTS idx_regulatory_pack_applicability_tenant
  ON regulatory_pack_applicability_evaluations(tenant_id, recommendation, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS regulatory_pack_applicability_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicability_evaluation_id uuid NOT NULL REFERENCES regulatory_pack_applicability_evaluations(id) ON DELETE CASCADE,
  regulatory_pack_item_id uuid REFERENCES regulatory_pack_items(id) ON DELETE SET NULL,
  legal_obligation_id uuid REFERENCES legal_obligations(id) ON DELETE SET NULL,
  recommendation text NOT NULL,
  confidence numeric(8,6) NOT NULL DEFAULT 0,
  human_confirmation_required boolean NOT NULL DEFAULT true,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_pack_applicability_result_recommendation_check
    CHECK (recommendation IN ('applicable','not_applicable','needs_review','insufficient_data')),
  CONSTRAINT regulatory_pack_applicability_result_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_regulatory_pack_applicability_results_evaluation
  ON regulatory_pack_applicability_results(applicability_evaluation_id);

CREATE TABLE IF NOT EXISTS regulatory_governance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id uuid,
  previous_state jsonb,
  new_state jsonb,
  contract_version text NOT NULL,
  source_id uuid REFERENCES regulatory_authoritative_sources(id) ON DELETE SET NULL,
  regulation_id uuid REFERENCES regulations(id) ON DELETE SET NULL,
  regulation_version_id uuid REFERENCES regulation_versions(id) ON DELETE SET NULL,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_governance_audit_object
  ON regulatory_governance_audit(object_type, object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regulatory_governance_audit_tenant
  ON regulatory_governance_audit(tenant_id, created_at DESC);

COMMENT ON TABLE regulatory_semantic_diffs IS
  'Deterministic governed semantic diff between canonical regulation_versions. AI interpretation is non-authoritative draft metadata only.';

COMMENT ON TABLE regulatory_semantic_diff_changes IS
  'Structured text, obligation and temporal changes with source checksums and canonical object references.';

COMMENT ON TABLE regulatory_obligation_change_lineage IS
  'Traceable obligation lineage between regulation versions. Historical obligations are preserved and never overwritten.';

COMMENT ON TABLE regulatory_packs IS
  'Governed regulatory pack identity. Packs compose canonical regulatory truth and do not copy legal text.';

COMMENT ON TABLE regulatory_pack_versions IS
  'Versioned regulatory pack composition with stable checksum and provenance.';

COMMENT ON TABLE regulatory_pack_items IS
  'Explicit pack composition references to canonical sources, regulations, versions, obligations and diffs.';

COMMENT ON TABLE regulatory_pack_tenant_activations IS
  'Tenant-scoped activation/configuration of a global or jurisdictional pack version. Tenant activation does not mutate pack definition.';

COMMENT ON TABLE regulatory_pack_applicability_evaluations IS
  'Tenant-scoped applicability recommendation/evaluation. Legal truth remains in canonical regulatory objects and human confirmation gates sensitive applicability.';

COMMENT ON TABLE regulatory_governance_audit IS
  'Minimal regulatory governance audit trail without document text or secrets.';

COMMIT;
