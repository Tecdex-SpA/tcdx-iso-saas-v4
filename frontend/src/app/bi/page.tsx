import DashboardBuilderGuide from '@/components/math-governance/DashboardBuilder';
import OfficialAnalyticsPanel from '@/components/math-governance/OfficialAnalyticsPanel';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function DashboardBuilder() {
  return (
    <Phase5Workspace
      title="Business Intelligence"
      description="Dashboard builder gobernado. Cada widget consume resultados oficiales con fórmula, versión, fuente, confianza, freshness, variación, drill-down y snapshot."
      endpoint="/api/dashboards"
      primaryLabel="dashboards"
      emptyMessage="No hay dashboards configurados. Los dashboards predefinidos se crean como definiciones editables por tenant y consumen resultados oficiales."
      analyticsDomain=""
      columns={[
        { key: 'dashboard_key', label: 'Dashboard' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'dashboard_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <DashboardBuilderGuide />
      <OfficialAnalyticsPanel title="Catálogo consumible por widgets" compact limit={12} />
    </Phase5Workspace>
  );
}
