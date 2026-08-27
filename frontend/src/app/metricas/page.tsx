import FunctionalIndicatorCatalog from '@/components/indicators/FunctionalIndicatorCatalog';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import MetricsTenantContext from '@/components/math-governance/MetricsTenantContext';
import Link from 'next/link';

export default function MetricCatalog() {
  return (
    <EnterpriseDomainWorkspaceShell
      domain="intelligence"
      eyebrow="Gobierno de indicadores"
      title="Indicadores oficiales"
      description="Resultados gobernados por fuentes semánticas, fórmulas oficiales, Data Trust y snapshots reproducibles."
      actions={
        <Link href="/metricas/constructor" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-focus)]">
          Abrir constructor gobernado
        </Link>
      }
    >
      <main className="space-y-6">
        <div className="rounded-md border border-[var(--tcdx-color-info)]/30 bg-[var(--tcdx-color-info)]/10 p-4 text-sm leading-6 text-[var(--tcdx-color-text-ink)]">
          <strong>Fuente oficial:</strong> los valores, estados, períodos e interpretación provienen del catálogo oficial y de snapshots publicados.
          Si un indicador no tiene evidencia suficiente, se mantiene explícitamente sin medición; no se reemplaza por valores administrativos.
        </div>
        <MetricsTenantContext />
        <FunctionalIndicatorCatalog />
      </main>
    </EnterpriseDomainWorkspaceShell>
  );
}
