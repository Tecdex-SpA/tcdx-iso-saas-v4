import OperationalBuilder from './OperationalBuilder';

export default function LossAnalyticsPanel() {
  return <OperationalBuilder kind="loss" title="Analítica de pérdidas" description="Crea evento, valida recuperaciones, confirma pérdida, ejecuta net loss, expected loss, VaR y Monte Carlo oficial." domain="loss" defaultResultCode="loss.net" />;
}
