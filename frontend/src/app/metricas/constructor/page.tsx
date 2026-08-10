import MetricBuilder from '@/components/math-governance/MetricBuilder';

export default function MetricBuilderPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Gobierno de indicadores</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Constructor de métricas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Configuración operacional de métricas oficiales con source contracts, preview, publicación, ejecución, explicación y lineage.</p>
      </header>
      <MetricBuilder />
    </main>
  );
}
