-- TCDX ISO SaaS v4 - Phase 4 commercial product governance
-- Additive commercial catalog, entitlements, limits, packs, methodologies and workpapers.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES product_families(id) ON DELETE RESTRICT,
  edition_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES commercial_editions(id) ON DELETE RESTRICT,
  plan_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES commercial_plans(id) ON DELETE RESTRICT,
  plan_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (plan_id, version_number)
);

CREATE OR REPLACE FUNCTION reject_published_commercial_plan_version_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'commercial_plan_versions records are immutable after publishing';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_commercial_plan_versions_immutable ON commercial_plan_versions;
CREATE TRIGGER trg_commercial_plan_versions_immutable
BEFORE UPDATE OR DELETE ON commercial_plan_versions
FOR EACH ROW
WHEN (OLD.status = 'published')
EXECUTE FUNCTION reject_published_commercial_plan_version_change();

CREATE TABLE IF NOT EXISTS commercial_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  sort_order integer NOT NULL DEFAULT 500,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commercial_technical_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  required_permission text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS plan_version_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES commercial_modules(module_key) ON DELETE RESTRICT,
  included boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, module_key)
);

CREATE TABLE IF NOT EXISTS plan_version_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE CASCADE,
  addon_key text NOT NULL REFERENCES commercial_addons(addon_key) ON DELETE RESTRICT,
  included boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, addon_key)
);

CREATE TABLE IF NOT EXISTS module_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL REFERENCES commercial_modules(module_key) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES commercial_features(feature_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_key, feature_key)
);

CREATE TABLE IF NOT EXISTS feature_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL REFERENCES commercial_features(feature_key) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_key, capability_key)
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_version_id uuid NOT NULL REFERENCES commercial_plan_versions(id) ON DELETE RESTRICT,
  plan_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','past_due','suspended','cancelled','replaced')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_status ON tenant_subscriptions (tenant_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS tenant_subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_subscription_id uuid NOT NULL REFERENCES tenant_subscriptions(id) ON DELETE CASCADE,
  addon_key text NOT NULL REFERENCES commercial_addons(addon_key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_subscription_id, addon_key)
);

CREATE TABLE IF NOT EXISTS tenant_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE RESTRICT,
  enabled boolean NOT NULL,
  read_only boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  reason text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, capability_key)
);

CREATE TABLE IF NOT EXISTS usage_limit_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  default_limit numeric,
  unit text NOT NULL DEFAULT 'count',
  period text NOT NULL DEFAULT 'month' CHECK (period IN ('day','month','year','lifetime')),
  warning_threshold numeric NOT NULL DEFAULT 0.8 CHECK (warning_threshold > 0 AND warning_threshold <= 1),
  enforcement text NOT NULL DEFAULT 'block' CHECK (enforcement IN ('observe','warn','block')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_key text NOT NULL REFERENCES usage_limit_definitions(resource_key) ON DELETE RESTRICT,
  limit_value numeric,
  warning_threshold numeric NOT NULL DEFAULT 0.8 CHECK (warning_threshold > 0 AND warning_threshold <= 1),
  enforcement text NOT NULL DEFAULT 'block' CHECK (enforcement IN ('observe','warn','block')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, resource_key)
);

CREATE TABLE IF NOT EXISTS usage_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_key text NOT NULL REFERENCES usage_limit_definitions(resource_key) ON DELETE RESTRICT,
  period_key text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  source text NOT NULL,
  correlation_id text,
  idempotency_key text,
  measured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_measurements_unique_idempotent ON usage_measurements (tenant_id, resource_key, period_key, COALESCE(idempotency_key, ''::text));

CREATE TABLE IF NOT EXISTS trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trial_key text NOT NULL,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, trial_key)
);

CREATE TABLE IF NOT EXISTS commercial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commercial_events_tenant_created ON commercial_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  response_target_hours integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS deployment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pack_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  pack_type text NOT NULL CHECK (pack_type IN ('regulatory','methodology','sector','implementation','template')),
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  licensed_text_included boolean NOT NULL DEFAULT false,
  content_classification text NOT NULL DEFAULT 'internal_methodology',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES pack_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (pack_id, version_number)
);

CREATE TABLE IF NOT EXISTS pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_version_id uuid NOT NULL REFERENCES pack_versions(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text NOT NULL,
  item_order integer NOT NULL DEFAULT 100,
  content_classification text NOT NULL DEFAULT 'internal_methodology',
  licensed_text_included boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (pack_version_id, item_key)
);

CREATE TABLE IF NOT EXISTS pack_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_version_id uuid NOT NULL REFERENCES pack_versions(id) ON DELETE CASCADE,
  dependency_pack_key text NOT NULL,
  dependency_version integer,
  UNIQUE (pack_version_id, dependency_pack_key)
);

CREATE TABLE IF NOT EXISTS tenant_pack_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pack_key text NOT NULL,
  pack_version_id uuid NOT NULL REFERENCES pack_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'installed' CHECK (status IN ('previewed','installed','rolled_back','failed')),
  installed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, pack_key, pack_version_id)
);

CREATE TABLE IF NOT EXISTS tenant_pack_installation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES tenant_pack_installations(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_type text NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'installed' CHECK (status IN ('installed','rolled_back','not_reversible')),
  created_record_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (installation_id, item_key)
);

CREATE TABLE IF NOT EXISTS risk_methodology_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  methodology_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  display_name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (methodology_key, version_number)
);

CREATE TABLE IF NOT EXISTS audit_workpaper_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  display_name text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, version_number)
);

CREATE TABLE IF NOT EXISTS tenant_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES commercial_technical_capabilities(capability_key) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('plan','addon','override','trial','legacy')),
  source_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  read_only boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_entitlements_unique_source ON tenant_entitlements (tenant_id, capability_key, source, COALESCE(source_id, '00000000-0000-0000-0000-000000000000'::uuid));

INSERT INTO permissions (permission_key, permission_group, display_name, description)
VALUES
  ('commercial.catalog.read','commercial','Consultar catalogo comercial','Consulta familias, ediciones, planes, modulos y capabilities.'),
  ('commercial.catalog.manage','commercial','Administrar catalogo comercial','Crea y versiona catalogo comercial.'),
  ('commercial.plan.read','commercial','Consultar planes','Consulta planes y versiones publicadas.'),
  ('commercial.plan.manage','commercial','Administrar planes','Publica versiones y configura planes.'),
  ('commercial.subscription.read','commercial','Consultar suscripciones','Consulta plan, vigencia y estado por tenant.'),
  ('commercial.subscription.manage','commercial','Administrar suscripciones','Ejecuta cambios de plan y add-ons.'),
  ('commercial.entitlement.read','commercial','Consultar entitlements','Consulta capacidades efectivas y origen.'),
  ('commercial.entitlement.override','commercial','Administrar overrides','Aplica overrides auditados y con vigencia.'),
  ('commercial.usage.read','commercial','Consultar consumo','Consulta limites, uso y remaining.'),
  ('commercial.health.read','commercial','Consultar salud comercial','Consulta salud operacional y comercial del tenant.'),
  ('commercial.trial.manage','commercial','Administrar trials','Inicia y termina trials controlados.'),
  ('commercial.pack.read','commercial','Consultar packs','Consulta packs y previews.'),
  ('commercial.pack.manage','commercial','Administrar packs','Versiona packs y elementos autorizados.'),
  ('commercial.pack.install','commercial','Instalar packs','Instala packs tenant-scoped de forma idempotente.'),
  ('commercial.methodology.read','commercial','Consultar metodologias','Consulta metodologias de riesgo versionadas.'),
  ('commercial.methodology.manage','commercial','Administrar metodologias','Administra metodologias declarativas.'),
  ('commercial.workpaper.read','commercial','Consultar papeles de trabajo','Consulta plantillas de papeles de trabajo.'),
  ('commercial.workpaper.manage','commercial','Administrar papeles de trabajo','Administra plantillas reutilizables.')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('superadmin','platform_admin')
  AND p.permission_key LIKE 'commercial.%'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, TRUE
FROM app_roles r
CROSS JOIN permissions p
WHERE r.role_key IN ('admin','tenant_admin')
  AND p.permission_key IN ('commercial.subscription.read','commercial.entitlement.read','commercial.usage.read','commercial.health.read','commercial.pack.read','commercial.methodology.read','commercial.workpaper.read')
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = TRUE, updated_at = now();

WITH family AS (
  INSERT INTO product_families (family_key, display_name, description, status)
  VALUES ('iso_saas','TCDX ISO SaaS','Producto SaaS operacional para gestion GRC e ISO.','active')
  ON CONFLICT (family_key) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = now()
  RETURNING id
), edition AS (
  INSERT INTO commercial_editions (family_id, edition_key, display_name, description, status)
  SELECT id, 'standard_commercial', 'Edicion comercial base', 'Edicion editable para contratos vigentes.', 'active'
  FROM family
  ON CONFLICT (edition_key) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = now()
  RETURNING id
)
INSERT INTO commercial_plans (edition_id, plan_key, display_name, description, status)
SELECT edition.id, plan_key, display_name, description, 'active'
FROM edition
CROSS JOIN (VALUES
  ('legacy','Legacy compatible','Plan de compatibilidad para contratos existentes.'),
  ('demo','Demo controlado','Plan operacional acotado para evaluacion controlada.'),
  ('pyme','Pyme','Plan editable para empresas de menor alcance.'),
  ('empresa','Empresa','Plan editable para operacion empresarial.'),
  ('enterprise','Enterprise','Plan editable para operacion avanzada.')
) AS plan_seed(plan_key, display_name, description)
ON CONFLICT (plan_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = 'active', updated_at = now();

INSERT INTO commercial_modules (module_key, display_name, description, sort_order, status)
VALUES
  ('core','Core operativo','Base operativa multi-tenant.',10,'active'),
  ('grc_core','GRC central','Workflow, evidencias y auditoria.',20,'active'),
  ('integrated_grc','GRC integrado','Privacidad, incidentes, TPRM y conectores controlados.',30,'active'),
  ('operations_grc','Operacion GRC','Procesos, servicios, BIA y continuidad.',40,'active'),
  ('risk_manager','Risk Manager','Riesgo operacional y cuantitativo.',50,'active'),
  ('ai_compliance','IA Compliance','Inteligencia asistida y limites.',60,'active'),
  ('premium_reports','Reportes Premium','Exportaciones ejecutivas.',70,'active'),
  ('audit_workpapers','Papeles de trabajo','Estructuras reutilizables de auditoria.',80,'active')
ON CONFLICT (module_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, status = 'active', updated_at = now();

INSERT INTO commercial_features (feature_key, display_name, description, status)
VALUES
  ('core.dashboard','Dashboard operativo','Resumen operacional.', 'active'),
  ('core.reports','Reportes operacionales','Reportes base.', 'active'),
  ('grc.phase1','Nucleo GRC avanzado','Workflow, evidencias y auditoria.', 'active'),
  ('grc.phase2','GRC integrado','Privacidad, incidentes, TPRM y conectores.', 'active'),
  ('grc.phase3','Operacion integrada','Procesos, BIA, continuidad e importaciones.', 'active'),
  ('imports.excel','Importacion Excel','Motor universal de importacion.', 'active'),
  ('ai.compliance','IA Compliance','Analisis asistido con limites.', 'active'),
  ('reports.premium','Reportes Premium','Exportacion PDF y ZIP.', 'active'),
  ('tprm.suppliers','Proveedores y terceros','Gestion TPRM.', 'active'),
  ('risk.quantitative','Riesgo cuantitativo','Analisis cuantitativo.', 'active'),
  ('methodology.risk','Metodologias de riesgo','Metodologias versionadas.', 'active'),
  ('workpapers.audit','Papeles de trabajo','Plantillas reutilizables.', 'active')
ON CONFLICT (feature_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = 'active', updated_at = now();

INSERT INTO commercial_technical_capabilities (capability_key, display_name, description, required_permission, status)
SELECT feature_key, display_name, description,
  CASE
    WHEN feature_key LIKE 'ai.%' THEN 'commercial.entitlement.read'
    WHEN feature_key LIKE 'imports.%' THEN 'operations.import'
    WHEN feature_key LIKE 'reports.%' THEN 'grc.export.generate'
    ELSE 'commercial.entitlement.read'
  END,
  'active'
FROM commercial_features
ON CONFLICT (capability_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, required_permission = EXCLUDED.required_permission, status = 'active', updated_at = now();

INSERT INTO module_features (module_key, feature_key)
VALUES
  ('core','core.dashboard'),('core','core.reports'),('grc_core','grc.phase1'),
  ('integrated_grc','grc.phase2'),('integrated_grc','tprm.suppliers'),
  ('operations_grc','grc.phase3'),('operations_grc','imports.excel'),
  ('risk_manager','risk.quantitative'),('risk_manager','methodology.risk'),
  ('ai_compliance','ai.compliance'),('premium_reports','reports.premium'),('audit_workpapers','workpapers.audit')
ON CONFLICT (module_key, feature_key) DO NOTHING;

INSERT INTO feature_capabilities (feature_key, capability_key)
SELECT feature_key, feature_key FROM commercial_features
ON CONFLICT (feature_key, capability_key) DO NOTHING;

WITH versions AS (
  INSERT INTO commercial_plan_versions (plan_id, plan_key, version_number, status, effective_from, metadata)
  SELECT id, plan_key, 1, 'published', now(), jsonb_build_object('seed', 'phase4')
  FROM commercial_plans
  WHERE plan_key IN ('legacy','demo','pyme','empresa','enterprise')
  ON CONFLICT (plan_id, version_number) DO NOTHING
  RETURNING id, plan_key
), all_versions AS (
  SELECT id, plan_key FROM versions
  UNION ALL
  SELECT cpv.id, cpv.plan_key
  FROM commercial_plan_versions cpv
  JOIN commercial_plans cp ON cp.id = cpv.plan_id
  WHERE cp.plan_key IN ('legacy','demo','pyme','empresa','enterprise') AND cpv.version_number = 1
)
INSERT INTO plan_version_modules (plan_version_id, module_key, included)
SELECT id, module_key, true
FROM all_versions
CROSS JOIN LATERAL (
  SELECT unnest(CASE plan_key
    WHEN 'demo' THEN ARRAY['core','grc_core']
    WHEN 'pyme' THEN ARRAY['core','grc_core','operations_grc','risk_manager']
    WHEN 'empresa' THEN ARRAY['core','grc_core','integrated_grc','operations_grc','risk_manager','premium_reports']
    WHEN 'enterprise' THEN ARRAY['core','grc_core','integrated_grc','operations_grc','risk_manager','ai_compliance','premium_reports','audit_workpapers']
    ELSE ARRAY['core','grc_core','integrated_grc','operations_grc','risk_manager','ai_compliance','premium_reports','audit_workpapers']
  END) AS module_key
) modules
ON CONFLICT (plan_version_id, module_key) DO NOTHING;

INSERT INTO usage_limit_definitions (resource_key, display_name, description, default_limit, unit, period, warning_threshold, enforcement)
VALUES
  ('active_users','Usuarios activos','Usuarios activos del tenant.',25,'count','month',0.8,'block'),
  ('active_standards','Normas activas','Normas activas contratadas.',3,'count','month',0.8,'block'),
  ('premium_modules','Modulos premium','Modulos premium habilitados.',6,'count','month',0.8,'block'),
  ('evidence_files','Archivos de evidencia','Cantidad de archivos de evidencia.',5000,'count','month',0.8,'warn'),
  ('storage_bytes','Almacenamiento','Bytes almacenados.',10737418240,'bytes','month',0.8,'warn'),
  ('imports_monthly','Importaciones mensuales','Lotes de importacion por mes.',25,'count','month',0.8,'block'),
  ('exports_monthly','Exportaciones mensuales','Exportaciones por mes.',50,'count','month',0.8,'block'),
  ('ai_requests_monthly','Consultas IA mensuales','Solicitudes IA por mes.',500,'count','month',0.8,'block'),
  ('external_lookups_monthly','Consultas externas mensuales','Consultas externas por mes.',250,'count','month',0.8,'block'),
  ('api_calls_monthly','Llamadas API mensuales','Llamadas API medidas.',25000,'count','month',0.8,'warn')
ON CONFLICT (resource_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, default_limit = EXCLUDED.default_limit, updated_at = now();

WITH active_contracts AS (
  SELECT DISTINCT ON (tenant_id)
    tenant_id,
    COALESCE(NULLIF(plan_key, ''), 'legacy') AS plan_key,
    COALESCE(contract_status, 'active') AS contract_status,
    started_at,
    ends_at,
    metadata
  FROM tenant_contracts
  ORDER BY tenant_id, created_at DESC NULLS LAST
), fallback_tenants AS (
  SELECT t.id AS tenant_id, 'legacy'::text AS plan_key, 'active'::text AS contract_status, NULL::date AS started_at, NULL::date AS ends_at, '{}'::jsonb AS metadata
  FROM tenants t
  WHERE NOT EXISTS (SELECT 1 FROM active_contracts ac WHERE ac.tenant_id = t.id)
), contract_source AS (
  SELECT * FROM active_contracts
  UNION ALL
  SELECT * FROM fallback_tenants
), chosen_plan AS (
  SELECT cs.*, COALESCE(cpv_exact.id, cpv_legacy.id) AS plan_version_id, COALESCE(cpv_exact.plan_key, 'legacy') AS resolved_plan_key
  FROM contract_source cs
  LEFT JOIN commercial_plan_versions cpv_exact ON cpv_exact.plan_key = cs.plan_key AND cpv_exact.status = 'published'
  LEFT JOIN commercial_plan_versions cpv_legacy ON cpv_legacy.plan_key = 'legacy' AND cpv_legacy.status = 'published'
)
INSERT INTO tenant_subscriptions (tenant_id, plan_version_id, plan_key, status, started_at, ended_at, metadata)
SELECT tenant_id, plan_version_id, resolved_plan_key,
  CASE WHEN contract_status IN ('trial','active','suspended','cancelled') THEN CASE WHEN contract_status = 'trial' THEN 'trialing' ELSE contract_status END ELSE 'active' END,
  COALESCE(started_at::timestamptz, now()),
  ends_at::timestamptz,
  jsonb_build_object('source', 'tenant_contracts_compatibility', 'legacy_plan_key', plan_key) || COALESCE(metadata, '{}'::jsonb)
FROM chosen_plan
WHERE plan_version_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = chosen_plan.tenant_id AND ts.status IN ('active','trialing','past_due','suspended'));

INSERT INTO tenant_usage_limits (tenant_id, resource_key, limit_value, warning_threshold, enforcement)
SELECT t.id, u.resource_key, u.default_limit, u.warning_threshold, u.enforcement
FROM tenants t
CROSS JOIN usage_limit_definitions u
ON CONFLICT (tenant_id, resource_key) DO NOTHING;

INSERT INTO pack_definitions (pack_key, display_name, pack_type, description, status, licensed_text_included, content_classification)
VALUES
  ('implementation_quickstart','Acelerador quickstart','implementation','Configuracion tecnica generica para inicio operativo.','published',FALSE,'internal_methodology'),
  ('implementation_standard','Acelerador standard','implementation','Onboarding ampliado y pasos operativos reutilizables.','published',FALSE,'internal_methodology'),
  ('methodology_iso31000_qualitative','Metodologia cualitativa ISO 31000','methodology','Escalas y matriz cualitativa propia referenciada a buenas practicas.','published',FALSE,'internal_methodology'),
  ('template_audit_workpapers_base','Papeles de trabajo base','template','Estructuras genericas de papeles de trabajo reutilizables.','published',FALSE,'internal_methodology'),
  ('regulatory_reference_library','Biblioteca regulatoria referencial','regulatory','Infraestructura para referencias autorizadas; no instalable hasta completar contenido autorizado.','draft',FALSE,'reference_only')
ON CONFLICT (pack_key) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, status = EXCLUDED.status, licensed_text_included = EXCLUDED.licensed_text_included, content_classification = EXCLUDED.content_classification, updated_at = now();

INSERT INTO pack_versions (pack_id, version_number, status, metadata)
SELECT id, 1, CASE WHEN status = 'published' THEN 'published' ELSE 'draft' END, jsonb_build_object('seed','phase4')
FROM pack_definitions
ON CONFLICT (pack_id, version_number) DO NOTHING;

INSERT INTO pack_items (pack_version_id, item_key, item_type, item_order, content_classification, licensed_text_included, payload)
SELECT pv.id, item_key, item_type, item_order, 'internal_methodology', FALSE, payload
FROM pack_versions pv
JOIN pack_definitions pd ON pd.id = pv.pack_id
CROSS JOIN LATERAL (
  VALUES
    ('operational_checklist','checklist',10,jsonb_build_object('sections', ARRAY['configuracion','usuarios','normas','validacion'])),
    ('tenant_health_review','health_rule',20,jsonb_build_object('rule','deterministic_health_review'))
) AS seed(item_key, item_type, item_order, payload)
WHERE pd.pack_key IN ('implementation_quickstart','implementation_standard')
ON CONFLICT (pack_version_id, item_key) DO NOTHING;

INSERT INTO risk_methodology_versions (methodology_key, version_number, status, display_name, definition)
VALUES ('iso31000_qualitative', 1, 'published', 'Matriz cualitativa base', jsonb_build_object(
  'scales', jsonb_build_object('impact', ARRAY[1,2,3,4,5], 'likelihood', ARRAY[1,2,3,4,5]),
  'scoring', jsonb_build_object('steps', jsonb_build_array(jsonb_build_object('operator','multiply','left','impact','right','likelihood'))),
  'thresholds', jsonb_build_array(
    jsonb_build_object('level','low','max',6),
    jsonb_build_object('level','medium','max',12),
    jsonb_build_object('level','high','max',20),
    jsonb_build_object('level','critical','max',25)
  )
))
ON CONFLICT (methodology_key, version_number) DO NOTHING;

INSERT INTO audit_workpaper_template_versions (template_key, version_number, status, display_name, sections, fields)
VALUES ('base_internal_audit_workpaper', 1, 'published', 'Papel de trabajo base',
  jsonb_build_array(jsonb_build_object('key','scope','label','Alcance'), jsonb_build_object('key','test','label','Prueba'), jsonb_build_object('key','result','label','Resultado')),
  jsonb_build_array(jsonb_build_object('key','objective','type','text'), jsonb_build_object('key','sample','type','text'), jsonb_build_object('key','conclusion','type','textarea'))
)
ON CONFLICT (template_key, version_number) DO NOTHING;

CREATE OR REPLACE VIEW v_commercial_plan_capabilities AS
SELECT DISTINCT
  cp.plan_key,
  cpv.id AS plan_version_id,
  cpv.version_number,
  cm.module_key,
  cf.feature_key,
  ctc.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  true AS enabled
FROM commercial_plans cp
JOIN commercial_plan_versions cpv ON cpv.plan_id = cp.id AND cpv.status = 'published'
JOIN plan_version_modules pvm ON pvm.plan_version_id = cpv.id AND pvm.included = true
JOIN commercial_modules cm ON cm.module_key = pvm.module_key AND cm.status = 'active'
JOIN module_features mf ON mf.module_key = cm.module_key
JOIN commercial_features cf ON cf.feature_key = mf.feature_key AND cf.status = 'active'
JOIN feature_capabilities fc ON fc.feature_key = cf.feature_key
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = fc.capability_key AND ctc.status = 'active';

CREATE OR REPLACE VIEW v_commercial_tenant_subscription AS
SELECT DISTINCT ON (ts.tenant_id)
  ts.*,
  cp.display_name AS plan_display_name,
  cpv.version_number,
  cpv.effective_from AS plan_effective_from
FROM tenant_subscriptions ts
JOIN commercial_plan_versions cpv ON cpv.id = ts.plan_version_id
JOIN commercial_plans cp ON cp.id = cpv.plan_id
WHERE ts.status IN ('active','trialing','past_due','suspended')
ORDER BY ts.tenant_id, ts.started_at DESC, ts.created_at DESC;

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
JOIN commercial_modules cm ON cm.module_key = pvm.module_key AND cm.status = 'active';

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

CREATE OR REPLACE VIEW v_commercial_tenant_health AS
SELECT
  t.id AS tenant_id,
  jsonb_build_object(
    'status', CASE
      WHEN COALESCE(t.service_status, 'active') IN ('suspended','cancelled') THEN 'suspended'
      WHEN COALESCE(limit_pressure.pressure, 0) >= 0.9 THEN 'at_risk'
      WHEN vts.id IS NULL THEN 'attention'
      ELSE 'healthy'
    END,
    'score', GREATEST(0, LEAST(100,
      100
      - CASE WHEN vts.id IS NULL THEN 35 ELSE 0 END
      - CASE WHEN COALESCE(limit_pressure.pressure, 0) >= 0.9 THEN 25 WHEN COALESCE(limit_pressure.pressure, 0) >= 0.8 THEN 10 ELSE 0 END
      - CASE WHEN COALESCE(t.service_status, 'active') IN ('suspended','cancelled') THEN 60 ELSE 0 END
    )),
    'factors', jsonb_build_array(
      jsonb_build_object('key','subscription_status','status',COALESCE(vts.status,'missing'),'weight',25),
      jsonb_build_object('key','limit_pressure','status',COALESCE(limit_pressure.pressure,0),'weight',20),
      jsonb_build_object('key','module_activation_completion','status',COALESCE(module_count.count,0),'weight',20)
    ),
    'recommended_actions', CASE WHEN vts.id IS NULL THEN jsonb_build_array('Asignar plan comercial vigente') ELSE jsonb_build_array() END,
    'calculated_at', now()
  ) AS health
FROM tenants t
LEFT JOIN v_commercial_tenant_subscription vts ON vts.tenant_id = t.id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS count FROM v_commercial_tenant_modules vtm WHERE vtm.tenant_id = t.id
) module_count ON true
LEFT JOIN LATERAL (
  SELECT MAX(CASE WHEN tul.limit_value IS NULL OR tul.limit_value = 0 THEN 0 ELSE LEAST(1, COALESCE(um.quantity,0) / tul.limit_value) END) AS pressure
  FROM tenant_usage_limits tul
  LEFT JOIN LATERAL (
    SELECT quantity FROM usage_measurements um
    WHERE um.tenant_id = tul.tenant_id AND um.resource_key = tul.resource_key
    ORDER BY um.updated_at DESC LIMIT 1
  ) um ON true
  WHERE tul.tenant_id = t.id AND tul.status = 'active'
) limit_pressure ON true;

CREATE OR REPLACE VIEW v_tenant_commercial_entitlements AS
SELECT * FROM v_commercial_tenant_capabilities;

COMMIT;
