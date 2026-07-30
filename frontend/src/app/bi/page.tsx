import DashboardBuilderGuide from '@/components/math-governance/DashboardBuilder';
import GrcDecisionCenter from '@/components/math-governance/GrcDecisionCenter';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function DashboardBuilder() {
  return (
    <Phase5Workspace
      title="Business Intelligence"
      description="Cockpit ejecutivo para interpretar resultados oficiales, priorizar riesgos y convertir indicadores en acciones verificables."
      endpoint="/api/dashboards"
      primaryLabel="dashboards"
      emptyMessage="No hay dashboards configurados. Los tableros predefinidos consumen resultados oficiales, tendencias y decisiones por tenant."
      analyticsDomain=""
      columns={[
        { key: 'dashboard_key', label: 'Dashboard' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'dashboard_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <GrcDecisionCenter title="Cockpit ejecutivo de decisiones" limit={18} />
      <DashboardBuilderGuide />
    </Phase5Workspace>
  );
}
