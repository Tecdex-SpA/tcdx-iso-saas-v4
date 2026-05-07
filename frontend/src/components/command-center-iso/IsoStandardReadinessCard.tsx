import type { IsoStandardReadiness } from './types';
import { formatNumber, formatPercent, label, scoreBarClass, semaphoreClass } from './utils';

type Props = {
  standard: IsoStandardReadiness;
};

export default function IsoStandardReadinessCard({ standard }: Props) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-950">
            {standard.standard_code} · {standard.version_code}
          </div>
          <div className="mt-1 text-xs text-gray-500">{standard.display_name || 'Norma ISO activa'}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${semaphoreClass(standard.semaphore)}`}>
          {label(standard.semaphore)}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Readiness</span>
          <span className="font-semibold text-gray-900">{formatPercent(standard.readiness_score)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full ${scoreBarClass(standard.readiness_score)}`}
            style={{ width: `${Math.max(4, Math.min(100, Number(standard.readiness_score || 0)))}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Cobertura</div>
          <div className="mt-1 font-semibold text-gray-950">{formatPercent(standard.coverage_pct)}</div>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Sin mapear</div>
          <div className="mt-1 font-semibold text-gray-950">{formatNumber(standard.unlinked_iso_controls)}</div>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Acciones abiertas</div>
          <div className="mt-1 font-semibold text-gray-950">{formatNumber(standard.recommended_actions_open)}</div>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Riesgos altos</div>
          <div className="mt-1 font-semibold text-gray-950">{formatNumber(standard.high_risks + standard.critical_risks)}</div>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Docs</div>
          <div className="mt-1 font-semibold text-gray-950">{formatNumber(standard.documents_generated)}</div>
        </div>
        <div className="rounded bg-gray-50 p-3">
          <div className="text-gray-500">Hallazgos/NC</div>
          <div className="mt-1 font-semibold text-gray-950">{formatNumber(standard.open_findings + standard.open_nonconformities)}</div>
        </div>
      </div>
    </article>
  );
}
