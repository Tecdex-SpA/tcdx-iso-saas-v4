import CalculationRunHistory from '@/components/math-governance/CalculationRunHistory';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function ReportGenerationHistory() {
  return (
    <Phase5Workspace
      title="Generaciones de reportes"
      description="Historial reproducible de emisiones, snapshots, checksum, aprobación y descarga autorizada con cálculo oficial trazable."
      endpoint="/api/report-generations"
      primaryLabel="generaciones"
      emptyMessage="No hay emisiones de reporte generadas."
      analyticsDomain=""
      domainWorkspace="reports"
      columns={[
        { key: 'generation_key', label: 'Emisión' },
        { key: 'format', label: 'Formato' },
        { key: 'status', label: 'Estado' },
        { key: 'checksum', label: 'Checksum' },
        { key: 'requested_at', label: 'Solicitado' },
      ]}
    >
      <CalculationRunHistory />
    </Phase5Workspace>
  );
}
