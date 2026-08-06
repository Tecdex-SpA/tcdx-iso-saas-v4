'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(repoRoot, relativePath), content, 'utf8');
  console.log(`Actualizado: ${relativePath}`);
}

function replaceOnce(source, label, from, to) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`No se encontró bloque esperado: ${label}`);
  }
  return source.replace(from, to);
}

function patchUsersPage() {
  const relativePath = 'frontend/src/app/usuarios/page.tsx';
  let source = read(relativePath);

  source = replaceOnce(
    source,
    'users role gate',
    `  useEffect(() => {\n    if (!token || !user) return;\n\n    const run = async () => {`,
    `  useEffect(() => {\n    if (!token || !user) return;\n    if (!isSuperAdmin && !isAdmin) {\n      setUsers([]);\n      setLoading(false);\n      return;\n    }\n\n    const run = async () => {`
  );

  source = replaceOnce(
    source,
    'remove duplicate admin load',
    `        } else {\n          const tenantId = resolveTenantId(user);\n          setSelectedTenantId(tenantId);\n          await loadUsers(token, tenantId, isSuperAdmin);\n        }`,
    `        } else {\n          const tenantId = resolveTenantId(user);\n          setSelectedTenantId(tenantId);\n        }`
  );

  source = replaceOnce(
    source,
    'users effect dependencies',
    `  }, [isSuperAdmin, loadTenants, loadUsers, token, user]);`,
    `  }, [isAdmin, isSuperAdmin, loadTenants, token, user]);`
  );

  source = replaceOnce(
    source,
    'users selected tenant gate',
    `  useEffect(() => {\n    if (!token || !selectedTenantId) return;\n\n    void loadUsers(token, selectedTenantId, isSuperAdmin);\n  }, [isSuperAdmin, loadUsers, selectedTenantId, token]);`,
    `  useEffect(() => {\n    if (!token || !selectedTenantId || (!isSuperAdmin && !isAdmin)) return;\n\n    void loadUsers(token, selectedTenantId, isSuperAdmin);\n  }, [isAdmin, isSuperAdmin, loadUsers, selectedTenantId, token]);`
  );

  write(relativePath, source);
}

function patchBiPage() {
  const relativePath = 'frontend/src/app/bi/page.tsx';
  let source = read(relativePath);

  source = replaceOnce(
    source,
    'bi client and auth import',
    `import DashboardBuilderGuide from '@/components/math-governance/DashboardBuilder';`,
    `'use client';\n\nimport DashboardBuilderGuide from '@/components/math-governance/DashboardBuilder';\nimport { getUserFromToken } from '@/utils/auth';`
  );

  source = replaceOnce(
    source,
    'bi role resolution',
    `export default function DashboardBuilder() {\n  return (`,
    `export default function DashboardBuilder() {\n  const role = String(getUserFromToken()?.role || '').toLowerCase();\n  const canManageDashboards = [\n    'admin',\n    'tenant_admin',\n    'superadmin',\n    'super_admin',\n    'platform_admin',\n    'admin_global',\n    'global_admin',\n    'owner',\n  ].includes(role);\n\n  return (`
  );

  source = replaceOnce(
    source,
    'bi dashboard builder gate',
    `      <DashboardBuilderGuide />`,
    `      {canManageDashboards ? <DashboardBuilderGuide /> : null}`
  );

  write(relativePath, source);
}

function patchProcessesPanel() {
  const relativePath = 'frontend/src/components/configuracion/ProcessesOperationsPanel.tsx';
  let source = read(relativePath);

  source = replaceOnce(
    source,
    'canonical uuid helper',
    `function getToken() {`,
    `function isCanonicalUuid(value: string) {\n  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);\n}\n\nfunction getToken() {`
  );

  source = replaceOnce(
    source,
    'links process id validation',
    `  const loadLinks = useCallback(async (processId: string) => {\n    if (!processId) {\n      setLinks([]);\n      return;\n    }`,
    `  const loadLinks = useCallback(async (processId: string) => {\n    if (!processId || !isCanonicalUuid(processId)) {\n      setLinks([]);\n      return;\n    }`
  );

  write(relativePath, source);
}

patchUsersPage();
patchBiPage();
patchProcessesPanel();
