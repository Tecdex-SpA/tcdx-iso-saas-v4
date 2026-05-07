'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken } from '@/utils/auth';
import IsoActivityTimeline from './IsoActivityTimeline';
import IsoExecutiveSummary from './IsoExecutiveSummary';
import IsoPriorityList from './IsoPriorityList';
import IsoRiskActionOverview from './IsoRiskActionOverview';
import IsoStandardReadinessCard from './IsoStandardReadinessCard';
import type { IsoCommandCenterResponse } from './types';
import { label } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

type ApiEnvelope = Partial<IsoCommandCenterResponse> & {
  ok?: boolean;
  error?: string;
  data?: IsoCommandCenterResponse;
};

function emptyResponse(): IsoCommandCenterResponse {
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
    },
    standards: [],
    priorities: [],
    activity: [],
    data_quality: { level: 'limited', notes: [] },
  };
}

export default function IsoCommandCenterDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<IsoCommandCenterResponse>(emptyResponse());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async (activeToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/iso-command-center/summary`, {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    const text = await response.text();
    let json: ApiEnvelope | null = null;
    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error('Respuesta invalida desde Command Center ISO.');
    }

    if (!response.ok || json?.ok === false || !json) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sesion no valida o sin permisos para Command Center ISO.');
      }
      throw new Error(json?.error || 'No fue posible cargar Command Center ISO.');
    }

    return (json.data || json) as IsoCommandCenterResponse;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const next = await loadSummary(token);
      setData({
        ...emptyResponse(),
        ...next,
        summary: next.summary || emptyResponse().summary,
        standards: Array.isArray(next.standards) ? next.standards : [],
        priorities: Array.isArray(next.priorities) ? next.priorities : [],
        activity: Array.isArray(next.activity) ? next.activity : [],
        data_quality: next.data_quality || { level: 'limited', notes: [] },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Command Center ISO.');
    } finally {
      setLoading(false);
    }
  }, [loadSummary, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    setToken(validToken);

    if (!validToken) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver el Command Center ISO.');
    }
  }, []);

  useEffect(() => {
    if (token) {
      refresh();
    }
  }, [refresh, token]);

  const topStandards = useMemo(
    () => [...data.standards].sort((a, b) => Number(a.readiness_score || 0) - Number(b.readiness_score || 0)),
    [data.standards]
  );

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-gray-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Command Center ISO
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-950">
                Estado ejecutivo de cumplimiento ISO
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Vista consolidada de readiness, riesgos, documentos, acciones recomendadas, conversiones y brechas por norma.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="/acciones-recomendadas" className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
                  Ver acciones recomendadas
                </a>
                <a href="/diagnostico" className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-50">
                  Ver diagnostico ISO
                </a>
                <a href="/matriz-riesgo" className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-50">
                  Ver matriz de riesgos
                </a>
                <a href="/plan-accion" className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-50">
                  Ver planes
                </a>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <button
                type="button"
                onClick={refresh}
                disabled={loading || !token}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
              <span className="text-xs text-gray-500">
                Calidad de datos: {label(data.data_quality?.level)}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data.data_quality?.notes && data.data_quality.notes.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Datos parciales</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.data_quality.notes.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-lg border border-gray-200 bg-white" />
            <div className="grid gap-4 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-64 animate-pulse rounded-lg border border-gray-200 bg-white" />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <IsoExecutiveSummary summary={data.summary} />

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-950">Readiness por norma</h2>
                <span className="text-xs text-gray-500">{data.standards.length} norma(s) evaluables</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {topStandards.map((standard) => (
                  <IsoStandardReadinessCard
                    key={`${standard.standard_code}-${standard.version_code}`}
                    standard={standard}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <div className="space-y-6">
                <IsoPriorityList priorities={data.priorities} />
                <IsoRiskActionOverview summary={data.summary} />
              </div>
              <IsoActivityTimeline activity={data.activity} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
