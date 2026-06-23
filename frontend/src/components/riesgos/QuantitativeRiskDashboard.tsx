import TcdxIcon from '@/components/icons/TcdxIcon';
import { EnterpriseKpiCard } from '@/components/ui/enterprise';
import {
  formatRiskNumber,
  formatRiskProbability,
  type QuantitativeRiskKpis,
} from './riskSimulationUtils';

type QuantitativeRiskDashboardProps = {
  kpis: QuantitativeRiskKpis;
  unitSuffix: string;
  variant?: 'grid' | 'sidePanel';
};

const cards = [
  {
    key: 'expectedExposure',
    label: 'Exposicion esperada acumulada',
    sideLabel: 'Exposicion esperada',
    helper: 'Suma de medias anuales de los riesgos filtrados.',
    sideHelper: 'Media anual acumulada.',
    icon: 'hourglass' as const,
    tone: 'info' as const,
  },
  {
    key: 'conservativeP95',
    label: 'P95 agregado conservador',
    sideLabel: 'P95 conservador',
    helper: 'Suma de P95 individuales; no es P95 de portafolio simulado.',
    sideHelper: 'Suma de P95 individuales.',
    icon: 'trend' as const,
    tone: 'info' as const,
  },
  {
    key: 'criticalProbability',
    label: 'Prob. critica promedio',
    sideLabel: 'Prob. critica',
    helper: 'Promedio de probabilidad critica de riesgos filtrados.',
    sideHelper: 'Promedio de probabilidad critica.',
    icon: 'alert' as const,
    tone: 'warning' as const,
  },
  {
    key: 'prioritizedHighRisks',
    label: 'Riesgos altos priorizados',
    sideLabel: 'Riesgos altos',
    helper: 'Conteo de riesgos clasificados como alto o critico.',
    sideHelper: 'Clasificados alto/critico.',
    icon: 'shield' as const,
    tone: 'danger' as const,
  },
];

export default function QuantitativeRiskDashboard({
  kpis,
  unitSuffix,
  variant = 'grid',
}: QuantitativeRiskDashboardProps) {
  function renderValue(key: string) {
    if (key === 'expectedExposure') return `${formatRiskNumber(kpis.expectedExposure)} ${unitSuffix}`;
    if (key === 'conservativeP95') return `${formatRiskNumber(kpis.conservativeP95)} ${unitSuffix}`;
    if (key === 'criticalProbability') return formatRiskProbability(kpis.criticalProbability);
    return formatRiskNumber(kpis.prioritizedHighRisks);
  }

  if (variant === 'sidePanel') {
    return (
      <aside className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm 2xl:w-[360px]">
        <div className="mb-4">
          <h2 className="text-base font-black text-slate-950">Resumen cuantitativo</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">KPIs agregados de los riesgos filtrados.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
          {cards.map((card) => (
            <article
              key={card.key}
              className="flex min-h-[112px] items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5 text-slate-700">{card.sideLabel}</p>
                <div className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-950">
                  {renderValue(card.key)}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{card.sideHelper}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-blue-100">
                <TcdxIcon name={card.icon} className="h-5 w-5" />
              </span>
            </article>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <EnterpriseKpiCard
          key={card.key}
          label={card.label}
          value={<span className="text-2xl">{renderValue(card.key)}</span>}
          icon={<TcdxIcon name={card.icon} className="h-5 w-5" />}
          tone={card.tone}
          meta={card.helper}
        />
      ))}
    </section>
  );
}
