import OperationalBuilder from './OperationalBuilder';

export default function MetricBuilder() {
  return <OperationalBuilder kind="metric" title="Constructor de métricas" description="Crea, valida, versiona, publica y ejecuta métricas oficiales con fórmula, variables, source contract, thresholds, historial, explicación y lineage." domain="data_quality" defaultResultCode="data.completeness" />;
}
