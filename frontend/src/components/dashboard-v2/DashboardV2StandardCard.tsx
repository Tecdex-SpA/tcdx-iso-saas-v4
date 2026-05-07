import type { DashboardV2Standard } from './types';
import { chipClass, formatDateTime, formatNumber, formatPercent, scoreClass, statusLabel } from './utils';

type Props = {
  standard: DashboardV2Standard;
};

export default function DashboardV2StandardCard({ standard }: Props) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {standard.standard_code} · {standard.version_code}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            {standard.display_name || 'Norma contratada activa'}
          </p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(standard.health_status)}`}>
          {statusLabel(standard.health_status)}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Readiness</span>
          <span className="font-semibold text-slate-950">{formatPercent(standard.readiness_score)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${scoreClass(standard.readiness_score)}`}
            style={{ width: `${Math.max(4, Math.min(100, Number(standard.readiness_score || 0)))}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <Metric label="Salud/Cobertura" value={formatPercent(standard.coverage_pct)} />
        <Metric label="Brechas" value={formatNumber(standard.open_gaps)} />
        <Metric label="Riesgos altos" value={formatNumber(standard.high_risks)} />
        <Metric label="Acciones" value={formatNumber(standard.pending_actions)} />
        <Metric label="Ciclo de vida" value={statusLabel(standard.lifecycle_status)} />
        <Metric label="Docs" value={formatNumber(standard.documents_generated)} />
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Ultima revision: {formatDateTime(standard.last_reviewed_at || standard.updated_at)}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-950">{value}</div>
    </div>
  );
}
