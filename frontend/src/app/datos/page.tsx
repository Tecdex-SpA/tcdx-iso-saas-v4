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
      emptyMessage="No hay dominios de datos configurados para este tenant. Los catálogos globales se muestran cuando están publicados."
      columns={[
        { key: 'domain_key', label: 'Clave' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
        { key: 'description', label: 'Descripción' },
      ]}
    >
      <nav aria-label="Herramientas de gobierno de datos" className="flex flex-wrap gap-2">
        <Link href="/datos/semantica" className="inline-flex min-h-10 items-center border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Capa semántica</Link>
        <Link href="/datos/calidad" className="inline-flex min-h-10 items-center border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Calidad y confianza</Link>
        <Link href="/datos/lineage" className="inline-flex min-h-10 items-center border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">Lineage</Link>
      </nav>
    </Phase5Workspace>
  );
}
