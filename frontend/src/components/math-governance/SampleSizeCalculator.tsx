import OperationalBuilder from './OperationalBuilder';

export default function SampleSizeCalculator() {
  return <OperationalBuilder kind="assurance" testId="assurance-sample" title="Calculadora de muestra" description="Calcula tamaño de muestra, crea test de assurance, registra ejecución, revisión y explanation/lineage oficial." domain="assurance" defaultResultCode="assurance.sample_size" />;
}
