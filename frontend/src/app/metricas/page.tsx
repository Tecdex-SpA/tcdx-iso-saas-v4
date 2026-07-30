import FormulaCatalog from '@/components/math-governance/FormulaCatalog';
import MetricBuilder from '@/components/math-governance/MetricBuilder';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function MetricCatalog() {
  return (
    <Phase5Workspace
      title="Métricas"
      description="Catálogo versionado de KPI, KRI, KCI, KQI, SLA y métricas de calidad con fuente, fórmula, umbral y confianza."
      endpoint="/api/metrics"
      primaryLabel="métricas"
      emptyMessage="No hay métricas visibles. El catálogo inicial global aparece después de aplicar la migración Fase 5."
      analyticsDomain="data_quality"
      columns={[
        { key: 'metric_code', label: 'Código' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'metric_type', label: 'Tipo' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <MetricBuilder />
      <FormulaCatalog />
    </Phase5Workspace>
  );
}
