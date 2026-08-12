import FunctionalIndicatorCatalog from '@/components/indicators/FunctionalIndicatorCatalog';
import MetricsTenantContext from '@/components/math-governance/MetricsTenantContext';
import Link from 'next/link';

export default function MetricCatalog() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Gobierno de indicadores</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Indicadores oficiales</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Resultados gobernados por fuentes semánticas, fórmulas oficiales, Data Trust y snapshots reproducibles.
          Esta vista no administra KPI configurables ni copia valores desde la configuración administrativa.
        </p>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <strong>Fuente oficial:</strong> los valores, estados, períodos e interpretación provienen del catálogo oficial y de snapshots publicados.
          Si un indicador no tiene evidencia suficiente, se mantiene explícitamente sin medición; no se reemplaza por valores administrativos.
        </div>
        <Link href="/metricas/constructor" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Abrir constructor gobernado</Link>
      </header>
      <MetricsTenantContext />
      <FunctionalIndicatorCatalog />
    </main>
  );
}
