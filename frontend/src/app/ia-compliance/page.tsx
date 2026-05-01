'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type EngineHealthResponse = {
  ok: boolean;
  data?: {
    ok?: boolean;
    service?: string;
    env?: string;
    db_connection?: boolean;
  };
};

type HealthSummaryResponse = {
  ok: boolean;
  context?: {
    tenant_id: string;
    tenant_name: string;
    standards: string[];
    controls_total: number;
    controls_warning: number;
    controls_critical: number;
    evidences_pending: number;
    findings_critical: number;
  };
  ai?: {
    ok?: boolean;
    type?: string;
    summary?: string;
    suggestions?: string[];
    confidence?: string;
    source?: string;
  };
};

type ExecutiveBriefResponse = {
  ok: boolean;
  context?: any;
  ai?: {
    headline: string;
    executive_summary: string;
    top_priorities: string[];
    management_actions: string[];
    confidence?: string;
  };
};

type SuggestionRow = {
  id: string;
  suggestion_type: string;
  title: string | null;
  status: string;
  confidence: string | null;
  created_at: string;
  output_payload: Record<string, any> | null;
};

export default function IaCompliancePage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState('');

  const [engineHealth, setEngineHealth] = useState<EngineHealthResponse | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummaryResponse | null>(null);
  const [executiveBrief, setExecutiveBrief] = useState<ExecutiveBriefResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (!authToken || !u?.tenant_id) {
      setLoading(false);
      setError('No se pudo obtener la sesión del usuario.');
      return;
    }

    loadAll();
  }, []);

  const getWithAuth = async (url: string) => {
    const authToken = localStorage.getItem('token');

    if (!authToken) {
      window.location.href = '/login';
      throw new Error('Sesión no disponible');
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const text = await res.text();

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta inválida desde ${url}`);
    }

    if (!res.ok) {
      throw new Error(json?.error || json?.detail || 'Error consultando IA Compliance');
    }

    return json;
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');

      const [engine, health, drafts] = await Promise.all([
        getWithAuth(`${API_URL}/api/ai-compliance/engine-health`),
        getWithAuth(`${API_URL}/api/ai-compliance/health-summary`),
        getWithAuth(`${API_URL}/api/ai-compliance/suggestions`),
      ]);

      setEngineHealth(engine);
      setHealthSummary(health);
      setSuggestions(Array.isArray(drafts?.data) ? drafts.data.slice(0, 6) : []);
    } catch (err: any) {
      console.error('ERROR LOAD IA COMPLIANCE DASHBOARD:', err);
      setError(err.message || 'No fue posible cargar IA Compliance.');
    } finally {
      setLoading(false);
    }
  };

  const loadExecutiveBrief = async () => {
    try {
      setBriefLoading(true);
      setError('');

      const brief = await getWithAuth(
        `${API_URL}/api/ai-compliance/executive-brief?period=Periodo%20actual`
      );

      setExecutiveBrief(brief);
    } catch (err: any) {
      console.error('ERROR LOAD EXECUTIVE BRIEF IA COMPLIANCE:', err);
      setError(err.message || 'No fue posible generar el resumen gerencial IA.');
    } finally {
      setBriefLoading(false);
    }
  };

  const engineOk = Boolean(engineHealth?.data?.ok);
  const engineDbOk = Boolean(engineHealth?.data?.db_connection);
  const healthContext = healthSummary?.context || null;
  const healthAi = healthSummary?.ai || null;
  const executiveData = executiveBrief?.ai || null;

  const suggestionMetrics = useMemo(() => {
    return {
      total: suggestions.length,
      drafts: suggestions.filter((row) => row.status !== 'applied').length,
      applied: suggestions.filter((row) => row.status === 'applied').length,
    };
  }, [suggestions]);

  const standardsLabel = useMemo(() => {
    if (!healthContext?.standards?.length) return 'Sin normas activas';
    return healthContext.standards.join(' · ');
  }, [healthContext]);

  const isSeniorAuditorSuggestionType = (value: string) =>
    [
      'senior_auditor_task',
      'senior_auditor_risk_alert',
      'senior_auditor_evidence_gap',
      'senior_auditor_insight',
    ].includes(value);

  const getSuggestionTypeLabel = (value: string) => {
    switch (value) {
      case 'finding_analysis':
        return 'Análisis de hallazgo';
      case 'action_plan_suggestion':
        return 'Plan sugerido';
      case 'senior_auditor_task':
        return 'Tarea auditor senior';
      case 'senior_auditor_risk_alert':
        return 'Alerta riesgo senior';
      case 'senior_auditor_evidence_gap':
        return 'Brecha evidencia senior';
      case 'senior_auditor_insight':
        return 'Insight auditor senior';
      case 'nonconformity_draft':
        return 'Borrador NC';
      case 'executive_brief':
        return 'Resumen gerencial';
      default:
        return value || 'Sugerencia';
    }
  };

  const getSuggestionBadge = (value: string) => {
    switch (value) {
      case 'finding_analysis':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'action_plan_suggestion':
        return 'border-violet-200 bg-violet-50 text-violet-700';
      case 'senior_auditor_task':
      case 'senior_auditor_risk_alert':
      case 'senior_auditor_evidence_gap':
      case 'senior_auditor_insight':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'nonconformity_draft':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'executive_brief':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  const getSuggestionPreview = (row: SuggestionRow) => {
    const output = row.output_payload || {};

    if (row.suggestion_type === 'finding_analysis') {
      return String(output.summary || row.title || 'Análisis IA');
    }

    if (row.suggestion_type === 'action_plan_suggestion') {
      return String(output.objective || row.title || 'Plan sugerido IA');
    }

    if (isSeniorAuditorSuggestionType(row.suggestion_type)) {
      return String(
        output.title ||
          output.recommended_action ||
          output.summary ||
          row.title ||
          'Sugerencia auditor senior'
      );
    }

    if (row.suggestion_type === 'nonconformity_draft') {
      return String(output.statement || row.title || 'Borrador IA');
    }

    if (row.suggestion_type === 'executive_brief') {
      return String(output.headline || row.title || 'Resumen gerencial');
    }

    return String(row.title || 'Sugerencia IA');
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f7fb] p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">IA Compliance</h1>
            <p className="mt-1 text-sm text-slate-500">
              Centro de apoyo inteligente para cumplimiento, remediación y seguimiento ejecutivo.
            </p>
            {healthContext?.tenant_name && (
              <p className="mt-2 text-sm text-slate-700">
                Empresa: <span className="font-semibold">{healthContext.tenant_name}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refrescar
            </button>

            <button
              type="button"
              onClick={loadExecutiveBrief}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              {briefLoading ? 'Generando...' : 'Resumen gerencial IA'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
            Cargando IA Compliance...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Motor IA"
                value={engineOk ? 'OK' : 'Error'}
                tone={engineOk ? 'green' : 'red'}
              />
              <MetricCard
                title="Conexión BD motor"
                value={engineDbOk ? 'OK' : 'Error'}
                tone={engineDbOk ? 'green' : 'red'}
              />
              <MetricCard
                title="Controles activos"
                value={String(healthContext?.controls_total || 0)}
              />
              <MetricCard
                title="Controles en atención"
                value={String(healthContext?.controls_warning || 0)}
                tone="amber"
              />
              <MetricCard
                title="Evidencias pendientes"
                value={String(healthContext?.evidences_pending || 0)}
                tone="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Resumen de salud IA
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Interpretación ejecutiva del estado actual del tenant.
                    </p>
                  </div>

                  {healthAi?.confidence && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      Confianza: {healthAi.confidence}
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Normas activas
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {standardsLabel}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                  {healthAi?.summary || 'Sin resumen IA disponible.'}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title="Controles deteriorados"
                    value={String(healthContext?.controls_critical || 0)}
                    tone="red"
                  />
                  <InfoCard
                    title="Hallazgos críticos"
                    value={String(healthContext?.findings_critical || 0)}
                    tone="red"
                  />
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    Recomendaciones IA
                  </div>

                  {Array.isArray(healthAi?.suggestions) && healthAi.suggestions.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {healthAi.suggestions.map((item: string, index: number) => (
                        <li key={`health-suggestion-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">
                      Sin recomendaciones disponibles.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">Accesos rápidos</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Atajos a los módulos donde IA ya está integrada.
                </p>

                <div className="mt-4 space-y-3">
                  <QuickLink
                    href="/hallazgos"
                    title="Hallazgos"
                    description="Analizar y aplicar IA sobre hallazgos."
                  />
                  <QuickLink
                    href="/no-conformidades"
                    title="No conformidades"
                    description="Redacción IA y creación de acción desde borrador."
                  />
                  <QuickLink
                    href="/plan-accion"
                    title="Plan de acción"
                    description="Aplicar planes sugeridos IA al plan real."
                  />
                  <QuickLink
                    href="/ia-compliance/sugerencias"
                    title="Sugerencias IA guardadas"
                    description="Revisar borradores, trazabilidad y aplicar."
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    Sugerencias recientes
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Pendientes: <span className="font-semibold">{suggestionMetrics.drafts}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Aplicadas: <span className="font-semibold">{suggestionMetrics.applied}</span>
                  </div>
                </div>
              </div>
            </div>

            {executiveData && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-violet-500 font-bold">
                      Resumen gerencial IA
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {executiveData.headline}
                    </h2>
                  </div>

                  {executiveData.confidence && (
                    <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                      Confianza: {executiveData.confidence}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-violet-100 bg-white p-4 text-sm leading-7 text-slate-700">
                  {executiveData.executive_summary}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-violet-100 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">
                      Prioridades
                    </div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {(executiveData.top_priorities || []).map(
                        (item: string, index: number) => (
                          <li key={`brief-priority-${index}`}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-violet-100 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">
                      Acciones de gerencia
                    </div>
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {(executiveData.management_actions || []).map(
                        (item: string, index: number) => (
                          <li key={`brief-action-${index}`}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Últimas sugerencias guardadas
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Vista rápida de actividad reciente del módulo IA.
                  </p>
                </div>

                <Link
                  href="/ia-compliance/sugerencias"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ver todas
                </Link>
              </div>

              {suggestions.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">
                  Aún no hay sugerencias guardadas.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {suggestions.map((row: SuggestionRow) => (
                    <div
                      key={row.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-4xl">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSuggestionBadge(
                                row.suggestion_type
                              )}`}
                            >
                              {getSuggestionTypeLabel(row.suggestion_type)}
                            </span>

                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {row.status || 'draft'}
                            </span>
                          </div>

                          <div className="mt-3 text-sm font-semibold text-slate-900">
                            {getSuggestionPreview(row)}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatDateTime(row.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  tone = 'slate',
}: {
  title: string;
  value: string;
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'red'
      ? 'text-red-700'
      : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'blue'
      ? 'text-blue-700'
      : 'text-slate-900';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  tone = 'slate',
}: {
  title: string;
  value: string;
  tone?: 'slate' | 'red' | 'amber' | 'blue' | 'green';
}) {
  const toneClass =
    tone === 'red'
      ? 'text-red-700'
      : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'blue'
      ? 'text-blue-700'
      : tone === 'green'
      ? 'text-emerald-700'
      : 'text-slate-900';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </Link>
  );
}
