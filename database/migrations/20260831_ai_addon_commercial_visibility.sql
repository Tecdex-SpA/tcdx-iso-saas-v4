-- AI-ADDON-01 + COMMERCIAL-UI-01
-- Forward-only, idempotent normalization:
-- base plans remain non-AI; commercial_addons.ai is the only AI entitlement.

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
    'ai_feature_flags_authority', 'tenant_configuration_subordinate_to_subscription_addon'
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
    required_permission = EXCLUDED.required_permission,
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
  AND pvm.included = true;

WITH eligible_legacy_ai_tenants AS (
  SELECT DISTINCT ON (vts.tenant_id)
    vts.id AS tenant_subscription_id
  FROM v_commercial_tenant_subscription vts
  JOIN tenants t
    ON t.id = vts.tenant_id
  WHERE vts.status IN ('active','trialing','past_due')
    AND COALESCE(t.ai_enabled, false) = true
    AND COALESCE(NULLIF(t.ai_plan, ''), 'none') <> 'none'
    AND NOT EXISTS (
      SELECT 1
      FROM tenant_subscription_addons existing
      WHERE existing.tenant_subscription_id = vts.id
        AND existing.addon_key = 'ai'
    )
  ORDER BY vts.tenant_id, vts.started_at DESC, vts.created_at DESC
)
INSERT INTO tenant_subscription_addons (tenant_subscription_id, addon_key, status, started_at)
SELECT tenant_subscription_id, 'ai', 'active', now()
FROM eligible_legacy_ai_tenants;

CREATE OR REPLACE VIEW v_commercial_tenant_modules AS
SELECT DISTINCT
  vts.tenant_id,
  vts.plan_key,
  cm.module_key,
  cm.display_name,
  cm.description,
  cm.sort_order,
  true AS enabled,
  'plan'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN plan_version_modules pvm ON pvm.plan_version_id = vts.plan_version_id AND pvm.included = true
JOIN commercial_modules cm ON cm.module_key = pvm.module_key AND cm.status = 'active'
UNION
SELECT DISTINCT
  vts.tenant_id,
  vts.plan_key,
  cm.module_key,
  cm.display_name,
  cm.description,
  cm.sort_order,
  true AS enabled,
  'addon'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON tsa.tenant_subscription_id = vts.id
 AND tsa.status = 'active'
 AND (tsa.ended_at IS NULL OR tsa.ended_at > now())
JOIN plan_version_addons pva
  ON pva.plan_version_id = vts.plan_version_id
 AND pva.addon_key = tsa.addon_key
 AND pva.included = true
JOIN commercial_addons ca
  ON ca.addon_key = tsa.addon_key
 AND ca.status = 'active'
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ca.metadata->'capability_keys', '[]'::jsonb)) addon_capability(capability_key)
JOIN feature_capabilities fc
  ON fc.capability_key = addon_capability.capability_key
JOIN module_features mf
  ON mf.feature_key = fc.feature_key
JOIN commercial_modules cm
  ON cm.module_key = mf.module_key
 AND cm.status = 'active';

CREATE OR REPLACE VIEW v_commercial_tenant_capabilities AS
SELECT DISTINCT
  vts.tenant_id,
  pc.capability_key,
  pc.required_permission,
  pc.dependencies,
  true AS enabled,
  false AS read_only,
  'plan'::text AS source,
  vts.started_at AS effective_from,
  vts.ended_at AS effective_until,
  pc.module_key
FROM v_commercial_tenant_subscription vts
JOIN v_commercial_plan_capabilities pc ON pc.plan_version_id = vts.plan_version_id
UNION
SELECT DISTINCT
  vts.tenant_id,
  ctc.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  true AS enabled,
  false AS read_only,
  'addon'::text AS source,
  tsa.started_at AS effective_from,
  tsa.ended_at AS effective_until,
  mf.module_key
FROM v_commercial_tenant_subscription vts
JOIN tenant_subscription_addons tsa
  ON tsa.tenant_subscription_id = vts.id
 AND tsa.status = 'active'
 AND (tsa.ended_at IS NULL OR tsa.ended_at > now())
JOIN plan_version_addons pva
  ON pva.plan_version_id = vts.plan_version_id
 AND pva.addon_key = tsa.addon_key
 AND pva.included = true
JOIN commercial_addons ca
  ON ca.addon_key = tsa.addon_key
 AND ca.status = 'active'
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ca.metadata->'capability_keys', '[]'::jsonb)) addon_capability(capability_key)
JOIN commercial_technical_capabilities ctc
  ON ctc.capability_key = addon_capability.capability_key
 AND ctc.status = 'active'
JOIN feature_capabilities fc
  ON fc.capability_key = ctc.capability_key
JOIN module_features mf
  ON mf.feature_key = fc.feature_key
UNION
SELECT
  tso.tenant_id,
  tso.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  tso.enabled,
  tso.read_only,
  'override'::text,
  tso.valid_from,
  tso.valid_until,
  NULL::text AS module_key
FROM tenant_feature_overrides tso
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = tso.capability_key
WHERE tso.status = 'active' AND (tso.valid_until IS NULL OR tso.valid_until > now())
UNION
SELECT
  tr.tenant_id,
  tr.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  true,
  false,
  'trial'::text,
  tr.starts_at,
  tr.ends_at,
  NULL::text AS module_key
FROM trials tr
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = tr.capability_key
WHERE tr.status = 'active' AND tr.ends_at > now();

COMMIT;
