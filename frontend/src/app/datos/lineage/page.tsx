import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function LineageExplorer() {
  return (
    <Phase5Workspace
      title="Lineage e Impact Graph"
      description="Relaciones registradas entre dashboards, widgets, métricas, mediciones, fórmulas, fuentes, evidencias y efectos GRC."
      endpoint="/api/data/domains"
      primaryLabel="lineage"
      emptyMessage="Selecciona una entidad desde una métrica, dashboard o reporte para navegar lineage."
      columns={[
        { key: 'domain_key', label: 'Dominio' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
