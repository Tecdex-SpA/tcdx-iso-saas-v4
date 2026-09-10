-- DB-N05 - Minimum production reference/system seed v1.
--
-- This seed contains only global reference and system configuration data.
-- Tenant/customer fixtures are created by isolated tests and are not part of
-- the production seed.

BEGIN;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026090715) THEN
    RAISE EXCEPTION 'DB-N05 production seed lock unavailable';
  END IF;
END $$;

INSERT INTO app_roles (role_key, display_name, description, role_level, is_system, is_active)
VALUES
  ('platform_admin', 'Platform admin', 'Platform operations role.', 10, true, true),
  ('tenant_admin', 'Tenant admin', 'Tenant administration role.', 20, true, true),
  ('auditor', 'Auditor', 'Audit execution and review role.', 40, true, true),
  ('area_owner', 'Area owner', 'Operational owner role.', 60, true, true),
  ('executive', 'Executive', 'Executive read role.', 80, true, true),
  ('dealer', 'Dealer', 'Commercial partner role.', 90, true, true),
  ('viewer', 'Viewer', 'Read-only tenant user role.', 100, true, true)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  role_level = EXCLUDED.role_level,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO permissions (permission_key, permission_group, display_name, description, is_active)
VALUES
  ('dashboards.read', 'core', 'Read dashboards', 'Read dashboards.', true),
  ('controls.view', 'controls', 'Read controls', 'Read controls.', true),
  ('controls.manage', 'controls', 'Manage controls', 'Manage controls.', true),
  ('evidences.view', 'evidence', 'Read evidences', 'Read evidences.', true),
  ('evidences.upload', 'evidence', 'Upload evidences', 'Upload evidences.', true),
  ('findings.view', 'audit', 'Read findings', 'Read findings.', true),
  ('findings.manage', 'audit', 'Manage findings', 'Manage findings.', true),
  ('actions.view', 'actions', 'Read action plans', 'Read action plans.', true),
  ('actions.manage', 'actions', 'Manage action plans', 'Manage action plans.', true),
  ('assets.view', 'assets', 'Read assets', 'Read assets.', true),
  ('assets.manage', 'assets', 'Manage assets', 'Manage assets.', true),
  ('audits.view', 'audit', 'Read audits', 'Read audits.', true),
  ('audits.manage', 'audit', 'Manage audits', 'Manage audits.', true),
  ('standards.view', 'standards', 'Read standards', 'Read standards.', true),
  ('standards.manage', 'standards', 'Manage tenant standards', 'Manage tenant standards.', true),
  ('risk_matrix.view', 'risk', 'Read risks', 'Read risks.', true),
  ('risk_matrix.manage', 'risk', 'Manage risks', 'Manage risks.', true),
  ('workflow.read', 'workflow', 'Read workflows', 'Read workflows.', true),
  ('workflow.transition', 'workflow', 'Transition workflows', 'Transition workflows.', true),
  ('workflow.manage', 'workflow', 'Manage workflows', 'Manage workflows.', true),
  ('health.view', 'metrics', 'Read health', 'Read health.', true),
  ('metrics.read', 'metrics', 'Read metrics', 'Read metrics.', true),
  ('metrics.catalog.read', 'metrics', 'Read metric catalog', 'Read metric catalog.', true),
  ('metrics.engine', 'metrics', 'Run metric engine', 'Run governed metric engine.', true),
  ('metrics.data_trust', 'metrics', 'Read metric trust', 'Read metric trust assessments.', true),
  ('metrics.indicators.read', 'metrics', 'Read functional indicators', 'Read functional indicators.', true),
  ('reports.read', 'reports', 'Read reports', 'Read reports.', true),
  ('reports.download', 'reports', 'Download reports', 'Download reports.', true),
  ('modules.view', 'commercial', 'Read modules', 'Read modules.', true),
  ('commercial.entitlement.read', 'commercial', 'Read commercial entitlements', 'Read commercial entitlements.', true),
  ('data.semantic_layer', 'data', 'Manage semantic layer', 'Manage semantic source contracts.', true),
  ('data.lineage', 'data', 'Read data lineage', 'Read data lineage.', true),
  ('knowledge.read', 'knowledge', 'Read knowledge base', 'Read governed knowledge base.', true),
  ('knowledge.ingest', 'knowledge', 'Ingest knowledge documents', 'Ingest knowledge documents.', true),
  ('regulatory.read', 'regulatory', 'Read regulatory metadata', 'Read regulatory metadata.', true),
  ('regulatory.manage', 'regulatory', 'Manage regulatory packs', 'Manage regulatory packs.', true),
  ('grc.connectors.manage', 'grc', 'Manage GRC connectors', 'Manage GRC connector instances.', true),
  ('grc.escalations.manage', 'grc', 'Manage GRC escalations', 'Manage GRC escalations.', true),
  ('grc.gaps.manage', 'grc', 'Manage GRC gaps', 'Manage GRC gap lifecycle.', true),
  ('ai.view', 'ai', 'Read AI experiences', 'Read AI experiences.', true)
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, true
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key = 'platform_admin'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'tenant_admin', permission_key, true
FROM permissions
WHERE permission_key <> 'commercial.entitlement.read'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'executive', permission_key, true
FROM permissions
WHERE permission_key IN (
  'dashboards.read','controls.view','evidences.view','findings.view','actions.view',
  'assets.view','audits.view','standards.view','risk_matrix.view','workflow.read',
  'health.view','metrics.read','reports.read','reports.download','modules.view','ai.view'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'area_owner', permission_key, true
FROM permissions
WHERE permission_key IN (
  'controls.view','evidences.view','evidences.upload','findings.view','findings.manage',
  'actions.view','actions.manage','assets.view','risk_matrix.view','workflow.read',
  'workflow.transition','health.view','reports.read'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'auditor', permission_key, true
FROM permissions
WHERE permission_key IN (
  'controls.view','evidences.view','findings.view','findings.manage',
  'audits.view','audits.manage','standards.view','workflow.read',
  'workflow.transition','health.view','reports.read','reports.download'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'viewer', permission_key, true
FROM permissions
WHERE permission_key IN (
  'dashboards.read','controls.view','evidences.view','findings.view',
  'actions.view','audits.view','standards.view','health.view','metrics.read','reports.read'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = EXCLUDED.is_allowed, updated_at = now();

INSERT INTO saas_modules (
  module_key,
  display_name,
  description,
  default_enabled,
  is_system,
  is_active,
  sort_order,
  status
)
VALUES
  (
    'grc_phase1_core',
    'GRC Phase 1 Core',
    'Workflows, evidence requests, readiness, frameworks and audit runtime.',
    false,
    true,
    true,
    45,
    'active'
  ),
  (
    'grc_phase2_integrated',
    'GRC Phase 2 Integrated',
    'Privacy, incidents, suppliers, connectors and integrated GRC runtime.',
    false,
    true,
    true,
    46,
    'active'
  ),
  (
    'grc_phase3_operations',
    'GRC Phase 3 Operations',
    'Operational units, processes, services, BIA, continuity, KPI/KRI and quantitative risk runtime.',
    false,
    true,
    true,
    47,
    'active'
  )
ON CONFLICT (module_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_enabled = false,
  is_system = true,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  status = 'active',
  updated_at = now();

-- Tenant module settings remain tenant-owned and are not seeded here.

INSERT INTO commercial_plans (plan_key, display_name, is_active)
VALUES
  ('pyme', 'ISO', true),
  ('empresa', 'ISO + Operational Risk', true),
  ('enterprise', 'GRC', true)
ON CONFLICT (plan_key) DO UPDATE SET display_name = EXCLUDED.display_name, is_active = EXCLUDED.is_active;

INSERT INTO commercial_plan_versions (plan_key, version, status, published_at)
VALUES
  ('pyme', 'v1', 'published', now()),
  ('empresa', 'v1', 'published', now()),
  ('enterprise', 'v1', 'published', now())
ON CONFLICT (plan_key, version) DO UPDATE SET status = EXCLUDED.status, published_at = COALESCE(commercial_plan_versions.published_at, EXCLUDED.published_at);

INSERT INTO commercial_addons (addon_key, display_name, description, status, metadata)
VALUES (
  'ai',
  'AI',
  'Commercial add-on for tenant-scoped AI capabilities.',
  'active',
  '{"classification":"AI_ADDON","commercial_model":"base_plan_plus_addon","authority":"tenant_subscription_addons"}'::jsonb
)
ON CONFLICT (addon_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = commercial_addons.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO standards (standard_code, family, display_name, version_label, is_active, metadata)
VALUES
  ('ISO_27001_2022', 'ISO_27001', 'ISO/IEC 27001', '2022', true, '{"source":"reference_seed"}'::jsonb)
ON CONFLICT (standard_code) DO UPDATE SET
  family = EXCLUDED.family,
  display_name = EXCLUDED.display_name,
  version_label = EXCLUDED.version_label,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata;

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

-- The former three-control subset is TEST_FIXTURE_ONLY and is not inserted here.
-- Production controls and mappings are loaded by load-production-reference-catalogs.js.

-- F5_5_GRC_HEALTH and all formula/source contracts come from the official runtime
-- registry through load-production-reference-catalogs.js; no parallel formula seed.

INSERT INTO usage_limit_definitions (resource_key, display_name, description, default_limit, unit, period, warning_threshold, enforcement)
VALUES
  ('active_users', 'Usuarios activos', 'Usuarios activos del tenant.', 25, 'count', 'month', 0.8, 'block'),
  ('active_standards', 'Normas activas', 'Normas activas contratadas.', 3, 'count', 'month', 0.8, 'block'),
  ('premium_modules', 'Módulos premium', 'Módulos premium habilitados.', 6, 'count', 'month', 0.8, 'block'),
  ('evidence_files', 'Archivos de evidencia', 'Cantidad de archivos de evidencia.', 5000, 'count', 'month', 0.8, 'warn'),
  ('storage_bytes', 'Almacenamiento', 'Bytes almacenados.', 10737418240, 'bytes', 'month', 0.8, 'warn'),
  ('imports_monthly', 'Importaciones mensuales', 'Lotes de importación por mes.', 25, 'count', 'month', 0.8, 'block'),
  ('exports_monthly', 'Exportaciones mensuales', 'Exportaciones por mes.', 50, 'count', 'month', 0.8, 'block'),
  ('api_calls_monthly', 'Llamadas API mensuales', 'Llamadas API medidas.', 25000, 'count', 'month', 0.8, 'warn'),
  ('semantic_contracts', 'Contratos semánticos', 'Contratos semánticos tenant activos.', 100, 'count', 'lifetime', 0.8, 'block'),
  ('semantic_mappings', 'Mappings semánticos', 'Mappings tipados tenant activos.', 1000, 'count', 'lifetime', 0.8, 'block'),
  ('semantic_observations_monthly', 'Observaciones semánticas', 'Observaciones canónicas ingeridas por mes.', 100000, 'count', 'month', 0.8, 'block'),
  ('indicators_active', 'Indicadores activos', 'Máximo de indicadores tenant publicados.', 250, 'count', 'lifetime', 0.8, 'block'),
  ('indicator_versions_active', 'Versiones de indicadores', 'Versiones metodológicas creadas por tenant.', 1000, 'count', 'lifetime', 0.8, 'block'),
  ('indicator_snapshots_monthly', 'Snapshots mensuales', 'Snapshots oficiales creados por mes.', 5000, 'count', 'month', 0.8, 'block'),
  ('indicator_snapshots_retained', 'Snapshots retenidos', 'Snapshots oficiales retenidos.', 50000, 'count', 'lifetime', 0.8, 'block'),
  ('indicator_jobs_concurrent', 'Jobs concurrentes', 'Jobs 5-C3 simultáneos por tenant.', 4, 'count', 'lifetime', 0.75, 'block'),
  ('indicator_comparisons_monthly', 'Comparaciones mensuales', 'Comparaciones históricas creadas por mes.', 10000, 'count', 'month', 0.8, 'block'),
  ('indicator_exports_monthly', 'Exportaciones de indicadores', 'Exportaciones oficiales por mes.', 250, 'count', 'month', 0.8, 'block')
ON CONFLICT (resource_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  default_limit = EXCLUDED.default_limit,
  unit = EXCLUDED.unit,
  period = EXCLUDED.period,
  warning_threshold = EXCLUDED.warning_threshold,
  enforcement = EXCLUDED.enforcement,
  status = 'active',
  updated_at = now();

INSERT INTO metric_job_policies (job_type, timeout_ms, max_attempts, retry_backoff_seconds, checksum)
VALUES
  ('metric.calculate', 30000, 3, 30, encode(digest('metric.calculate:30000:3:30', 'sha256'), 'hex')),
  ('metric.snapshot', 30000, 3, 30, encode(digest('metric.snapshot:30000:3:30', 'sha256'), 'hex')),
  ('metric.compare', 30000, 3, 30, encode(digest('metric.compare:30000:3:30', 'sha256'), 'hex')),
  ('metric.freshness', 30000, 3, 60, encode(digest('metric.freshness:30000:3:60', 'sha256'), 'hex')),
  ('metric.alert', 30000, 3, 60, encode(digest('metric.alert:30000:3:60', 'sha256'), 'hex')),
  ('metric.reconcile', 60000, 3, 120, encode(digest('metric.reconcile:60000:3:120', 'sha256'), 'hex')),
  ('metric.retention', 60000, 3, 120, encode(digest('metric.retention:60000:3:120', 'sha256'), 'hex'))
ON CONFLICT (job_type) DO UPDATE SET
  timeout_ms = EXCLUDED.timeout_ms,
  max_attempts = EXCLUDED.max_attempts,
  retry_backoff_seconds = EXCLUDED.retry_backoff_seconds,
  checksum = EXCLUDED.checksum,
  status = 'active',
  updated_at = now();

INSERT INTO grc_workflow_definitions (workflow_key, display_name, is_active)
VALUES
  ('finding_remediation', 'Finding remediation', true),
  ('evidence_review', 'Evidence review', true)
ON CONFLICT (workflow_key) DO UPDATE SET display_name = EXCLUDED.display_name, is_active = EXCLUDED.is_active;

INSERT INTO grc_workflow_versions (workflow_definition_id, version, status, definition)
SELECT id, 1, 'published', '{"states":["created","in_progress","review","closed"]}'::jsonb
FROM grc_workflow_definitions
WHERE workflow_key = 'finding_remediation'
ON CONFLICT (workflow_definition_id, version) DO UPDATE SET status = EXCLUDED.status, definition = EXCLUDED.definition;

INSERT INTO grc_workflow_versions (workflow_definition_id, version, status, definition)
SELECT id, 1, 'published', '{"states":["created","submitted","approved","rejected"]}'::jsonb
FROM grc_workflow_definitions
WHERE workflow_key = 'evidence_review'
ON CONFLICT (workflow_definition_id, version) DO UPDATE SET status = EXCLUDED.status, definition = EXCLUDED.definition;

COMMIT;
