'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

function localText(locale: string) {
  const en = locale === 'en';

  return {
    title: en ? 'Senior AI Auditor' : 'IA Auditor Senior',
    subtitle: en
      ? 'Global, non-destructive audit-oriented review using tenant compliance data.'
      : 'Revisión global, no destructiva y orientada a auditoría usando datos reales del tenant.',
    warning: en
      ? 'AI Auditor does not approve, close, or create critical records without human validation.'
      : 'IA Auditor no aprueba, cierra ni crea registros críticos sin validación humana.',
    run: en ? 'Run analysis' : 'Ejecutar análisis',
    running: en ? 'Analyzing...' : 'Analizando...',
    reload: en ? 'Reload scope' : 'Recargar scope',
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
    error: en ? 'Could not run Senior AI Auditor.' : 'No fue posible ejecutar IA Auditor Senior.',
  };
}

function scoreTone(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (score >= 65) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
    </div>
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

  const loadScope = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/scope`, {
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

      const res = await fetch(`${API_URL}/api/ai-auditor/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify({
          locale,
          audit_focus: 'general',
          depth: 'executive',
          include_internet: false,
        }),
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

  useEffect(() => {
    if (token) void loadScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, locale]);

  const counts = scope?.counts || {};
  const summary = analysis?.summary || {};
  const coverage = analysis?.coverage || {};

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-[34px] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                {copy.humanReview}
              </span>

              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">
                {copy.title}
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                {copy.subtitle}
              </p>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {copy.warning}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadScope}
                disabled={loading || analyzing}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {copy.reload}
              </button>

              <button
                onClick={runAnalysis}
                disabled={loading || analyzing}
                className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {analyzing ? copy.running : copy.run}
              </button>
            </div>
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
                    {item.deep_link && (
                      <button
                        onClick={() => window.location.href = item.deep_link}
                        className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.openModule}
                      </button>
                    )}
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
                    {item.deep_link && (
                      <button
                        onClick={() => window.location.href = item.deep_link}
                        className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.openModule}
                      </button>
                    )}
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
