-- HOTFIX-POSTDEPLOY-01
-- Forward-only RBAC reconciliation for canonical IA Compliance read permission.

BEGIN;

DO $$
DECLARE
  expected_role_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM permissions WHERE permission_key = 'ai.view' AND is_active IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'HOTFIX-POSTDEPLOY-01 missing active canonical permission: ai.view';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM commercial_technical_capabilities
    WHERE capability_key = 'ai.compliance'
      AND status = 'active'
      AND required_permission = 'ai.view'
  ) THEN
    RAISE EXCEPTION 'HOTFIX-POSTDEPLOY-01 ai.compliance is not canonicalized to ai.view';
  END IF;

  SELECT COUNT(*)::int
    INTO expected_role_count
  FROM app_roles
  WHERE role_key IN ('admin', 'tenant_admin', 'auditor')
    AND is_active IS DISTINCT FROM FALSE;

  IF expected_role_count <> 3 THEN
    RAISE EXCEPTION 'HOTFIX-POSTDEPLOY-01 expected tenant IA roles missing or inactive: %', expected_role_count;
  END IF;
END $$;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT ar.role_key, 'ai.view', true
FROM app_roles ar
JOIN permissions p
  ON p.permission_key = 'ai.view'
 AND p.is_active IS DISTINCT FROM FALSE
WHERE ar.role_key IN ('admin', 'tenant_admin', 'auditor')
  AND ar.is_active IS DISTINCT FROM FALSE
ON CONFLICT (role_key, permission_key)
DO UPDATE SET is_allowed = true, updated_at = now()
WHERE role_permissions.is_allowed IS DISTINCT FROM true;

DO $$
DECLARE
  missing_expected_count integer;
  unauthorized_count integer;
BEGIN
  SELECT COUNT(*)::int
    INTO missing_expected_count
  FROM app_roles ar
  LEFT JOIN role_permissions rp
    ON rp.role_key = ar.role_key
   AND rp.permission_key = 'ai.view'
   AND rp.is_allowed = true
  WHERE ar.role_key IN ('admin', 'tenant_admin', 'auditor')
    AND ar.is_active IS DISTINCT FROM FALSE
    AND rp.role_key IS NULL;

  IF missing_expected_count <> 0 THEN
    RAISE EXCEPTION 'HOTFIX-POSTDEPLOY-01 expected tenant IA roles without ai.view: %', missing_expected_count;
  END IF;

  SELECT COUNT(*)::int
    INTO unauthorized_count
  FROM role_permissions rp
  JOIN app_roles ar
    ON ar.role_key = rp.role_key
   AND ar.is_active IS DISTINCT FROM FALSE
  WHERE rp.permission_key = 'ai.view'
    AND rp.is_allowed = true
    AND rp.role_key NOT IN (
      'admin',
      'tenant_admin',
      'auditor',
      'platform_admin',
      'superadmin',
      'super_admin',
      'global_admin',
      'admin_global',
      'owner'
    );

  IF unauthorized_count <> 0 THEN
    RAISE EXCEPTION 'HOTFIX-POSTDEPLOY-01 unauthorized roles have ai.view: %', unauthorized_count;
  END IF;
END $$;

COMMIT;
