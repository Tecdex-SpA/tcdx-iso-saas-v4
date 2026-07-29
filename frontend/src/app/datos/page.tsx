import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function DatosPage() {
  return (
    <Phase5Workspace
      title="Datos"
      description="Gobierno de datos, dominios, elementos, calidad, freshness, lineage e impacto GRC."
      endpoint="/api/data/domains"
      primaryLabel="dominios de datos"
      emptyMessage="No hay dominios de datos configurados para este tenant. Los catálogos globales se muestran cuando están publicados."
      columns={[
        { key: 'domain_key', label: 'Clave' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
        { key: 'description', label: 'Descripción' },
      ]}
    />
  );
}
