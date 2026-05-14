'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken } from '@/utils/auth';
import IsoActivityTimeline from '@/components/command-center-iso/IsoActivityTimeline';
import IsoNormCard from './IsoNormCard';
import IsoPriorityPanel from './IsoPriorityPanel';
import IsoQuickLinks from './IsoQuickLinks';
import IsoWorkflowSummary from './IsoWorkflowSummary';
import type { UnifiedIsoResponse } from './types';
import { formatNumber, formatPercent, readinessClass, statusLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

type ApiEnvelope = Partial<UnifiedIsoResponse> & {
  ok?: boolean;
  data?: UnifiedIsoResponse;
  error?: string;
};

function emptyData(): UnifiedIsoResponse {
  return {
    summary: {
      active_standards: 0,
      certifiable_standards: 0,
      transition_standards: 0,
      iso_controls_total: 0,
      iso_controls_linked: 0,
      coverage_pct: 0,
      recommended_actions_open: 0,
      recommended_actions_converted: 0,
      high_risks: 0,
      open_findings: 0,
      open_nonconformities: 0,
      open_action_plans: 0,
      readiness_score: 0,
      readiness_label: 'sin_datos',
      contracted_standards: 0,
      total_versions_evaluated: 0,
    },
    standard_cards: [],
    priorities: [],
    activity: [],
    alerts: [],
    quick_links: [],
    data_quality: { level: 'limited', notes: [] },
  };
}

export default function UnifiedIsoCommandCenter() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<UnifiedIsoResponse>(emptyData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async (activeToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/iso-command-center/unified`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    const text = await response.text();
    let json: ApiEnvelope | null = null;

    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error('Respuesta invalida desde Centro de Control ISO.');
    }

    if (!response.ok || json?.ok === false || !json) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sesion no valida o sin permisos para Centro de Control ISO.');
      }
      throw new Error(json?.error || 'No fue posible cargar Centro de Control ISO.');
    }

    return (json.data || json) as UnifiedIsoResponse;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const next = await loadData(token);
      setData({
        ...emptyData(),
        ...next,
        summary: { ...emptyData().summary, ...(next.summary || {}) },
        standard_cards: Array.isArray(next.standard_cards) ? next.standard_cards : [],
        priorities: Array.isArray(next.priorities) ? next.priorities : [],
        activity: Array.isArray(next.activity) ? next.activity : [],
        alerts: Array.isArray(next.alerts) ? next.alerts : [],
        quick_links: Array.isArray(next.quick_links) ? next.quick_links : [],
        data_quality: next.data_quality || { level: 'limited', notes: [] },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Centro de Control ISO.');
    } finally {
      setLoading(false);
    }
  }, [loadData, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    setToken(validToken);

    if (!validToken) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver el Centro de Control ISO.');
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [refresh, token]);

  const standards = useMemo(
    () => [...data.standard_cards].sort((a, b) => Number(a.readiness_score || 0) - Number(b.readiness_score || 0)),
    [data.standard_cards]
  );

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_360px]">
            <div className="p-6 lg:p-7">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Centro de Control ISO</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-slate-950">
                Operacion diaria de cumplimiento, riesgos y acciones ISO
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Consolidación de brechas, riesgos, documentos, acciones y documentos operativos
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="/acciones-recomendadas" className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
                  Gestionar acciones
                </a>
                <a href="/auditorias?view=preauditoria" className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                  Abrir Auditor ISO
                </a>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading || !token}
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Readiness global</div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-5xl font-semibold">{formatPercent(data.summary.readiness_score)}</span>
                <span className="mb-2 rounded bg-white/10 px-2 py-1 text-xs font-semibold">{statusLabel(data.summary.readiness_label)}</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/12">
                <div
                  className={`h-2 rounded-full ${readinessClass(data.summary.readiness_score)}`}
                  style={{ width: `${Math.max(4, Math.min(100, Number(data.summary.readiness_score || 0)))}%` }}
                />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <DarkMetric label="Normas contratadas" value={formatNumber(data.summary.contracted_standards || data.standard_cards.length)} />
                <DarkMetric label="Cobertura" value={formatPercent(data.summary.coverage_pct)} />
                <DarkMetric label="Acciones abiertas" value={formatNumber(data.summary.recommended_actions_open)} />
                <DarkMetric label="Riesgos altos" value={formatNumber(data.summary.high_risks)} />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}

        {data.alerts.length > 0 && (
          <section className="grid gap-3 lg:grid-cols-2">
            {data.alerts.slice(0, 4).map((alert, index) => (
              <div key={`${alert.type}-${alert.title}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="font-semibold">{alert.title}</div>
                {alert.message && <div className="mt-1 text-xs">{alert.message}</div>}
              </div>
            ))}
          </section>
        )}

        {loading && (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && !error && standards.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Sin normas contratadas activas</div>
            <p className="mt-2 text-sm text-slate-500">
              Este tenant no tiene normas activas en tenant_standards, por eso no se muestran tarjetas ni metricas normativas.
            </p>
          </div>
        )}

        {!loading && !error && standards.length > 0 && (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-950">Normas contratadas</h2>
                <span className="text-xs text-slate-500">{standards.length} version(es) operativas visibles</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {standards.map((standard) => (
                  <IsoNormCard key={`${standard.standard_code}-${standard.version_code}`} standard={standard} />
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <div className="space-y-6">
                <IsoPriorityPanel priorities={data.priorities} />
                <IsoWorkflowSummary data={data} />
              </div>
              <div className="space-y-6">
                <IsoQuickLinks links={data.quick_links} />
                <IsoActivityTimeline activity={data.activity} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
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
