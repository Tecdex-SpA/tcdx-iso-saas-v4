import OperationalBuilder from './OperationalBuilder';

export default function VariableMapper() {
  return <OperationalBuilder kind="metric" title="Mapeo de variables" description="Mapea variables de fórmula a inputs gobernados, valida muestra de preview, guarda versión y conserva lineage al ejecutar." domain="data_quality" defaultResultCode="data.completeness" />;
}
