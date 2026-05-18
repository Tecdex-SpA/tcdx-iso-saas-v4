'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type Suggestion = {
  id: string;
  standard_code?: string | null;
  source_module: string;
  source_entity_type?: string | null;
  suggestion_type: string;
  target_record_type: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  priority: 'critica' | 'alta' | 'media' | 'baja';
  status: string;
  suggested_owner?: string | null;
  suggested_due_date?: string | null;
  created_record_type?: string | null;
  created_record_id?: string | null;
  control_clause?: string | null;
  control_category?: string | null;
  control_description?: string | null;
  source_trace_json?: any;
  payload_json?: any;
  created_at?: string;
};

type Summary = {
  totals?: {
    total_suggestions: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    critical_count: number;
    high_count: number;
  };
  by_standard?: any[];
  by_type?: any[];
  recent?: any[];
};

function resolveTenantId(user: any): string {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function badgeClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (['critica', 'critical'].includes(normalized)) return 'bg-red-600 text-white';
  if (['alta', 'alto', 'high'].includes(normalized)) return 'bg-orange-500 text-white';
  if (['media', 'medio', 'medium'].includes(normalized)) return 'bg-amber-100 text-amber-900';
  if (['approved', 'applied', 'aprobada'].includes(normalized)) return 'bg-emerald-100 text-emerald-800';
  if (['rejected', 'rechazada'].includes(normalized)) return 'bg-gray-200 text-gray-700';
  return 'bg-slate-100 text-slate-700';
}

function label(value?: string | null) {
  return String(value || 'sin_dato').replaceAll('_', ' ');
}

export default function IsoOperationalExecutionPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('');
  const [standard, setStandard] = useState('');
  const [targetType, setTargetType] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');
  const [lastGenerate, setLastGenerate] = useState<any>(null);

  const tenantId = useMemo(() => resolveTenantId(getUserFromToken()), []);

  const standards = useMemo(() => {
    const values = new Set<string>();
    suggestions.forEach((item) => {
      if (item.standard_code) values.add(item.standard_code);
    });
    (summary?.by_standard || []).forEach((item) => {
      if (item.standard_code) values.add(item.standard_code);
    });
    return Array.from(values).sort();
  }, [suggestions, summary]);

  const filtered = useMemo(() => {
    return suggestions.filter((item) => {
      if (standard && item.standard_code !== standard) return false;
      if (priority && item.priority !== priority) return false;
      if (targetType && item.target_record_type !== targetType) return false;
      return true;
    });
  }, [suggestions, standard, priority, targetType]);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || 'Error en Ejecucion ISO');
    }
    return json;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryJson, suggestionsJson] = await Promise.all([
        apiFetch('/api/iso-operational-execution/summary'),
        apiFetch(`/api/iso-operational-execution/suggestions?status=${encodeURIComponent(status)}`),
      ]);
      setSummary(summaryJson.data || null);
      setSuggestions(Array.isArray(suggestionsJson.data) ? suggestionsJson.data : []);
      setSelected((current) => {
        if (!current) return null;
        return suggestionsJson.data?.find((item: Suggestion) => item.id === current.id) || null;
      });
    } catch (err: any) {
      console.error('ERROR LOAD ISO EXECUTION:', err);
      setError(err?.message || 'No fue posible cargar Ejecucion ISO');
    } finally {
      setLoading(false);
    }
  };

  const generate = async (dryRun: boolean) => {
    try {
      setGenerating(true);
      setError('');
      const json = await apiFetch('/api/iso-operational-execution/generate', {
        method: 'POST',
        body: JSON.stringify({
          dry_run: dryRun,
          standard_code: standard || undefined,
        }),
      });
      setLastGenerate(json.data || null);
      if (!dryRun) {
        await load();
      }
    } catch (err: any) {
      console.error('ERROR GENERATE ISO EXECUTION:', err);
      setError(err?.message || 'No fue posible generar sugerencias');
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (item: Suggestion, dryRun = false) => {
    try {
      setActingId(item.id);
      setError('');
      const json = await apiFetch(`/api/iso-operational-execution/${item.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          target_record_type: item.target_record_type,
          dry_run: dryRun,
        }),
      });
      if (dryRun) {
        setLastGenerate(json.data || null);
      } else {
        await load();
      }
    } catch (err: any) {
      console.error('ERROR APPROVE ISO EXECUTION:', err);
      setError(err?.message || 'No fue posible aprobar la sugerencia');
    } finally {
      setActingId('');
    }
  };

  const reject = async (item: Suggestion) => {
    const comment = window.prompt('Motivo de rechazo');
    if (comment === null) return;

    try {
      setActingId(item.id);
      setError('');
      await apiFetch(`/api/iso-operational-execution/${item.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejection_comment: comment,
        }),
      });
      await load();
    } catch (err: any) {
      console.error('ERROR REJECT ISO EXECUTION:', err);
      setError(err?.message || 'No fue posible rechazar la sugerencia');
    } finally {
      setActingId('');
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-950">Ejecucion ISO</h1>
            <p className="text-sm text-gray-500 mt-1">
              Convierte brechas, riesgos y documentos ISO en trabajo operativo revisable.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={generating}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Simular generacion
            </button>
            <button
              type="button"
              onClick={() => generate(false)}
              disabled={generating}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Generar sugerencias
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {lastGenerate && (
          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {lastGenerate.dry_run
              ? `Simulacion: ${lastGenerate.generated_count || 0} sugerencias candidatas.`
              : `Generacion: ${lastGenerate.inserted_count || 0} sugerencias guardadas.`}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          {[
            ['Total', summary?.totals?.total_suggestions || 0, 'bg-slate-900 text-white'],
            ['Pendientes', summary?.totals?.pending_count || 0, 'bg-blue-100 text-blue-800'],
            ['Aprobadas', summary?.totals?.approved_count || 0, 'bg-emerald-100 text-emerald-800'],
            ['Rechazadas', summary?.totals?.rejected_count || 0, 'bg-gray-200 text-gray-700'],
            ['Criticas/Altas', (summary?.totals?.critical_count || 0) + (summary?.totals?.high_count || 0), 'bg-orange-500 text-white'],
          ].map(([name, value, className]) => (
            <div key={String(name)} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">{name}</div>
              <div className={`mt-2 inline-flex min-w-12 justify-center rounded px-3 py-1 text-xl font-bold ${className}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4 grid gap-3 lg:grid-cols-5">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="pending">Pendientes</option>
              <option value="applied">Aplicadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="">Todas</option>
            </select>

            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas las normas</option>
              {standards.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas las prioridades</option>
              <option value="critica">Critica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>

            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos los destinos</option>
              <option value="action_plan">Plan de accion</option>
              <option value="finding">Hallazgo</option>
              <option value="nonconformity">No conformidad</option>
              <option value="evidence_request">Solicitud evidencia</option>
            </select>

            <button
              type="button"
              onClick={() => load()}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Actualizar
            </button>
          </div>

          <div className="grid lg:grid-cols-[1.5fr_0.8fr]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Sugerencia</th>
                    <th className="px-4 py-3">Norma</th>
                    <th className="px-4 py-3">Prioridad</th>
                    <th className="px-4 py-3">Fuente</th>
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-gray-500">
                        Cargando sugerencias...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-gray-500">
                        No hay sugerencias para los filtros actuales.
                      </td>
                    </tr>
                  ) : filtered.map((item) => (
                    <tr
                      key={item.id}
                      className={`align-top hover:bg-gray-50 cursor-pointer ${selected?.id === item.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelected(item)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-950">{item.title}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {item.description || item.rationale}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Responsable: {item.suggested_owner || 'Sin asignar'} · {item.suggested_due_date || 'sin fecha'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.standard_code || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeClass(item.priority)}`}>
                          {label(item.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{label(item.source_module)}</div>
                        <div className="text-xs text-gray-400">{label(item.suggestion_type)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{label(item.target_record_type)}</td>
                      <td className="px-4 py-3">
                        {item.status === 'pending' ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                approve(item, true);
                              }}
                              disabled={actingId === item.id}
                              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              Dry-run
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                approve(item, false);
                              }}
                              disabled={actingId === item.id}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                reject(item);
                              }}
                              disabled={actingId === item.id}
                              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeClass(item.status)}`}>
                            {label(item.status)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="border-t border-gray-100 p-5 lg:border-l lg:border-t-0 bg-slate-50">
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Detalle trazable</div>
                    <h2 className="mt-1 text-lg font-semibold text-gray-950">{selected.title}</h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeClass(selected.priority)}`}>
                      {label(selected.priority)}
                    </span>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${badgeClass(selected.status)}`}>
                      {label(selected.status)}
                    </span>
                    <span className="rounded bg-white px-2 py-1 text-xs text-gray-700 border border-gray-200">
                      {selected.standard_code || 'Sin norma'}
                    </span>
                  </div>

                  <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-700 space-y-2">
                    <div><strong>Fuente:</strong> {label(selected.source_module)} / {label(selected.source_entity_type)}</div>
                    <div><strong>Tipo:</strong> {label(selected.suggestion_type)}</div>
                    <div><strong>Destino:</strong> {label(selected.target_record_type)}</div>
                    <div><strong>Control:</strong> {selected.control_clause || 'N/A'} {selected.control_category || ''}</div>
                    <div><strong>Registro creado:</strong> {selected.created_record_type || 'No aplicado'} {selected.created_record_id || ''}</div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Racional</h3>
                    <p className="mt-1 text-sm text-gray-600">{selected.rationale || selected.description || 'Sin racional adicional.'}</p>
                  </div>

                  <details className="rounded border border-gray-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">Trazabilidad JSON</summary>
                    <pre className="mt-3 max-h-80 overflow-auto text-xs text-gray-600">
                      {JSON.stringify({
                        payload_json: selected.payload_json,
                        source_trace_json: selected.source_trace_json,
                      }, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Selecciona una sugerencia para ver origen, control, payload y trazabilidad.
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
