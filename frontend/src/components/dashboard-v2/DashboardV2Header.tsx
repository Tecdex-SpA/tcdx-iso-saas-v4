import type { DashboardV2Response } from './types';
import { formatDateTime, formatNumber, formatPercent, scoreClass, statusLabel } from './utils';

type Props = {
  data: DashboardV2Response;
  loading: boolean;
  onRefresh: () => void;
};

export default function DashboardV2Header({ data, loading, onRefresh }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_390px]">
        <div className="p-6 lg:p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Nuevo Dashboard</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950">
            Dashboard ejecutivo ISO
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Vista base para operar cumplimiento, readiness de auditoria, salud ISO, acciones, riesgos, KPIs y alertas desde un solo lugar.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Refrescar estado'}
            </button>
            <a href="/acciones-recomendadas" className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Acciones recomendadas
            </a>
            <a href="/dashboard?view=iso" className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Centro ISO
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
            {data.tenant?.name || 'Empresa'}
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-semibold">{formatPercent(data.executive_readiness.score)}</span>
            <span className="mb-2 rounded bg-white/10 px-2 py-1 text-xs font-semibold">
              {statusLabel(data.executive_readiness.readiness_label)}
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/12">
            <div
              className={`h-2 rounded-full ${scoreClass(data.executive_readiness.score)}`}
              style={{ width: `${Math.max(4, Math.min(100, Number(data.executive_readiness.score || 0)))}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-white/72">{data.executive_readiness.headline}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <DarkMetric label="Normas activas" value={formatNumber(data.summary.active_standards)} />
            <DarkMetric label="Cobertura" value={formatPercent(data.summary.coverage_pct)} />
            <DarkMetric label="Acciones" value={formatNumber(data.summary.pending_actions)} />
            <DarkMetric label="Riesgos altos" value={formatNumber(data.summary.high_risks)} />
          </div>
          <div className="mt-4 text-xs text-white/48">
            Ultima actualizacion: {formatDateTime(data.last_updated_at)}
          </div>
        </div>
      </div>
    </section>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-white/8 p-3">
      <div className="text-white/58">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
