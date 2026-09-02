import Phase5Workspace from '@/components/phase5/Phase5Workspace';
import Link from 'next/link';

export default function DatosPage() {
  return (
    <Phase5Workspace
      domainWorkspace="data"
      title="Datos"
      description="Gobierno de datos, dominios, elementos, calidad, freshness, lineage e impacto GRC."
      endpoint="/api/data/domains"
      primaryLabel="dominios de datos"
      emptyMessage="No hay dominios de datos configurados para este tenant. Importa datos operacionales o usa evidencias para crear material indexable antes de revisar gobierno avanzado."
      emptyAction={{ label: 'Abrir importaciones', href: '/importaciones' }}
      columns={[
        { key: 'domain_key', label: 'Clave' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
        { key: 'description', label: 'Descripción' },
      ]}
    >
      <nav aria-label="Herramientas de gobierno de datos" className="flex flex-wrap gap-2">
        <Link href="/evidencias" className="inline-flex min-h-10 items-center border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Evidencias</Link>
        <Link href="/importaciones" className="inline-flex min-h-10 items-center border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Importaciones</Link>
      </nav>
    </Phase5Workspace>
  );
}
