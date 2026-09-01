-- NORMALIZATION-01
-- Forward-only authority normalization for commercial capabilities, AI add-on
-- effective rows and legacy plan-level AI.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM permissions WHERE permission_key = 'ai.view' AND is_active IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'NORMALIZATION-01 missing active canonical permission: ai.view';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM permissions WHERE permission_key = 'actions.view' AND is_active IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'NORMALIZATION-01 missing active canonical permission: actions.view';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM commercial_technical_capabilities WHERE capability_key = 'ai.compliance' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'NORMALIZATION-01 missing active capability: ai.compliance';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM commercial_technical_capabilities WHERE capability_key = 'iso.actions' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'NORMALIZATION-01 missing active capability: iso.actions';
  END IF;
END $$;

UPDATE commercial_technical_capabilities
SET required_permission = 'ai.view',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'normalization_01_permission', 'ai.view',
      'legacy_required_permission', CASE
        WHEN required_permission IS DISTINCT FROM 'ai.view' THEN required_permission
        ELSE COALESCE(metadata->>'legacy_required_permission', 'ai.view')
      END,
      'commercial_classification', 'AI_ADDON',
      'addon_key', 'ai'
    ),
    updated_at = now()
WHERE capability_key = 'ai.compliance'
  AND required_permission IS DISTINCT FROM 'ai.view';

UPDATE commercial_technical_capabilities
SET required_permission = 'actions.view',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'normalization_01_permission', 'actions.view',
      'legacy_required_permission', CASE
        WHEN required_permission IS DISTINCT FROM 'actions.view' THEN required_permission
        ELSE COALESCE(metadata->>'legacy_required_permission', 'actions.view')
      END
    ),
    updated_at = now()
WHERE capability_key = 'iso.actions'
  AND required_permission IS DISTINCT FROM 'actions.view';

WITH effective_ai_addons AS (
  SELECT
    tsa.id,
    row_number() OVER (
      PARTITION BY tsa.tenant_subscription_id, tsa.addon_key
      ORDER BY
        tsa.started_at ASC NULLS LAST,
        tsa.created_at ASC NULLS LAST,
        tsa.id ASC
    ) AS canonical_rank
  FROM tenant_subscription_addons tsa
  WHERE tsa.addon_key = 'ai'
    AND tsa.status = 'active'
    AND (tsa.ended_at IS NULL OR tsa.ended_at > now())
)
UPDATE tenant_subscription_addons tsa
SET status = 'cancelled',
    ended_at = COALESCE(tsa.ended_at, now()),
    updated_at = now()
FROM effective_ai_addons duplicate
WHERE tsa.id = duplicate.id
  AND duplicate.canonical_rank > 1;

INSERT INTO plan_version_addons (plan_version_id, addon_key, included)
SELECT cpv.id, 'ai', true
FROM commercial_plan_versions cpv
JOIN commercial_plans cp
  ON cp.id = cpv.plan_id
WHERE cpv.status = 'published'
  AND cp.status = 'active'
ON CONFLICT (plan_version_id, addon_key)
DO UPDATE SET included = true, updated_at = now();

UPDATE plan_version_modules pvm
SET included = false,
    updated_at = now()
FROM commercial_plan_versions cpv
WHERE cpv.id = pvm.plan_version_id
  AND cpv.status = 'published'
  AND pvm.module_key = 'ai_compliance'
  AND pvm.included = true;

DO $$
DECLARE
  orphan_count integer;
  duplicate_count integer;
  standard_ai_count integer;
BEGIN
  SELECT COUNT(*)::int
    INTO orphan_count
  FROM commercial_technical_capabilities ctc
  LEFT JOIN permissions p
    ON p.permission_key = ctc.required_permission
   AND p.is_active IS DISTINCT FROM FALSE
  WHERE ctc.status = 'active'
    AND ctc.required_permission IS NOT NULL
    AND p.permission_key IS NULL;

  IF orphan_count <> 0 THEN
    RAISE EXCEPTION 'NORMALIZATION-01 orphan required permission references: %', orphan_count;
  END IF;

  SELECT COUNT(*)::int
    INTO duplicate_count
  FROM (
    SELECT tsa.tenant_subscription_id, tsa.addon_key
    FROM tenant_subscription_addons tsa
    WHERE tsa.addon_key = 'ai'
      AND tsa.status = 'active'
      AND (tsa.ended_at IS NULL OR tsa.ended_at > now())
    GROUP BY tsa.tenant_subscription_id, tsa.addon_key
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count <> 0 THEN
    RAISE EXCEPTION 'NORMALIZATION-01 duplicate effective AI add-ons remain: %', duplicate_count;
  END IF;

  SELECT COUNT(*)::int
    INTO standard_ai_count
  FROM v_commercial_plan_capabilities
  WHERE plan_key IN ('pyme', 'empresa', 'enterprise')
    AND capability_key IN ('ai.compliance', 'ai.auditor');

  IF standard_ai_count <> 0 THEN
    RAISE EXCEPTION 'NORMALIZATION-01 standard plan AI capability count: %', standard_ai_count;
  END IF;
END $$;

COMMIT;
