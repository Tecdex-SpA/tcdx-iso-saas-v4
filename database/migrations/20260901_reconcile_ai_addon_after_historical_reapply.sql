-- Repair forward-only after a historical Commercial Plan Matrix reapply.
-- Restores AI Add-on commercial invariants without rewriting historical ledgers.

BEGIN;

INSERT INTO commercial_addons (addon_key, display_name, description, status, metadata)
VALUES (
  'ai',
  'IA',
  'Add-on comercial transversal para IA Compliance, Auditor IA y configuracion IA tenant-scoped.',
  'active',
  jsonb_build_object(
    'canonical_key', 'ai',
    'capability_keys', jsonb_build_array('ai.compliance', 'ai.auditor'),
    'commercial_model', 'base_plan_plus_addon',
    'ai_feature_flags_authority', 'tenant_configuration_subordinate_to_subscription_addon',
    'reconciled_by', '20260901_reconcile_ai_addon_after_historical_reapply'
  )
)
ON CONFLICT (addon_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'active',
    metadata = COALESCE(commercial_addons.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO commercial_modules (module_key, display_name, description, status, sort_order, metadata)
VALUES (
  'ai_compliance',
  'IA',
  'IA Compliance e IA Auditor bajo add-on comercial transversal.',
  'active',
  180,
  jsonb_build_object('commercial_classification', 'AI_ADDON', 'addon_key', 'ai')
)
ON CONFLICT (module_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'active',
    sort_order = EXCLUDED.sort_order,
    metadata = COALESCE(commercial_modules.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO commercial_features (feature_key, display_name, description, status, metadata)
VALUES
  ('ai_compliance_core','IA Compliance','Analisis asistido de cumplimiento bajo add-on IA.','active',jsonb_build_object('commercial_classification','AI_ADDON','addon_key','ai')),
  ('ai_auditor_core','IA Auditor','Auditoria asistida bajo add-on IA, permiso audit.review y validacion humana.','active',jsonb_build_object('commercial_classification','AI_ADDON','addon_key','ai'))
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'active',
    metadata = COALESCE(commercial_features.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO commercial_technical_capabilities (capability_key, display_name, description, required_permission, status, metadata)
VALUES
  ('ai.compliance','IA Compliance','Analisis asistido de cumplimiento bajo add-on IA.','ai_compliance.read','active',jsonb_build_object('commercial_classification','AI_ADDON','addon_key','ai')),
  ('ai.auditor','IA Auditor','Auditoria asistida bajo add-on IA, permiso audit.review y validacion humana.','audit.review','active',jsonb_build_object('commercial_classification','AI_ADDON','addon_key','ai'))
ON CONFLICT (capability_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    required_permission = CASE
      WHEN commercial_technical_capabilities.capability_key = 'ai.compliance'
       AND commercial_technical_capabilities.required_permission = 'ai.view'
        THEN commercial_technical_capabilities.required_permission
      ELSE EXCLUDED.required_permission
    END,
    status = 'active',
    metadata = COALESCE(commercial_technical_capabilities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

INSERT INTO module_features (module_key, feature_key)
VALUES
  ('ai_compliance','ai_compliance_core'),
  ('ai_compliance','ai_auditor_core')
ON CONFLICT (module_key, feature_key) DO NOTHING;

INSERT INTO feature_capabilities (feature_key, capability_key)
VALUES
  ('ai_compliance_core','ai.compliance'),
  ('ai_auditor_core','ai.auditor')
ON CONFLICT (feature_key, capability_key) DO NOTHING;

WITH published_standard_versions AS (
  SELECT id
  FROM commercial_plan_versions
  WHERE status = 'published'
    AND plan_key IN ('pyme', 'empresa', 'enterprise')
)
INSERT INTO plan_version_addons (plan_version_id, addon_key, included)
SELECT id, 'ai', true
FROM published_standard_versions
ON CONFLICT (plan_version_id, addon_key)
DO UPDATE SET included = true, updated_at = now();

WITH published_standard_versions AS (
  SELECT id
  FROM commercial_plan_versions
  WHERE status = 'published'
    AND plan_key IN ('pyme', 'empresa', 'enterprise')
)
UPDATE plan_version_modules pvm
SET included = false,
    updated_at = now()
FROM published_standard_versions psv
WHERE pvm.plan_version_id = psv.id
  AND pvm.module_key = 'ai_compliance'
  AND pvm.included IS DISTINCT FROM false;

DO $$
DECLARE
  ai_addon_ready boolean;
  ai_capabilities_ready integer;
  base_plan_ai_capabilities integer;
  compatible_standard_plan_versions integer;
  standard_plan_versions integer;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM commercial_addons
    WHERE addon_key = 'ai'
      AND status = 'active'
      AND metadata->>'canonical_key' = 'ai'
  )
  INTO ai_addon_ready;

  SELECT COUNT(*)::int
  FROM commercial_technical_capabilities
  WHERE capability_key IN ('ai.compliance', 'ai.auditor')
    AND status = 'active'
    AND metadata->>'commercial_classification' = 'AI_ADDON'
    AND metadata->>'addon_key' = 'ai'
  INTO ai_capabilities_ready;

  SELECT COUNT(*)::int
  FROM v_commercial_plan_capabilities
  WHERE plan_key IN ('pyme', 'empresa', 'enterprise')
    AND capability_key IN ('ai.compliance', 'ai.auditor')
  INTO base_plan_ai_capabilities;

  WITH standard_versions AS (
    SELECT id
    FROM commercial_plan_versions
    WHERE status = 'published'
      AND plan_key IN ('pyme', 'empresa', 'enterprise')
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE pva.addon_key = 'ai' AND pva.included = true)::int
  FROM standard_versions sv
  LEFT JOIN plan_version_addons pva
    ON pva.plan_version_id = sv.id
   AND pva.addon_key = 'ai'
  INTO standard_plan_versions, compatible_standard_plan_versions;

  IF ai_addon_ready IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'AI add-on reconciliation failed: AI_ADDON_READY=false';
  END IF;
  IF ai_capabilities_ready <> 2 THEN
    RAISE EXCEPTION 'AI add-on reconciliation failed: AI_CAPABILITIES_READY=%', ai_capabilities_ready;
  END IF;
  IF base_plan_ai_capabilities <> 0 THEN
    RAISE EXCEPTION 'AI add-on reconciliation failed: BASE_PLAN_AI_CAPABILITIES=%', base_plan_ai_capabilities;
  END IF;
  IF compatible_standard_plan_versions <> standard_plan_versions THEN
    RAISE EXCEPTION 'AI add-on reconciliation failed: COMPATIBLE_STANDARD_PLAN_VERSIONS=%/%', compatible_standard_plan_versions, standard_plan_versions;
  END IF;
END $$;

COMMIT;
