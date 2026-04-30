'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type AuditRow = {
  id: string;
  iso: string;
  start_date?: string;
  end_date?: string;
  auditor_name?: string;
  status?: string;
};

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

export default function IaAuditorPage() {
  const [token, setToken] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);

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
    if (!token || !tenantId) return;

    try {
      setLoading(true);

      const [auditsRes, runsRes] = await Promise.all([
        fetch(`${API_URL}/api/audits/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/ai-auditor/runs/${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const auditsJson = await auditsRes.json();
      const runsJson = await runsRes.json();

      setAudits(Array.isArray(auditsJson) ? auditsJson : []);
      setRuns(Array.isArray(runsJson?.data) ? runsJson.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId]);

  const analyze = async () => {
    if (!selectedAuditId) {
      alert('Selecciona una auditoría');
      return;
    }

    try {
      setAnalyzing(true);
      setResult(null);

      const res = await fetch(`${API_URL}/api/ai-auditor/analyze/${selectedAuditId}`, {
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-[34px] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
            IA Auditor v1
          </span>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            Auditor inteligente asistido
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            Revisa checklist de auditoría, resultados por control, evidencias indirectas, hallazgos
            y acciones. Genera sugerencias que requieren aprobación humana antes de crear registros formales.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <select
              value={selectedAuditId}
              onChange={(e) => setSelectedAuditId(e.target.value)}
              className="min-w-[360px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">Seleccionar auditoría</option>
              {audits.map((audit) => (
                <option key={audit.id} value={audit.id}>
                  {audit.iso} · {audit.start_date?.slice(0, 10)} · {audit.auditor_name || 'Sin auditor'}
                </option>
              ))}
            </select>

            <button
              onClick={analyze}
              disabled={analyzing || !selectedAuditId}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {analyzing ? 'Analizando...' : 'Ejecutar IA Auditor'}
            </button>
          </div>
        </section>

        {result && (
          <section className="rounded-[30px] border border-indigo-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Resultado IA Auditor</h2>

            <p className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              {result.summary}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {(result.suggestions || []).map((s: any, idx: number) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {s.type} · {s.priority || s.severity || 'prioridad'}
                  </div>
                  <h3 className="mt-2 font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{s.description}</p>
                  <div className="mt-3 text-xs font-semibold text-slate-500">
                    Sugerencia pendiente de aprobación humana.
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Historial IA Auditor</h2>

          {loading ? (
            <div className="mt-4 text-sm text-slate-500">Cargando...</div>
          ) : (
            <div className="mt-4 space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {run.standard_code || run.iso || '-'} · {new Date(run.created_at).toLocaleString('es-CL')}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{run.summary}</p>
                </div>
              ))}

              {runs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Aún no existen ejecuciones IA Auditor.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
