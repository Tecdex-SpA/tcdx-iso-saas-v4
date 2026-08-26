'use client';

import { useSyncExternalStore } from 'react';
import DashboardBuilderGuide from '@/components/math-governance/DashboardBuilder';
import GrcDecisionCenter from '@/components/math-governance/GrcDecisionCenter';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';
import { getUserRoleFromToken } from '@/utils/auth';

const DASHBOARD_MANAGER_ROLES = new Set([
  'admin',
  'tenant_admin',
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

export default function DashboardBuilder() {
  const role = useSyncExternalStore<string | null>(
    () => () => undefined,
    () => getUserRoleFromToken(),
    () => null
  );

  if (role === null) {
    return <div className="p-6 text-sm text-slate-600">Validando acceso al cockpit BI…</div>;
  }

  const canManageDashboards = DASHBOARD_MANAGER_ROLES.has(role);

  return (
    <Phase5Workspace
      title="Reportes Business Intelligence"
      description="Cockpit ejecutivo para interpretar resultados oficiales, priorizar riesgos y convertir indicadores en acciones verificables."
      endpoint="/api/dashboards"
      primaryLabel="dashboards"
      emptyMessage="No hay dashboards configurados. Los tableros predefinidos consumen resultados oficiales, tendencias y decisiones por tenant."
      loadCollection={false}
      domainWorkspace="reports"
      columns={[
        { key: 'dashboard_key', label: 'Dashboard' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'dashboard_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <GrcDecisionCenter title="Cockpit ejecutivo de decisiones" />
      {canManageDashboards ? <DashboardBuilderGuide /> : null}
    </Phase5Workspace>
  );
}
