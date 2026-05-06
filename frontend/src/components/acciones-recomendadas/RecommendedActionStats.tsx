import type { RecommendedActionsSummary } from './types';

type Props = {
  summary: RecommendedActionsSummary | null;
};

export default function RecommendedActionStats({ summary }: Props) {
  const totals = summary?.totals || {};
  const criticalHigh = Number(totals.critical_count || 0) + Number(totals.high_count || 0);
  const cards = [
    { label: 'Total recomendaciones', value: totals.total_suggestions || 0, className: 'bg-slate-950 text-white' },
    { label: 'Criticas / altas', value: criticalHigh, className: 'bg-orange-500 text-white' },
    { label: 'Pendientes', value: totals.pending_count || 0, className: 'bg-blue-100 text-blue-800' },
    { label: 'Convertidas', value: totals.approved_count || 0, className: 'bg-emerald-100 text-emerald-800' },
    { label: 'Descartadas', value: totals.rejected_count || 0, className: 'bg-gray-200 text-gray-700' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-gray-500">{card.label}</div>
          <div className={`mt-3 inline-flex min-w-12 justify-center rounded px-3 py-1 text-2xl font-bold ${card.className}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
