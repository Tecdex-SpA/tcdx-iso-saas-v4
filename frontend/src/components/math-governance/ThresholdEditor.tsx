import OperationalBuilder from './OperationalBuilder';

export default function ThresholdEditor() {
  return <OperationalBuilder kind="metric" title="Editor de thresholds" description="Define umbrales warning/crítico dentro de la configuración gobernada de la métrica y valida preview antes de publicar." domain="data_quality" defaultResultCode="data.completeness" />;
}
