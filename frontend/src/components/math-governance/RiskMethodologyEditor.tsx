import OperationalBuilder from './OperationalBuilder';

export default function RiskMethodologyEditor() {
  return <OperationalBuilder kind="metric" title="Metodología de riesgo" description="Configura resultado oficial de riesgo, fuente, escala, thresholds y ejecución trazable para dashboard y reportes." domain="risk" defaultResultCode="risk.residual" />;
}
