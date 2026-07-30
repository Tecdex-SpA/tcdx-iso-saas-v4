import OperationalBuilder from './OperationalBuilder';

export default function FormulaEditor() {
  return <OperationalBuilder kind="metric" title="Editor de fórmula" description="Edita una fórmula declarativa segura asociada a una métrica, valida variables, guarda versión y publica sin ejecutar código arbitrario." domain="data_quality" defaultResultCode="data.completeness" />;
}
