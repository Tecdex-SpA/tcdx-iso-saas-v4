'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

function scoreTone(score: number) {
  if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function priorityTone(priority?: string) {
  const raw = String(priority || '').toLowerCase();

  if (raw.includes('alta')) return 'border-red-200 bg-red-50 text-red-700';
  if (raw.includes('media')) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function arrayOf(value: any) {
  return Array.isArray(value) ? value : [];
}

function RecommendationGroup({
  title,
  items,
  empty,
}: {
  title: string;
  items: any[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">
        {title}
      </h3>

      <div className="mt-4 space-y-3">
        {items.map((item: any, idx: number) => (
          <div key={idx} className={`rounded-2xl border p-4 ${priorityTone(item.priority)}`}>
            <div className="text-xs font-bold uppercase tracking-[0.12em]">
              {item.priority || 'prioridad'} · {item.recommended_record || item.type || 'sugerencia'}
            </div>
            <h4 className="mt-2 font-bold">{item.title}</h4>
            <p className="mt-2 text-sm leading-6">{item.why}</p>
            {item.recommended_next_step && (
              <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold">
                Próximo paso: {item.recommended_next_step}
              </p>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditoriasIaPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando IA Auditor...</div>
        </AppLayout>
      }
    >
      <AuditoriasIaContent />
    </Suspense>
  );
}

function AuditoriasIaContent() {
  const params = useSearchParams();
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseAiAuditor = !entitlementsLoading && canUseAiFeature('auditor');
  const auditId = params.get('id') || '';

  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [context, setContext] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (entitlementsLoading) return;
    if (!canUseAiAuditor) {
      window.location.replace('/auditorias');
      return;
    }
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();
    const tid = resolveTenantId(u);

    if (!t || !tid) {
      window.location.href = '/login';
      return;
    }

    setToken(t);
    setTenantId(tid);
  }, [canUseAiAuditor, entitlementsLoading]);

  const load = async () => {
    if (!token || !tenantId || !auditId) return;

    try {
      setLoading(true);

      const [contextRes, runsRes] = await Promise.all([
        fetch(`${API_URL}/api/ai-auditor/context/${auditId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/ai-auditor/runs/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const contextJson = await contextRes.json();
      const runsJson = await runsRes.json();

      if (!contextRes.ok || contextJson?.ok === false) {
        alert(contextJson.error || 'No fue posible cargar contexto IA Auditor');
        return;
      }

      setContext(contextJson);
      setRuns(Array.isArray(runsJson?.data) ? runsJson.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId, auditId]);

  const analyze = async () => {
    if (!token || !auditId) return;

    try {
      setAnalyzing(true);
      setResult(null);

      const res = await fetch(`${API_URL}/api/ai-auditor/analyze/${auditId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json.error || 'Error ejecutando IA Auditor');
        return;
      }

      setResult(json);
      await load();
    } finally {
      setAnalyzing(false);
    }
  };

  const analysis = result?.analysis || result?.data?.suggestions_json || null;
  const diagnosis = analysis?.diagnosis || {};
  const criticalControls = arrayOf(analysis?.critical_controls);
  const evidenceGaps = arrayOf(analysis?.evidence_gaps);
  const recommendedFindings = arrayOf(analysis?.recommended_findings);
  const recommendedActions = arrayOf(analysis?.recommended_actions);
  const recommendedEvidenceRequests = arrayOf(analysis?.recommended_evidence_requests);
  const governanceWarnings = arrayOf(analysis?.governance_warnings);
  const suggestedNextSteps = arrayOf(analysis?.suggested_next_steps);
  const unresolvedFindings = analysis?.duplicated_or_unresolved_findings || {};

  const checklistStats = useMemo(() => {
    const rows = context?.checklist || [];

    return {
      total: rows.length,
      conformes: rows.filter((r: any) => r.result === 'conforme').length,
      observaciones: rows.filter((r: any) => r.result === 'observacion').length,
      noConformes: rows.filter((r: any) => r.result === 'no_conforme').length,
      sinEvidencia: rows.filter((r: any) => r.result === 'sin_evidencia').length,
      pendientes: rows.filter((r: any) => !r.result || r.result === 'pendiente').length,
    };
  }, [context]);

  if (!auditId) {
    return (
      <AppLayout>
        <div className="p-6">Falta id de auditoría.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-[34px] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                Auditorías · IA Auditor
              </span>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                IA Auditor contextual
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Analiza esta auditoría con contexto real: checklist por control, evidencia disponible,
                hallazgos, acciones asociadas, estado de revisión y brechas. Las recomendaciones no crean
                registros automáticamente; deben ser aprobadas por un usuario autorizado.
              </p>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                IA Auditor no reemplaza al auditor humano; sus sugerencias requieren aprobación.
              </div>

              {context?.audit && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <strong>{context.audit.iso}</strong> · {context.audit.auditor_name || 'Auditor no informado'} · Estado: {context.audit.status || 'pendiente'}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.location.href = `/auditorias/ejecucion?id=${auditId}`}
                className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Abrir checklist
              </button>

              <button
                onClick={() => window.location.href = '/auditorias'}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Volver
              </button>

              <button
                onClick={analyze}
                disabled={analyzing || loading}
                className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : 'Ejecutar IA Auditor'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Metric label="Controles" value={checklistStats.total} />
          <Metric label="Conformes" value={checklistStats.conformes} />
          <Metric label="Observaciones" value={checklistStats.observaciones} />
          <Metric label="No conformes" value={checklistStats.noConformes} />
          <Metric label="Sin evidencia" value={checklistStats.sinEvidencia} />
          <Metric label="Pendientes" value={checklistStats.pendientes} />
        </section>

        {analysis && (
          <>
            <section className="rounded-[30px] border border-indigo-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Resultado ejecutivo IA Auditor</h2>
                  <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                    {analysis.executive_summary}
                  </p>
                  <p className="mt-3 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    {analysis.human_approval_note ||
                      'IA Auditor no reemplaza al auditor humano; sus sugerencias requieren aprobación antes de convertirse en registros formales.'}
                  </p>
                </div>

                <div className={`rounded-3xl border px-6 py-5 text-center ${scoreTone(Number(diagnosis.readiness_score || 0))}`}>
                  <div className="text-xs font-bold uppercase tracking-[0.14em]">Score preparación</div>
                  <div className="mt-1 text-4xl font-black">{diagnosis.readiness_score || 0}%</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Metric label="Revisado" value={`${diagnosis.reviewed_percent || 0}%`} />
                <Metric label="Conformidad" value={`${diagnosis.conformity_percent || 0}%`} />
                <Metric label="Evidencias" value={diagnosis.evidence_count || 0} />
                <Metric label="Controles críticos" value={criticalControls.length} />
                <Metric label="Brechas evidencia" value={evidenceGaps.length} />
                <Metric label="Hallazgos abiertos" value={unresolvedFindings.unresolved_count || 0} />
                <Metric label="Acciones abiertas" value={diagnosis.open_actions_count || 0} />
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Acciones sugeridas</h2>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <RecommendationGroup
                  title="Hallazgos sugeridos"
                  items={recommendedFindings}
                  empty="No hay hallazgos sugeridos con la evidencia actual."
                />
                <RecommendationGroup
                  title="Acciones correctivas sugeridas"
                  items={recommendedActions}
                  empty="No hay acciones correctivas sugeridas con la evidencia actual."
                />
                <RecommendationGroup
                  title="Evidencias sugeridas"
                  items={recommendedEvidenceRequests}
                  empty="No hay solicitudes de evidencia sugeridas con la evidencia actual."
                />
                <RecommendationGroup
                  title="Advertencias de gobierno"
                  items={governanceWarnings}
                  empty="No hay advertencias de gobierno relevantes para esta ejecución."
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">Brechas de evidencia</h2>
                <div className="mt-5 space-y-3">
                  {evidenceGaps.slice(0, 8).map((item: any) => (
                    <div key={item.control_review_id} className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                      <div className="font-bold">
                        {item.control_title || item.control_code || 'Control sin nombre'}
                      </div>
                      <div className="mt-1 text-xs font-semibold">
                        {item.clause ? `Cláusula ${item.clause}` : 'Sin código visible'} · {item.reason}
                      </div>
                    </div>
                  ))}
                  {evidenceGaps.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No se detectaron brechas de evidencia prioritarias.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">Siguientes pasos</h2>
                <div className="mt-5 space-y-3">
                  {suggestedNextSteps.map((item: string, idx: number) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      {item}
                    </div>
                  ))}
                  {suggestedNextSteps.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Mantener evidencia actualizada y seguimiento periódico.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Controles críticos detectados</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-3 py-3">Control</th>
                      <th className="px-3 py-3">Cláusula</th>
                      <th className="px-3 py-3">Resultado</th>
                      <th className="px-3 py-3">Evidencias</th>
                      <th className="px-3 py-3">Riesgo</th>
                      <th className="px-3 py-3">Motivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalControls.map((item: any) => (
                      <tr key={item.control_review_id} className="border-b align-top">
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">{item.control_title || item.control_code || 'Control'}</div>
                          {item.control_code && (
                            <div className="text-xs text-slate-500">{item.control_code}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">{item.clause || '-'}</td>
                        <td className="px-3 py-3">{item.result || '-'}</td>
                        <td className="px-3 py-3">{item.evidence_count || 0}</td>
                        <td className="px-3 py-3 font-bold">{item.risk_level} · {item.risk_score}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {(item.reasons || []).join(', ') || '-'}
                        </td>
                      </tr>
                    ))}

                    {criticalControls.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          No se detectaron controles críticos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!analysis && (
          <section className="rounded-[30px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Aún no hay análisis IA para esta auditoría</h2>
            <p className="mt-2 text-sm text-slate-500">
              Ejecuta IA Auditor para obtener diagnóstico, controles críticos y recomendaciones accionables.
            </p>
          </section>
        )}

        {runs.length > 0 && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Historial reciente IA Auditor</h2>

            <div className="mt-4 space-y-3">
              {runs.slice(0, 5).map((run) => (
                <div key={run.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {run.standard_code || run.iso || '-'} · {new Date(run.created_at).toLocaleString('es-CL')}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{run.summary}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
