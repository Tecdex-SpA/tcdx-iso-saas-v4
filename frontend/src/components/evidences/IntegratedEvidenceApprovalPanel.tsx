'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type IntegratedEvidence = {
  id: string;
  tenant_id: string;
  control_id?: string | null;
  tenant_control_id?: string | null;
  description?: string | null;
  file_name?: string | null;
  file_mime_type?: string | null;
  file_size_bytes?: number | string | null;
  status?: string | null;
  validated?: boolean | null;
  evidence_type?: string | null;
  created_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  source_document_id?: string | null;
  source_suggestion_id?: string | null;
  suggested_standard_code?: string | null;
  suggested_control_ref?: string | null;
  suggested_reason?: string | null;
  suggestion_confidence_score?: number | string | null;
  web_view_url?: string | null;
  source_provider?: string | null;
  source_name?: string | null;
  folder_path?: string | null;
  iso?: string | null;
  clause?: string | null;
  control_description?: string | null;
  operation_name?: string | null;
  operation_code?: string | null;
  operation_type?: string | null;
  catalog_control_description?: string | null;
  catalog_category?: string | null;
  tenant_control_status?: string | null;
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase().trim();

  if (['aprobado', 'aprobada', 'approved'].includes(raw)) return 'aprobada';
  if (['rechazado', 'rechazada', 'rejected'].includes(raw)) return 'rechazada';
  return 'pendiente';
}

function percent(value?: number | string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n <= 1) return `${Math.round(n * 100)}%`;
  return `${Math.round(n)}%`;
}

function statusClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === 'aprobada') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  if (normalized === 'rechazada') {
    return 'bg-red-50 text-red-700 ring-red-200';
  }

  return 'bg-amber-50 text-amber-700 ring-amber-200';
}

export default function IntegratedEvidenceApprovalPanel({ tenantId }: { tenantId: string }) {
  const [evidences, setEvidences] = useState<IntegratedEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendiente');
  const [search, setSearch] = useState('');

  const fetchJson = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.error || 'Error en la operación');
    }

    return json;
  };

  const load = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('tenant_id', tenantId);
      params.set('limit', '300');

      if (statusFilter) {
        params.set('status', statusFilter);
      }

      const json = await fetchJson(
        `${API_URL}/api/document-integrations/integrated-evidences?${params.toString()}`
      );

      setEvidences(Array.isArray(json.evidences) ? json.evidences : []);
    } catch (err: any) {
      setMessage(err.message || 'No fue posible cargar evidencias integradas.');
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return evidences;

    return evidences.filter((item) => {
      const haystack = [
        item.file_name,
        item.description,
        item.suggested_standard_code,
        item.suggested_control_ref,
        item.suggested_reason,
        item.source_name,
        item.folder_path,
        item.control_description,
        item.catalog_control_description,
        item.operation_name,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [evidences, search]);

  const approveEvidence = async (evidence: IntegratedEvidence) => {
    try {
      setWorkingId(`approve-${evidence.id}`);

      await fetchJson(`${API_URL}/api/evidences/approve/${evidence.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'aprobada' }),
      });

      setMessage(
        'Evidencia aprobada. Ahora puede impactar salud, KPI y cumplimiento según las reglas del sistema.'
      );

      await load();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible aprobar la evidencia.');
    } finally {
      setWorkingId('');
    }
  };

  const rejectEvidence = async (evidence: IntegratedEvidence) => {
    const reason =
      window.prompt(
        'Motivo del rechazo:',
        evidence.rejection_reason || 'No corresponde al control o requiere corrección documental.'
      ) || '';

    try {
      setWorkingId(`reject-${evidence.id}`);

      await fetchJson(`${API_URL}/api/evidences/approve/${evidence.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'rechazada',
          rejection_reason: reason,
        }),
      });

      setMessage('Evidencia rechazada.');

      await load();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible rechazar la evidencia.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            Aprobación humana
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Evidencias integradas pendientes de aprobación
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Estas evidencias fueron creadas desde sugerencias documentales aprobadas. Se mantienen como
            pendientes hasta que un auditor, administrador del tenant o superadmin las apruebe. Solo al aprobarlas
            pueden impactar salud, KPI y cumplimiento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="">Todas</option>
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por archivo, norma, control, fuente o carpeta..."
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-emerald-300"
        />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
          {filtered.length} visibles / {evidences.length} cargadas
        </div>
      </div>

      <div className="mt-5 max-h-[440px] overflow-y-auto pr-1">
        <div className="space-y-3">
          {filtered.map((evidence) => {
            const normalized = normalizeStatus(evidence.status);
            const isPending = normalized === 'pendiente';

            return (
              <div
                key={evidence.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(evidence.status)}`}>
                        {normalized}
                      </span>

                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">
                        {evidence.suggested_standard_code || evidence.iso || 'Sin norma'}
                      </span>

                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-200">
                        Control {evidence.suggested_control_ref || evidence.clause || '—'}
                      </span>

                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                        Confianza {percent(evidence.suggestion_confidence_score)}
                      </span>
                    </div>

                    <h3 className="mt-3 truncate text-base font-black text-slate-950">
                      {evidence.file_name || 'Documento integrado'}
                    </h3>

                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      <b>Control:</b>{' '}
                      {evidence.control_description ||
                        evidence.catalog_control_description ||
                        'Control no informado'}
                    </div>

                    {evidence.suggested_reason && (
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        <b>Motivo IA:</b> {evidence.suggested_reason}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
                      <div>
                        <b>Fuente:</b> {evidence.source_name || evidence.source_provider || '—'}
                      </div>
                      <div>
                        <b>Carpeta:</b> {evidence.folder_path || '—'}
                      </div>
                      <div>
                        <b>Creada:</b> {formatDate(evidence.created_at)}
                      </div>
                      <div>
                        <b>Operación:</b> {evidence.operation_name || evidence.operation_code || '—'}
                      </div>
                      <div>
                        <b>Revisada:</b> {formatDate(evidence.reviewed_at)}
                      </div>
                      <div>
                        <b>Validada:</b> {evidence.validated ? 'Sí' : 'No'}
                      </div>
                    </div>

                    {evidence.rejection_reason && (
                      <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        <b>Motivo rechazo:</b> {evidence.rejection_reason}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {evidence.web_view_url && (
                      <a
                        href={evidence.web_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        Abrir documento
                      </a>
                    )}

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveEvidence(evidence)}
                          disabled={workingId === `approve-${evidence.id}`}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {workingId === `approve-${evidence.id}` ? 'Aprobando...' : 'Aprobar evidencia'}
                        </button>

                        <button
                          type="button"
                          onClick={() => rejectEvidence(evidence)}
                          disabled={workingId === `reject-${evidence.id}`}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {workingId === `reject-${evidence.id}` ? 'Rechazando...' : 'Rechazar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No hay evidencias integradas para el filtro seleccionado.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
