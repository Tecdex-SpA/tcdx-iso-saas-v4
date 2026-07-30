import AssuranceScoringBuilder from '@/components/math-governance/AssuranceScoringBuilder';
import SampleSizeCalculator from '@/components/math-governance/SampleSizeCalculator';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function AssuranceTestManager() {
  return (
    <Phase5Workspace
      title="Tests de assurance"
      description="Tests de activos, riesgos, controles, evidencias, continuidad y recuperación con ejecución, excepción y revisión."
      endpoint="/api/assurance-tests"
      primaryLabel="tests"
      emptyMessage="No hay tests de assurance configurados."
      analyticsDomain="assurance"
      columns={[
        { key: 'test_code', label: 'Código' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'test_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <AssuranceScoringBuilder />
      <SampleSizeCalculator />
    </Phase5Workspace>
  );
}
