import type { IsoStandardReadiness } from '@/components/command-center-iso/types';
import { formatNumber, formatPercent, readinessClass, semaphoreClass, statusLabel } from './utils';

type Props = {
  standard: IsoStandardReadiness;
};

export default function IsoNormCard({ standard }: Props) {
  const riskCount = Number(standard.critical_risks || 0) + Number(standard.high_risks || 0);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {standard.standard_code} · {standard.version_code}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {standard.display_name || 'Norma activa del tenant'}
          </p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${semaphoreClass(standard.semaphore)}`}>
          {statusLabel(standard.semaphore)}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Readiness operativo</span>
          <span className="font-semibold text-slate-950">{formatPercent(standard.readiness_score)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${readinessClass(standard.readiness_score)}`}
            style={{ width: `${Math.max(4, Math.min(100, Number(standard.readiness_score || 0)))}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <Metric label="Cobertura" value={formatPercent(standard.coverage_pct)} />
        <Metric label="Brechas" value={formatNumber(standard.gaps_count)} />
        <Metric label="Riesgos altos" value={formatNumber(riskCount)} />
        <Metric label="Acciones abiertas" value={formatNumber(standard.recommended_actions_open)} />
        <Metric label="Documentos" value={formatNumber(standard.documents_generated)} />
        <Metric label="Planes abiertos" value={formatNumber(standard.open_action_plans)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href="/acciones-recomendadas" className="rounded bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
          Ver acciones
        </a>
        <a href="/diagnostico" className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Diagnostico
        </a>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}
