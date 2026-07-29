import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Phase5Workspace
      title="Detalle de encuesta"
      description="Versiones publicadas inmutables, secciones, preguntas, opciones, scoring y branching."
      endpoint={`/api/surveys/${id}`}
      primaryLabel="detalle de encuesta"
      emptyMessage="Encuesta no encontrada o sin acceso."
      columns={[
        { key: 'survey_key', label: 'Clave' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'survey_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
