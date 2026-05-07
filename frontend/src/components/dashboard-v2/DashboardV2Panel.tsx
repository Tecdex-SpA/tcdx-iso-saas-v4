import type { ReactNode } from 'react';
import type { DashboardV2Response } from './types';
import { chipClass, formatNumber, priorityClass, statusLabel } from './utils';

type Props = {
  activeTab: string;
  data: DashboardV2Response;
};

export default function DashboardV2Panel({ activeTab, data }: Props) {
  if (activeTab === 'acciones') {
    return (
      <Panel title="Acciones recomendadas y trabajo pendiente" actionHref="/acciones-recomendadas">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Pendientes" value={data.summary.pending_actions} />
          <Metric label="Convertidas" value={data.summary.converted_actions} />
          <Metric label="Planes abiertos" value={data.summary.open_action_plans} />
        </div>
      </Panel>
    );
  }

  if (activeTab === 'riesgos') {
    return (
      <Panel title="Riesgos ISO prioritarios" actionHref="/matriz-riesgo">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Riesgos altos/criticos" value={data.summary.high_risks} />
          <Metric label="Normas con riesgo" value={data.work?.risks?.standards_with_risk || 0} />
        </div>
      </Panel>
    );
  }

  if (activeTab === 'kpis') {
    const kpis = data.work?.kpis;
    return (
      <Panel title="KPIs" actionHref="/dashboard-kpi">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Medidos" value={kpis?.measured_kpis || 0} />
          <Metric label="Verdes" value={kpis?.green || 0} />
          <Metric label="Amarillos" value={kpis?.yellow || 0} />
          <Metric label="Rojos" value={kpis?.red || 0} />
        </div>
      </Panel>
    );
  }

  if (activeTab === 'alertas') {
    return (
      <Panel title="Alertas inteligentes">
        <div className="space-y-3">
          {data.alerts.length === 0 && <Empty text="Sin alertas activas con los datos actuales." />}
          {data.alerts.slice(0, 8).map((alert, index) => (
            <a
              key={`${alert.type}-${alert.title}-${index}`}
              href={alert.route || '#'}
              className="block rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <div className="font-semibold">{alert.title}</div>
              {alert.message && <div className="mt-1 text-xs">{alert.message}</div>}
            </a>
          ))}
        </div>
      </Panel>
    );
  }

  if (activeTab === 'salud_iso' || activeTab === 'ciclo_vida') {
    return (
      <Panel title={activeTab === 'salud_iso' ? 'Salud ISO' : 'Ciclo de vida operativo'} actionHref={activeTab === 'salud_iso' ? '/health' : '/ciclo-vida'}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Cobertura" value={`${Number(data.summary.coverage_pct || 0).toFixed(1)}%`} />
          <Metric label="Hallazgos" value={data.summary.open_findings} />
          <Metric label="No conformidades" value={data.summary.open_nonconformities} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Resumen ejecutivo">
      <div className="space-y-4">
        <div className="rounded bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-950">{data.executive_readiness.headline}</div>
          <p className="mt-2 text-sm text-slate-600">{data.executive_readiness.statement}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Bloqueadores principales</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.executive_readiness.blockers.length === 0 && (
              <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass('ready')}`}>
                Sin bloqueadores criticos
              </span>
            )}
            {data.executive_readiness.blockers.map((blocker) => (
              <span key={blocker} className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass('attention')}`}>
                {blocker}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Prioridades</h3>
          <div className="mt-3 space-y-2">
            {data.priorities.length === 0 && <Empty text="No hay prioridades activas." />}
            {data.priorities.slice(0, 5).map((priority, index) => (
              <a key={`${priority.title}-${index}`} href={priority.route || '/acciones-recomendadas'} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{priority.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{priority.reason || 'Revision sugerida'}</div>
                  </div>
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(priority.priority)}`}>
                    {priority.priority}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Panel({ title, actionHref, children }: { title: string; actionHref?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {actionHref && (
          <a href={actionHref} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
            Abrir modulo
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-950">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded bg-slate-50 px-4 py-5 text-sm text-slate-500">
      {statusLabel(text)}
    </div>
  );
}
