import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default async function MetricDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Phase5Workspace
      title="Detalle de métrica"
      description="Definición, fórmula versionada, fuentes, mediciones, tendencia y Data Trust Score."
      endpoint={`/api/metrics/${id}`}
      primaryLabel="detalle de métrica"
      emptyMessage="Métrica no encontrada o sin acceso."
      columns={[
        { key: 'metric_code', label: 'Código' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'metric_type', label: 'Tipo' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
