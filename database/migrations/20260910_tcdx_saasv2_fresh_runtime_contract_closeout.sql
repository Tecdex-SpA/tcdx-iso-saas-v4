BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(844332, 2026091004) THEN
    RAISE EXCEPTION 'TCDX SaaSv2 fresh runtime contract closeout lock unavailable';
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS avatar text;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rut text,
  ADD COLUMN IF NOT EXISTS business text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS branches text,
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_web_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auditor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_monthly_quota integer NOT NULL DEFAULT 0 CHECK (ai_monthly_quota >= 0),
  ADD COLUMN IF NOT EXISTS ai_quota_used integer NOT NULL DEFAULT 0 CHECK (ai_quota_used >= 0),
  ADD COLUMN IF NOT EXISTS ai_features_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS suspended_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_rut_runtime ON tenants (lower(rut)) WHERE rut IS NOT NULL;

CREATE OR REPLACE FUNCTION unaccent_safe(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    COALESCE(value, ''),
    'áéíóúÁÉÍÓÚñÑüÜ',
    'aeiouAEIOUnNuU'
  )
$$;

CREATE OR REPLACE FUNCTION runtime_tenant_slug_base(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(regexp_replace(lower(unaccent_safe(value)), '[^a-z0-9]+', '-', 'g'), ''), 'tenant')
$$;

CREATE OR REPLACE FUNCTION ensure_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix integer := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    NEW.slug := lower(regexp_replace(btrim(NEW.slug), '[^a-zA-Z0-9]+', '-', 'g'));
    RETURN NEW;
  END IF;

  base_slug := trim(both '-' FROM runtime_tenant_slug_base(COALESCE(NEW.name, 'tenant')));
  IF base_slug = '' THEN
    base_slug := 'tenant';
  END IF;

  candidate := base_slug;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.slug = candidate
        AND (NEW.id IS NULL OR t.id IS DISTINCT FROM NEW.id)
    );
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix::text;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tenants_ensure_slug ON tenants;
CREATE TRIGGER trg_tenants_ensure_slug
BEFORE INSERT OR UPDATE OF name, slug ON tenants
FOR EACH ROW
EXECUTE FUNCTION ensure_tenant_slug();

ALTER TABLE saas_modules
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE commercial_plans
  ADD COLUMN IF NOT EXISTS edition_id uuid,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE commercial_plans
SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'retired' END
WHERE status IS NULL;

ALTER TABLE commercial_plan_versions
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES commercial_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS effective_until timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE commercial_plan_versions cpv
SET plan_id = cp.id
FROM commercial_plans cp
WHERE cp.plan_key = cpv.plan_key
  AND cpv.plan_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM commercial_plan_versions
    WHERE plan_id IS NOT NULL
    GROUP BY plan_id, version_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'commercial_plan_versions has duplicate plan_id/version_number pairs';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ux_commercial_plan_versions_plan_id_version_number'
      AND conrelid = 'commercial_plan_versions'::regclass
  ) THEN
    ALTER TABLE commercial_plan_versions
      ADD CONSTRAINT ux_commercial_plan_versions_plan_id_version_number UNIQUE (plan_id, version_number);
  END IF;
END $$;

ALTER TABLE commercial_technical_capabilities
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE commercial_technical_capabilities SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE commercial_technical_capabilities ALTER COLUMN id SET NOT NULL;
ALTER TABLE commercial_technical_capabilities ALTER COLUMN module_key DROP NOT NULL;
ALTER TABLE commercial_technical_capabilities ALTER COLUMN classification DROP NOT NULL;
ALTER TABLE commercial_technical_capabilities ALTER COLUMN classification SET DEFAULT 'runtime_capability';
CREATE UNIQUE INDEX IF NOT EXISTS ux_commercial_technical_capabilities_id ON commercial_technical_capabilities (id);

ALTER TABLE tenant_subscriptions
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM tenant_subscription_addons
    WHERE tenant_subscription_id IS NOT NULL
    GROUP BY tenant_subscription_id, addon_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'tenant_subscription_addons has duplicate tenant_subscription_id/addon_key pairs';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ux_tenant_subscription_addons_subscription_addon'
      AND conrelid = 'tenant_subscription_addons'::regclass
  ) THEN
    ALTER TABLE tenant_subscription_addons
      ADD CONSTRAINT ux_tenant_subscription_addons_subscription_addon UNIQUE (tenant_subscription_id, addon_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
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
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_commercial_plans_edition_runtime'
      AND conrelid = 'commercial_plans'::regclass
  ) THEN
    ALTER TABLE commercial_plans
      ADD CONSTRAINT fk_commercial_plans_edition_runtime
      FOREIGN KEY (edition_id) REFERENCES commercial_editions(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_commercial_plans_status_runtime'
      AND conrelid = 'commercial_plans'::regclass
  ) THEN
    ALTER TABLE commercial_plans
      ADD CONSTRAINT ck_commercial_plans_status_runtime CHECK (status IN ('draft','active','retired')) NOT VALID;
  END IF;
END $$;

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_measurements_unique_idempotent
  ON usage_measurements (tenant_id, resource_key, period_key, COALESCE(idempotency_key, ''::text));

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

CREATE TABLE IF NOT EXISTS tenant_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_key text,
  contract_status text NOT NULL DEFAULT 'active' CHECK (contract_status IN ('trial','active','suspended','cancelled','expired','terminated','inactive')),
  started_at timestamptz,
  ends_at timestamptz,
  billing_currency text NOT NULL DEFAULT 'CLP',
  commercial_notes text,
  billing_notes text,
  commercial_owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  crm_reference text,
  max_active_standards integer CHECK (max_active_standards IS NULL OR max_active_standards >= 0),
  max_premium_modules integer CHECK (max_premium_modules IS NULL OR max_premium_modules >= 0),
  external_lookup_quota integer CHECK (external_lookup_quota IS NULL OR external_lookup_quota >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_contracts_tenant_updated ON tenant_contracts (tenant_id, updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS dealer_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'commercial_partner',
  can_view_health boolean NOT NULL DEFAULT true,
  can_view_contract boolean NOT NULL DEFAULT false,
  can_request_changes boolean NOT NULL DEFAULT false,
  can_view_sensitive_evidence boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealer_user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_dealer_tenants_dealer_status ON dealer_tenants (dealer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_dealer_tenants_tenant_status ON dealer_tenants (tenant_id, status);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_tenant_created ON admin_audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created ON admin_audit_log (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saas_price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_key text NOT NULL,
  item_name text NOT NULL,
  item_description text,
  currency text NOT NULL DEFAULT 'CLP',
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  billing_frequency text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_key)
);

CREATE TABLE IF NOT EXISTS saas_monthly_prebilling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','crm_ready','exported','cancelled')),
  currency text NOT NULL DEFAULT 'CLP',
  plan_key text,
  contract_status text,
  subtotal_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  additional_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, billing_month)
);

CREATE TABLE IF NOT EXISTS saas_monthly_prebilling_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prebilling_id uuid NOT NULL REFERENCES saas_monthly_prebilling(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  line_type text NOT NULL,
  line_key text NOT NULL,
  line_name text NOT NULL,
  line_description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal_amount numeric NOT NULL DEFAULT 0,
  is_manual boolean NOT NULL DEFAULT false,
  is_discount boolean NOT NULL DEFAULT false,
  is_billable boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saas_prebilling_lines_prebilling ON saas_monthly_prebilling_lines (prebilling_id, created_at);

CREATE TABLE IF NOT EXISTS ai_core.external_lookup_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  monthly_limit integer NOT NULL DEFAULT 100 CHECK (monthly_limit >= 0),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_external_lookup_quotas_default
  ON ai_core.external_lookup_quotas (is_default) WHERE is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS ux_external_lookup_quotas_tenant
  ON ai_core.external_lookup_quotas (tenant_id) WHERE tenant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_core.external_lookup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  standard_code text,
  domain_code text,
  problem_type_code text,
  scenario_code text,
  query_text text,
  lookup_reason text,
  response_used boolean NOT NULL DEFAULT false,
  quality_score numeric,
  sources_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_lookup_logs_tenant_created ON ai_core.external_lookup_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_core.external_lookup_quota_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  old_monthly_limit integer,
  new_monthly_limit integer,
  old_is_active boolean,
  new_is_active boolean,
  old_notes text,
  new_notes text,
  change_reason text,
  source text NOT NULL DEFAULT 'admin_saas',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_lookup_quota_audit_tenant_created ON ai_core.external_lookup_quota_audit (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_core.external_lookup_extra_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  billing_month text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_amount numeric NOT NULL DEFAULT 100 CHECK (unit_amount >= 0),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  accepted boolean NOT NULL DEFAULT false,
  accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_lookup_extra_charges_tenant_month ON ai_core.external_lookup_extra_charges (tenant_id, billing_month);

INSERT INTO permissions (permission_key, permission_group, display_name, description, is_active)
VALUES
  ('admin_saas.view','admin_saas','View SaaS administration','View platform SaaS administration surfaces.',true),
  ('admin_saas.manage','admin_saas','Manage SaaS administration','Manage platform SaaS administration surfaces.',true),
  ('data.governance','data','Data governance','Access data governance surfaces.',true),
  ('data.catalog.read','data','Read data catalog','Read governed data catalog.',true),
  ('metrics.catalog','metrics','Metrics catalog','Access metrics catalog.',true),
  ('metrics.measure','metrics','Measure metrics','Run metric measurement.',true),
  ('metrics.manage','metrics','Manage metrics','Manage metric definitions and workflows.',true),
  ('metrics.validate','metrics','Validate metrics','Validate metric outputs.',true),
  ('metrics.publish','metrics','Publish metrics','Publish metric snapshots.',true),
  ('metrics.recalculate','metrics','Recalculate metrics','Recalculate metric observations.',true),
  ('metrics.indicators.technical','metrics','Technical metric indicators','Access technical indicator details.',true),
  ('metrics.methodology.manage','metrics','Manage methodology','Manage metric methodology.',true),
  ('metrics.methodology.review','metrics','Review methodology','Review metric methodology.',true),
  ('metrics.methodology.publish','metrics','Publish methodology','Publish metric methodology.',true),
  ('metrics.snapshots.publish','metrics','Publish snapshots','Publish metric snapshots.',true),
  ('metrics.comparisons.read','metrics','Read comparisons','Read metric comparisons.',true),
  ('metrics.actions.propose','metrics','Propose metric actions','Propose metric actions.',true),
  ('metrics.actions.review','metrics','Review metric actions','Review metric actions.',true),
  ('metrics.jobs.run','metrics','Run metric jobs','Run metric jobs.',true),
  ('commercial.catalog.read','commercial','Read commercial catalog','Read commercial catalog.',true),
  ('commercial.catalog.manage','commercial','Manage commercial catalog','Manage commercial catalog.',true),
  ('commercial.plan.read','commercial','Read commercial plans','Read commercial plans.',true),
  ('commercial.plan.manage','commercial','Manage commercial plans','Manage commercial plans.',true),
  ('commercial.subscription.read','commercial','Read subscriptions','Read tenant commercial subscriptions.',true),
  ('commercial.subscription.manage','commercial','Manage subscriptions','Manage tenant commercial subscriptions.',true),
  ('commercial.entitlement.manage','commercial','Manage entitlements','Manage tenant commercial entitlements.',true),
  ('commercial.entitlement.override','commercial','Override entitlements','Apply tenant commercial entitlement overrides.',true),
  ('commercial.usage.read','commercial','Read commercial usage','Read tenant commercial usage.',true),
  ('commercial.health.read','commercial','Read commercial health','Read tenant commercial health.',true),
  ('commercial.trial.manage','commercial','Manage commercial trials','Manage commercial trials.',true),
  ('commercial.pack.read','commercial','Read commercial packs','Read commercial packs.',true),
  ('commercial.pack.manage','commercial','Manage commercial packs','Manage commercial packs.',true),
  ('commercial.pack.install','commercial','Install commercial packs','Install commercial packs.',true),
  ('commercial.methodology.read','commercial','Read methodologies','Read commercial methodologies.',true),
  ('commercial.methodology.manage','commercial','Manage methodologies','Manage commercial methodologies.',true),
  ('commercial.workpaper.read','commercial','Read workpapers','Read workpaper templates.',true),
  ('commercial.workpaper.manage','commercial','Manage workpapers','Manage workpaper templates.',true)
ON CONFLICT (permission_key) DO UPDATE SET
  permission_group = EXCLUDED.permission_group,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT ar.role_key, p.permission_key, true
FROM app_roles ar
JOIN permissions p ON p.is_active IS DISTINCT FROM false
WHERE ar.role_key = 'platform_admin'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT ar.role_key, p.permission_key, true
FROM app_roles ar
JOIN permissions p ON p.permission_key IN (
  'commercial.subscription.read',
  'commercial.entitlement.read',
  'commercial.usage.read',
  'commercial.health.read',
  'commercial.pack.read',
  'commercial.methodology.read',
  'commercial.workpaper.read',
  'metrics.read',
  'metrics.catalog.read'
)
WHERE ar.role_key = 'tenant_admin'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

WITH module_candidates AS (
  SELECT
    COALESCE(module_key, capability_key) AS module_key,
    COALESCE(NULLIF(module_key, ''), capability_key) AS display_name,
    2 AS source_priority
  FROM commercial_technical_capabilities
  WHERE COALESCE(module_key, capability_key) IS NOT NULL

  UNION ALL

  SELECT
    module_key,
    display_name,
    1 AS source_priority
  FROM saas_modules
  WHERE module_key IS NOT NULL
),
modules AS (
  SELECT DISTINCT ON (module_key)
    module_key,
    display_name
  FROM module_candidates
  WHERE NULLIF(TRIM(module_key), '') IS NOT NULL
  ORDER BY
    module_key,
    source_priority,
    display_name
)
INSERT INTO commercial_modules (
  module_key,
  display_name,
  description,
  sort_order,
  status,
  metadata
)
SELECT
  module_key,
  display_name,
  'Fresh runtime module contract',
  500,
  'active',
  '{"source":"fresh_runtime_contract_closeout"}'::jsonb
FROM modules
ON CONFLICT (module_key) DO UPDATE SET
  display_name = COALESCE(
    commercial_modules.display_name,
    EXCLUDED.display_name
  ),
  status = 'active',
  updated_at = now();

INSERT INTO commercial_features (feature_key, display_name, description, status, metadata)
SELECT capability_key, COALESCE(display_name, capability_key), COALESCE(description, 'Fresh runtime feature contract'), 'active', '{"source":"fresh_runtime_contract_closeout"}'::jsonb
FROM commercial_technical_capabilities
ON CONFLICT (feature_key) DO UPDATE SET
  display_name = COALESCE(commercial_features.display_name, EXCLUDED.display_name),
  status = 'active',
  updated_at = now();

INSERT INTO module_features (module_key, feature_key)
SELECT COALESCE(ctc.module_key, ctc.capability_key), ctc.capability_key
FROM commercial_technical_capabilities ctc
JOIN commercial_modules cm ON cm.module_key = COALESCE(ctc.module_key, ctc.capability_key)
JOIN commercial_features cf ON cf.feature_key = ctc.capability_key
ON CONFLICT (module_key, feature_key) DO NOTHING;

INSERT INTO feature_capabilities (feature_key, capability_key)
SELECT capability_key, capability_key
FROM commercial_technical_capabilities
ON CONFLICT (feature_key, capability_key) DO NOTHING;

INSERT INTO plan_version_modules (plan_version_id, module_key, included)
SELECT DISTINCT pvc.plan_version_id, COALESCE(ctc.module_key, ctc.capability_key), true
FROM plan_version_capabilities pvc
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = pvc.capability_key
JOIN commercial_modules cm ON cm.module_key = COALESCE(ctc.module_key, ctc.capability_key)
WHERE pvc.is_included IS DISTINCT FROM false
ON CONFLICT (plan_version_id, module_key) DO UPDATE SET included = true, updated_at = now();

CREATE OR REPLACE FUNCTION get_user_effective_permissions(requested_user_id uuid)
RETURNS TABLE(permission_key text, permission_group text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH user_role AS (
    SELECT CASE lower(COALESCE(NULLIF(effective_role, ''), role))
      WHEN 'superadmin' THEN 'platform_admin'
      WHEN 'super_admin' THEN 'platform_admin'
      WHEN 'global_admin' THEN 'platform_admin'
      WHEN 'admin_global' THEN 'platform_admin'
      WHEN 'admin' THEN 'tenant_admin'
      WHEN 'operativo' THEN 'area_owner'
      ELSE lower(COALESCE(NULLIF(effective_role, ''), role))
    END AS role_key
    FROM users
    WHERE id = requested_user_id
      AND status = 'active'
    LIMIT 1
  )
  SELECT p.permission_key, p.permission_group, p.display_name
  FROM user_role ur
  JOIN role_permissions rp
    ON rp.role_key = ur.role_key
   AND rp.is_allowed = true
  JOIN permissions p
    ON p.permission_key = rp.permission_key
   AND p.is_active IS DISTINCT FROM false
  JOIN app_roles ar
    ON ar.role_key = ur.role_key
   AND ar.is_active IS DISTINCT FROM false
  ORDER BY p.permission_group, p.permission_key
$$;

CREATE OR REPLACE FUNCTION user_has_permission(requested_user_id uuid, requested_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM get_user_effective_permissions(requested_user_id) p
    WHERE p.permission_key = requested_permission
  ), false)
$$;

CREATE OR REPLACE FUNCTION log_admin_audit_event(
  actor_user_id uuid,
  action text,
  tenant_id uuid,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF action IS NULL OR btrim(action) = '' THEN
    RAISE EXCEPTION 'admin audit action is required';
  END IF;

  INSERT INTO admin_audit_log (
    actor_user_id,
    action,
    tenant_id,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    actor_user_id,
    action,
    tenant_id,
    entity_type,
    entity_id,
    COALESCE(details, '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

CREATE OR REPLACE VIEW v_dealer_tenants AS
SELECT
  dt.id,
  dt.dealer_user_id,
  COALESCE(du.full_name, du.name) AS dealer_name,
  du.email AS dealer_email,
  dt.tenant_id,
  t.name AS tenant_name,
  dt.relationship_type,
  dt.can_view_health,
  dt.can_view_contract,
  dt.can_request_changes,
  dt.can_view_sensitive_evidence,
  dt.status,
  dt.assigned_at,
  dt.revoked_at,
  dt.metadata
FROM dealer_tenants dt
JOIN users du ON du.id = dt.dealer_user_id
JOIN tenants t ON t.id = dt.tenant_id;

CREATE OR REPLACE VIEW v_tenant_modules AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  sm.module_key,
  sm.display_name AS module_name,
  sm.description AS module_description,
  sm.sort_order,
  COALESCE(tms.is_enabled, tms.enabled, sm.default_enabled, false) AS is_enabled,
  tms.enabled_at,
  tms.disabled_at,
  tms.notes,
  COALESCE(tms.metadata, '{}'::jsonb) AS metadata
FROM tenants t
CROSS JOIN saas_modules sm
LEFT JOIN tenant_module_settings tms
  ON tms.tenant_id = t.id
 AND tms.module_key = sm.module_key
WHERE sm.is_active IS DISTINCT FROM false
  AND COALESCE(sm.status, 'active') = 'active';

CREATE OR REPLACE VIEW v_tenant_contract_overview AS
SELECT DISTINCT ON (t.id)
  t.id AS tenant_id,
  t.name AS tenant_name,
  tc.id AS contract_id,
  tc.plan_key,
  tc.contract_status,
  tc.started_at,
  tc.ends_at,
  tc.billing_currency,
  tc.commercial_notes,
  tc.billing_notes,
  tc.crm_reference,
  tc.max_active_standards,
  tc.max_premium_modules,
  tc.external_lookup_quota,
  tc.metadata,
  tc.created_at,
  tc.updated_at
FROM tenants t
LEFT JOIN tenant_contracts tc ON tc.tenant_id = t.id
ORDER BY t.id, tc.updated_at DESC NULLS LAST, tc.created_at DESC NULLS LAST;

CREATE OR REPLACE VIEW v_admin_saas_summary AS
SELECT
  COUNT(*)::int AS total_tenants,
  COUNT(*) FILTER (WHERE service_status = 'active')::int AS active_tenants,
  COUNT(*) FILTER (WHERE service_status LIKE 'suspended%')::int AS suspended_tenants,
  COUNT(*) FILTER (WHERE service_status IN ('deleted','cancelled'))::int AS inactive_tenants,
  COUNT(*) FILTER (WHERE ai_enabled = true)::int AS ai_enabled_tenants,
  COALESCE(SUM(ai_quota_used), 0)::int AS ai_quota_used,
  COALESCE(SUM(ai_monthly_quota), 0)::int AS ai_monthly_quota
FROM tenants;

CREATE OR REPLACE VIEW ai_core.v_external_lookup_usage_monthly AS
SELECT
  tenant_id,
  date_trunc('month', created_at)::date AS usage_month,
  count(*)::int AS used_count,
  max(created_at) AS last_lookup_at
FROM ai_core.external_lookup_logs
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, date_trunc('month', created_at)::date;

DROP VIEW IF EXISTS
  v_saas_prebilling_tenant_context,
  v_commercial_tenant_health,
  v_tenant_commercial_entitlements,
  v_commercial_tenant_capabilities,
  v_commercial_tenant_modules,
  v_commercial_tenant_subscription,
  v_commercial_plan_capabilities;

CREATE OR REPLACE VIEW v_commercial_plan_capabilities AS
SELECT DISTINCT
  COALESCE(cp.plan_key, cpv.plan_key) AS plan_key,
  cpv.id AS plan_version_id,
  cpv.version_number,
  COALESCE(ctc.module_key, ctc.capability_key) AS module_key,
  ctc.capability_key AS feature_key,
  ctc.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  COALESCE(pvc.is_included, true) AS enabled
FROM commercial_plan_versions cpv
LEFT JOIN commercial_plans cp ON cp.id = cpv.plan_id OR cp.plan_key = cpv.plan_key
JOIN plan_version_capabilities pvc ON pvc.plan_version_id = cpv.id
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = pvc.capability_key
WHERE cpv.status = 'published'
  AND pvc.is_included IS DISTINCT FROM false
UNION
SELECT DISTINCT
  COALESCE(cp.plan_key, cpv.plan_key) AS plan_key,
  cpv.id AS plan_version_id,
  cpv.version_number,
  pvm.module_key,
  cf.feature_key,
  ctc.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  pvm.included AS enabled
FROM commercial_plan_versions cpv
LEFT JOIN commercial_plans cp ON cp.id = cpv.plan_id OR cp.plan_key = cpv.plan_key
JOIN plan_version_modules pvm ON pvm.plan_version_id = cpv.id AND pvm.included = true
JOIN module_features mf ON mf.module_key = pvm.module_key
JOIN commercial_features cf ON cf.feature_key = mf.feature_key AND cf.status = 'active'
JOIN feature_capabilities fc ON fc.feature_key = cf.feature_key
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = fc.capability_key
WHERE cpv.status = 'published';

CREATE OR REPLACE VIEW v_commercial_tenant_subscription AS
SELECT DISTINCT ON (ts.tenant_id)
  ts.*,
  COALESCE(cp.display_name, ts.plan_key) AS plan_display_name,
  cpv.version_number,
  cpv.effective_from AS plan_effective_from
FROM tenant_subscriptions ts
LEFT JOIN commercial_plan_versions cpv ON cpv.id = ts.plan_version_id
LEFT JOIN commercial_plans cp ON cp.plan_key = COALESCE(cpv.plan_key, ts.plan_key)
WHERE ts.status IN ('active','trialing','past_due','suspended')
ORDER BY ts.tenant_id, ts.started_at DESC, ts.created_at DESC;

CREATE OR REPLACE VIEW v_commercial_tenant_modules AS
SELECT DISTINCT
  vts.tenant_id,
  vts.plan_key,
  pc.module_key,
  COALESCE(cm.display_name, sm.display_name, pc.module_key) AS display_name,
  COALESCE(cm.description, sm.description) AS description,
  COALESCE(cm.sort_order, sm.sort_order, 500) AS sort_order,
  true AS enabled,
  'plan'::text AS source
FROM v_commercial_tenant_subscription vts
JOIN v_commercial_plan_capabilities pc ON pc.plan_version_id = vts.plan_version_id AND pc.enabled = true
LEFT JOIN commercial_modules cm ON cm.module_key = pc.module_key
LEFT JOIN saas_modules sm ON sm.module_key = pc.module_key;

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
  tfo.tenant_id,
  tfo.capability_key,
  ctc.required_permission,
  ctc.dependencies,
  tfo.enabled,
  tfo.read_only,
  'override'::text,
  tfo.valid_from,
  tfo.valid_until,
  COALESCE(ctc.module_key, tfo.capability_key) AS module_key
FROM tenant_feature_overrides tfo
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = tfo.capability_key
WHERE tfo.status = 'active' AND (tfo.valid_until IS NULL OR tfo.valid_until > now())
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
  COALESCE(ctc.module_key, tr.capability_key) AS module_key
FROM trials tr
JOIN commercial_technical_capabilities ctc ON ctc.capability_key = tr.capability_key
WHERE tr.status = 'active' AND tr.ends_at > now();

CREATE OR REPLACE VIEW v_tenant_commercial_entitlements AS
SELECT * FROM v_commercial_tenant_capabilities;

CREATE OR REPLACE VIEW v_commercial_tenant_health AS
SELECT
  t.id AS tenant_id,
  jsonb_build_object(
    'status', CASE
      WHEN COALESCE(t.service_status, 'active') IN ('suspended','suspended_non_payment','cancelled') THEN 'suspended'
      WHEN vts.id IS NULL THEN 'attention'
      ELSE 'healthy'
    END,
    'score', CASE
      WHEN COALESCE(t.service_status, 'active') IN ('suspended','suspended_non_payment','cancelled') THEN 40
      WHEN vts.id IS NULL THEN 65
      ELSE 100
    END,
    'calculated_at', now()
  ) AS health
FROM tenants t
LEFT JOIN v_commercial_tenant_subscription vts ON vts.tenant_id = t.id;

CREATE OR REPLACE VIEW v_saas_prebilling_tenant_context AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.rut,
  COALESCE(tc.plan_key, vts.plan_key, t.ai_plan, 'demo') AS plan_key,
  COALESCE(tc.contract_status, vts.status, t.service_status) AS contract_status,
  COALESCE(active_standards.count, 0)::int AS active_standards,
  COALESCE(enabled_modules.count, 0)::int AS enabled_modules,
  COALESCE(q.monthly_limit, dq.monthly_limit, 100)::int AS external_lookup_monthly_limit,
  COALESCE(u.used_count, 0)::int AS external_lookup_used_month,
  GREATEST(COALESCE(q.monthly_limit, dq.monthly_limit, 100) - COALESCE(u.used_count, 0), 0)::int AS external_lookup_remaining_month,
  u.last_lookup_at AS external_lookup_last_lookup_at
FROM tenants t
LEFT JOIN LATERAL (
  SELECT *
  FROM tenant_contracts tc
  WHERE tc.tenant_id = t.id
  ORDER BY tc.updated_at DESC NULLS LAST, tc.created_at DESC NULLS LAST
  LIMIT 1
) tc ON true
LEFT JOIN v_commercial_tenant_subscription vts ON vts.tenant_id = t.id
LEFT JOIN ai_core.external_lookup_quotas q ON q.tenant_id = t.id
LEFT JOIN LATERAL (
  SELECT monthly_limit
  FROM ai_core.external_lookup_quotas
  WHERE is_default = true AND is_active = true
  LIMIT 1
) dq ON true
LEFT JOIN LATERAL (
  SELECT used_count, last_lookup_at
  FROM ai_core.v_external_lookup_usage_monthly
  WHERE tenant_id = t.id
    AND usage_month = date_trunc('month', now())::date
  LIMIT 1
) u ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS count
  FROM tenant_standards ts
  WHERE ts.tenant_id = t.id
    AND COALESCE(ts.is_active, true) IS DISTINCT FROM false
) active_standards ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS count
  FROM v_tenant_modules vm
  WHERE vm.tenant_id = t.id
    AND vm.is_enabled = true
) enabled_modules ON true;

GRANT USAGE ON SCHEMA public TO tcdx_backend_runtime;
GRANT USAGE ON SCHEMA ai_core TO tcdx_backend_runtime;

GRANT SELECT ON
  app_roles,
  permissions,
  role_permissions,
  v_dealer_tenants,
  v_tenant_modules,
  v_admin_saas_summary,
  v_tenant_contract_overview,
  v_commercial_plan_capabilities,
  v_commercial_tenant_subscription,
  v_commercial_tenant_modules,
  v_commercial_tenant_capabilities,
  v_tenant_commercial_entitlements,
  v_commercial_tenant_health,
  v_saas_prebilling_tenant_context
TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE ON
  users,
  tenants,
  tenant_contracts,
  dealer_tenants,
  admin_audit_log,
  product_families,
  commercial_editions,
  commercial_plans,
  commercial_plan_versions,
  commercial_modules,
  commercial_addons,
  commercial_features,
  commercial_technical_capabilities,
  plan_version_modules,
  plan_version_addons,
  module_features,
  feature_capabilities,
  tenant_subscriptions,
  tenant_subscription_addons,
  tenant_module_settings,
  tenant_feature_overrides,
  tenant_usage_limits,
  usage_measurements,
  trials,
  pack_definitions,
  pack_versions,
  pack_items,
  pack_dependencies,
  tenant_pack_installations,
  tenant_pack_installation_items,
  risk_methodology_versions,
  audit_workpaper_template_versions,
  saas_price_catalog,
  saas_monthly_prebilling,
  saas_monthly_prebilling_lines
TO tcdx_backend_runtime;

GRANT SELECT, INSERT, UPDATE ON
  ai_core.external_lookup_quotas,
  ai_core.external_lookup_logs,
  ai_core.external_lookup_quota_audit,
  ai_core.external_lookup_extra_charges
TO tcdx_backend_runtime;
GRANT SELECT ON ai_core.v_external_lookup_usage_monthly TO tcdx_backend_runtime;

GRANT EXECUTE ON FUNCTION get_user_effective_permissions(uuid) TO tcdx_backend_runtime;
GRANT EXECUTE ON FUNCTION user_has_permission(uuid, text) TO tcdx_backend_runtime;
GRANT EXECUTE ON FUNCTION log_admin_audit_event(uuid, text, uuid, text, uuid, jsonb) TO tcdx_backend_runtime;

COMMIT;
