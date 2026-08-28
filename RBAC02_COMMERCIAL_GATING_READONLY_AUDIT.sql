\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

SELECT
  (to_regclass('public.dealer_tenants') IS NOT NULL)::int AS dealer_tenants_exists,
  (to_regclass('public.dealer_tenant_access') IS NOT NULL)::int AS dealer_tenant_access_exists
\gset

\o :tenants_csv
COPY (
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    COALESCE(t.service_status, 'active') AS service_status,
    t.suspended_at,
    t.deleted_at,
    vts.plan_key,
    vts.status AS subscription_status
  FROM public.tenants t
  LEFT JOIN public.v_commercial_tenant_subscription vts ON vts.tenant_id = t.id
  ORDER BY t.name, t.id
) TO STDOUT WITH CSV HEADER;
\o

\o :users_roles_csv
COPY (
  SELECT
    u.id AS user_id,
    u.tenant_id,
    u.email,
    u.role AS raw_role,
    CASE
      WHEN lower(u.role) IN ('platform_admin','tenant_admin','auditor','area_owner','executive','dealer') THEN 'CANONICAL_ROLE'
      WHEN lower(u.role) IN ('super_admin','global_admin','admin_global') THEN 'EXACT_ALIAS'
      WHEN lower(u.role) IN ('admin_cumplimiento','compliance_admin','responsable_area','cliente','client','read_only','readonly','solo_lectura','ejecutivo') THEN 'COMPATIBILITY_MAPPING'
      WHEN lower(u.role) IN ('superadmin','owner','admin','compliance_manager','operativo','control_owner','viewer') THEN 'DEPRECATED_LEGACY_ROLE'
      ELSE 'UNKNOWN_REQUIRES_DECISION'
    END AS role_classification,
    CASE
      WHEN lower(u.role) IN ('platform_admin','super_admin','global_admin','admin_global','superadmin','owner') THEN 'platform_admin'
      WHEN lower(u.role) IN ('tenant_admin','admin','admin_cumplimiento','compliance_admin','compliance_manager') THEN 'tenant_admin'
      WHEN lower(u.role) = 'auditor' THEN 'auditor'
      WHEN lower(u.role) IN ('area_owner','operativo','responsable_area','control_owner') THEN 'area_owner'
      WHEN lower(u.role) IN ('executive','viewer','cliente','client','read_only','readonly','solo_lectura','ejecutivo') THEN 'executive'
      WHEN lower(u.role) = 'dealer' THEN 'dealer'
      ELSE NULL
    END AS canonical_semantic_role,
    true AS user_active,
    u.created_at
  FROM public.users u
  ORDER BY u.tenant_id NULLS FIRST, u.role, u.email
) TO STDOUT WITH CSV HEADER;
\o

\o :roles_catalog_csv
COPY (
  SELECT
    ar.role_key,
    ar.display_name,
    ar.role_level,
    ar.is_system,
    ar.is_active,
    CASE
      WHEN ar.role_key IN ('platform_admin','tenant_admin','auditor','area_owner','executive','dealer') THEN 'CANONICAL_ROLE'
      WHEN ar.role_key IN ('super_admin','global_admin','admin_global') THEN 'EXACT_ALIAS'
      WHEN ar.role_key IN ('admin_cumplimiento','compliance_admin','responsable_area','cliente','client','read_only','readonly','solo_lectura','ejecutivo') THEN 'COMPATIBILITY_MAPPING'
      WHEN ar.role_key IN ('superadmin','owner','admin','compliance_manager','operativo','control_owner','viewer') THEN 'DEPRECATED_LEGACY_ROLE'
      ELSE 'UNKNOWN_REQUIRES_DECISION'
    END AS role_classification
  FROM public.app_roles ar
  ORDER BY ar.role_level, ar.role_key
) TO STDOUT WITH CSV HEADER;
\o

\o :role_permissions_csv
COPY (
  SELECT
    rp.role_key,
    rp.permission_key,
    p.permission_group,
    rp.is_allowed,
    p.is_active AS permission_active
  FROM public.role_permissions rp
  LEFT JOIN public.permissions p ON p.permission_key = rp.permission_key
  ORDER BY rp.role_key, rp.permission_key
) TO STDOUT WITH CSV HEADER;
\o

\o :subscriptions_csv
COPY (
  SELECT
    ts.tenant_id,
    t.name AS tenant_name,
    ts.plan_key,
    CASE
      WHEN lower(ts.plan_key) IN ('iso','legacy','demo','pyme') THEN 'ISO'
      WHEN lower(ts.plan_key) IN ('iso_riesgo_operativo','iso_operational_risk','empresa') THEN 'ISO_RIESGO_OPERATIVO'
      WHEN lower(ts.plan_key) IN ('grc','enterprise') THEN 'GRC'
      ELSE 'UNKNOWN_REQUIRES_DECISION'
    END AS normalized_plan,
    ts.status,
    ts.started_at,
    ts.ended_at,
    ts.version,
    ts.metadata
  FROM public.tenant_subscriptions ts
  JOIN public.tenants t ON t.id = ts.tenant_id
  ORDER BY t.name, ts.started_at DESC
) TO STDOUT WITH CSV HEADER;
\o

\o :tenant_modules_csv
COPY (
  SELECT
    vtm.tenant_id,
    vtm.plan_key,
    vtm.module_key,
    vtm.display_name,
    vtm.enabled AS is_enabled,
    vtm.source
  FROM public.v_commercial_tenant_modules vtm
  ORDER BY vtm.tenant_id, vtm.module_key
) TO STDOUT WITH CSV HEADER;
\o

\o :tenant_capabilities_csv
COPY (
  SELECT
    vtc.tenant_id,
    vtc.capability_key,
    vtc.module_key,
    vtc.required_permission,
    vtc.enabled,
    vtc.read_only,
    vtc.source,
    vtc.effective_from,
    vtc.effective_until
  FROM public.v_commercial_tenant_capabilities vtc
  ORDER BY vtc.tenant_id, vtc.capability_key
) TO STDOUT WITH CSV HEADER;
\o

\if :dealer_tenants_exists
  \if :dealer_tenant_access_exists
    \o :dealer_assignments_csv
COPY (
      SELECT
        'dealer_tenants' AS source_table,
        dealer_user_id,
        tenant_id,
        status,
        created_at
      FROM public.dealer_tenants
      UNION ALL
      SELECT
        'dealer_tenant_access' AS source_table,
        dealer_user_id,
        tenant_id,
        CASE WHEN is_active THEN 'active' ELSE 'inactive' END AS status,
        created_at
      FROM public.dealer_tenant_access
      ORDER BY source_table, dealer_user_id, tenant_id
) TO STDOUT WITH CSV HEADER;
\o
  \else
    \o :dealer_assignments_csv
COPY (
      SELECT
        'dealer_tenants' AS source_table,
        dealer_user_id,
        tenant_id,
        status,
        created_at
      FROM public.dealer_tenants
      ORDER BY source_table, dealer_user_id, tenant_id
) TO STDOUT WITH CSV HEADER;
\o
  \endif
\else
  \if :dealer_tenant_access_exists
    \o :dealer_assignments_csv
COPY (
      SELECT
        'dealer_tenant_access' AS source_table,
        dealer_user_id,
        tenant_id,
        CASE WHEN is_active THEN 'active' ELSE 'inactive' END AS status,
        created_at
      FROM public.dealer_tenant_access
      ORDER BY source_table, dealer_user_id, tenant_id
) TO STDOUT WITH CSV HEADER;
\o
  \else
    \o :dealer_assignments_csv
COPY (
      SELECT
        NULL::text AS source_table,
        NULL::uuid AS dealer_user_id,
        NULL::uuid AS tenant_id,
        NULL::text AS status,
        NULL::timestamptz AS created_at
      WHERE false
) TO STDOUT WITH CSV HEADER;
\o
  \endif
\endif

\o :dashboard_access_matrix_csv
COPY (
  SELECT
    u.id AS user_id,
    u.email,
    u.tenant_id,
    u.role AS raw_role,
    vts.plan_key,
    CASE
      WHEN vts.status IS NULL THEN 'SUBSCRIPTION_INACTIVE'
      WHEN COALESCE(t.service_status, 'active') NOT IN ('active','trialing') THEN 'TENANT_INACTIVE'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.role_permissions rp
        WHERE rp.role_key = u.role AND rp.permission_key = 'dashboards.read' AND rp.is_allowed = true
      ) THEN 'RBAC_PERMISSION_MISSING'
      WHEN NOT EXISTS (
        SELECT 1 FROM public.v_commercial_tenant_capabilities vtc
        WHERE vtc.tenant_id = u.tenant_id
          AND vtc.capability_key = 'core.dashboard'
          AND vtc.enabled = true
      ) THEN 'CAPABILITY_NOT_ENTITLED'
      WHEN EXISTS (
        SELECT 1 FROM public.v_commercial_tenant_capabilities vtc
        WHERE vtc.tenant_id = u.tenant_id
          AND vtc.capability_key = 'core.dashboard'
          AND vtc.enabled = true
          AND vtc.module_key IS NOT NULL
      ) AND NOT EXISTS (
        SELECT 1 FROM public.v_commercial_tenant_modules vtm
        WHERE vtm.tenant_id = u.tenant_id
          AND vtm.module_key = 'core'
          AND vtm.enabled = true
      ) THEN 'MODULE_KEY_MISMATCH'
      ELSE 'NO_FAILURE'
    END AS dashboard_denial_classification
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  LEFT JOIN public.v_commercial_tenant_subscription vts ON vts.tenant_id = u.tenant_id
  WHERE true
  ORDER BY u.tenant_id, u.role, u.email
) TO STDOUT WITH CSV HEADER;
\o

\o :route_access_matrix_csv
COPY (
  SELECT
    route,
    route_group,
    required_permission,
    capability_key,
    module_key,
    plan_requirement,
    scope_requirement,
    mutation,
    canonical_roles_allowed,
    expected_access
  FROM (VALUES
    ('/dashboard','home','dashboards.read','core.dashboard','core','ANY_ACTIVE_COMMERCIAL_TENANT','tenant',false,'tenant_admin,auditor,area_owner,executive','ALLOW_IF_PERMISSION_AND_ACTIVE_TENANT'),
    ('/grc-global','home','workflow.read','grc.phase2','integrated_grc','GRC_OR_EXPLICIT_MODULE','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/privacidad','operations-resilience','privacy.read','grc.phase2','integrated_grc','GRC_OR_EXPLICIT_MODULE','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/incidentes','operations-resilience','incidents.read','grc.phase2','integrated_grc','GRC_OR_EXPLICIT_MODULE','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/operaciones-grc','operations-resilience','operations.dashboard.read','grc.phase3','operations_grc','ISO_RIESGO_OPERATIVO_OR_GRC','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/bia','operations-resilience','bia.read','grc.phase3','operations_grc','ISO_RIESGO_OPERATIVO_OR_GRC','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/riesgo-cuantitativo','risk-control','quantitative_risk.read','risk.quantitative','risk_manager','ISO_RIESGO_OPERATIVO_OR_GRC','tenant',false,'tenant_admin,auditor,area_owner','ALLOW_IF_MODULE_ACTIVE'),
    ('/reportes/studio','reports','reports.read','reporting.studio','report_studio','GRC_OR_EXPLICIT_MODULE','tenant',false,'tenant_admin,auditor','ALLOW_IF_MODULE_ACTIVE')
  ) AS routes(route, route_group, required_permission, capability_key, module_key, plan_requirement, scope_requirement, mutation, canonical_roles_allowed, expected_access)
) TO STDOUT WITH CSV HEADER;
\o

\o :module_key_mismatches_csv
COPY (
  SELECT
    vtc.tenant_id,
    vtc.capability_key,
    vtc.module_key AS capability_module_key,
    CASE
      WHEN vtc.module_key IS NULL THEN 'NO_MODULE_REQUIRED'
      WHEN vtm.module_key IS NULL THEN 'MODULE_KEY_MISMATCH'
      WHEN vtm.enabled IS DISTINCT FROM true THEN 'MODULE_NOT_ACTIVE'
      ELSE 'OK'
    END AS module_gate_state
  FROM public.v_commercial_tenant_capabilities vtc
  LEFT JOIN public.v_commercial_tenant_modules vtm
    ON vtm.tenant_id = vtc.tenant_id
   AND vtm.module_key = vtc.module_key
  WHERE vtc.enabled = true
  ORDER BY module_gate_state DESC, vtc.tenant_id, vtc.capability_key
) TO STDOUT WITH CSV HEADER;
\o

\o :expired_entitlements_csv
COPY (
  SELECT
    'tenant_subscriptions' AS source_table,
    tenant_id,
    plan_key AS key,
    status,
    ended_at AS expires_at
  FROM public.tenant_subscriptions
  WHERE ended_at IS NOT NULL AND ended_at <= now() AND status IN ('active','trialing','past_due','suspended')
  UNION ALL
  SELECT
    'tenant_feature_overrides' AS source_table,
    tenant_id,
    capability_key AS key,
    status,
    valid_until AS expires_at
  FROM public.tenant_feature_overrides
  WHERE valid_until IS NOT NULL AND valid_until <= now() AND status = 'active'
  ORDER BY source_table, tenant_id, key
) TO STDOUT WITH CSV HEADER;
\o

\o :legacy_role_anomalies_csv
COPY (
  SELECT
    role_classification,
    raw_role,
    user_count,
    tenant_count
  FROM (
    SELECT
      CASE
        WHEN lower(u.role) IN ('platform_admin','tenant_admin','auditor','area_owner','executive','dealer') THEN 'CANONICAL_ROLE'
        WHEN lower(u.role) IN ('super_admin','global_admin','admin_global') THEN 'EXACT_ALIAS'
        WHEN lower(u.role) IN ('admin_cumplimiento','compliance_admin','responsable_area','cliente','client','read_only','readonly','solo_lectura','ejecutivo') THEN 'COMPATIBILITY_MAPPING'
        WHEN lower(u.role) IN ('superadmin','owner','admin','compliance_manager','operativo','control_owner','viewer') THEN 'DEPRECATED_LEGACY_ROLE'
        ELSE 'UNKNOWN_REQUIRES_DECISION'
      END AS role_classification,
      u.role AS raw_role,
      count(*)::int AS user_count,
      count(DISTINCT u.tenant_id)::int AS tenant_count
    FROM public.users u
    GROUP BY role_classification, u.role
  ) roles
  WHERE role_classification <> 'CANONICAL_ROLE'
  ORDER BY role_classification, raw_role
) TO STDOUT WITH CSV HEADER;
\o

\o :summary_txt
SELECT 'tenants=' || count(*) FROM public.tenants;
SELECT 'users=' || count(*) FROM public.users;
SELECT 'roles=' || count(*) FROM public.app_roles;
SELECT 'active_subscriptions=' || count(*) FROM public.v_commercial_tenant_subscription;
SELECT 'tenant_modules=' || count(*) FROM public.v_commercial_tenant_modules;
SELECT 'tenant_capabilities=' || count(*) FROM public.v_commercial_tenant_capabilities;
SELECT 'dashboard_module_mismatches=' || count(*)
FROM public.v_commercial_tenant_capabilities vtc
LEFT JOIN public.v_commercial_tenant_modules vtm
  ON vtm.tenant_id = vtc.tenant_id
 AND vtm.module_key = vtc.module_key
WHERE vtc.capability_key = 'core.dashboard'
  AND vtc.enabled = true
  AND vtc.module_key = 'core'
  AND vtm.module_key IS NULL;
SELECT 'unknown_roles=' || count(DISTINCT u.role)
FROM public.users u
WHERE lower(u.role) NOT IN (
  'platform_admin','tenant_admin','auditor','area_owner','executive','dealer',
  'super_admin','global_admin','admin_global',
  'admin_cumplimiento','compliance_admin','responsable_area','cliente','client','read_only','readonly','solo_lectura','ejecutivo',
  'superadmin','owner','admin','compliance_manager','operativo','control_owner','viewer'
);
\o

ROLLBACK;
