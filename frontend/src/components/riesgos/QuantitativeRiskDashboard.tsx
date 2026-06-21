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
    label: 'Exposicion esperada acumulada',
    helper: 'Suma de medias anuales de los riesgos filtrados.',
    icon: 'hourglass' as const,
    iconClass: 'bg-blue-50 text-blue-700',
    valueClass: 'text-blue-700',
  },
  {
    key: 'conservativeP95',
    label: 'P95 agregado conservador',
    helper: 'Suma de P95 individuales; no es P95 de portafolio simulado.',
    icon: 'trend' as const,
    iconClass: 'bg-violet-50 text-violet-700',
    valueClass: 'text-violet-700',
  },
  {
    key: 'criticalProbability',
    label: 'Prob. critica promedio',
    helper: 'Promedio de probabilidad critica de riesgos filtrados.',
    icon: 'alert' as const,
    iconClass: 'bg-amber-50 text-amber-700',
    valueClass: 'text-amber-700',
  },
  {
    key: 'prioritizedHighRisks',
    label: 'Riesgos altos priorizados',
    helper: 'Conteo de riesgos clasificados como alto o critico.',
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
    if (key === 'conservativeP95') return `${formatRiskNumber(kpis.conservativeP95)} ${unitSuffix}`;
    if (key === 'criticalProbability') return formatRiskProbability(kpis.criticalProbability);
    return formatRiskNumber(kpis.prioritizedHighRisks);
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="enterprise-kpi-card group relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white shadow-sm ${card.iconClass}`}>
              <TcdxIcon name={card.icon} className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800">{card.label}</div>
              <div className={`mt-1 text-2xl font-black tracking-tight ${card.valueClass}`}>{renderValue(card.key)}</div>
              <div className="mt-1 text-xs leading-4 text-slate-500">{card.helper}</div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
