import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function DataCatalogPage() {
  return (
    <Phase5Workspace
      domainWorkspace="data"
      title="Catálogo maestro de datos"
      description="Elementos de datos con definición de negocio, definición técnica, fuente, clasificación y responsable."
      endpoint="/api/data/elements"
      primaryLabel="elementos de datos"
      emptyMessage="No hay elementos de datos registrados. Crea elementos desde la API o administración autorizada."
      columns={[
        { key: 'element_key', label: 'Elemento' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'classification', label: 'Clasificación' },
        { key: 'source_reference', label: 'Fuente' },
        { key: 'status', label: 'Estado' },
      ]}
    />
  );
}
