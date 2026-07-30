import OperationalBuilder from './OperationalBuilder';

export default function AssuranceScoringBuilder() {
  return <OperationalBuilder kind="assurance" testId="assurance-score" title="Constructor de assurance" description="Crea test, define población, muestra, ejecución, resultado, revisión, sample size y assurance score oficial." domain="assurance" defaultResultCode="assurance.score" />;
}
