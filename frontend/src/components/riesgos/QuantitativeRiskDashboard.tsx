import TcdxIcon from '@/components/icons/TcdxIcon';
import {
  formatRiskNumber,
  formatRiskProbability,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type QuantitativeRiskDashboardProps = {
  kpis: QuantitativeRiskKpis;
  unitSuffix: string;
};

const cards = [
  {
    key: 'expectedExposure',
    label: 'Exposicion esperada',
    icon: 'hourglass' as const,
    iconClass: 'bg-blue-50 text-blue-700',
    valueClass: 'text-blue-700',
  },
  {
    key: 'p95',
    label: 'P95',
    icon: 'trend' as const,
    iconClass: 'bg-violet-50 text-violet-700',
    valueClass: 'text-violet-700',
  },
  {
    key: 'criticalProbability',
    label: 'Prob. disrupcion critica',
    icon: 'alert' as const,
    iconClass: 'bg-amber-50 text-amber-700',
    valueClass: 'text-amber-700',
  },
  {
    key: 'prioritizedHighRisks',
    label: 'Riesgos altos priorizados',
    icon: 'shield' as const,
    iconClass: 'bg-red-50 text-red-700',
    valueClass: 'text-red-700',
  },
];

export default function QuantitativeRiskDashboard({
  kpis,
  unitSuffix,
}: QuantitativeRiskDashboardProps) {
  function renderValue(key: string) {
    if (key === 'expectedExposure') return `${formatRiskNumber(kpis.expectedExposure)} ${unitSuffix}`;
    if (key === 'p95') return `${formatRiskNumber(kpis.p95)} ${unitSuffix}`;
    if (key === 'criticalProbability') return formatRiskProbability(kpis.criticalProbability);
    return formatRiskNumber(kpis.prioritizedHighRisks);
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.iconClass}`}>
              <TcdxIcon name={card.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-medium text-slate-700">{card.label}</div>
              <div className={`mt-1 text-2xl font-bold ${card.valueClass}`}>{renderValue(card.key)}</div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
