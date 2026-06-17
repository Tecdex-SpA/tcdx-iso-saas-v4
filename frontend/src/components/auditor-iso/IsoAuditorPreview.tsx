'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken } from '@/utils/auth';
import type { IsoStandardReadiness } from '@/components/command-center-iso/types';
import { formatNumber, formatPercent, priorityClass, readinessClass, statusLabel } from '@/components/centro-control-iso/utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

type AuditQuestion = {
  question_code?: string | null;
  question_text: string;
  clause_code?: string | null;
  category?: string | null;
};

type AuditArea = {
  standard_code?: string | null;
  version_code?: string | null;
  severity?: string | null;
  title: string;
  recommendation?: string | null;
  route?: string | null;
};

type AuditorResponse = {
  ok?: boolean;
  tenant_id?: string;
  standards: IsoStandardReadiness[];
  summary: {
    readiness_score: number;
    readiness_label: string;
    contracted_standards: number;
    open_actions: number;
    converted_actions: number;
    high_risks: number;
    open_findings: number;
    open_nonconformities: number;
  };
  areas_of_review: AuditArea[];
  audit_questions: Array<{
    standard_code: string;
    version_code: string;
    questions: AuditQuestion[];
  }>;
  evidence_focus: Array<{
    standard_code: string;
    version_code: string;
    gaps_count: number;
    unlinked_iso_controls: number;
    recommendation: string;
  }>;
  warnings: Array<{ title: string; message?: string | null }>;
  data_quality?: { level: string; notes?: string[] };
  data?: AuditorResponse;
  error?: string;
};

function emptyData(): AuditorResponse {
  return {
    standards: [],
    summary: {
      readiness_score: 0,
      readiness_label: 'sin_datos',
      contracted_standards: 0,
      open_actions: 0,
      converted_actions: 0,
      high_risks: 0,
      open_findings: 0,
      open_nonconformities: 0,
    },
    areas_of_review: [],
    audit_questions: [],
    evidence_focus: [],
    warnings: [],
    data_quality: { level: 'limited', notes: [] },
  };
}

export default function IsoAuditorPreview() {
  const [token, setToken] = useState<string | null>(null);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [data, setData] = useState<AuditorResponse>(emptyData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPreview = useCallback(async (activeToken: string, standardCode = '') => {
    const query = standardCode ? `?standard_code=${encodeURIComponent(standardCode)}` : '';
    const response = await fetch(`${API_BASE_URL}/api/iso-auditor/preview${query}`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    const text = await response.text();
    let json: AuditorResponse | null = null;

    try {
      json = text ? JSON.parse(text) as AuditorResponse : null;
    } catch {
      throw new Error('Respuesta invalida desde Auditor ISO.');
    }

    if (!response.ok || json?.ok === false || !json) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sesion no valida o sin permisos para Auditor ISO.');
      }
      throw new Error(json?.error || 'No fue posible cargar Auditor ISO.');
    }

    return (json.data || json) as AuditorResponse;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');
      const next = await loadPreview(token, selectedStandard);
      setData({ ...emptyData(), ...next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Auditor ISO.');
    } finally {
      setLoading(false);
    }
  }, [loadPreview, selectedStandard, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    setToken(validToken);

    if (!validToken) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver el Auditor ISO.');
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [refresh, token]);

  const standards = data.standards || [];
  const questions = useMemo(
    () => data.audit_questions.flatMap((group) =>
      group.questions.map((question) => ({
        ...question,
        standard_code: group.standard_code,
        version_code: group.version_code,
      }))
    ),
    [data.audit_questions]
  );

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-slate-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Auditor ISO asistido</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Preauditoria guiada por datos operativos</h1>
              <p className="mt-2 text-sm text-slate-600">
                Analiza solo normas contratadas del tenant: readiness, brechas, riesgos, acciones, evidencia esperada y preguntas sugeridas.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedStandard}
                onChange={(event) => setSelectedStandard(event.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todas las normas</option>
                {standards.map((standard) => (
                  <option key={`${standard.standard_code}-${standard.version_code}`} value={standard.standard_code}>
                    {standard.standard_code} {standard.version_code}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={refresh}
                disabled={loading || !token}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? 'Analizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
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
            <div className="text-lg font-semibold">Sin normas contratadas activas</div>
            <p className="mt-2 text-sm text-slate-500">No hay normas disponibles para preauditoria en este tenant.</p>
          </div>
        )}

        {!loading && !error && standards.length > 0 && (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <Kpi label="Readiness" value={formatPercent(data.summary.readiness_score)} tone="bg-slate-950 text-white" />
              <Kpi label="Normas" value={formatNumber(data.summary.contracted_standards)} tone="bg-white text-slate-950" />
              <Kpi label="Riesgos altos" value={formatNumber(data.summary.high_risks)} tone="bg-white text-slate-950" />
              <Kpi label="Acciones abiertas" value={formatNumber(data.summary.open_actions)} tone="bg-white text-slate-950" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-950">Normas en preauditoria</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {standards.map((standard) => (
                      <div key={`${standard.standard_code}-${standard.version_code}`} className="rounded border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">{standard.standard_code} {standard.version_code}</div>
                            <div className="text-xs text-slate-500">{standard.display_name || 'Norma activa'}</div>
                          </div>
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">
                            {statusLabel(standard.readiness_label)}
                          </span>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${readinessClass(standard.readiness_score)}`}
                            style={{ width: `${Math.max(4, Math.min(100, Number(standard.readiness_score || 0)))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-950">Areas de revision</h2>
                  <div className="mt-4 space-y-3">
                    {data.areas_of_review.length === 0 && (
                      <div className="rounded bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        No hay areas criticas calculadas con los datos actuales.
                      </div>
                    )}
                    {data.areas_of_review.map((area, index) => (
                      <a key={`${area.title}-${index}`} href={area.route || '/acciones-recomendadas'} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{area.title}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {area.standard_code} {area.version_code} · {area.recommendation || 'Revision sugerida'}
                            </div>
                          </div>
                          <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(area.severity)}`}>
                            {area.severity || 'media'}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-950">Preguntas sugeridas</h2>
                  <div className="mt-4 space-y-3">
                    {questions.slice(0, 10).map((question, index) => (
                      <div key={`${question.question_code || index}`} className="rounded bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-blue-700">
                          {question.standard_code} · {question.category || 'auditoria'}
                        </div>
                        <div className="mt-1 text-sm text-slate-800">{question.question_text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-950">Foco de evidencia</h2>
                  <div className="mt-4 space-y-3">
                    {data.evidence_focus.length === 0 && (
                      <div className="text-sm text-slate-500">No hay foco de evidencia pendiente detectado.</div>
                    )}
                    {data.evidence_focus.map((item) => (
                      <div key={`${item.standard_code}-${item.version_code}`} className="rounded border border-slate-200 p-3 text-sm">
                        <div className="font-semibold">{item.standard_code} {item.version_code}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatNumber(item.gaps_count)} brechas · {formatNumber(item.unlinked_iso_controls)} controles sin mapeo
                        </div>
                        <div className="mt-2 text-xs text-slate-600">{item.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 p-5 shadow-sm ${tone}`}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
