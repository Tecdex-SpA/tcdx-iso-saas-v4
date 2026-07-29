import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function DataQualityPanel() {
  return (
    <Phase5Workspace
      title="Calidad y confianza del dato"
      description="Evaluaciones de calidad, freshness y estado de confianza. Un dato stale, rejected o unknown se marca con advertencia visible."
      endpoint="/api/data/quality"
      primaryLabel="evaluaciones de calidad"
      emptyMessage="No hay evaluaciones de calidad ejecutadas para este tenant."
      columns={[
        { key: 'assessed_entity_type', label: 'Entidad' },
        { key: 'assessment_status', label: 'Calidad' },
        { key: 'score', label: 'Score' },
        { key: 'assessed_at', label: 'Evaluado' },
      ]}
    />
  );
}
