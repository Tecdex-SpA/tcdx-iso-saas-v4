-- DB-N01 - Canonical control operational identity.
--
-- Canonical model:
--   controls_catalog.id          = catalog identity
--   tenant_controls.control_id   = catalog link
--   tenant_controls.id           = operational identity
--
-- This migration intentionally does not drop public.controls or evidences.control_id.
-- It fails instead of choosing between multiple tenant_controls candidates.
--
-- Optional manual decisions for previously audited ambiguous rows can be supplied
-- by the migration runner/session as JSON before execution:
--   SET LOCAL tcdx.dbn01_manual_decisions = '[{"table_name":"findings","record_id":"...","selected_tenant_control_id":"...","approved_by":"...","reason":"..."}]';

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090401) THEN
    RAISE EXCEPTION 'DB-N01 migration lock unavailable';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.controls_catalog') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: controls_catalog missing';
  END IF;
  IF to_regclass('public.tenant_controls') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: tenant_controls missing';
  END IF;
  IF to_regclass('public.controls') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: controls legacy table missing';
  END IF;
  IF to_regclass('public.findings') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: findings missing';
  END IF;
  IF to_regclass('public.evidences') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: evidences missing';
  END IF;
  IF to_regclass('public.action_plans') IS NULL THEN
    RAISE EXCEPTION 'DB-N01 preflight failed: action_plans missing';
  END IF;
END $$;

CREATE TEMP TABLE dbn01_manual_decisions ON COMMIT DROP AS
SELECT
  table_name,
  record_id,
  selected_tenant_control_id,
  approved_by,
  reason
FROM jsonb_to_recordset(
  COALESCE(NULLIF(current_setting('tcdx.dbn01_manual_decisions', true), '')::jsonb, '[]'::jsonb)
) AS d(
  table_name text,
  record_id uuid,
  selected_tenant_control_id uuid,
  approved_by text,
  reason text
);

DO $$
DECLARE
  duplicate_manual_decisions integer;
  invalid_manual_tables integer;
  invalid_manual_records integer;
  invalid_manual_selected_controls integer;
  invalid_manual_tenants integer;
  invalid_manual_catalogs integer;
  invalid_manual_operations integer;
BEGIN
  SELECT count(*) INTO duplicate_manual_decisions
  FROM (
    SELECT table_name, record_id
    FROM dbn01_manual_decisions
    GROUP BY table_name, record_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_manual_decisions > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions duplicate for table_name/record_id: %', duplicate_manual_decisions;
  END IF;

  SELECT count(*) INTO invalid_manual_tables
  FROM dbn01_manual_decisions
  WHERE table_name IS NULL
     OR table_name NOT IN ('findings', 'evidences');

  IF invalid_manual_tables > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions invalid table_name: %', invalid_manual_tables;
  END IF;

  SELECT count(*) INTO invalid_manual_records
  FROM dbn01_manual_decisions d
  LEFT JOIN findings f
    ON d.table_name = 'findings'
   AND f.id = d.record_id
  LEFT JOIN evidences e
    ON d.table_name = 'evidences'
   AND e.id = d.record_id
  WHERE d.record_id IS NULL
     OR (d.table_name = 'findings' AND f.id IS NULL)
     OR (d.table_name = 'evidences' AND e.id IS NULL);

  IF invalid_manual_records > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions record_id invalid or missing: %', invalid_manual_records;
  END IF;

  SELECT count(*) INTO invalid_manual_selected_controls
  FROM dbn01_manual_decisions d
  LEFT JOIN tenant_controls selected_tc
    ON selected_tc.id = d.selected_tenant_control_id
  WHERE d.selected_tenant_control_id IS NULL
     OR selected_tc.id IS NULL;

  IF invalid_manual_selected_controls > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions selected_tenant_control_id invalid or missing: %',
      invalid_manual_selected_controls;
  END IF;

  WITH decision_context AS (
    SELECT
      d.table_name,
      d.record_id,
      d.selected_tenant_control_id,
      selected_tc.tenant_id AS selected_tenant_id,
      selected_tc.control_id AS selected_catalog_control_id,
      COALESCE(f.tenant_id, e.tenant_id) AS record_tenant_id,
      COALESCE(f_direct.control_id, f_legacy.catalog_control_id, e_direct.control_id, e_catalog_direct.id, e_legacy.catalog_control_id) AS expected_catalog_control_id,
      f_direct.id AS finding_direct_tenant_control_id,
      e_direct.id AS evidence_direct_tenant_control_id
    FROM dbn01_manual_decisions d
    LEFT JOIN findings f
      ON d.table_name = 'findings'
     AND f.id = d.record_id
    LEFT JOIN tenant_controls f_direct
      ON d.table_name = 'findings'
     AND f_direct.id = f.tenant_control_id
     AND f_direct.tenant_id = f.tenant_id
    LEFT JOIN controls f_legacy
      ON d.table_name = 'findings'
     AND f_legacy.id = f.tenant_control_id
     AND f_legacy.tenant_id = f.tenant_id
    LEFT JOIN evidences e
      ON d.table_name = 'evidences'
     AND e.id = d.record_id
    LEFT JOIN tenant_controls e_direct
      ON d.table_name = 'evidences'
     AND e_direct.id = e.tenant_control_id
     AND e_direct.tenant_id = e.tenant_id
    LEFT JOIN controls_catalog e_catalog_direct
      ON d.table_name = 'evidences'
     AND e_catalog_direct.id = e.control_id
    LEFT JOIN controls e_legacy
      ON d.table_name = 'evidences'
     AND e_legacy.id = e.control_id
     AND e_legacy.tenant_id = e.tenant_id
    LEFT JOIN tenant_controls selected_tc
      ON selected_tc.id = d.selected_tenant_control_id
  )
  SELECT
    count(*) FILTER (
      WHERE selected_tenant_id IS DISTINCT FROM record_tenant_id
    ),
    count(*) FILTER (
      WHERE expected_catalog_control_id IS NULL
         OR selected_catalog_control_id IS DISTINCT FROM expected_catalog_control_id
    ),
    count(*) FILTER (
      WHERE (table_name = 'findings'
             AND finding_direct_tenant_control_id IS NOT NULL
             AND selected_tenant_control_id IS DISTINCT FROM finding_direct_tenant_control_id)
         OR (table_name = 'evidences'
             AND evidence_direct_tenant_control_id IS NOT NULL
             AND selected_tenant_control_id IS DISTINCT FROM evidence_direct_tenant_control_id)
    )
  INTO invalid_manual_tenants, invalid_manual_catalogs, invalid_manual_operations
  FROM decision_context;

  IF invalid_manual_tenants > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions selected_tenant_control_id belongs to another tenant: %',
      invalid_manual_tenants;
  END IF;

  IF invalid_manual_catalogs > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions selected_tenant_control_id does not match expected catalog control: %',
      invalid_manual_catalogs;
  END IF;

  IF invalid_manual_operations > 0 THEN
    RAISE EXCEPTION 'DB-N01 manual decisions selected_tenant_control_id does not match current canonical operation context: %',
      invalid_manual_operations;
  END IF;
END $$;

CREATE UNIQUE INDEX dbn01_manual_decisions_record_idx
  ON dbn01_manual_decisions (table_name, record_id);

CREATE TABLE IF NOT EXISTS dbn01_control_identity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id text NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  previous_tenant_control_id uuid,
  new_tenant_control_id uuid,
  legacy_control_id uuid,
  catalog_control_id uuid,
  resolution_source text NOT NULL,
  decision_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_id, table_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_dbn01_control_identity_audit_record
  ON dbn01_control_identity_audit (table_name, record_id);

DO $$
DECLARE
  invalid_action_plans integer;
  invalid_existing_evidences integer;
  unresolved_findings integer;
  ambiguous_findings integer;
  unresolved_evidences integer;
  ambiguous_evidences integer;
BEGIN
  WITH finding_candidates AS (
    SELECT
      f.id AS finding_id,
      f.tenant_id,
      f.tenant_control_id AS current_control_id,
      direct.id AS direct_tenant_control_id,
      legacy.id AS legacy_control_id,
      legacy.catalog_control_id,
      tc.id AS candidate_tenant_control_id,
      d.selected_tenant_control_id AS manual_tenant_control_id
    FROM findings f
    LEFT JOIN tenant_controls direct
      ON direct.tenant_id = f.tenant_id
     AND direct.id = f.tenant_control_id
    LEFT JOIN controls legacy
      ON legacy.id = f.tenant_control_id
     AND legacy.tenant_id = f.tenant_id
    LEFT JOIN tenant_controls tc
      ON direct.id IS NULL
     AND legacy.catalog_control_id IS NOT NULL
     AND tc.tenant_id = f.tenant_id
     AND tc.control_id = legacy.catalog_control_id
    LEFT JOIN dbn01_manual_decisions d
      ON d.table_name = 'findings'
     AND d.record_id = f.id
    WHERE f.tenant_control_id IS NOT NULL
  ), finding_resolution AS (
    SELECT
      finding_id,
      tenant_id,
      current_control_id,
      (array_agg(DISTINCT direct_tenant_control_id) FILTER (WHERE direct_tenant_control_id IS NOT NULL))[1] AS direct_tenant_control_id,
      (array_agg(DISTINCT legacy_control_id) FILTER (WHERE legacy_control_id IS NOT NULL))[1] AS legacy_control_id,
      (array_agg(DISTINCT catalog_control_id) FILTER (WHERE catalog_control_id IS NOT NULL))[1] AS catalog_control_id,
      count(candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL) AS candidate_count,
      (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1] AS sole_candidate,
      (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1] AS manual_tenant_control_id,
      bool_or(candidate_tenant_control_id = manual_tenant_control_id) AS manual_matches_candidate
    FROM finding_candidates
    GROUP BY finding_id, tenant_id, current_control_id
  )
  SELECT
    count(*) FILTER (
      WHERE direct_tenant_control_id IS NULL
        AND candidate_count = 0
    ),
    count(*) FILTER (
      WHERE direct_tenant_control_id IS NULL
        AND candidate_count > 1
        AND NOT COALESCE(manual_matches_candidate, false)
    )
  INTO unresolved_findings, ambiguous_findings
  FROM finding_resolution;

  IF unresolved_findings > 0 THEN
    RAISE EXCEPTION 'DB-N01 findings unresolved: %', unresolved_findings;
  END IF;

  IF ambiguous_findings > 0 THEN
    RAISE EXCEPTION 'DB-N01 findings ambiguous without approved manual decision: %', ambiguous_findings;
  END IF;

  WITH evidence_candidates AS (
    SELECT
      e.id AS evidence_id,
      e.tenant_id,
      e.control_id,
      e.tenant_control_id,
      direct.id AS direct_tenant_control_id,
      legacy.id AS legacy_control_id,
      COALESCE(catalog_direct.id, legacy.catalog_control_id) AS catalog_control_id,
      tc.id AS candidate_tenant_control_id,
      d.selected_tenant_control_id AS manual_tenant_control_id
    FROM evidences e
    LEFT JOIN tenant_controls direct
      ON direct.tenant_id = e.tenant_id
     AND direct.id = e.tenant_control_id
    LEFT JOIN controls_catalog catalog_direct
      ON catalog_direct.id = e.control_id
    LEFT JOIN controls legacy
      ON legacy.id = e.control_id
     AND legacy.tenant_id = e.tenant_id
    LEFT JOIN tenant_controls tc
      ON e.tenant_control_id IS NULL
     AND tc.tenant_id = e.tenant_id
     AND tc.control_id = COALESCE(catalog_direct.id, legacy.catalog_control_id)
    LEFT JOIN dbn01_manual_decisions d
      ON d.table_name = 'evidences'
     AND d.record_id = e.id
    WHERE e.control_id IS NOT NULL
       OR e.tenant_control_id IS NOT NULL
  ), evidence_resolution AS (
    SELECT
      evidence_id,
      tenant_id,
      control_id,
      tenant_control_id,
      (array_agg(DISTINCT direct_tenant_control_id) FILTER (WHERE direct_tenant_control_id IS NOT NULL))[1] AS direct_tenant_control_id,
      (array_agg(DISTINCT legacy_control_id) FILTER (WHERE legacy_control_id IS NOT NULL))[1] AS legacy_control_id,
      (array_agg(DISTINCT catalog_control_id) FILTER (WHERE catalog_control_id IS NOT NULL))[1] AS catalog_control_id,
      count(candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL) AS candidate_count,
      (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1] AS sole_candidate,
      (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1] AS manual_tenant_control_id,
      bool_or(candidate_tenant_control_id = manual_tenant_control_id) AS manual_matches_candidate
    FROM evidence_candidates
    GROUP BY evidence_id, tenant_id, control_id, tenant_control_id
  )
  SELECT
    count(*) FILTER (
      WHERE tenant_control_id IS NOT NULL
        AND direct_tenant_control_id IS NULL
    ),
    count(*) FILTER (
      WHERE tenant_control_id IS NULL
        AND control_id IS NOT NULL
        AND candidate_count = 0
    ),
    count(*) FILTER (
      WHERE tenant_control_id IS NULL
        AND control_id IS NOT NULL
        AND candidate_count > 1
        AND NOT COALESCE(manual_matches_candidate, false)
    )
  INTO invalid_existing_evidences, unresolved_evidences, ambiguous_evidences
  FROM evidence_resolution;

  IF invalid_existing_evidences > 0 THEN
    RAISE EXCEPTION 'DB-N01 existing evidences.tenant_control_id invalid: %', invalid_existing_evidences;
  END IF;

  IF unresolved_evidences > 0 THEN
    RAISE EXCEPTION 'DB-N01 evidences legacy-only unresolved: %', unresolved_evidences;
  END IF;

  IF ambiguous_evidences > 0 THEN
    RAISE EXCEPTION 'DB-N01 evidences legacy-only ambiguous without approved manual decision: %', ambiguous_evidences;
  END IF;

  SELECT count(*) INTO invalid_action_plans
  FROM action_plans ap
  LEFT JOIN tenant_controls tc
    ON tc.id = ap.tenant_control_id
   AND tc.tenant_id = ap.tenant_id
  WHERE ap.tenant_control_id IS NOT NULL
    AND tc.id IS NULL;

  IF invalid_action_plans > 0 THEN
    RAISE EXCEPTION 'DB-N01 action_plans.tenant_control_id invalid: %', invalid_action_plans;
  END IF;
END $$;

WITH finding_candidates AS (
  SELECT
    f.id AS finding_id,
    f.tenant_id,
    f.tenant_control_id AS current_control_id,
    direct.id AS direct_tenant_control_id,
    legacy.id AS legacy_control_id,
    legacy.catalog_control_id,
    tc.id AS candidate_tenant_control_id,
    d.selected_tenant_control_id AS manual_tenant_control_id,
    to_jsonb(d) AS manual_payload
  FROM findings f
  LEFT JOIN tenant_controls direct
    ON direct.tenant_id = f.tenant_id
   AND direct.id = f.tenant_control_id
  LEFT JOIN controls legacy
    ON legacy.id = f.tenant_control_id
   AND legacy.tenant_id = f.tenant_id
  LEFT JOIN tenant_controls tc
    ON direct.id IS NULL
   AND legacy.catalog_control_id IS NOT NULL
   AND tc.tenant_id = f.tenant_id
   AND tc.control_id = legacy.catalog_control_id
  LEFT JOIN dbn01_manual_decisions d
    ON d.table_name = 'findings'
   AND d.record_id = f.id
  WHERE f.tenant_control_id IS NOT NULL
), finding_resolution AS (
  SELECT
    finding_id,
    tenant_id,
    current_control_id,
    (array_agg(DISTINCT direct_tenant_control_id) FILTER (WHERE direct_tenant_control_id IS NOT NULL))[1] AS direct_tenant_control_id,
    (array_agg(DISTINCT legacy_control_id) FILTER (WHERE legacy_control_id IS NOT NULL))[1] AS legacy_control_id,
    (array_agg(DISTINCT catalog_control_id) FILTER (WHERE catalog_control_id IS NOT NULL))[1] AS catalog_control_id,
    count(candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL) AS candidate_count,
    (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1] AS sole_candidate,
    (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1] AS manual_tenant_control_id,
    (jsonb_agg(manual_payload) FILTER (WHERE manual_tenant_control_id IS NOT NULL))->0 AS manual_payload
  FROM finding_candidates
  GROUP BY finding_id, tenant_id, current_control_id
), finding_targets AS (
  SELECT
    finding_id,
    tenant_id,
    current_control_id,
    COALESCE(direct_tenant_control_id, manual_tenant_control_id, sole_candidate) AS new_tenant_control_id,
    legacy_control_id,
    catalog_control_id,
    CASE
      WHEN direct_tenant_control_id IS NOT NULL THEN 'already_canonical'
      WHEN manual_tenant_control_id IS NOT NULL THEN 'manual_decision'
      ELSE 'deterministic_catalog_singleton'
    END AS resolution_source,
    COALESCE(manual_payload, '{}'::jsonb) AS decision_payload
  FROM finding_resolution
)
INSERT INTO dbn01_control_identity_audit (
  migration_id,
  table_name,
  record_id,
  tenant_id,
  previous_tenant_control_id,
  new_tenant_control_id,
  legacy_control_id,
  catalog_control_id,
  resolution_source,
  decision_payload
)
SELECT
  '20260904_dbn01_control_identity_normalization',
  'findings',
  finding_id,
  tenant_id,
  current_control_id,
  new_tenant_control_id,
  legacy_control_id,
  catalog_control_id,
  resolution_source,
  decision_payload
FROM finding_targets
WHERE current_control_id IS DISTINCT FROM new_tenant_control_id
ON CONFLICT (migration_id, table_name, record_id) DO NOTHING;

WITH finding_candidates AS (
  SELECT
    f.id AS finding_id,
    f.tenant_control_id AS current_control_id,
    direct.id AS direct_tenant_control_id,
    tc.id AS candidate_tenant_control_id,
    d.selected_tenant_control_id AS manual_tenant_control_id
  FROM findings f
  LEFT JOIN tenant_controls direct
    ON direct.tenant_id = f.tenant_id
   AND direct.id = f.tenant_control_id
  LEFT JOIN controls legacy
    ON legacy.id = f.tenant_control_id
   AND legacy.tenant_id = f.tenant_id
  LEFT JOIN tenant_controls tc
    ON direct.id IS NULL
   AND legacy.catalog_control_id IS NOT NULL
   AND tc.tenant_id = f.tenant_id
   AND tc.control_id = legacy.catalog_control_id
  LEFT JOIN dbn01_manual_decisions d
    ON d.table_name = 'findings'
   AND d.record_id = f.id
  WHERE f.tenant_control_id IS NOT NULL
), finding_targets AS (
  SELECT
    finding_id,
    current_control_id,
    COALESCE(
      (array_agg(DISTINCT direct_tenant_control_id) FILTER (WHERE direct_tenant_control_id IS NOT NULL))[1],
      (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1],
      (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1]
    ) AS new_tenant_control_id
  FROM finding_candidates
  GROUP BY finding_id, current_control_id
)
UPDATE findings f
SET tenant_control_id = t.new_tenant_control_id,
    updated_at = COALESCE(f.updated_at, now())
FROM finding_targets t
WHERE f.id = t.finding_id
  AND f.tenant_control_id IS DISTINCT FROM t.new_tenant_control_id;

WITH evidence_candidates AS (
  SELECT
    e.id AS evidence_id,
    e.tenant_id,
    e.control_id,
    e.tenant_control_id,
    legacy.id AS legacy_control_id,
    COALESCE(catalog_direct.id, legacy.catalog_control_id) AS catalog_control_id,
    tc.id AS candidate_tenant_control_id,
    d.selected_tenant_control_id AS manual_tenant_control_id,
    to_jsonb(d) AS manual_payload
  FROM evidences e
  LEFT JOIN controls_catalog catalog_direct
    ON catalog_direct.id = e.control_id
  LEFT JOIN controls legacy
    ON legacy.id = e.control_id
   AND legacy.tenant_id = e.tenant_id
  LEFT JOIN tenant_controls tc
    ON e.tenant_control_id IS NULL
   AND tc.tenant_id = e.tenant_id
   AND tc.control_id = COALESCE(catalog_direct.id, legacy.catalog_control_id)
  LEFT JOIN dbn01_manual_decisions d
    ON d.table_name = 'evidences'
   AND d.record_id = e.id
  WHERE e.tenant_control_id IS NULL
    AND e.control_id IS NOT NULL
), evidence_resolution AS (
  SELECT
    evidence_id,
    tenant_id,
    control_id,
    (array_agg(DISTINCT legacy_control_id) FILTER (WHERE legacy_control_id IS NOT NULL))[1] AS legacy_control_id,
    (array_agg(DISTINCT catalog_control_id) FILTER (WHERE catalog_control_id IS NOT NULL))[1] AS catalog_control_id,
    (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1] AS sole_candidate,
    (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1] AS manual_tenant_control_id,
    (jsonb_agg(manual_payload) FILTER (WHERE manual_tenant_control_id IS NOT NULL))->0 AS manual_payload
  FROM evidence_candidates
  GROUP BY evidence_id, tenant_id, control_id
), evidence_targets AS (
  SELECT
    evidence_id,
    tenant_id,
    control_id,
    COALESCE(manual_tenant_control_id, sole_candidate) AS new_tenant_control_id,
    legacy_control_id,
    catalog_control_id,
    CASE
      WHEN manual_tenant_control_id IS NOT NULL THEN 'manual_decision'
      ELSE 'deterministic_catalog_singleton'
    END AS resolution_source,
    COALESCE(manual_payload, '{}'::jsonb) AS decision_payload
  FROM evidence_resolution
)
INSERT INTO dbn01_control_identity_audit (
  migration_id,
  table_name,
  record_id,
  tenant_id,
  previous_tenant_control_id,
  new_tenant_control_id,
  legacy_control_id,
  catalog_control_id,
  resolution_source,
  decision_payload
)
SELECT
  '20260904_dbn01_control_identity_normalization',
  'evidences',
  evidence_id,
  tenant_id,
  NULL,
  new_tenant_control_id,
  legacy_control_id,
  catalog_control_id,
  resolution_source,
  decision_payload
FROM evidence_targets
ON CONFLICT (migration_id, table_name, record_id) DO NOTHING;

WITH evidence_candidates AS (
  SELECT
    e.id AS evidence_id,
    tc.id AS candidate_tenant_control_id,
    d.selected_tenant_control_id AS manual_tenant_control_id
  FROM evidences e
  LEFT JOIN controls_catalog catalog_direct
    ON catalog_direct.id = e.control_id
  LEFT JOIN controls legacy
    ON legacy.id = e.control_id
   AND legacy.tenant_id = e.tenant_id
  LEFT JOIN tenant_controls tc
    ON e.tenant_control_id IS NULL
   AND tc.tenant_id = e.tenant_id
   AND tc.control_id = COALESCE(catalog_direct.id, legacy.catalog_control_id)
  LEFT JOIN dbn01_manual_decisions d
    ON d.table_name = 'evidences'
   AND d.record_id = e.id
  WHERE e.tenant_control_id IS NULL
    AND e.control_id IS NOT NULL
), evidence_targets AS (
  SELECT
    evidence_id,
    COALESCE(
      (array_agg(DISTINCT manual_tenant_control_id) FILTER (WHERE manual_tenant_control_id IS NOT NULL))[1],
      (array_agg(DISTINCT candidate_tenant_control_id) FILTER (WHERE candidate_tenant_control_id IS NOT NULL))[1]
    ) AS new_tenant_control_id
  FROM evidence_candidates
  GROUP BY evidence_id
)
UPDATE evidences e
SET tenant_control_id = t.new_tenant_control_id
FROM evidence_targets t
WHERE e.id = t.evidence_id
  AND e.tenant_control_id IS NULL;

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.findings'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.findings'::regclass AND attname = 'tenant_control_id')
      ]::smallint[]
      AND confrelid = 'public.controls'::regclass
  LOOP
    EXECUTE format('ALTER TABLE findings DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.findings'::regclass
      AND conname = 'fk_findings_tenant_control_canonical'
  ) THEN
    ALTER TABLE findings
      ADD CONSTRAINT fk_findings_tenant_control_canonical
      FOREIGN KEY (tenant_control_id)
      REFERENCES tenant_controls(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.evidences'::regclass
      AND conname = 'fk_evidences_tenant_control_canonical'
  ) THEN
    ALTER TABLE evidences
      ADD CONSTRAINT fk_evidences_tenant_control_canonical
      FOREIGN KEY (tenant_control_id)
      REFERENCES tenant_controls(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.action_plans'::regclass
      AND conname = 'fk_action_plans_tenant_control_canonical'
  ) THEN
    ALTER TABLE action_plans
      ADD CONSTRAINT fk_action_plans_tenant_control_canonical
      FOREIGN KEY (tenant_control_id)
      REFERENCES tenant_controls(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

ALTER TABLE findings VALIDATE CONSTRAINT fk_findings_tenant_control_canonical;
ALTER TABLE evidences VALIDATE CONSTRAINT fk_evidences_tenant_control_canonical;
ALTER TABLE action_plans VALIDATE CONSTRAINT fk_action_plans_tenant_control_canonical;

DO $$
DECLARE
  invalid_findings integer;
  invalid_evidences integer;
  invalid_action_plans integer;
BEGIN
  SELECT count(*) INTO invalid_findings
  FROM findings f
  LEFT JOIN tenant_controls tc
    ON tc.id = f.tenant_control_id
   AND tc.tenant_id = f.tenant_id
  WHERE f.tenant_control_id IS NOT NULL
    AND tc.id IS NULL;

  SELECT count(*) INTO invalid_evidences
  FROM evidences e
  LEFT JOIN tenant_controls tc
    ON tc.id = e.tenant_control_id
   AND tc.tenant_id = e.tenant_id
  WHERE e.tenant_control_id IS NOT NULL
    AND tc.id IS NULL;

  SELECT count(*) INTO invalid_action_plans
  FROM action_plans ap
  LEFT JOIN tenant_controls tc
    ON tc.id = ap.tenant_control_id
   AND tc.tenant_id = ap.tenant_id
  WHERE ap.tenant_control_id IS NOT NULL
    AND tc.id IS NULL;

  IF invalid_findings > 0 OR invalid_evidences > 0 OR invalid_action_plans > 0 THEN
    RAISE EXCEPTION 'DB-N01 tenant consistency failed: findings %, evidences %, action_plans %',
      invalid_findings, invalid_evidences, invalid_action_plans;
  END IF;
END $$;

COMMIT;
