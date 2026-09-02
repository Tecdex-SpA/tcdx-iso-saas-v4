import ReportStudioWorkspace from '@/components/math-governance/ReportStudioWorkspace';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function ReportStudio() {
  return (
    <Phase5Workspace
      title="Diseñador de reportes"
      description="Flujo guiado para seleccionar información real, revisar configuración, generar PDF/DOCX/XLSX y consultar historial sin requerir códigos internos."
      endpoint="/api/reports"
      primaryLabel="reportes"
      emptyMessage="No hay definiciones de reporte configuradas."
      domainWorkspace="reports"
      columns={[
        { key: 'report_key', label: 'Reporte' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'report_type', label: 'Tipo' },
        { key: 'classification', label: 'Clasificación' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <ReportStudioWorkspace />
    </Phase5Workspace>
  );
}
