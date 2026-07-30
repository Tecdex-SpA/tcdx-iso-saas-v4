import FormulaCatalog from '@/components/math-governance/FormulaCatalog';
import MetricBuilder from '@/components/math-governance/MetricBuilder';
import MetricsSectionBoundary from '@/components/math-governance/MetricsSectionBoundary';
import MetricsTenantContext from '@/components/math-governance/MetricsTenantContext';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function MetricCatalog() {
  return (
    <Phase5Workspace
      title="Métricas y fórmulas"
      description="Opera la capa matemática oficial y administra el catálogo versionado de KPI, KRI, KCI, KQI, SLA y métricas de calidad."
      endpoint="/api/metrics"
      primaryLabel="métricas"
      emptyMessage="No hay métricas visibles. Revisa el catálogo oficial y los datos operacionales de la empresa seleccionada."
      columns={[
        { key: 'metric_code', label: 'Código' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'metric_type', label: 'Tipo' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <MetricsTenantContext />
      <MetricsSectionBoundary title="Catálogo y recálculo oficial">
        <FormulaCatalog />
      </MetricsSectionBoundary>
      <MetricsSectionBoundary title="Constructor de métricas">
        <MetricBuilder />
      </MetricsSectionBoundary>
    </Phase5Workspace>
  );
}
