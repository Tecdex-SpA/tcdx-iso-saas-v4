'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type SelectOption = {
  value: string;
  label: string;
};

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

function localText(locale: string) {
  const en = locale === 'en';

  return {
    title: en ? 'Senior AI Auditor' : 'IA Auditor Senior',
    subtitle: en
      ? 'Executive audit review powered by tenant evidence, ISO health, findings, actions, and ai-engine.'
      : 'Revisión auditora ejecutiva usando evidencias, salud ISO, hallazgos, acciones y ai-engine.',
    warning: en
      ? 'Advisory analysis only. AI does not approve, close, create, or modify critical records without human validation.'
      : 'Análisis consultivo. La IA no aprueba, cierra, crea ni modifica registros críticos sin validación humana.',
    advisory: en ? 'AI advisory only' : 'IA solo consultiva',
    noRecords: en ? 'No automatic records' : 'Sin registros automáticos',
    run: en ? 'Run analysis' : 'Ejecutar análisis',
    running: en ? 'Analyzing...' : 'Analizando...',
    reload: en ? 'Reload scope' : 'Recargar alcance',
    score: en ? 'Readiness score' : 'Score de preparación',
    controls: en ? 'Controls' : 'Controles',
    evidence: en ? 'Evidence' : 'Evidencias',
    findings: en ? 'Open findings' : 'Hallazgos abiertos',
    actions: en ? 'Open actions' : 'Acciones abiertas',
    overdue: en ? 'Overdue actions' : 'Acciones vencidas',
    audits: en ? 'Recent audits' : 'Auditorías recientes',
    health: en ? 'ISO health' : 'Salud ISO',
    summary: en ? 'Executive summary' : 'Resumen ejecutivo',
    opinion: en ? 'Auditor opinion' : 'Opinión auditora',
    gaps: en ? 'Main gaps' : 'Brechas principales',
    evidenceRequests: en ? 'Evidence requests' : 'Solicitudes de evidencia',
    findingSuggestions: en ? 'Finding suggestions' : 'Hallazgos sugeridos',
    actionSuggestions: en ? 'Action plan suggestions' : 'Planes de acción sugeridos',
    nextSteps: en ? 'Next steps' : 'Siguientes pasos',
    humanReview: en ? 'Human review required' : 'Revisión humana requerida',
    noData: en ? 'No data available yet.' : 'Sin datos disponibles todavía.',
    openModule: en ? 'Open module' : 'Abrir módulo',
    prepare: en ? 'Prepare' : 'Preparar',
    prepareFinding: en ? 'Prepare finding' : 'Preparar hallazgo',
    prepareEvidence: en ? 'Prepare evidence' : 'Preparar evidencia',
    prepareActionPlan: en ? 'Prepare action plan' : 'Preparar plan',
    prepareError: en ? 'Could not prepare the suggestion.' : 'No fue posible preparar la sugerencia.',
    error: en ? 'Could not run Senior AI Auditor.' : 'No fue posible ejecutar IA Auditor Senior.',
    scope: en ? 'Audit scope' : 'Alcance auditado',
    standard: en ? 'Standard' : 'Norma',
    allStandards: en ? 'All standards' : 'Todas las normas',
    auditFocus: en ? 'Audit focus' : 'Foco auditor',
    depth: en ? 'Depth' : 'Profundidad',
    engineTrace: en ? 'AI engine trace' : 'Trazabilidad motor IA',
    engineUsed: en ? 'ai-engine used' : 'ai-engine usado',
    source: en ? 'Source' : 'Fuente',
    endpoint: en ? 'Endpoint' : 'Endpoint',
    dbWrite: en ? 'DB write' : 'Escritura BD',
    generatedAt: en ? 'Generated at' : 'Generado',
    controlSource: en ? 'Control source' : 'Fuente de controles',
    controlsByStandard: en ? 'Controls by standard' : 'Controles por norma',
    warnings: en ? 'Warnings' : 'Advertencias',
    yes: en ? 'Yes' : 'Sí',
    no: en ? 'No' : 'No',
    true: en ? 'true' : 'true',
    false: en ? 'false' : 'false',
    notAvailable: en ? 'Not available' : 'No disponible',
    focusGeneral: en ? 'General' : 'General',
    focusControls: en ? 'Controls' : 'Controles',
    focusEvidence: en ? 'Evidence' : 'Evidencias',
    focusRisks: en ? 'Risks' : 'Riesgos',
    focusActions: en ? 'Actions' : 'Acciones',
    focusCertification: en ? 'Certification readiness' : 'Preparación certificación',
    depthExecutive: en ? 'Executive' : 'Ejecutiva',
    depthStandard: en ? 'Standard' : 'Estándar',
    depthDeep: en ? 'Deep' : 'Profunda',
    readiness: en ? 'Readiness' : 'Preparación',
    safeMode: en ? 'Safe mode' : 'Modo seguro',
    safeModeText: en
      ? 'The module only prepares advisory findings and deep links. It does not create operational records.'
      : 'El módulo solo prepara recomendaciones y enlaces. No crea registros operativos.',
  };
}

function scoreTone(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (score >= 65) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function badgeTone(value: any) {
  if (value === true || value === 'true') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === false || value === 'false') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function Card({ title, value, helper }: { title: string; value: any; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      {helper && <div className="mt-1 text-xs text-slate-500">{helper}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TraceItem({ label, value }: { label: string; value: any }) {
  const rendered = value === undefined || value === null || value === '' ? '-' : String(value);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold text-slate-800">{rendered}</div>
    </div>
  );
}

function Pill({ children, value }: { children: React.ReactNode; value?: any }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${badgeTone(value)}`}>
      {children}
    </span>
  );
}

function ListSection({
  title,
  items,
  empty,
  render,
}: {
  title: string;
  items: any[];
  empty: string;
  render: (item: any, index: number) => React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => render(item, index))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

export default function SeniorAiAuditorPage() {
  const { locale } = useTranslation();
  const copy = localText(locale);

  const [token, setToken] = useState('');
  const [scope, setScope] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const [selectedStandard, setSelectedStandard] = useState('all');
  const [selectedFocus, setSelectedFocus] = useState('general');
  const [selectedDepth, setSelectedDepth] = useState('executive');

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || '';
    const user = getUserFromToken();
    const resolvedTenantId = resolveTenantId(user);

    if (!storedToken || !resolvedTenantId) {
      window.location.href = '/login';
      return;
    }

    setToken(storedToken);
  }, []);

  const standardOptions = useMemo<SelectOption[]>(() => {
    const standards = Array.isArray(scope?.standards) ? scope.standards : [];
    return [
      { value: 'all', label: copy.allStandards },
      ...standards.map((standard: string) => ({
        value: standard,
        label: standard,
      })),
    ];
  }, [scope?.standards, copy.allStandards]);

  const focusOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'general', label: copy.focusGeneral },
      { value: 'controls', label: copy.focusControls },
      { value: 'evidence', label: copy.focusEvidence },
      { value: 'risks', label: copy.focusRisks },
      { value: 'actions', label: copy.focusActions },
      { value: 'certification_readiness', label: copy.focusCertification },
    ],
    [copy]
  );

  const depthOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'executive', label: copy.depthExecutive },
      { value: 'standard', label: copy.depthStandard },
      { value: 'deep', label: copy.depthDeep },
    ],
    [copy]
  );

  const loadScope = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedStandard !== 'all') {
        params.set('standard_code', selectedStandard);
      }

      const url = `${API_URL}/api/ai-auditor/scope${params.toString() ? `?${params.toString()}` : ''}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tcdx-locale': locale,
        },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.error);
      }

      setScope(json.scope || null);
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!token) return;

    try {
      setAnalyzing(true);
      setError('');
      setAnalysis(null);

      const body: Record<string, any> = {
        locale,
        audit_focus: selectedFocus,
        depth: selectedDepth,
        include_internet: false,
      };

      if (selectedStandard !== 'all') {
        body.standard_code = selectedStandard;
      }

      const res = await fetch(`${API_URL}/api/ai-auditor/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.error);
      }

      setAnalysis(json);
      setScope(json.scope || scope);
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setAnalyzing(false);
    }
  };


  const prepareSuggestion = async (type: string, suggestion: any) => {
    if (!token) return;

    try {
      setError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/suggestions/${type}/prepare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify({
          locale,
          standard_code: selectedStandard !== 'all' ? selectedStandard : suggestion?.standard_code,
          suggestion,
        }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.prepareError);
      }

      const storageKey = json.storage_key;
      const deepLink = json.deep_link;

      if (storageKey && json.prepared_payload) {
        sessionStorage.setItem(storageKey, JSON.stringify(json.prepared_payload));
      }

      if (deepLink) {
        window.location.href = deepLink;
      }
    } catch (err: any) {
      setError(err?.message || copy.prepareError);
    }
  };


  useEffect(() => {
    if (token) void loadScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, locale, selectedStandard]);

  const counts = scope?.counts || {};
  const summary = analysis?.summary || {};
  const coverage = analysis?.coverage || {};
  const trace = analysis?.trace || {};
  const sources = scope?.sources || analysis?.scope?.sources || {};
  const controlsByStandard = Array.isArray(scope?.controls_by_standard)
    ? scope.controls_by_standard
    : [];
  const warnings = Array.isArray(sources?.warnings) ? sources.warnings : [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-7 text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill value>{copy.humanReview}</Pill>
                  <Pill value={false}>{copy.noRecords}</Pill>
                  <Pill value={trace?.ai_engine_used}>{copy.advisory}</Pill>
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight">
                  {copy.title}
                </h1>

                <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-300">
                  {copy.subtitle}
                </p>

                <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                  {copy.warning}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur xl:min-w-[360px]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-100">
                  {copy.safeMode}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {copy.safeModeText}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Field label={copy.standard}>
              <Select
                value={selectedStandard}
                options={standardOptions}
                onChange={setSelectedStandard}
              />
            </Field>

            <Field label={copy.auditFocus}>
              <Select
                value={selectedFocus}
                options={focusOptions}
                onChange={setSelectedFocus}
              />
            </Field>

            <Field label={copy.depth}>
              <Select
                value={selectedDepth}
                options={depthOptions}
                onChange={setSelectedDepth}
              />
            </Field>

            <button
              onClick={loadScope}
              disabled={loading || analyzing}
              className="mt-7 h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 xl:mt-[27px]"
            >
              {loading ? '...' : copy.reload}
            </button>

            <button
              onClick={runAnalysis}
              disabled={loading || analyzing}
              className="mt-7 h-11 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 xl:mt-[27px]"
            >
              {analyzing ? copy.running : copy.run}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Card title={copy.controls} value={counts.controls_total || 0} />
          <Card title={copy.evidence} value={counts.evidence_total || 0} />
          <Card title={copy.findings} value={counts.findings_open || 0} />
          <Card title={copy.actions} value={counts.action_plans_open || 0} />
          <Card title={copy.overdue} value={counts.action_plans_overdue || 0} />
          <Card title={copy.audits} value={counts.audits_recent || 0} />
          <Card title={copy.health} value={`${counts.health_average || 0}%`} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.controlSource}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TraceItem label={copy.source} value={sources?.controls_source || copy.notAvailable} />
              <TraceItem label={copy.warnings} value={warnings.length} />
            </div>

            <div className="mt-5 space-y-3">
              {controlsByStandard.map((item: any) => (
                <div key={item.standard_code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {item.standard_code}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.source}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-indigo-700">
                      {item.controls || 0}
                    </div>
                  </div>
                </div>
              ))}

              {controlsByStandard.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  {copy.noData}
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {warnings.join(' · ')}
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.engineTrace}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TraceItem label={copy.engineUsed} value={trace?.ai_engine_used === true ? copy.yes : trace?.ai_engine_used === false ? copy.no : '-'} />
              <TraceItem label={copy.source} value={trace?.source || '-'} />
              <TraceItem label={copy.endpoint} value={trace?.endpoint || '-'} />
              <TraceItem label={copy.dbWrite} value={String(trace?.db_write ?? false)} />
              <TraceItem label={copy.generatedAt} value={trace?.generated_at || '-'} />
              <TraceItem label={copy.scope} value={selectedStandard === 'all' ? copy.allStandards : selectedStandard} />
            </div>
          </div>
        </section>

        {analysis && (
          <>
            <section className="rounded-[30px] border border-indigo-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {copy.summary}
                  </h2>

                  <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                    {summary.executive_summary || copy.noData}
                  </p>

                  <h3 className="mt-5 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                    {copy.opinion}
                  </h3>
                  <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-700">
                    {summary.auditor_opinion || copy.noData}
                  </p>
                </div>

                <div className={`rounded-3xl border px-6 py-5 text-center ${scoreTone(Number(summary.score || 0))}`}>
                  <div className="text-xs font-bold uppercase tracking-[0.14em]">
                    {copy.score}
                  </div>
                  <div className="mt-1 text-4xl font-black">{summary.score || 0}%</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em]">
                    {summary.readiness_level || '-'}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card title={copy.controls} value={coverage.controls_reviewed || 0} />
                <Card title={copy.evidence} value={coverage.evidences_reviewed || 0} />
                <Card title={copy.findings} value={coverage.findings_reviewed || 0} />
                <Card title={copy.actions} value={coverage.actions_reviewed || 0} />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ListSection
                title={copy.gaps}
                items={summary.main_gaps || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {item.type} · {item.severity}
                    </div>
                    <h3 className="mt-2 font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                )}
              />

              <ListSection
                title={copy.evidenceRequests}
                items={analysis.evidence_requests || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {item.standard_code || '-'} · {item.priority || '-'}
                    </div>
                    <h3 className="mt-2 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6">{item.reason}</p>
                    <button
                      onClick={() => prepareSuggestion('evidence', item)}
                      className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold"
                    >
                      {copy.prepareEvidence}
                    </button>
                  </div>
                )}
              />

              <ListSection
                title={copy.findingSuggestions}
                items={analysis.findings_suggestions || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {item.severity || '-'}
                    </div>
                    <h3 className="mt-2 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6">{item.recommended_action}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => prepareSuggestion('finding', item)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.prepareFinding}
                      </button>
                      {item.deep_link && (
                        <button
                          onClick={() => window.location.href = item.deep_link}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                        >
                          {copy.openModule}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              />

              <ListSection
                title={copy.actionSuggestions}
                items={analysis.action_plan_suggestions || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {item.priority || '-'}
                    </div>
                    <h3 className="mt-2 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6">{item.recommended_action}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => prepareSuggestion('action_plan', item)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.prepareActionPlan}
                      </button>
                      {item.deep_link && (
                        <button
                          onClick={() => window.location.href = item.deep_link}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                        >
                          {copy.openModule}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              />
            </div>

            <ListSection
              title={copy.nextSteps}
              items={analysis.next_steps || []}
              empty={copy.noData}
              render={(item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              )}
            />
          </>
        )}

        {!analysis && (
          <section className="rounded-[30px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
