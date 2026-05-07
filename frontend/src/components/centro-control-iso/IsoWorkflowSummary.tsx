import type { UnifiedIsoResponse } from './types';
import { formatNumber } from './utils';

type Props = {
  data: UnifiedIsoResponse;
};

export default function IsoWorkflowSummary({ data }: Props) {
  const workflow = data.workflow || {
    suggested: 0,
    converted: 0,
    open_action_plans: 0,
    open_findings: 0,
    open_nonconformities: 0,
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Avance operativo</h2>
      <p className="mt-1 text-xs text-slate-500">
        Seguimiento de inteligencia ISO convertida en trabajo gestionable.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="Sugeridas" value={workflow.suggested} tone="bg-blue-50 text-blue-800" />
        <Metric label="Convertidas" value={workflow.converted} tone="bg-emerald-50 text-emerald-800" />
        <Metric label="Planes abiertos" value={workflow.open_action_plans} tone="bg-slate-50 text-slate-800" />
        <Metric label="Hallazgos" value={workflow.open_findings} tone="bg-amber-50 text-amber-800" />
        <Metric label="No conformidades" value={workflow.open_nonconformities} tone="bg-rose-50 text-rose-800" />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded p-3 ${tone}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{formatNumber(value)}</div>
    </div>
  );
}
