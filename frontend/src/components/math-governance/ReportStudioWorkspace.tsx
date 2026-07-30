import BuilderSurface from './BuilderSurface';

export default function ReportStudioWorkspace() {
  return (
    <BuilderSurface
      title="Report Studio Workspace"
      description="Genera PDF, DOCX y XLSX con snapshot, checksum, metodología, aprobación y descarga."
      steps={["Definición","Secciones","Resultados","Preview","Generación","Aprobación","Descarga","Historial"]}
      resultCode="report_studio"
      primaryHref="/reportes/studio"
    />
  );
}
