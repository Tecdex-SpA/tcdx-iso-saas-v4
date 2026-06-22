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
};

const cards = [
  {
    key: 'expectedExposure',
    label: 'Exposicion esperada acumulada',
    helper: 'Suma de medias anuales de los riesgos filtrados.',
    icon: 'hourglass' as const,
    tone: 'info' as const,
  },
  {
    key: 'conservativeP95',
    label: 'P95 agregado conservador',
    helper: 'Suma de P95 individuales; no es P95 de portafolio simulado.',
    icon: 'trend' as const,
    tone: 'info' as const,
  },
  {
    key: 'criticalProbability',
    label: 'Prob. critica promedio',
    helper: 'Promedio de probabilidad critica de riesgos filtrados.',
    icon: 'alert' as const,
    tone: 'warning' as const,
  },
  {
    key: 'prioritizedHighRisks',
    label: 'Riesgos altos priorizados',
    helper: 'Conteo de riesgos clasificados como alto o critico.',
    icon: 'shield' as const,
    tone: 'danger' as const,
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
