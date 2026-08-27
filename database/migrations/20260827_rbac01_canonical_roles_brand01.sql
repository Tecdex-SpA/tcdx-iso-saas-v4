-- RBAC-01 Stage 2 + BRAND-01
-- Additive canonical role catalog completion and legacy compatibility.
-- Does not rename/delete roles, reassign users, touch tenants, subscriptions,
-- entitlements, modules or dealer assignments.

BEGIN;

INSERT INTO app_roles (role_key, display_name, description, role_level, is_system, is_active)
VALUES
  ('platform_admin', 'Administrador Plataforma', 'Administracion operativa de plataforma SaaS segun permisos efectivos.', 2, true, true),
  ('tenant_admin', 'Administrador Empresa', 'Administracion dentro del tenant segun permisos efectivos y capacidades contratadas.', 20, true, true),
  ('auditor', 'Auditor tenant', 'Consulta y ejecuta operaciones de auditoria, evidencia, hallazgos y reportes segun permisos efectivos.', 50, true, true),
  ('area_owner', 'Responsable de Area', 'Opera riesgos, controles, evidencias y planes dentro de su responsabilidad y alcance.', 40, true, true),
  ('executive', 'Ejecutivo', 'Visibilidad ejecutiva de lectura sobre capacidades contratadas y activas.', 60, true, true),
  ('dealer', 'Dealer / Partner', 'Acceso a tenants asignados por dealer_tenants/dealer_tenant_access y permisos efectivos.', 10, true, true),
  ('operativo', 'Operativo legacy', 'Rol legacy compatible con area_owner; no usar para clientes nuevos.', 45, true, true)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'auditor', p.permission_key, true
FROM permissions p
WHERE p.permission_key = 'dashboards.read'
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT r.role_key, p.permission_key, true
FROM (VALUES ('area_owner'), ('operativo')) AS r(role_key)
JOIN app_roles ar ON ar.role_key = r.role_key
CROSS JOIN permissions p
WHERE p.permission_key IN (
  'actions.manage',
  'actions.view',
  'controls.view',
  'evidence.request.read',
  'evidences.upload',
  'evidences.view',
  'health.view',
  'reports.view',
  'risk_matrix.view',
  'workflow.read',
  'workflow.transition'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

INSERT INTO role_permissions (role_key, permission_key, is_allowed)
SELECT 'executive', p.permission_key, true
FROM permissions p
WHERE p.permission_key IN (
  'actions.view',
  'assets.view',
  'audits.view',
  'controls.view',
  'dashboards.read',
  'data.catalog.read',
  'data.lineage.read',
  'data.quality.read',
  'evidences.view',
  'health.view',
  'metrics.read',
  'modules.view',
  'nonconformities.view',
  'reports.download',
  'reports.read',
  'reports.view',
  'risk_matrix.view',
  'standards.view',
  'surveys.read'
)
ON CONFLICT (role_key, permission_key) DO UPDATE SET is_allowed = true, updated_at = now();

COMMIT;
