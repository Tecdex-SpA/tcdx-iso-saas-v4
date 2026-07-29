import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function ReportStudio() {
  return (
    <Phase5Workspace
      title="Report Studio"
      description="Definiciones de reporte, plantillas, filtros, clasificación, aprobación, scheduling y generación PDF/DOCX/XLSX."
      endpoint="/api/reports"
      primaryLabel="reportes"
      emptyMessage="No hay definiciones de reporte configuradas."
      columns={[
        { key: 'report_key', label: 'Reporte' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'report_type', label: 'Tipo' },
        { key: 'classification', label: 'Clasificación' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
