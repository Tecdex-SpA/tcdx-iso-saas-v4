'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken } from '@/utils/auth';
import DashboardV2Header from './DashboardV2Header';
import DashboardV2Panel from './DashboardV2Panel';
import DashboardV2StandardCard from './DashboardV2StandardCard';
import DashboardV2Tabs from './DashboardV2Tabs';
import type { DashboardV2Response } from './types';
import { chipClass, statusLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

type ApiEnvelope = Partial<DashboardV2Response> & {
  ok?: boolean;
  data?: DashboardV2Response;
  error?: string;
};

function emptyData(): DashboardV2Response {
  return {
    executive_readiness: {
      headline: 'Sin datos suficientes',
      score: 0,
      readiness_label: 'sin_datos',
      statement: 'Aun no hay datos suficientes para calcular readiness.',
      blockers: [],
      blockers_summary: 'Sin datos suficientes',
    },
    general_health: {
      score: 0,
      label: 'sin_datos',
      coverage_pct: 0,
      status: 'limited',
    },
    audit_readiness: {
      score: 0,
      label: 'sin_datos',
      message: 'Sin datos suficientes',
      blockers: [],
    },
    active_standards: [],
    summary: {
      active_standards: 0,
      operational_versions: 0,
      transition_versions: 0,
      readiness_score: 0,
      coverage_pct: 0,
      pending_actions: 0,
      converted_actions: 0,
      high_risks: 0,
      open_findings: 0,
      open_nonconformities: 0,
      open_action_plans: 0,
    },
    alerts: [],
    priorities: [],
    tabs: [
      { key: 'resumen', title: 'Resumen', status: 'empty', metric: 0 },
      { key: 'salud_iso', title: 'Salud ISO', status: 'prepared', metric: 0 },
      { key: 'ciclo_vida', title: 'Ciclo de vida', status: 'prepared', metric: 0 },
      { key: 'acciones', title: 'Acciones', status: 'prepared', metric: 0 },
      { key: 'riesgos', title: 'Riesgos', status: 'prepared', metric: 0 },
      { key: 'kpis', title: 'KPIs', status: 'prepared', metric: 0 },
      { key: 'alertas', title: 'Alertas', status: 'prepared', metric: 0 },
    ],
    data_quality: { level: 'limited', notes: [] },
  };
}

export default function DashboardV2() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardV2Response>(emptyData());
  const [activeTab, setActiveTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async (activeToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard-v2/summary`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    const text = await response.text();
    let json: ApiEnvelope | null = null;

    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error('Respuesta invalida desde Dashboard v2.');
    }

    if (!response.ok || json?.ok === false || !json) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sesion no valida o sin permisos para Dashboard v2.');
      }
      throw new Error(json?.error || 'No fue posible cargar Dashboard v2.');
    }

    return (json.data || json) as DashboardV2Response;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const next = await loadSummary(token);
      setData({
        ...emptyData(),
        ...next,
        executive_readiness: { ...emptyData().executive_readiness, ...(next.executive_readiness || {}) },
        general_health: { ...emptyData().general_health, ...(next.general_health || {}) },
        audit_readiness: { ...emptyData().audit_readiness, ...(next.audit_readiness || {}) },
        active_standards: Array.isArray(next.active_standards) ? next.active_standards : [],
        alerts: Array.isArray(next.alerts) ? next.alerts : [],
        priorities: Array.isArray(next.priorities) ? next.priorities : [],
        tabs: Array.isArray(next.tabs) && next.tabs.length ? next.tabs : emptyData().tabs,
        summary: { ...emptyData().summary, ...(next.summary || {}) },
        data_quality: next.data_quality || { level: 'limited', notes: [] },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Dashboard v2.');
    } finally {
      setLoading(false);
    }
  }, [loadSummary, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    setToken(validToken);

    if (!validToken) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver Dashboard v2.');
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [refresh, token]);

  const standards = useMemo(
    () => [...data.active_standards].sort((a, b) => Number(a.readiness_score || 0) - Number(b.readiness_score || 0)),
    [data.active_standards]
  );

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardV2Header data={data} loading={loading} onRefresh={refresh} />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {data.data_quality?.notes && data.data_quality.notes.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Calidad de datos {statusLabel(data.data_quality.level)}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.data_quality.notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <DashboardV2Tabs tabs={data.tabs} activeTab={activeTab} onChange={setActiveTab} />

        {loading && (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && !error && standards.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Sin normas activas contratadas</div>
            <p className="mt-2 text-sm text-slate-500">
              Dashboard v2 no muestra normas no contratadas ni estados en cero de normas fuera del alcance del tenant.
            </p>
          </div>
        )}

        {!loading && !error && standards.length > 0 && (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Normas contratadas</h2>
                  <p className="mt-1 text-xs text-slate-500">Solo tarjetas activas del tenant actual.</p>
                </div>
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(data.general_health.status)}`}>
                  {statusLabel(data.general_health.status)}
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {standards.map((standard) => (
                  <DashboardV2StandardCard
                    key={`${standard.standard_code}-${standard.version_code}`}
                    standard={standard}
                  />
                ))}
              </div>
            </section>

            <DashboardV2Panel activeTab={activeTab} data={data} />

            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Base para personalizacion futura</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Los bloques ya quedan declarados para ordenamiento, layout por usuario y tarjetas movibles en fases siguientes.
                  </p>
                </div>
                <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  {data.customization?.layout_version || 'dashboard_v2_base'}
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
