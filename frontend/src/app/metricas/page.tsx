import FormulaCatalog from '@/components/math-governance/FormulaCatalog';
import MetricBuilder from '@/components/math-governance/MetricBuilder';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function MetricCatalog() {
  return (
    <Phase5Workspace
      title="Métricas y fórmulas"
      description="Opera la capa matemática oficial y administra el catálogo versionado de KPI, KRI, KCI, KQI, SLA y métricas de calidad."
      endpoint="/api/metrics"
      primaryLabel="métricas"
      emptyMessage="No hay métricas visibles. Revisa el catálogo oficial y los datos operacionales de la empresa seleccionada."
      analyticsDomain="data_quality"
      columns={[
        { key: 'metric_code', label: 'Código' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'metric_type', label: 'Tipo' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <FormulaCatalog />
      <MetricBuilder />
    </Phase5Workspace>
  );
}
