'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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
  const auditId = params.get('id') || '';

  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [context, setContext] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    const u = getUserFromToken();
    const tid = resolveTenantId(u);

    if (!t || !tid) {
      window.location.href = '/login';
      return;
    }

    setToken(t);
    setTenantId(tid);
  }, []);

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
  const suggestions = Array.isArray(analysis?.suggestions) ? analysis.suggestions : [];
  const criticalControls = Array.isArray(analysis?.critical_controls)
    ? analysis.critical_controls
    : [];

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
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Recomendaciones accionables</h2>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {suggestions.map((item: any, idx: number) => (
                  <div key={idx} className={`rounded-2xl border p-4 ${priorityTone(item.priority)}`}>
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {item.type} · {item.priority || 'prioridad'}
                    </div>
                    <h3 className="mt-2 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6">{item.why}</p>
                    <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold">
                      Próximo paso: {item.recommended_next_step}
                    </p>
                    <p className="mt-2 text-xs font-semibold">
                      Registro sugerido: {item.recommended_record}
                    </p>
                  </div>
                ))}
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
