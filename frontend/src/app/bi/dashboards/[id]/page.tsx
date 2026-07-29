import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default async function DashboardRenderer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Phase5Workspace
      title="Dashboard"
      description="Render de widgets con advertencias visibles cuando la fuente está stale, rejected o unknown."
      endpoint={`/api/dashboards/${id}/render`}
      primaryLabel="dashboard"
      emptyMessage="Dashboard no encontrado o sin widgets publicados."
      columns={[
        { key: 'dashboard_key', label: 'Clave' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
