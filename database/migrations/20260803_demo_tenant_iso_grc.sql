-- TCDX ISO SaaS v4 - Demo Tecdex ISO 9001 + ISO/IEC 27001 + GRC operativo.
-- Datos demostrativos sintéticos, tenant-scoped, idempotentes y separados del deploy general.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION pg_temp.demo_uuid(p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5('demo-tecdex:' || p_key), 1, 8) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 9, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 13, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 17, 4) || '-' ||
    substr(md5('demo-tecdex:' || p_key), 21, 12)
  )::uuid;
$$;

CREATE TEMP TABLE demo_seed_context (
  tenant_id uuid PRIMARY KEY,
  admin_id uuid NOT NULL,
  auditor_id uuid NOT NULL,
  password_hash text NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_seed_context (tenant_id, admin_id, auditor_id, password_hash)
VALUES (
  pg_temp.demo_uuid('tenant'),
  pg_temp.demo_uuid('user-admin'),
  pg_temp.demo_uuid('user-auditor'),
  '$2b$10$HJZxiDgdPJn2mXd0qlsHsugrhvPMU3f34a/1IIrH15aRqwpbygYJm'
);

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(name)
    INTO missing
  FROM (
    VALUES
      ('tenants'),('users'),('standards'),('tenant_standards'),('tenant_operations'),
      ('tenant_controls'),('controls_catalog'),('evidences'),('audits'),('findings'),
      ('action_plans'),('assets'),('asset_risks'),('commercial_technical_capabilities'),
      ('commercial_plan_versions'),('tenant_subscriptions'),('tenant_feature_overrides'),
      ('tenant_usage_limits'),('permissions'),('role_permissions'),('data_domains'),
      ('data_sources'),('data_elements'),('metric_definitions'),('metric_formula_versions'),
      ('metric_measurements'),('metric_snapshots'),('data_snapshots'),('data_lineage_edges'),
      ('data_source_contracts'),('data_source_contract_versions'),('data_source_field_mappings'),
      ('grc_observations'),('grc_observation_relations'),('dashboard_definitions'),
      ('dashboard_widgets'),('report_definitions'),('report_generations'),('survey_definitions'),
      ('assurance_test_definitions'),('loss_events')
  ) AS required(name)
  WHERE to_regclass('public.' || required.name) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Demo Tecdex preflight failed. Missing required tables: %', array_to_string(missing, ', ');
  END IF;
END $$;

INSERT INTO tenants (
  id, name, rut, address, business, branches, service_status,
  ai_enabled, ai_plan, ai_web_enabled, ai_report_enabled, ai_auditor_enabled,
  ai_monthly_quota, ai_quota_used, ai_features_json, created_at
)
SELECT
  tenant_id,
  'Demo Tecdex',
  'DEMO-TECDX-ISO-GRC',
  'Av. Apoquindo 0000, Las Condes, Santiago, Chile',
  'Servicios tecnologicos B2B, procesamiento de informacion, infraestructura cloud e hibrida',
  'Direccion; Operaciones; Tecnologia; Seguridad de la Informacion; Calidad; Comercial; Finanzas; Personas; Continuidad',
  'active',
  true,
  'demo_enterprise',
  false,
  true,
  true,
  5000,
  0,
  '{"auditor":true,"suggestions":true,"web_research":false,"report_enrichment":true,"document_generation":true,"company_profile_context":true}'::jsonb,
  now()
FROM demo_seed_context
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rut = EXCLUDED.rut,
  address = EXCLUDED.address,
  business = EXCLUDED.business,
  branches = EXCLUDED.branches,
  service_status = 'active',
  ai_enabled = true,
  ai_plan = 'demo_enterprise',
  ai_report_enabled = true,
  ai_auditor_enabled = true,
  ai_monthly_quota = 5000,
  ai_quota_used = 0,
  ai_features_json = EXCLUDED.ai_features_json,
  deleted_at = NULL,
  suspended_at = NULL;

INSERT INTO users (id, tenant_id, name, full_name, email, password_hash, role, job_title, created_at)
SELECT admin_id, tenant_id, 'Administrador Demo Tecdex', 'Administrador Demo Tecdex', 'admin.demo@tcdx.demo', password_hash, 'admin', 'Administrador GRC Integrado', now()
FROM demo_seed_context
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  job_title = EXCLUDED.job_title;

INSERT INTO users (id, tenant_id, name, full_name, email, password_hash, role, job_title, created_at)
SELECT auditor_id, tenant_id, 'Auditor Demo Tecdex', 'Auditor Demo Tecdex', 'auditor.demo@tcdx.demo', password_hash, 'auditor', 'Auditor Interno Integrado', now()
FROM demo_seed_context
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  job_title = EXCLUDED.job_title;

INSERT INTO roles (name)
SELECT role_name
FROM (VALUES ('admin'), ('auditor')) AS r(role_name)
WHERE to_regclass('public.roles') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM roles existing WHERE existing.name = r.role_name);

INSERT INTO user_roles (user_id, role_id)
SELECT c.admin_id, r.id
FROM demo_seed_context c
JOIN roles r ON r.name = 'admin'
WHERE to_regclass('public.user_roles') IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT c.auditor_id, r.id
FROM demo_seed_context c
JOIN roles r ON r.name = 'auditor'
WHERE to_regclass('public.user_roles') IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO app_roles (role_key, display_name, description, role_level, is_system, is_active)
VALUES
  ('admin', 'Administrador tenant', 'Administra tenant, GRC, datos, metricas y reportes.', 80, true, true),
  ('auditor', 'Auditor tenant', 'Ejecuta auditorias, revisa evidencias y consulta lineage.', 60, true, true)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('tenant.manage','tenant','Administrar tenant','Administra configuracion tenant.'),
  ('framework.manage','grc','Administrar normas','Gestiona normas y controles.'),
  ('risk.manage','grc','Administrar riesgos','Gestiona riesgos y tratamientos.'),
  ('control.manage','grc','Administrar controles','Gestiona controles y pruebas.'),
  ('evidence.review','grc','Revisar evidencias','Revisa y valida evidencias.'),
  ('audit.execute','grc','Ejecutar auditorias','Ejecuta auditorias y hallazgos.'),
  ('action.manage','grc','Administrar acciones','Gestiona planes de accion.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'admin', p.permission_key, true
FROM permissions p
WHERE p.permission_key IN (
  'tenant.manage','framework.manage','risk.manage','control.manage','evidence.review','audit.execute','action.manage',
  'commercial.subscription.read','commercial.entitlement.read','commercial.usage.read','commercial.health.read',
  'data.catalog.read','data.catalog.manage','data.quality.read','data.quality.manage','data.lineage.read','data.lineage.manage',
  'metrics.read','metrics.manage','metrics.publish','metrics.measure','metrics.validate','metrics.recalculate',
  'surveys.read','surveys.manage','surveys.publish','surveys.respond','surveys.evaluate','surveys.approve',
  'assurance_tests.read','assurance_tests.manage','assurance_tests.execute','assurance_tests.review',
  'loss_events.read','loss_events.manage','loss_events.approve',
  'dashboards.read','dashboards.manage','dashboards.publish',
  'reports.read','reports.manage','reports.generate','reports.schedule','reports.approve','reports.download',
  'semantic.contracts.read','semantic.contracts.manage','semantic.contracts.review','semantic.contracts.publish',
  'semantic.mappings.read','semantic.mappings.manage','semantic.mappings.validate',
  'semantic.observations.read','semantic.observations.ingest','semantic.lineage.read',
  'semantic.sufficiency.read','semantic.sufficiency.manage','semantic.sufficiency.publish'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'auditor', p.permission_key, true
FROM permissions p
WHERE p.permission_key IN (
  'framework.manage','evidence.review','audit.execute',
  'data.catalog.read','data.quality.read','data.lineage.read',
  'metrics.read','surveys.read','surveys.respond',
  'assurance_tests.read','assurance_tests.execute','loss_events.read',
  'dashboards.read','reports.read','reports.generate','reports.download',
  'semantic.contracts.read','semantic.mappings.read','semantic.observations.read',
  'semantic.lineage.read','semantic.sufficiency.read'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

INSERT INTO standards (code, name)
SELECT s.code, s.name
FROM (VALUES ('ISO9001','ISO 9001:2015'), ('ISO27001','ISO/IEC 27001:2022')) AS s(code, name)
WHERE NOT EXISTS (SELECT 1 FROM standards existing WHERE existing.code = s.code);

INSERT INTO tenant_standards (id, tenant_id, standard_code, is_active, initialized_at, catalog_mode, contracted_at, lifecycle_status)
SELECT pg_temp.demo_uuid('tenant-standard-' || s.code), c.tenant_id, s.code, true, now(), 'demo_integrated', now(), 'active'
FROM demo_seed_context c
CROSS JOIN (VALUES ('ISO9001'), ('ISO27001')) s(code)
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  updated_at = now(),
  lifecycle_status = 'active',
  deactivated_at = NULL,
  paused_at = NULL,
  permanently_deactivated_at = NULL;

INSERT INTO tenant_company_profiles (
  id, tenant_id, created_by_user_id, updated_by_user_id, profile_json, industry, subindustry,
  company_size, maturity_level, risk_appetite, allow_web_research, allow_document_context,
  allow_ai_recommendations, ai_profile_summary_json
)
SELECT
  pg_temp.demo_uuid('company-profile'),
  tenant_id,
  admin_id,
  admin_id,
  jsonb_build_object(
    'slug','demo-tecdex',
    'legal_name','demo.tecdex',
    'domain','demo.tecdex',
    'country','Chile',
    'timezone','America/Santiago',
    'language','es',
    'currency','CLP',
    'employees',120,
    'management_systems',jsonb_build_array('ISO 9001:2015','ISO/IEC 27001:2022'),
    'narrative','Empresa chilena B2B de servicios tecnologicos y procesamiento de informacion con infraestructura cloud e hibrida.'
  ),
  'Servicios tecnologicos',
  'SaaS B2B y procesamiento de informacion',
  '120 trabajadores',
  'integrado',
  'moderado',
  false,
  true,
  true,
  '{"summary":"Demo Tecdex opera un SGSI y SGC integrados, con riesgos, controles, evidencias, auditorias, metricas y capa semantica demostrativos."}'::jsonb
FROM demo_seed_context
ON CONFLICT (tenant_id) DO UPDATE SET
  updated_by_user_id = EXCLUDED.updated_by_user_id,
  profile_json = EXCLUDED.profile_json,
  industry = EXCLUDED.industry,
  subindustry = EXCLUDED.subindustry,
  company_size = EXCLUDED.company_size,
  maturity_level = EXCLUDED.maturity_level,
  risk_appetite = EXCLUDED.risk_appetite,
  updated_at = now();

WITH enterprise_version AS (
  SELECT cpv.id, cpv.plan_key
  FROM commercial_plan_versions cpv
  WHERE cpv.plan_key = 'enterprise' AND cpv.status = 'published'
  ORDER BY cpv.version_number DESC
  LIMIT 1
)
INSERT INTO tenant_subscriptions (id, tenant_id, plan_version_id, plan_key, status, started_at, metadata)
SELECT pg_temp.demo_uuid('subscription-enterprise'), c.tenant_id, ev.id, ev.plan_key, 'active', now() - interval '11 months',
       '{"source":"demo_tenant_iso_grc","commercial_type":"demo","entitlement_basis":"published_enterprise_plan_plus_demo_semantic_override"}'::jsonb
FROM demo_seed_context c
JOIN enterprise_version ev ON true
ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  ended_at = NULL,
  updated_at = now(),
  metadata = EXCLUDED.metadata;

INSERT INTO tenant_feature_overrides (id, tenant_id, capability_key, enabled, read_only, status, valid_from, valid_until, reason, created_by, metadata)
SELECT pg_temp.demo_uuid('override-data-semantic-layer'), tenant_id, 'data.semantic_layer', true, false, 'active', now() - interval '11 months', now() + interval '18 months',
       'Tenant demo comercial: habilitacion explicita de capa semantica sobre plan enterprise para demostracion ISO/GRC.',
       admin_id,
       '{"source":"demo_tenant_iso_grc","effective_entitlement":"override","scope":"tenant_demo_only"}'::jsonb
FROM demo_seed_context
ON CONFLICT (tenant_id, capability_key) DO UPDATE SET
  enabled = true,
  read_only = false,
  status = 'active',
  valid_until = EXCLUDED.valid_until,
  reason = EXCLUDED.reason,
  updated_at = now(),
  metadata = EXCLUDED.metadata;

INSERT INTO tenant_usage_limits (id, tenant_id, resource_key, limit_value, warning_threshold, enforcement, status, created_by)
SELECT pg_temp.demo_uuid('usage-' || u.resource_key), c.tenant_id, u.resource_key, u.limit_value, 0.8, u.enforcement, 'active', c.admin_id
FROM demo_seed_context c
CROSS JOIN (
  VALUES
    ('active_users',25,'block'),('active_standards',5,'block'),('evidence_files',5000,'warn'),('storage_bytes',21474836480,'warn'),
    ('exports_monthly',500,'warn'),('api_calls_monthly',250000,'warn'),('metric_definitions',250,'block'),
    ('metric_measurements_monthly',25000,'warn'),('dashboard_definitions',100,'block'),('report_generations_monthly',1000,'warn'),
    ('scheduled_reports',50,'block'),('semantic_contracts',50,'block'),('semantic_mappings',1000,'block'),('semantic_observations_monthly',50000,'warn')
) AS u(resource_key, limit_value, enforcement)
WHERE EXISTS (SELECT 1 FROM usage_limit_definitions d WHERE d.resource_key = u.resource_key)
ON CONFLICT (tenant_id, resource_key) DO UPDATE SET
  limit_value = EXCLUDED.limit_value,
  warning_threshold = EXCLUDED.warning_threshold,
  enforcement = EXCLUDED.enforcement,
  status = 'active',
  updated_at = now();

CREATE TEMP TABLE demo_processes (
  seq int PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  area text NOT NULL,
  criticality text NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_processes VALUES
  (1,'DIR','Direccion y planificacion','Direccion','high'),
  (2,'COM','Gestion comercial','Comercial','medium'),
  (3,'SRV','Diseno y prestacion del servicio','Operaciones','critical'),
  (4,'TEC','Operacion tecnologica','Tecnologia','critical'),
  (5,'PRO','Gestion de proveedores','Operaciones','high'),
  (6,'PER','Gestion de personas','Personas','medium'),
  (7,'DOC','Gestion documental','Calidad','medium'),
  (8,'AUD','Auditoria interna','Calidad','medium'),
  (9,'NCM','Gestion de no conformidades','Calidad','high'),
  (10,'MEJ','Mejora continua','Direccion','medium');

INSERT INTO tenant_processes (id, tenant_id, name)
SELECT pg_temp.demo_uuid('process-' || seq), c.tenant_id, p.name
FROM demo_seed_context c CROSS JOIN demo_processes p
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO tenant_operations (id, tenant_id, process_id, name)
SELECT pg_temp.demo_uuid('operation-' || seq), c.tenant_id, pg_temp.demo_uuid('process-' || seq), p.name
FROM demo_seed_context c CROSS JOIN demo_processes p
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO assets (id, tenant_id, name, type, iso, criticality, owner)
SELECT pg_temp.demo_uuid('asset-' || s.seq), c.tenant_id, s.name, s.asset_type, 'ISO27001', s.criticality, s.owner
FROM demo_seed_context c
CROSS JOIN (
  VALUES
    (1,'Plataforma SaaS clientes','aplicacion','critico','Tecnologia'),
    (2,'Base de datos productiva','informacion','critico','Seguridad de la Informacion'),
    (3,'Repositorio documental ISO','informacion','alto','Calidad'),
    (4,'Sistema de tickets y continuidad','servicio','alto','Operaciones'),
    (5,'Portal de proveedores','aplicacion','medio','Operaciones'),
    (6,'Repositorio de codigo','informacion','alto','Tecnologia'),
    (7,'Servicio de correo corporativo','servicio','medio','Personas'),
    (8,'Infraestructura cloud hibrida','infraestructura','critico','Tecnologia')
) AS s(seq, name, asset_type, criticality, owner)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  criticality = EXCLUDED.criticality,
  owner = EXCLUDED.owner;

CREATE TEMP TABLE demo_risks (
  seq int PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  level text NOT NULL,
  probability text NOT NULL,
  impact text NOT NULL,
  asset_seq int NOT NULL,
  process_seq int NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_risks
SELECT gs,
  (ARRAY[
    'Ransomware en infraestructura cloud','Phishing con robo de credenciales','Fuga de datos personales','Vulnerabilidad critica sin parche',
    'Configuracion insegura cloud','Falla de restauracion de backups','Privilegios excesivos no revisados','Proveedor critico sin evaluacion vigente',
    'Incidente de privacidad no reportado','SLA contractual incumplido','Reproceso por requisito ambiguo','Dependencia de personal clave',
    'Documento vigente no disponible','Reclamos por calidad de servicio','Trazabilidad incompleta de cambios','Cambio productivo no aprobado',
    'Capacidad insuficiente en peak','Error de facturacion recurrente','Contrato sin clausulas de seguridad','Evidencia de control vencida',
    'Auditoria interna atrasada','Hallazgo critico sin accion','Monitoreo de logs incompleto','Continuidad no probada'
  ])[gs],
  (ARRAY['seguridad','seguridad','privacidad','tecnologia','cloud','continuidad','iam','proveedores','privacidad','operacion','calidad','personas','documental','cliente','cambios','cambios','capacidad','finanzas','contratos','evidencias','auditoria','mejora','logging','continuidad'])[gs],
  CASE WHEN gs <= 3 THEN 'critical' WHEN gs <= 9 THEN 'high' WHEN gs <= 18 THEN 'medium' ELSE 'low' END,
  CASE WHEN gs IN (1,2,4,5,8,14) THEN 'alta' WHEN gs <= 18 THEN 'media' ELSE 'baja' END,
  CASE WHEN gs <= 3 THEN 'critico' WHEN gs <= 9 THEN 'alto' WHEN gs <= 18 THEN 'medio' ELSE 'bajo' END,
  ((gs - 1) % 8) + 1,
  ((gs - 1) % 10) + 1
FROM generate_series(1,24) gs;

INSERT INTO asset_risks (id, asset_id, risk, impact, probability, level, created_at)
SELECT pg_temp.demo_uuid('risk-' || r.seq), pg_temp.demo_uuid('asset-' || r.asset_seq), r.title,
       r.impact, r.probability, r.level, now() - (r.seq || ' days')::interval
FROM demo_risks r
ON CONFLICT (id) DO UPDATE SET
  risk = EXCLUDED.risk,
  impact = EXCLUDED.impact,
  probability = EXCLUDED.probability,
  level = EXCLUDED.level;

INSERT INTO controls_catalog (id, iso, clause, category, description, tenant_id, source_type, is_active)
SELECT pg_temp.demo_uuid('control-catalog-' || gs), CASE WHEN gs <= 28 THEN 'ISO9001' ELSE 'ISO27001' END,
       CASE
         WHEN gs <= 28 THEN 'QMS-' || lpad(gs::text,2,'0')
         ELSE 'A.' || (5 + ((gs - 29) / 5))::text || '.' || (1 + ((gs - 29) % 5))::text
       END,
       CASE WHEN gs <= 28 THEN 'calidad' ELSE 'seguridad_informacion' END,
       'Control demo ' || gs || ': ' ||
       CASE WHEN gs <= 28 THEN 'control integrado del SGC para proceso, evidencia, hallazgo y mejora.'
            ELSE 'control integrado del SGSI para activo, riesgo, evidencia y tratamiento.' END,
       c.tenant_id,
       'tenant_demo',
       true
FROM demo_seed_context c CROSS JOIN generate_series(1,55) gs
WHERE NOT EXISTS (SELECT 1 FROM controls_catalog cc WHERE cc.id = pg_temp.demo_uuid('control-catalog-' || gs));

INSERT INTO tenant_controls (
  id, tenant_id, control_id, status, score, health_status, responsible_user_id,
  last_reviewed_at, due_date, priority, applicability, notes, metadata, operation_id
)
SELECT pg_temp.demo_uuid('tenant-control-' || gs), c.tenant_id, pg_temp.demo_uuid('control-catalog-' || gs),
       CASE WHEN gs % 11 = 0 THEN 'pendiente' WHEN gs % 5 = 0 THEN 'parcial' ELSE 'implementado' END,
       CASE WHEN gs % 11 = 0 THEN 2.5 WHEN gs % 5 = 0 THEN 3.5 ELSE 4.4 END,
       CASE WHEN gs % 11 = 0 THEN 'requiere_atencion' WHEN gs % 5 = 0 THEN 'observado' ELSE 'saludable' END,
       CASE WHEN gs % 2 = 0 THEN c.admin_id ELSE c.auditor_id END,
       now() - ((gs % 70) || ' days')::interval,
       (current_date + ((gs % 120) - 30)),
       CASE WHEN gs <= 10 THEN 'alta' WHEN gs <= 35 THEN 'media' ELSE 'baja' END,
       CASE WHEN gs % 17 = 0 THEN 'no_aplicable' ELSE 'aplicable' END,
       'Control demo integrado con evidencia, riesgo, auditoria y metrica.',
       jsonb_build_object('demo_slug','demo-tecdex','control_type',CASE WHEN gs % 3 = 0 THEN 'detectivo' WHEN gs % 3 = 1 THEN 'preventivo' ELSE 'correctivo' END,'execution_type',CASE WHEN gs % 3 = 0 THEN 'automatico' WHEN gs % 3 = 1 THEN 'manual' ELSE 'semiautomatico' END,'frequency',CASE WHEN gs % 4 = 0 THEN 'mensual' WHEN gs % 4 = 1 THEN 'trimestral' WHEN gs % 4 = 2 THEN 'semanal' ELSE 'continua' END),
       pg_temp.demo_uuid('operation-' || (((gs - 1) % 10) + 1))
FROM demo_seed_context c CROSS JOIN generate_series(1,55) gs
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  score = EXCLUDED.score,
  health_status = EXCLUDED.health_status,
  responsible_user_id = EXCLUDED.responsible_user_id,
  last_reviewed_at = EXCLUDED.last_reviewed_at,
  due_date = EXCLUDED.due_date,
  priority = EXCLUDED.priority,
  applicability = EXCLUDED.applicability,
  notes = EXCLUDED.notes,
  metadata = EXCLUDED.metadata,
  updated_at = now();

INSERT INTO evidences (
  id, tenant_id, tenant_control_id, control_id, description, file_name, file_path, status,
  validated, reviewed_by, reviewed_at, expires_at, evidence_type, version, metadata,
  file_mime_type, file_size_bytes, content_fingerprint, document_extraction_status, ai_analysis_status
)
SELECT pg_temp.demo_uuid('evidence-' || gs), c.tenant_id, pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       'Evidencia demo ' || gs || ' para control ISO/GRC con trazabilidad lógica y sin binario ficticio.',
       'DEMO-' || lpad(gs::text,3,'0') || '-evidencia-logica.pdf',
       NULL,
       CASE WHEN gs % 13 = 0 THEN 'vencida' WHEN gs % 11 = 0 THEN 'pendiente' WHEN gs % 7 = 0 THEN 'proxima_a_vencer' WHEN gs % 5 = 0 THEN 'reemplazada' ELSE 'aprobada' END,
       gs % 11 <> 0,
       CASE WHEN gs % 2 = 0 THEN c.admin_id ELSE c.auditor_id END,
       now() - ((gs % 90) || ' days')::interval,
       current_date + CASE WHEN gs % 13 = 0 THEN -10 WHEN gs % 7 = 0 THEN 15 ELSE 120 END,
       CASE WHEN gs % 5 = 0 THEN 'registro' WHEN gs % 5 = 1 THEN 'politica' WHEN gs % 5 = 2 THEN 'acta' WHEN gs % 5 = 3 THEN 'reporte' ELSE 'certificado' END,
       1,
       jsonb_build_object('demo_slug','demo-tecdex','logical_only',true,'period_months_back',gs % 12,'source','demo_migration'),
       'application/pdf',
       0,
       encode(digest('demo-tecdex-evidence-' || gs, 'sha256'), 'hex'),
       'not_applicable',
       'not_applicable'
FROM demo_seed_context c CROSS JOIN generate_series(1,80) gs
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  validated = EXCLUDED.validated,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at,
  expires_at = EXCLUDED.expires_at,
  evidence_type = EXCLUDED.evidence_type,
  metadata = EXCLUDED.metadata;

INSERT INTO audits (id, tenant_id, iso, start_date, end_date, requester_name, auditor_type, auditor_name, status, audit_result, audit_result_notes, audit_result_at)
SELECT pg_temp.demo_uuid('audit-' || s.seq), c.tenant_id, s.iso, s.start_date, s.end_date, 'Comite GRC Demo Tecdex', s.auditor_type, 'Auditor Demo Tecdex', s.status, s.result, s.notes, s.end_date::timestamp
FROM demo_seed_context c
CROSS JOIN (
  VALUES
    (1,'ISO9001', current_date - 320, current_date - 315, 'interno', 'cerrada', 'con_observaciones', 'Auditoria ISO 9001 anual cerrada con oportunidades de mejora.'),
    (2,'ISO27001', current_date - 260, current_date - 254, 'interno', 'cerrada', 'con_observaciones', 'Auditoria ISO 27001 anual con brechas menores.'),
    (3,'Integrada', current_date - 150, current_date - 145, 'interno', 'cerrada', 'satisfactoria', 'Auditoria integrada SGC/SGSI con madurez operacional.'),
    (4,'Proveedor', current_date - 90, current_date - 88, 'proveedor', 'cerrada', 'con_hallazgos', 'Auditoria a proveedor cloud critico.'),
    (5,'Seguimiento', current_date - 20, current_date - 18, 'interno', 'en_revision', 'pendiente', 'Seguimiento de acciones abiertas.')
) AS s(seq, iso, start_date, end_date, auditor_type, status, result, notes)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  audit_result = EXCLUDED.audit_result,
  audit_result_notes = EXCLUDED.audit_result_notes,
  audit_result_at = EXCLUDED.audit_result_at;

INSERT INTO findings (
  id, tenant_id, iso_code, title, description, finding_type, severity, status,
  source_type, source_id, owner, detected_by, due_date, closed_at, created_by,
  tenant_control_id, audit_id, asset_id
)
SELECT pg_temp.demo_uuid('finding-' || gs), c.tenant_id,
       CASE WHEN gs <= 9 THEN 'ISO9001' ELSE 'ISO27001' END,
       'Hallazgo demo ' || gs,
       'Hallazgo sintético trazable a auditoría, control, evidencia y plan de acción.',
       CASE WHEN gs <= 2 THEN 'no_conformidad_menor' WHEN gs <= 7 THEN 'observacion' WHEN gs <= 14 THEN 'oportunidad_mejora' ELSE 'conformidad_destacada' END,
       CASE WHEN gs <= 2 THEN 'alta' WHEN gs <= 7 THEN 'media' ELSE 'baja' END,
       CASE WHEN gs IN (1,3,6,9,12) THEN 'abierto' WHEN gs IN (2,4,8) THEN 'en_progreso' ELSE 'cerrado' END,
       'audit',
       pg_temp.demo_uuid('audit-' || (((gs - 1) % 5) + 1)),
       CASE WHEN gs % 2 = 0 THEN 'Seguridad de la Informacion' ELSE 'Calidad' END,
       'Auditor Demo Tecdex',
       current_date + ((gs % 6) * 15),
       CASE WHEN gs > 14 THEN now() - ((gs % 20) || ' days')::interval ELSE NULL END,
       c.auditor_id,
       NULL,
       pg_temp.demo_uuid('audit-' || (((gs - 1) % 5) + 1)),
       pg_temp.demo_uuid('asset-' || (((gs - 1) % 8) + 1))
FROM demo_seed_context c CROSS JOIN generate_series(1,18) gs
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  closed_at = EXCLUDED.closed_at,
  due_date = EXCLUDED.due_date,
  updated_at = now();

INSERT INTO action_plans (
  id, tenant_id, iso_code, title, description, source_type, source_id, priority, status,
  owner, due_date, created_by, completed_at, tenant_control_id, finding_id, audit_id,
  asset_id, approval_status, approval_reviewed_by, approval_reviewed_at, approval_comment
)
SELECT pg_temp.demo_uuid('action-' || gs), c.tenant_id,
       CASE WHEN gs <= 12 THEN 'ISO9001' ELSE 'ISO27001' END,
       'Acción demo ' || gs,
       'Plan de acción sintético con responsable, fechas, evidencia y verificación.',
       'finding',
       pg_temp.demo_uuid('finding-' || (((gs - 1) % 18) + 1)),
       CASE WHEN gs <= 6 THEN 'alta' WHEN gs <= 18 THEN 'media' ELSE 'baja' END,
       CASE WHEN gs <= 8 THEN 'cerrado' WHEN gs <= 16 THEN 'en_progreso' WHEN gs <= 20 THEN 'abierto' ELSE 'planificado' END,
       CASE WHEN gs % 2 = 0 THEN 'Seguridad de la Informacion' ELSE 'Calidad' END,
       current_date + CASE WHEN gs <= 8 THEN -30 WHEN gs <= 16 THEN 45 WHEN gs <= 20 THEN -7 ELSE 90 END,
       c.admin_id,
       CASE WHEN gs <= 8 THEN now() - ((40 - gs) || ' days')::interval ELSE NULL END,
       pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       pg_temp.demo_uuid('finding-' || (((gs - 1) % 18) + 1)),
       pg_temp.demo_uuid('audit-' || (((gs - 1) % 5) + 1)),
       pg_temp.demo_uuid('asset-' || (((gs - 1) % 8) + 1)),
       CASE WHEN gs <= 8 THEN 'aprobada' ELSE 'no_requerida' END,
       CASE WHEN gs <= 8 THEN c.auditor_id ELSE NULL END,
       CASE WHEN gs <= 8 THEN now() - ((30 - gs) || ' days')::interval ELSE NULL END,
       CASE WHEN gs <= 8 THEN 'Cierre verificado en demo.' ELSE NULL END
FROM demo_seed_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  due_date = EXCLUDED.due_date,
  completed_at = EXCLUDED.completed_at,
  updated_at = now();

CREATE TEMP TABLE demo_metrics (
  seq int PRIMARY KEY,
  code text NOT NULL,
  metric_type text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  direction text NOT NULL,
  aggregation text NOT NULL,
  base numeric NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_metrics VALUES
  (1,'demo_tecdex.iso9001_compliance','compliance','Cumplimiento ISO 9001','percentage','higher_is_better','percentage',84),
  (2,'demo_tecdex.iso27001_compliance','compliance','Cumplimiento ISO 27001','percentage','higher_is_better','percentage',79),
  (3,'demo_tecdex.controls_effective','kci','Controles efectivos','percentage','higher_is_better','percentage',82),
  (4,'demo_tecdex.evidence_current','kci','Evidencias vigentes','percentage','higher_is_better','percentage',76),
  (5,'demo_tecdex.open_findings','kri','Hallazgos abiertos','count','lower_is_better','latest',7),
  (6,'demo_tecdex.overdue_actions','kri','Acciones vencidas','count','lower_is_better','latest',4),
  (7,'demo_tecdex.critical_vulnerabilities','kri','Vulnerabilidades críticas','count','lower_is_better','latest',3),
  (8,'demo_tecdex.service_availability','sla','Disponibilidad del servicio','percentage','higher_is_better','average',99.4),
  (9,'demo_tecdex.customer_satisfaction','kpi','Satisfacción de cliente','score','higher_is_better','average',4.3),
  (10,'demo_tecdex.training_coverage','kpi','Cobertura de capacitación','percentage','higher_is_better','percentage',88),
  (11,'demo_tecdex.net_loss','kri','Pérdida neta operacional','CLP','lower_is_better','sum',1200000),
  (12,'demo_tecdex.data_trust','data_quality','Data Trust Score Demo','score','higher_is_better','average',81);

INSERT INTO data_domains (id, tenant_id, domain_key, display_name, description, owner_user_id, status, created_by, metadata)
SELECT pg_temp.demo_uuid('domain-' || d.key), c.tenant_id, d.key, d.name, d.description, c.admin_id, 'active', c.admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('compliance','Cumplimiento','Normas ISO, cláusulas, controles y evaluaciones.'),
  ('risk','Riesgos','Riesgos, matriz, tratamientos, eventos e indicadores.'),
  ('control','Controles','Controles integrados, pruebas y evidencia.'),
  ('evidence','Evidencias','Evidencias lógicas y vigencia.'),
  ('metric','Métricas','KPI, KRI, KCI y Data Trust.'),
  ('semantic','Capa semántica','Contratos, mappings y observaciones canónicas.')
) AS d(key, name, description)
ON CONFLICT (tenant_id, domain_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO data_sources (id, tenant_id, source_key, display_name, source_type, system_name, entity_name, refresh_frequency, owner_user_id, status, last_observed_at, metadata)
SELECT pg_temp.demo_uuid('source-' || s.key), c.tenant_id, s.key, s.name, 'table', 'PostgreSQL', s.entity, 'monthly', c.admin_id, 'active', now(), '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('controls','Controles tenant','tenant_controls'),('evidences','Evidencias','evidences'),('risks','Riesgos de activos','asset_risks'),
  ('findings','Hallazgos','findings'),('actions','Planes de acción','action_plans'),('metrics','Mediciones','metric_measurements')
) AS s(key, name, entity)
ON CONFLICT (tenant_id, source_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = 'active',
  last_observed_at = now(),
  updated_at = now();

INSERT INTO data_elements (
  id, tenant_id, domain_id, element_key, display_name, business_definition, technical_definition,
  data_type, classification, source_type, source_reference, owner_user_id, steward_user_id,
  status, created_by, metadata
)
SELECT pg_temp.demo_uuid('element-' || e.key), c.tenant_id, pg_temp.demo_uuid('domain-' || e.domain_key), e.key, e.name,
       e.business_definition, e.technical_definition, e.data_type, 'internal', 'table', e.source_ref,
       c.admin_id, c.auditor_id, 'active', c.admin_id, '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('compliance','compliance_score','Cumplimiento por norma','Porcentaje de cumplimiento evidenciado por norma.','metric_measurements.value_numeric para métricas de cumplimiento.','percentage','metric_measurements'),
  ('risk','risk_level','Nivel de riesgo','Nivel inherente/residual para priorización.','asset_risks.level normalizado por tenant vía assets.','text','asset_risks'),
  ('control','control_effectiveness','Efectividad de control','Score y health status del control operativo.','tenant_controls.score y health_status.','numeric','tenant_controls'),
  ('evidence','evidence_freshness','Vigencia de evidencia','Estado y fecha de expiración de evidencia lógica.','evidences.status y expires_at.','text','evidences'),
  ('metric','metric_value','Valor de métrica','Valor mensual calculado o medido.','metric_measurements.value_numeric.','numeric','metric_measurements'),
  ('semantic','trust_score','Confianza de dato','Score determinístico de calidad/freshness/lineage.','grc_observations.trust_score.','numeric','grc_observations')
) AS e(domain_key, key, name, business_definition, technical_definition, data_type, source_ref)
ON CONFLICT (tenant_id, element_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  business_definition = EXCLUDED.business_definition,
  technical_definition = EXCLUDED.technical_definition,
  updated_at = now();

INSERT INTO metric_definitions (
  id, tenant_id, metric_code, display_name, business_definition, technical_definition,
  metric_type, unit, direction, aggregation, frequency, owner_user_id, reviewer_user_id,
  status, created_by, metadata
)
SELECT pg_temp.demo_uuid('metric-' || m.seq), c.tenant_id, m.code, m.name,
       'Métrica demostrativa sintética para Demo Tecdex: ' || m.name,
       'Serie mensual tenant-scoped generada por migración demo y trazada a fuentes internas.',
       m.metric_type, m.unit, m.direction, m.aggregation, 'monthly', c.admin_id, c.auditor_id,
       'published', c.admin_id,
       jsonb_build_object('demo_slug','demo-tecdex','iso_scope',CASE WHEN m.seq IN (1,9) THEN 'ISO9001' WHEN m.seq IN (2,7,8) THEN 'ISO27001' ELSE 'integrated' END)
FROM demo_seed_context c CROSS JOIN demo_metrics m
ON CONFLICT (metric_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  business_definition = EXCLUDED.business_definition,
  technical_definition = EXCLUDED.technical_definition,
  owner_user_id = EXCLUDED.owner_user_id,
  reviewer_user_id = EXCLUDED.reviewer_user_id,
  status = 'published',
  updated_at = now();

INSERT INTO metric_formula_versions (
  id, metric_definition_id, version_number, expression, expression_language, inputs,
  status, effective_from, created_by, approved_by, approved_at, metadata
)
SELECT pg_temp.demo_uuid('metric-formula-' || m.seq), pg_temp.demo_uuid('metric-' || m.seq), 1,
       jsonb_build_object('operator','latest','source','demo_semantic_observations','metric_code',m.code),
       'tcdx_metric_dsl_v1',
       jsonb_build_array(jsonb_build_object('source','grc_observations','field','numeric_value','metric_code',m.code)),
       'published', now() - interval '11 months', c.admin_id, c.auditor_id, now(), '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN demo_metrics m
ON CONFLICT (metric_definition_id, version_number) DO NOTHING;

INSERT INTO metric_measurements (
  id, tenant_id, metric_definition_id, formula_version_id, period_key, period_start, period_end,
  value_numeric, unit, source_timestamp, calculated_at, quality_status, freshness_status,
  trust_score, trust_status, validation_status, evidence_id, correlation_id, created_by, metadata
)
SELECT pg_temp.demo_uuid('measurement-' || m.seq || '-' || month_offset),
       c.tenant_id,
       pg_temp.demo_uuid('metric-' || m.seq),
       pg_temp.demo_uuid('metric-formula-' || m.seq),
       to_char(date_trunc('month', now()) - (month_offset || ' months')::interval, 'YYYY-MM'),
       date_trunc('month', now()) - (month_offset || ' months')::interval,
       date_trunc('month', now()) - (month_offset || ' months')::interval + interval '1 month' - interval '1 second',
       CASE
         WHEN m.unit = 'CLP' THEN m.base + (month_offset * 75000)
         WHEN m.unit = 'count' THEN greatest(0, m.base + ((month_offset % 4) - 2))
         ELSE round((m.base + ((month_offset % 5) - 2) * 0.8)::numeric, 2)
       END,
       m.unit,
       now() - (month_offset || ' months')::interval,
       now(),
       CASE WHEN month_offset = 11 THEN 'estimated' ELSE 'valid' END,
       CASE WHEN month_offset > 9 THEN 'aging' ELSE 'current' END,
       CASE WHEN month_offset > 9 THEN 72 ELSE 86 END,
       CASE WHEN month_offset > 9 THEN 'attention' ELSE 'trusted' END,
       'approved',
       pg_temp.demo_uuid('evidence-' || (((m.seq + month_offset) % 80) + 1)),
       'demo-tecdex:' || m.code || ':' || to_char(date_trunc('month', now()) - (month_offset || ' months')::interval, 'YYYY-MM'),
       c.admin_id,
       jsonb_build_object('demo_slug','demo-tecdex','formula_code',m.code,'formula_version',1,'coverage',CASE WHEN month_offset > 9 THEN 0.78 ELSE 0.92 END)
FROM demo_seed_context c
CROSS JOIN demo_metrics m
CROSS JOIN generate_series(0,11) month_offset
ON CONFLICT DO NOTHING;

INSERT INTO metric_snapshots (id, tenant_id, metric_definition_id, measurement_id, formula_version_id, period_key, snapshot_payload, content_hash, created_by, metadata)
SELECT pg_temp.demo_uuid('metric-snapshot-' || m.seq),
       c.tenant_id,
       pg_temp.demo_uuid('metric-' || m.seq),
       pg_temp.demo_uuid('measurement-' || m.seq || '-0'),
       pg_temp.demo_uuid('metric-formula-' || m.seq),
       to_char(date_trunc('month', now()), 'YYYY-MM'),
       jsonb_build_object('metric_code',m.code,'value',mm.value_numeric,'unit',m.unit,'trust',mm.trust_score,'period',mm.period_key),
       encode(digest(jsonb_build_object('metric_code',m.code,'value',mm.value_numeric,'unit',m.unit,'period',mm.period_key)::text, 'sha256'), 'hex'),
       c.admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
JOIN demo_metrics m ON true
JOIN metric_measurements mm ON mm.id = pg_temp.demo_uuid('measurement-' || m.seq || '-0')
ON CONFLICT (tenant_id, metric_definition_id, period_key, content_hash) DO NOTHING;

INSERT INTO data_snapshots (id, tenant_id, snapshot_type, entity_type, entity_id, period_key, snapshot_payload, source_hash, created_by, correlation_id, metadata)
SELECT pg_temp.demo_uuid('data-snapshot-' || m.seq),
       c.tenant_id,
       'metric',
       'metric_definition',
       pg_temp.demo_uuid('metric-' || m.seq),
       to_char(date_trunc('month', now()), 'YYYY-MM'),
       jsonb_build_object('metric_code',m.code,'display_name',m.name,'value',mm.value_numeric,'unit',m.unit,'formula_version',1,'tenant','Demo Tecdex'),
       encode(digest(jsonb_build_object('metric_code',m.code,'value',mm.value_numeric,'period',mm.period_key)::text, 'sha256'), 'hex'),
       c.admin_id,
       'demo-tecdex:snapshot:' || m.code,
       '{"demo_slug":"demo-tecdex","observable_in":"dashboards_reports_semantic"}'::jsonb
FROM demo_seed_context c
JOIN demo_metrics m ON true
JOIN metric_measurements mm ON mm.id = pg_temp.demo_uuid('measurement-' || m.seq || '-0')
ON CONFLICT DO NOTHING;

INSERT INTO data_lineage_edges (id, tenant_id, from_type, from_id, to_type, to_id, relation_type, transformation, created_by, correlation_id, metadata)
SELECT pg_temp.demo_uuid('lineage-measurement-metric-' || m.seq), c.tenant_id, 'metric_measurement', pg_temp.demo_uuid('measurement-' || m.seq || '-0'),
       'metric_definition', pg_temp.demo_uuid('metric-' || m.seq), 'measured_from',
       'Medición mensual demo trazada a fórmula publicada y evidencia lógica.', c.admin_id, 'demo-tecdex:lineage:metric:' || m.seq,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN demo_metrics m
ON CONFLICT DO NOTHING;

INSERT INTO data_lineage_edges (id, tenant_id, from_type, from_id, to_type, to_id, relation_type, transformation, created_by, correlation_id, metadata)
SELECT pg_temp.demo_uuid('lineage-control-evidence-' || gs), c.tenant_id, 'tenant_control', pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       'evidence', pg_temp.demo_uuid('evidence-' || gs), 'supported_by',
       'Evidencia lógica soporta control tenant.', c.admin_id, 'demo-tecdex:lineage:evidence:' || gs,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN generate_series(1,80) gs
ON CONFLICT DO NOTHING;

INSERT INTO data_source_contracts (id, tenant_id, source_code, display_name, entity_type, adapter_key, status, current_version_id, owner_user_id, created_by, updated_by, metadata)
SELECT pg_temp.demo_uuid('semantic-contract-' || s.key), c.tenant_id, 'demo_tecdex.' || s.key, s.name, s.entity_type, 'postgres_table', 'published',
       NULL, c.admin_id, c.admin_id, c.admin_id,
       jsonb_build_object('demo_slug','demo-tecdex','table',s.table_name,'dashboard_visible',true)
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('controls','Controles canónicos','control','tenant_controls'),
  ('evidences','Evidencias canónicas','evidence','evidences'),
  ('risks','Riesgos canónicos','risk','asset_risks'),
  ('findings','Hallazgos canónicos','finding','findings'),
  ('actions','Acciones canónicas','action','action_plans'),
  ('metrics','Métricas canónicas','metric','metric_measurements')
) AS s(key, name, entity_type, table_name)
ON CONFLICT DO NOTHING;

INSERT INTO data_source_contract_versions (
  id, contract_id, version_number, physical_tables, tenant_key_candidates, timestamp_candidates,
  required_fields, optional_fields, field_equivalences, unit_policy, period_policy, minimum_coverage,
  maximum_age_seconds, status, valid_from, checksum, created_by, reviewed_by, approved_by,
  published_by, reviewed_at, approved_at, published_at, metadata
)
SELECT pg_temp.demo_uuid('semantic-contract-version-' || s.key), pg_temp.demo_uuid('semantic-contract-' || s.key), 1,
       jsonb_build_array(s.table_name), '["tenant_id"]'::jsonb, '["created_at","updated_at"]'::jsonb,
       jsonb_build_array('id','tenant_id'), jsonb_build_array('status','score','metadata'),
       jsonb_build_object('id','id','tenant','tenant_id','status','status'),
       '{"allowed_units":["count","percentage","score","CLP"]}'::jsonb,
       '{"frequency":"monthly","timezone":"America/Santiago"}'::jsonb,
       0.75,
       2592000,
       'published',
       now() - interval '11 months',
       encode(digest('demo-tecdex-contract-' || s.key || '-v1', 'sha256'), 'hex'),
       c.admin_id, c.auditor_id, c.auditor_id, c.admin_id, now(), now(), now(),
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('controls','tenant_controls'),('evidences','evidences'),('risks','asset_risks'),
  ('findings','findings'),('actions','action_plans'),('metrics','metric_measurements')
) AS s(key, table_name)
ON CONFLICT (contract_id, version_number) DO NOTHING;

UPDATE data_source_contracts c
SET current_version_id = v.id,
    status = 'published',
    updated_at = now()
FROM data_source_contract_versions v
WHERE c.tenant_id = (SELECT tenant_id FROM demo_seed_context)
  AND c.source_code LIKE 'demo_tecdex.%'
  AND v.contract_id = c.id
  AND v.version_number = 1
  AND c.current_version_id IS DISTINCT FROM v.id;

INSERT INTO data_source_field_mappings (
  id, tenant_id, contract_version_id, physical_table, physical_column, canonical_field,
  transformation_type, priority, required, status, created_by, updated_by, metadata
)
SELECT pg_temp.demo_uuid('semantic-mapping-' || s.key || '-' || f.field), c.tenant_id, pg_temp.demo_uuid('semantic-contract-version-' || s.key),
       s.table_name, f.field, f.canonical, 'direct', f.priority, f.required, 'active', c.admin_id, c.admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('controls','tenant_controls'),('evidences','evidences'),('risks','asset_risks'),
  ('findings','findings'),('actions','action_plans'),('metrics','metric_measurements')
) AS s(key, table_name)
CROSS JOIN (VALUES
  ('id','entity.id',1,true),('tenant_id','tenant.id',2,true),('status','entity.status',3,false),('created_at','entity.created_at',4,false)
) AS f(field, canonical, priority, required)
ON CONFLICT (tenant_id, contract_version_id, canonical_field, priority) DO UPDATE SET
  status = 'active',
  updated_at = now();

INSERT INTO grc_observations (
  id, tenant_id, observation_type, entity_type, entity_id, contract_id, contract_version_id,
  source_table, source_record_id, source_identity_hash, observed_at, period_start, period_end,
  status_value, numeric_value, unit, quality_status, quality_score, freshness_status,
  freshness_age_seconds, trust_score, owner_user_id, evidence_id, correlation_id, created_by, metadata
)
SELECT pg_temp.demo_uuid('observation-metric-' || m.seq), c.tenant_id, 'metric.measurement', 'metric_definition', pg_temp.demo_uuid('metric-' || m.seq),
       pg_temp.demo_uuid('semantic-contract-metrics'), pg_temp.demo_uuid('semantic-contract-version-metrics'),
       'metric_measurements', pg_temp.demo_uuid('measurement-' || m.seq || '-0')::text,
       encode(digest('demo-tecdex-observation-metric-' || m.seq, 'sha256'), 'hex'),
       now(), date_trunc('month', now()), date_trunc('month', now()) + interval '1 month' - interval '1 second',
       'approved', mm.value_numeric, m.unit,
       CASE WHEN mm.trust_score >= 80 THEN 'valid' ELSE 'attention' END,
       mm.trust_score,
       CASE WHEN mm.freshness_status = 'current' THEN 'fresh' ELSE 'attention' END,
       3600,
       mm.trust_score,
       c.admin_id,
       pg_temp.demo_uuid('evidence-' || (((m.seq) % 80) + 1)),
       'demo-tecdex:observation:' || m.code,
       c.admin_id,
       jsonb_build_object('demo_slug','demo-tecdex','explanation','Observación canónica derivada de medición mensual demo.')
FROM demo_seed_context c
JOIN demo_metrics m ON true
JOIN metric_measurements mm ON mm.id = pg_temp.demo_uuid('measurement-' || m.seq || '-0')
ON CONFLICT (tenant_id, contract_version_id, source_identity_hash) WHERE is_current DO NOTHING;

INSERT INTO grc_observation_relations (id, tenant_id, observation_id, related_entity_type, related_entity_id, relation_type, confidence, created_by, metadata)
SELECT pg_temp.demo_uuid('observation-relation-' || m.seq), c.tenant_id, pg_temp.demo_uuid('observation-metric-' || m.seq),
       'metric_definition', pg_temp.demo_uuid('metric-' || m.seq), 'measures', 1, c.admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN demo_metrics m
ON CONFLICT (tenant_id, observation_id, related_entity_type, related_entity_id, relation_type) DO NOTHING;

INSERT INTO dashboard_definitions (id, tenant_id, dashboard_key, display_name, description, dashboard_type, layout_config, filter_config, version_number, status, created_by, updated_by, published_by, published_at, metadata)
SELECT pg_temp.demo_uuid('dashboard-' || d.key), c.tenant_id, 'demo_tecdex_' || d.key, d.name, d.description, d.dashboard_type,
       '{"columns":12,"density":"enterprise"}'::jsonb, '{"period":"last_12_months","tenant":"demo-tecdex"}'::jsonb,
       1, 'published', c.admin_id, c.admin_id, c.admin_id, now(), '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('executive_grc','Dashboard Ejecutivo GRC Demo','Resumen ejecutivo ISO/GRC integrado.','executive'),
  ('compliance','Dashboard Cumplimiento Demo','ISO 9001 e ISO/IEC 27001.','compliance'),
  ('risk','Dashboard Riesgos Demo','Matriz y KRIs.','risk'),
  ('data_quality','Dashboard Confianza de Datos Demo','Calidad, freshness y lineage.','data_quality')
) AS d(key, name, description, dashboard_type)
ON CONFLICT (tenant_id, dashboard_key, version_number) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = 'published',
  published_at = now(),
  updated_at = now();

INSERT INTO dashboard_widgets (id, tenant_id, dashboard_id, widget_key, display_name, widget_type, data_source_type, data_source_ref, position_row, position_col, width, height, config, status, metadata)
SELECT pg_temp.demo_uuid('widget-' || d.key || '-' || m.seq), c.tenant_id, pg_temp.demo_uuid('dashboard-' || d.key),
       'metric_' || m.seq, m.name,
       CASE WHEN m.seq IN (1,2,4,8,12) THEN 'gauge' WHEN m.seq IN (5,6,7,11) THEN 'kpi_card' ELSE 'trend' END,
       'metric', m.code, 1 + ((m.seq - 1) / 4), 1 + (((m.seq - 1) % 4) * 3), 3, 2,
       jsonb_build_object('metric_code',m.code,'show_trust',true,'show_freshness',true,'lineage_enabled',true),
       'active', '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES ('executive_grc'),('compliance'),('risk'),('data_quality')) AS d(key)
JOIN demo_metrics m ON true
WHERE (d.key = 'executive_grc' AND m.seq IN (1,2,5,6,8,11,12))
   OR (d.key = 'compliance' AND m.seq IN (1,2,3,4,10))
   OR (d.key = 'risk' AND m.seq IN (5,6,7,11))
   OR (d.key = 'data_quality' AND m.seq IN (4,12))
ON CONFLICT (dashboard_id, widget_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  data_source_ref = EXCLUDED.data_source_ref,
  config = EXCLUDED.config,
  status = 'active',
  updated_at = now();

INSERT INTO report_definitions (id, tenant_id, report_key, display_name, report_type, classification, filter_config, section_config, recipient_config, approval_required, status, created_by, updated_by, metadata)
SELECT pg_temp.demo_uuid('report-' || r.key), c.tenant_id, 'demo_tecdex_' || r.key, r.name, r.report_type, 'internal',
       '{"period":"last_12_months","tenant":"demo-tecdex"}'::jsonb,
       jsonb_build_array('resumen_ejecutivo','metricas','riesgos','controles','evidencias','hallazgos','acciones','lineage'),
       jsonb_build_array(jsonb_build_object('role','admin'),jsonb_build_object('role','auditor')),
       true, 'published', c.admin_id, c.admin_id, '{"demo_slug":"demo-tecdex","no_fake_artifacts":true}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES
  ('executive_grc','Informe Ejecutivo GRC Demo','executive_grc'),
  ('risks','Informe de Riesgos Demo','risks'),
  ('compliance','Informe de Cumplimiento Demo','compliance'),
  ('data_quality','Informe de Integraciones y Calidad del Dato Demo','data_quality')
) AS r(key, name, report_type)
ON CONFLICT (tenant_id, report_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = 'published',
  updated_at = now();

INSERT INTO report_generations (id, tenant_id, report_definition_id, generation_key, format, status, snapshot_id, requested_by, approved_by, requested_at, started_at, finished_at, approved_at, checksum, correlation_id, metadata)
SELECT pg_temp.demo_uuid('report-generation-' || r.key || '-' || f.format), c.tenant_id, pg_temp.demo_uuid('report-' || r.key),
       'demo_tecdex_' || r.key || '_' || f.format || '_' || to_char(date_trunc('month', now()), 'YYYY_MM'),
       f.format, 'generated', pg_temp.demo_uuid('data-snapshot-1'), c.admin_id, c.auditor_id,
       now(), now(), now(), now(),
       encode(digest('demo-tecdex-report-generation-' || r.key || '-' || f.format, 'sha256'), 'hex'),
       'demo-tecdex:report:' || r.key || ':' || f.format,
       '{"demo_slug":"demo-tecdex","artifact_policy":"generate_on_download_no_fake_binary"}'::jsonb
FROM demo_seed_context c
CROSS JOIN (VALUES ('executive_grc'),('risks'),('compliance'),('data_quality')) AS r(key)
CROSS JOIN (VALUES ('pdf'),('docx'),('xlsx')) AS f(format)
ON CONFLICT (tenant_id, generation_key, format) DO UPDATE SET
  status = 'generated',
  snapshot_id = EXCLUDED.snapshot_id,
  approved_by = EXCLUDED.approved_by,
  approved_at = EXCLUDED.approved_at,
  checksum = EXCLUDED.checksum,
  metadata = EXCLUDED.metadata;

INSERT INTO survey_definitions (id, tenant_id, survey_key, display_name, survey_type, description, owner_user_id, status, created_by, metadata)
SELECT pg_temp.demo_uuid('survey-supplier-assessment'), tenant_id, 'demo_tecdex_supplier_assessment', 'Evaluación demo de proveedor crítico', 'supplier_assessment',
       'Cuestionario demo para evaluar proveedor crítico de servicios cloud.', admin_id, 'active', admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context
ON CONFLICT (tenant_id, survey_key) DO UPDATE SET status = 'active', updated_at = now();

INSERT INTO survey_versions (id, survey_definition_id, version_number, status, scoring_definition, branching_definition, created_by, approved_by, published_at, metadata)
SELECT pg_temp.demo_uuid('survey-version-supplier-assessment'), pg_temp.demo_uuid('survey-supplier-assessment'), 1, 'active',
       '{"max_score":100,"method":"weighted_sum","pass_threshold":75}'::jsonb,
       '{"if_score_below":75,"consequence":"finding_preview"}'::jsonb,
       admin_id, auditor_id, now(), '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context
ON CONFLICT (survey_definition_id, version_number) DO NOTHING;

INSERT INTO assessment_campaigns (id, tenant_id, survey_definition_id, survey_version_id, campaign_key, display_name, target_population, starts_at, ends_at, anonymous, status, created_by, approved_by, metadata)
SELECT pg_temp.demo_uuid('survey-campaign-cloud'), tenant_id, pg_temp.demo_uuid('survey-supplier-assessment'), pg_temp.demo_uuid('survey-version-supplier-assessment'),
       'demo_tecdex_cloud_supplier_2026', 'Campaña demo proveedores cloud 2026', '{"population":"proveedores criticos"}'::jsonb,
       now() - interval '20 days', now() + interval '40 days', false, 'active', admin_id, auditor_id, '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context
ON CONFLICT (tenant_id, campaign_key) DO UPDATE SET status = 'active', updated_at = now();

INSERT INTO assurance_test_definitions (id, tenant_id, test_code, display_name, test_type, objective, procedure, target_entity_type, target_entity_id, owner_user_id, reviewer_user_id, status, created_by, metadata)
SELECT pg_temp.demo_uuid('assurance-test-' || gs), c.tenant_id, 'DEMO-TEST-' || lpad(gs::text,2,'0'),
       'Test demo de assurance ' || gs,
       CASE WHEN gs % 5 = 0 THEN 'recovery_test' WHEN gs % 4 = 0 THEN 'technical_test' WHEN gs % 3 = 0 THEN 'operating_test' WHEN gs % 2 = 0 THEN 'implementation_test' ELSE 'design_test' END,
       'Verificar diseño, implementación y operación del control demo.',
       'Seleccionar muestra, revisar evidencia lógica, registrar resultado y generar acción si corresponde.',
       'control',
       pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       c.admin_id, c.auditor_id, 'active', c.admin_id,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (tenant_id, test_code) DO UPDATE SET status = 'active', updated_at = now();

INSERT INTO assurance_test_executions (id, tenant_id, test_definition_id, execution_code, population_description, sample_method, executed_by, reviewed_by, executed_at, reviewed_at, result, conclusion, status, evidence_id, finding_id, action_id, metadata)
SELECT pg_temp.demo_uuid('assurance-execution-' || gs), c.tenant_id, pg_temp.demo_uuid('assurance-test-' || gs),
       'DEMO-EXEC-' || lpad(gs::text,2,'0'), 'Población demo de controles y evidencias del periodo.',
       CASE WHEN gs % 2 = 0 THEN 'muestreo dirigido por riesgo' ELSE 'muestreo aleatorio simple' END,
       c.auditor_id, c.admin_id, now() - ((gs * 7) || ' days')::interval, now() - ((gs * 7 - 1) || ' days')::interval,
       CASE WHEN gs IN (3,7,11) THEN 'fail' WHEN gs IN (5,9) THEN 'pass_with_observations' ELSE 'pass' END,
       'Resultado demo trazado a control, evidencia, hallazgo y acción cuando aplica.',
       CASE WHEN gs IN (3,7,11) THEN 'reviewed' ELSE 'approved' END,
       pg_temp.demo_uuid('evidence-' || (((gs - 1) % 80) + 1)),
       CASE WHEN gs IN (3,7,11) THEN pg_temp.demo_uuid('finding-' || gs) ELSE NULL END,
       CASE WHEN gs IN (3,7,11) THEN pg_temp.demo_uuid('action-' || gs) ELSE NULL END,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN generate_series(1,12) gs
ON CONFLICT (tenant_id, execution_code) DO UPDATE SET
  result = EXCLUDED.result,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO loss_events (
  id, tenant_id, event_code, event_type, occurred_at, detected_at, process_id, service_id, risk_id,
  cause, impact_description, gross_loss, recoveries, currency, supplier_id, incident_id,
  failed_control_id, evidence_id, action_plan_id, status, created_by, approved_by, approved_at, metadata
)
SELECT pg_temp.demo_uuid('loss-' || gs), c.tenant_id, 'DEMO-LOSS-' || lpad(gs::text,2,'0'),
       CASE WHEN gs % 2 = 0 THEN 'operational' ELSE 'information_security' END,
       now() - ((gs * 38) || ' days')::interval,
       now() - ((gs * 38 - 1) || ' days')::interval,
       pg_temp.demo_uuid('process-' || (((gs - 1) % 10) + 1)),
       NULL,
       pg_temp.demo_uuid('risk-' || (((gs - 1) % 24) + 1)),
       'Causa demo controlada para análisis comercial.',
       'Impacto financiero y operacional sintético sin datos reales.',
       (ARRAY[850000,1200000,430000,2100000,650000,980000])[gs],
       (ARRAY[150000,250000,0,400000,50000,180000])[gs],
       'CLP',
       NULL,
       NULL,
       pg_temp.demo_uuid('tenant-control-' || (((gs - 1) % 55) + 1)),
       pg_temp.demo_uuid('evidence-' || (((gs - 1) % 80) + 1)),
       pg_temp.demo_uuid('action-' || (((gs - 1) % 24) + 1)),
       CASE WHEN gs IN (1,4) THEN 'confirmed' WHEN gs IN (2,5) THEN 'recovered_partial' ELSE 'closed' END,
       c.admin_id,
       c.auditor_id,
       now() - ((gs * 20) || ' days')::interval,
       '{"demo_slug":"demo-tecdex","currency_policy":"no_conversion"}'::jsonb
FROM demo_seed_context c CROSS JOIN generate_series(1,6) gs
ON CONFLICT (tenant_id, event_code) DO UPDATE SET
  gross_loss = EXCLUDED.gross_loss,
  recoveries = EXCLUDED.recoveries,
  status = EXCLUDED.status,
  updated_at = now(),
  metadata = EXCLUDED.metadata;

INSERT INTO data_lineage_edges (id, tenant_id, from_type, from_id, to_type, to_id, relation_type, transformation, created_by, correlation_id, metadata)
SELECT pg_temp.demo_uuid('lineage-risk-control-' || r.seq), c.tenant_id, 'asset_risk', pg_temp.demo_uuid('risk-' || r.seq),
       'tenant_control', pg_temp.demo_uuid('tenant-control-' || (((r.seq - 1) % 55) + 1)), 'affects',
       'Riesgo demo afecta y es mitigado analíticamente por control tenant.', c.admin_id, 'demo-tecdex:lineage:risk:' || r.seq,
       jsonb_build_object('demo_slug','demo-tecdex','risk_level',r.level,'process_seq',r.process_seq)
FROM demo_seed_context c JOIN demo_risks r ON true
ON CONFLICT DO NOTHING;

INSERT INTO data_lineage_edges (id, tenant_id, from_type, from_id, to_type, to_id, relation_type, transformation, created_by, correlation_id, metadata)
SELECT pg_temp.demo_uuid('lineage-finding-action-' || gs), c.tenant_id, 'finding', pg_temp.demo_uuid('finding-' || (((gs - 1) % 18) + 1)),
       'action_plan', pg_temp.demo_uuid('action-' || gs), 'affects',
       'Hallazgo demo genera acción correctiva o de mejora.', c.admin_id, 'demo-tecdex:lineage:action:' || gs,
       '{"demo_slug":"demo-tecdex"}'::jsonb
FROM demo_seed_context c CROSS JOIN generate_series(1,24) gs
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_tenant_id uuid := pg_temp.demo_uuid('tenant');
  v_admin_id uuid := pg_temp.demo_uuid('user-admin');
  v_auditor_id uuid := pg_temp.demo_uuid('user-auditor');
  v_semantic_allowed boolean;
  v_counts jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM tenant_feature_overrides
    WHERE tenant_id = v_tenant_id
      AND capability_key = 'data.semantic_layer'
      AND enabled = true
      AND status = 'active'
      AND (valid_until IS NULL OR valid_until > now())
  ) INTO v_semantic_allowed;

  SELECT jsonb_build_object(
    'tenant', (SELECT count(*) FROM tenants WHERE id = v_tenant_id AND service_status = 'active'),
    'users', (SELECT count(*) FROM users WHERE tenant_id = v_tenant_id AND email IN ('admin.demo@tcdx.demo','auditor.demo@tcdx.demo')),
    'standards', (SELECT count(*) FROM tenant_standards WHERE tenant_id = v_tenant_id AND is_active),
    'risks', (SELECT count(*) FROM asset_risks ar JOIN assets a ON a.id = ar.asset_id WHERE a.tenant_id = v_tenant_id),
    'controls', (SELECT count(*) FROM tenant_controls WHERE tenant_id = v_tenant_id),
    'evidences', (SELECT count(*) FROM evidences WHERE tenant_id = v_tenant_id),
    'audits', (SELECT count(*) FROM audits WHERE tenant_id = v_tenant_id),
    'findings', (SELECT count(*) FROM findings WHERE tenant_id = v_tenant_id),
    'actions', (SELECT count(*) FROM action_plans WHERE tenant_id = v_tenant_id),
    'metrics', (SELECT count(*) FROM metric_definitions WHERE tenant_id = v_tenant_id),
    'measurements', (SELECT count(*) FROM metric_measurements WHERE tenant_id = v_tenant_id),
    'semantic_contracts', (SELECT count(*) FROM data_source_contracts WHERE tenant_id = v_tenant_id),
    'observations', (SELECT count(*) FROM grc_observations WHERE tenant_id = v_tenant_id),
    'dashboards', (SELECT count(*) FROM dashboard_definitions WHERE tenant_id = v_tenant_id AND status = 'published'),
    'reports', (SELECT count(*) FROM report_definitions WHERE tenant_id = v_tenant_id AND status = 'published'),
    'assurance', (SELECT count(*) FROM assurance_test_definitions WHERE tenant_id = v_tenant_id),
    'losses', (SELECT count(*) FROM loss_events WHERE tenant_id = v_tenant_id)
  ) INTO v_counts;

  IF NOT v_semantic_allowed THEN
    RAISE EXCEPTION 'Demo Tecdex postcondition failed: data.semantic_layer not enabled';
  END IF;
  IF (v_counts->>'tenant')::int <> 1 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: tenant count %', v_counts->>'tenant'; END IF;
  IF (v_counts->>'users')::int <> 2 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: users count %', v_counts->>'users'; END IF;
  IF (v_counts->>'standards')::int < 2 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: standards %', v_counts->>'standards'; END IF;
  IF (v_counts->>'risks')::int < 24 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: risks %', v_counts->>'risks'; END IF;
  IF (v_counts->>'controls')::int < 55 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: controls %', v_counts->>'controls'; END IF;
  IF (v_counts->>'evidences')::int < 80 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: evidences %', v_counts->>'evidences'; END IF;
  IF (v_counts->>'audits')::int < 5 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: audits %', v_counts->>'audits'; END IF;
  IF (v_counts->>'findings')::int < 18 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: findings %', v_counts->>'findings'; END IF;
  IF (v_counts->>'actions')::int < 24 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: actions %', v_counts->>'actions'; END IF;
  IF (v_counts->>'measurements')::int < 144 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: measurements %', v_counts->>'measurements'; END IF;
  IF (v_counts->>'semantic_contracts')::int < 6 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: semantic contracts %', v_counts->>'semantic_contracts'; END IF;
  IF (v_counts->>'observations')::int < 12 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: observations %', v_counts->>'observations'; END IF;
  IF (v_counts->>'dashboards')::int < 4 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: dashboards %', v_counts->>'dashboards'; END IF;
  IF (v_counts->>'reports')::int < 4 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: reports %', v_counts->>'reports'; END IF;
  IF (v_counts->>'assurance')::int < 12 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: assurance %', v_counts->>'assurance'; END IF;
  IF (v_counts->>'losses')::int < 6 THEN RAISE EXCEPTION 'Demo Tecdex postcondition failed: losses %', v_counts->>'losses'; END IF;

  INSERT INTO commercial_events (tenant_id, actor_user_id, event_type, entity_type, entity_id, after_state, reason, request_id)
  VALUES (
    v_tenant_id,
    v_admin_id,
    'demo_tenant_seeded',
    'tenant',
    v_tenant_id,
    v_counts,
    'Carga demo ISO 9001 + ISO/IEC 27001 + GRC operativo',
    'demo-tecdex-migration'
  );
END $$;

COMMIT;
