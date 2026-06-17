import {
  formatRiskNumber,
  formatRiskProbability,
  getTopRiskContributors,
  type QuantitativeRisk,
} from './riskSimulationUtils';

type QuantitativeRiskContributorsProps = {
  risks: QuantitativeRisk[];
  unitSuffix: string;
  onSelectRisk: (risk: QuantitativeRisk) => void;
};

function ContributorList({
  title,
  items,
  unitSuffix,
  formatValue,
  onSelectRisk,
}: {
  title: string;
  items: ReturnType<typeof getTopRiskContributors>['byP95'];
  unitSuffix: string;
  formatValue?: (value: number) => string;
  onSelectRisk: (risk: QuantitativeRisk) => void;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">Sin datos suficientes.</div>
        ) : (
          items.map((item) => {
            const width = max > 0 ? Math.max(8, (item.value / max) * 100) : 0;
            return (
              <button
                key={item.risk.id}
                type="button"
                onClick={() => onSelectRisk(item.risk)}
                className="block w-full rounded border border-transparent p-1 text-left hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{item.risk.code}: {item.risk.name}</div>
                    <div className="text-xs text-slate-500">{item.risk.processName}</div>
                  </div>
                  <div className="text-right text-sm font-bold text-slate-900">
                    {formatValue ? formatValue(item.value) : `${formatRiskNumber(item.value)} ${unitSuffix}`}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                </div>
                {item.contributionPercent !== null && (
                  <div className="mt-1 text-xs text-slate-500">{formatRiskNumber(item.contributionPercent, 1)}% del total</div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function QuantitativeRiskContributors({
  risks,
  unitSuffix,
  onSelectRisk,
}: QuantitativeRiskContributorsProps) {
  const contributors = getTopRiskContributors(risks);

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Principales contribuyentes</h2>
          <p className="text-sm text-slate-500">Priorizacion por severidad, exposicion esperada y probabilidad critica.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ContributorList title="Top P95 individual" items={contributors.byP95} unitSuffix={unitSuffix} onSelectRisk={onSelectRisk} />
        <ContributorList title="Top media acumulada" items={contributors.byExpectedExposure} unitSuffix={unitSuffix} onSelectRisk={onSelectRisk} />
        <ContributorList
          title="Top probabilidad critica"
          items={contributors.byCriticalProbability}
          unitSuffix={unitSuffix}
          formatValue={(value) => formatRiskProbability(value)}
          onSelectRisk={onSelectRisk}
        />
      </div>
    </section>
  );
}
