'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

const IA_COMPLIANCE_COPY = {
  es: {
    title: 'IA Compliance',
    subtitle: '{copy.subtitle}',
    refresh: '{copy.refresh}',
    executiveBrief: '{copy.managementSummary}',
    generating: 'Generando...',
    loading: '{copy.loading}',
    sessionError: 'No se pudo obtener la sesión del usuario.',
    genericError: 'No fue posible cargar IA Compliance.',
    engineWarning: 'No fue posible conectar con AI Engine. Se muestran datos internos disponibles.',
    executiveBriefError: 'No fue posible generar el resumen gerencial IA.',
    engine: 'Motor IA',
    engineDb: 'Conexión BD motor',
    activeControls: 'Controles activos',
    attentionControls: 'Controles en atención',
    pendingEvidence: 'Evidencias pendientes',
    healthTitle: '{copy.healthTitle}',
    healthSubtitle: '{copy.healthSubtitle}',
    company: 'Empresa',
    activeStandards: '{copy.activeStandards}',
    noStandards: 'Sin normas activas',
    noSummary: 'Sin resumen IA disponible.',
    deterioratedControls: 'Controles deteriorados',
    criticalFindings: 'Hallazgos críticos',
    recommendations: '{copy.recommendations}',
    noRecommendations: '{copy.noRecommendations}',
    quickAccess: 'Accesos rápidos',
    quickAccessSubtitle: '{copy.quickAccessSubtitle}',
    findings: 'Hallazgos',
    findingsDesc: 'Analizar y aplicar IA sobre hallazgos.',
    nonconformities: 'No conformidades',
    nonconformitiesDesc: 'Redacción IA y creación de acción desde borrador.',
    actionPlan: 'Plan de acción',
    actionPlanDesc: 'Aplicar planes sugeridos IA al plan real.',
    savedSuggestions: 'Sugerencias IA guardadas',
    savedSuggestionsDesc: 'Revisar borradores, trazabilidad y aplicar.',
    recentSuggestions: '{copy.recentSuggestions}',
    pending: 'Pendientes',
    applied: 'Aplicadas',
    confidence: 'Confianza',
    managementSummary: '{copy.managementSummary}',
    priorities: '{copy.priorities}',
    managementActions: '{copy.managementActions}',
    latestSuggestions: '{copy.latestSuggestions}',
    latestSuggestionsSubtitle: '{copy.latestSuggestionsSubtitle}',
    viewAll: '{copy.viewAll}',
    noSavedSuggestions: '{copy.noSavedSuggestions}',
    ok: 'OK',
    error: 'Error',
    draft: 'draft',
    findingAnalysis: 'Análisis de hallazgo',
    suggestedPlan: 'Plan sugerido',
    seniorAuditorTask: 'Tarea auditor senior',
    seniorRiskAlert: 'Alerta riesgo senior',
    seniorEvidenceGap: 'Brecha evidencia senior',
    seniorInsight: 'Insight auditor senior',
    ncDraft: 'Borrador NC',
    suggestion: 'Sugerencia',
    aiAnalysis: 'Análisis IA',
    aiSuggestedPlan: 'Plan sugerido IA',
    seniorAuditorSuggestion: 'Sugerencia auditor senior',
    aiDraft: 'Borrador IA',
  },
  en: {
    title: 'AI Compliance',
    subtitle: 'Intelligent support center for compliance, remediation, and executive follow-up.',
    refresh: 'Refresh',
    executiveBrief: 'AI executive brief',
    generating: 'Generating...',
    loading: 'Loading AI Compliance...',
    sessionError: 'Could not obtain the user session.',
    genericError: 'AI Compliance could not be loaded.',
    engineWarning: 'AI Engine could not be reached. Available internal data is shown.',
    executiveBriefError: 'The AI executive brief could not be generated.',
    engine: 'AI Engine',
    engineDb: 'Engine DB connection',
    activeControls: 'Active controls',
    attentionControls: 'Controls requiring attention',
    pendingEvidence: 'Pending evidence',
    healthTitle: 'AI health summary',
    healthSubtitle: 'Executive interpretation of the current tenant status.',
    company: 'Company',
    activeStandards: 'Active standards',
    noStandards: 'No active standards',
    noSummary: 'No AI summary available.',
    deterioratedControls: 'Deteriorated controls',
    criticalFindings: 'Critical findings',
    recommendations: 'AI recommendations',
    noRecommendations: 'No recommendations available.',
    quickAccess: 'Quick access',
    quickAccessSubtitle: 'Shortcuts to modules where AI is already integrated.',
    findings: 'Findings',
    findingsDesc: 'Analyze and apply AI to findings.',
    nonconformities: 'Nonconformities',
    nonconformitiesDesc: 'AI drafting and action creation from draft.',
    actionPlan: 'Action plans',
    actionPlanDesc: 'Apply AI-suggested plans to the real action plan.',
    savedSuggestions: 'Saved AI suggestions',
    savedSuggestionsDesc: 'Review drafts, traceability, and apply.',
    recentSuggestions: 'Recent suggestions',
    pending: 'Pending',
    applied: 'Applied',
    confidence: 'Confidence',
    managementSummary: 'AI executive brief',
    priorities: 'Priorities',
    managementActions: 'Management actions',
    latestSuggestions: 'Latest saved suggestions',
    latestSuggestionsSubtitle: 'Quick view of recent AI module activity.',
    viewAll: 'View all',
    noSavedSuggestions: 'There are no saved suggestions yet.',
    ok: 'OK',
    error: 'Error',
    draft: 'draft',
    findingAnalysis: 'Finding analysis',
    suggestedPlan: 'Suggested plan',
    seniorAuditorTask: 'Senior auditor task',
    seniorRiskAlert: 'Senior risk alert',
    seniorEvidenceGap: 'Senior evidence gap',
    seniorInsight: 'Senior auditor insight',
    ncDraft: 'NC draft',
    suggestion: 'Suggestion',
    aiAnalysis: 'AI analysis',
    aiSuggestedPlan: 'AI suggested plan',
    seniorAuditorSuggestion: 'Senior auditor suggestion',
    aiDraft: 'AI draft',
  },
};

type IaComplianceCopy = typeof IA_COMPLIANCE_COPY.es;


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
  const { locale } = useTranslation();
  const copy: IaComplianceCopy = locale === 'en' ? IA_COMPLIANCE_COPY.en : IA_COMPLIANCE_COPY.es;
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
      setError(copy.sessionError);
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
        'x-tcdx-locale': locale,
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

      const [engineResult, healthResult, draftsResult] = await Promise.allSettled([
        getWithAuth(`${API_URL}/api/ai-compliance/engine-health`),
        getWithAuth(`${API_URL}/api/ai-compliance/health-summary`),
        getWithAuth(`${API_URL}/api/ai-compliance/suggestions`),
      ]);

      if (engineResult.status === 'fulfilled') {
        setEngineHealth(engineResult.value);
      } else {
        setEngineHealth({
          ok: true,
          data: {
            ok: false,
            service: 'ai-engine',
            env: 'unknown',
            db_connection: false,
          },
        });
      }

      if (healthResult.status === 'fulfilled') {
        setHealthSummary(healthResult.value);
      }

      if (draftsResult.status === 'fulfilled') {
        setSuggestions(Array.isArray(draftsResult.value?.data) ? draftsResult.value.data.slice(0, 6) : []);
      } else {
        setSuggestions([]);
      }

      if (
        engineResult.status === 'rejected' &&
        healthResult.status === 'rejected' &&
        draftsResult.status === 'rejected'
      ) {
        throw engineResult.reason || healthResult.reason || draftsResult.reason;
      }

      if (engineResult.status === 'rejected') {
        setError(copy.engineWarning);
      }
    } catch (err: any) {
      console.error('ERROR LOAD IA COMPLIANCE DASHBOARD:', err);
      setError(err.message || copy.genericError);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutiveBrief = async () => {
    try {
      setBriefLoading(true);
      setError('');

      const brief = await getWithAuth(
        `${API_URL}/api/ai-compliance/executive-brief?period=current`
      );

      setExecutiveBrief(brief);
    } catch (err: any) {
      console.error('ERROR LOAD EXECUTIVE BRIEF IA COMPLIANCE:', err);
      setError(err.message || copy.executiveBriefError);
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
    if (!healthContext?.standards?.length) return copy.noStandards;
    return healthContext.standards.join(' · ');
  }, [healthContext, copy.noStandards]);

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
        return copy.findingAnalysis;
      case 'action_plan_suggestion':
        return copy.suggestedPlan;
      case 'senior_auditor_task':
        return copy.seniorAuditorTask;
      case 'senior_auditor_risk_alert':
        return copy.seniorRiskAlert;
      case 'senior_auditor_evidence_gap':
        return copy.seniorEvidenceGap;
      case 'senior_auditor_insight':
        return copy.seniorInsight;
      case 'nonconformity_draft':
        return copy.ncDraft;
      case 'executive_brief':
        return copy.managementSummary;
      default:
        return value || copy.suggestion;
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
      return String(output.summary || row.title || copy.aiAnalysis);
    }

    if (row.suggestion_type === 'action_plan_suggestion') {
      return String(output.objective || row.title || copy.aiSuggestedPlan);
    }

    if (isSeniorAuditorSuggestionType(row.suggestion_type)) {
      return String(
        output.title ||
          output.recommended_action ||
          output.summary ||
          row.title ||
          copy.seniorAuditorSuggestion
      );
    }

    if (row.suggestion_type === 'nonconformity_draft') {
      return String(output.statement || row.title || copy.aiDraft);
    }

    if (row.suggestion_type === 'executive_brief') {
      return String(output.headline || row.title || copy.managementSummary);
    }

    return String(row.title || copy.suggestion);
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString(locale === 'en' ? 'en-US' : 'es-CL', {
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
            <h1 className="text-3xl font-bold text-slate-900">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {copy.subtitle}
            </p>
            {healthContext?.tenant_name && (
              <p className="mt-2 text-sm text-slate-700">
                {copy.company}: <span className="font-semibold">{healthContext.tenant_name}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {copy.refresh}
            </button>

            <button
              type="button"
              onClick={loadExecutiveBrief}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              {briefLoading ? copy.generating : copy.executiveBrief}
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
            {copy.loading}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title={copy.engine}
                value={engineOk ? copy.ok : copy.error}
                tone={engineOk ? 'green' : 'red'}
              />
              <MetricCard
                title={copy.engineDb}
                value={engineDbOk ? copy.ok : copy.error}
                tone={engineDbOk ? 'green' : 'red'}
              />
              <MetricCard
                title={copy.activeControls}
                value={String(healthContext?.controls_total || 0)}
              />
              <MetricCard
                title={copy.attentionControls}
                value={String(healthContext?.controls_warning || 0)}
                tone="amber"
              />
              <MetricCard
                title={copy.pendingEvidence}
                value={String(healthContext?.evidences_pending || 0)}
                tone="blue"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {copy.healthTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {copy.healthSubtitle}
                    </p>
                  </div>

                  {healthAi?.confidence && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {copy.confidence}: {healthAi.confidence}
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    {copy.activeStandards}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {standardsLabel}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                  {healthAi?.summary || copy.noSummary}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoCard
                    title={copy.deterioratedControls}
                    value={String(healthContext?.controls_critical || 0)}
                    tone="red"
                  />
                  <InfoCard
                    title={copy.criticalFindings}
                    value={String(healthContext?.findings_critical || 0)}
                    tone="red"
                  />
                </div>

                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-900 mb-2">
                    {copy.recommendations}
                  </div>

                  {Array.isArray(healthAi?.suggestions) && healthAi.suggestions.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                      {healthAi.suggestions.map((item: string, index: number) => (
                        <li key={`health-suggestion-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">
                      {copy.noRecommendations}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">{copy.quickAccess}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {copy.quickAccessSubtitle}
                </p>

                <div className="mt-4 space-y-3">
                  <QuickLink
                    href="/hallazgos"
                    title={copy.findings}
                    description={copy.findingsDesc}
                  />
                  <QuickLink
                    href="/no-conformidades"
                    title={copy.nonconformities}
                    description={copy.nonconformitiesDesc}
                  />
                  <QuickLink
                    href="/plan-accion"
                    title={copy.actionPlan}
                    description={copy.actionPlanDesc}
                  />
                  <QuickLink
                    href="/ia-compliance/sugerencias"
                    title={copy.savedSuggestions}
                    description={copy.savedSuggestionsDesc}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {copy.recentSuggestions}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {copy.pending}: <span className="font-semibold">{suggestionMetrics.drafts}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {copy.applied}: <span className="font-semibold">{suggestionMetrics.applied}</span>
                  </div>
                </div>
              </div>
            </div>

            {executiveData && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-violet-500 font-bold">
                      {copy.managementSummary}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {executiveData.headline}
                    </h2>
                  </div>

                  {executiveData.confidence && (
                    <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                      {copy.confidence}: {executiveData.confidence}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-violet-100 bg-white p-4 text-sm leading-7 text-slate-700">
                  {executiveData.executive_summary}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-violet-100 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">
                      {copy.priorities}
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
                      {copy.managementActions}
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
                    {copy.latestSuggestions}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {copy.latestSuggestionsSubtitle}
                  </p>
                </div>

                <Link
                  href="/ia-compliance/sugerencias"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copy.viewAll}
                </Link>
              </div>

              {suggestions.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">
                  {copy.noSavedSuggestions}
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
                              {row.status || copy.draft}
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
