import type { IsoCommandSummary } from './types';
import { formatNumber } from './utils';

type Props = {
  summary: IsoCommandSummary;
};

export default function IsoRiskActionOverview({ summary }: Props) {
  const rows = [
    { label: 'Riesgos altos/criticos', value: summary.high_risks, href: '/matriz-riesgo' },
    { label: 'Acciones recomendadas abiertas', value: summary.recommended_actions_open, href: '/acciones-recomendadas' },
    { label: 'Planes de accion abiertos', value: summary.open_action_plans, href: '/plan-accion' },
    { label: 'Hallazgos abiertos', value: summary.open_findings, href: '/hallazgos' },
    { label: 'No conformidades abiertas', value: summary.open_nonconformities, href: '/no-conformidades' },
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">Riesgo y ejecucion</h2>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <a key={row.label} href={row.href} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100">
            <span className="text-gray-600">{row.label}</span>
            <span className="font-semibold text-gray-950">{formatNumber(row.value)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
