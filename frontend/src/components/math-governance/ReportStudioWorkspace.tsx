import OperationalBuilder from './OperationalBuilder';

export default function ReportStudioWorkspace() {
  return <OperationalBuilder kind="report" title="Diseñador de reportes" description="Crea definiciones, selecciona resultados oficiales, genera PDF/DOCX/XLSX, aprueba y expone snapshot, checksum, explicación y lineage." defaultResultCode="health.grc" />;
}
