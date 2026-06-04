'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type SourceCard = {
  source_type: string;
  source_name: string;
  status: string;
  documents_count?: number;
  last_sync_at?: string | null;
};

type LibraryDocument = {
  id: string;
  source_type: 'document_index' | 'evidence';
  source_id: string;
  source_table?: string;
  document_key?: string;
  title: string;
  filename: string;
  normalized_path?: string | null;
  origin?: string | null;
  source_label?: string | null;
  document_type?: string | null;
  status?: string | null;
  semantic_status?: string | null;
  usefulness_score?: number | null;
  association_counts?: Record<string, number>;
  last_indexed_at?: string | null;
  active_version?: string | null;
  is_active_version?: boolean;
  has_previous_versions?: boolean;
  profile?: any;
};

type Association = {
  id: string;
  target_type: string;
  target_label?: string | null;
  evidence_usage?: string | null;
  is_active?: boolean;
  created_at?: string | null;
};

type Suggestion = {
  id: string;
  target_type: string;
  target_label?: string | null;
  score?: number | null;
  confidence?: number | null;
  reason?: string | null;
  snippet?: string | null;
  status?: string | null;
};

type Chunk = {
  id: string;
  chunk_index: number;
  page_number?: number | null;
  section_label?: string | null;
  chunk_text: string;
};

type TargetOption = {
  id: string;
  target_type: string;
  label: string;
  subtitle?: string | null;
};

type DetailPayload = {
  document: LibraryDocument;
  versions: LibraryDocument[];
  associations: Association[];
  suggestions: Suggestion[];
  chunks: Chunk[];
  history: Array<{ event: string; at?: string | null; label: string }>;
};

const targetLabels: Record<string, string> = {
  control: 'Control',
  nonconformity: 'No conformidad',
  finding: 'Hallazgo',
  process: 'Proceso',
  operation: 'Operacion',
  risk: 'Riesgo',
  action: 'Plan de accion',
};

const usageOptions = [
  ['primary_evidence', 'Evidencia principal'],
  ['supporting_evidence', 'Evidencia de soporte'],
  ['remediation_evidence', 'Evidencia de remediacion'],
  ['finding_evidence', 'Evidencia de hallazgo'],
  ['process_evidence', 'Evidencia de proceso'],
  ['operation_evidence', 'Evidencia de operacion'],
  ['risk_evidence', 'Evidencia de riesgo'],
  ['action_evidence', 'Evidencia de accion'],
  ['reference', 'Referencia'],
];

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceBadge(source?: string | null) {
  const raw = String(source || '').toLowerCase();
  if (raw.includes('google')) return 'Google Drive';
  if (raw.includes('zoho')) return 'Zoho Drive';
  if (raw.includes('sync')) return 'Sync Agent';
  if (raw.includes('mounted')) return 'Carpeta montada';
  if (raw.includes('manual')) return 'Carga manual';
  return source || 'Otro';
}

function typeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    policy: 'Politica',
    procedure: 'Procedimiento',
    record: 'Registro',
    form: 'Formulario',
    report: 'Reporte',
    certificate: 'Certificado',
    audit_evidence: 'Evidencia',
    risk_document: 'Riesgo',
    control_evidence: 'Control',
    contract: 'Contrato',
    meeting_minutes: 'Acta',
    unknown: 'Sin clasificar',
  };
  return labels[String(type || 'unknown')] || String(type || 'Sin clasificar');
}

function statusClass(value?: string | null) {
  const status = String(value || '').toLowerCase();
  if (['processed', 'indexed', 'evidence', 'active', 'aprobada'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['pending_review', 'pending', 'not_processed', 'pendiente'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (['failed', 'rejected', 'rechazada', 'error'].includes(status)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

async function fetchJson(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || json.message || 'Solicitud no procesada');
  }
  return json;
}

export default function UnifiedEvidenceLibrary({
  token,
  canManage,
}: {
  token: string;
  canManage: boolean;
}) {
  const [sources, setSources] = useState<SourceCard[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState('');
  const [tab, setTab] = useState<'summary' | 'associations' | 'suggestions' | 'chunks' | 'versions' | 'history'>('summary');
  const [filters, setFilters] = useState({
    search: '',
    origin: '',
    document_type: '',
    status: '',
    association: '',
    semantic_status: '',
    version: 'active',
  });
  const [targetType, setTargetType] = useState('control');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [associationForm, setAssociationForm] = useState({
    target_id: '',
    evidence_usage: 'supporting_evidence',
    notes: '',
  });

  const selectedSourceType = selected?.source_type || '';
  const selectedSourceId = selected?.source_id || '';

  const loadSources = async () => {
    const json = await fetchJson(`${API_URL}/api/evidence-library/sources`, token);
    setSources(Array.isArray(json.data) ? json.data : []);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const json = await fetchJson(`${API_URL}/api/evidence-library/documents?${params.toString()}`, token);
      const rows = Array.isArray(json.data) ? json.data : [];
      setDocuments(rows);
      setSelected((prev) => {
        if (prev && rows.some((row: LibraryDocument) => row.id === prev.id)) return prev;
        return rows[0] || null;
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (doc = selected) => {
    if (!doc) {
      setDetail(null);
      return;
    }
    const json = await fetchJson(
      `${API_URL}/api/evidence-library/documents/${doc.source_type}/${doc.source_id}`,
      token
    );
    setDetail(json.data || null);
  };

  const loadTargets = async () => {
    const params = new URLSearchParams();
    if (targetSearch.trim()) params.set('search', targetSearch.trim());
    const json = await fetchJson(`${API_URL}/api/evidence-library/targets/${targetType}?${params.toString()}`, token);
    setTargetOptions(Array.isArray(json.data) ? json.data : []);
  };

  useEffect(() => {
    loadSources().catch((error) => console.error('ERROR LOAD EVIDENCE SOURCES:', error));
  }, [token]);

  useEffect(() => {
    loadDocuments().catch((error) => console.error('ERROR LOAD EVIDENCE LIBRARY:', error));
  }, [token, filters.origin, filters.document_type, filters.status, filters.association, filters.semantic_status, filters.version]);

  useEffect(() => {
    loadDetail().catch((error) => console.error('ERROR LOAD EVIDENCE DETAIL:', error));
  }, [selectedSourceType, selectedSourceId]);

  useEffect(() => {
    if (!canManage) return;
    loadTargets().catch((error) => console.error('ERROR LOAD TARGETS:', error));
  }, [targetType, token]);

  const associationTotal = (doc: LibraryDocument) =>
    Object.values(doc.association_counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  const semanticSummary = useMemo(() => {
    const processed = documents.filter((doc) => doc.semantic_status === 'processed').length;
    const pending = documents.filter((doc) => doc.semantic_status !== 'processed').length;
    return { processed, pending };
  }, [documents]);

  const analyzeSelected = async () => {
    if (!selected || !canManage) return;
    setWorking('analyze');
    try {
      await fetchJson(`${API_URL}/api/evidence-library/semantic/analyze`, token, {
        method: 'POST',
        body: JSON.stringify({ source_type: selected.source_type, source_id: selected.source_id }),
      });
      await loadDocuments();
      await loadDetail(selected);
    } catch (error: any) {
      alert(error.message || 'No fue posible analizar el documento.');
    } finally {
      setWorking('');
    }
  };

  const saveAssociation = async () => {
    if (!selected || !associationForm.target_id || !canManage) return;
    setWorking('associate');
    try {
      await fetchJson(`${API_URL}/api/evidence-library/associations`, token, {
        method: 'POST',
        body: JSON.stringify({
          source_type: selected.source_type,
          source_id: selected.source_id,
          target_type: targetType,
          target_id: associationForm.target_id,
          evidence_usage: associationForm.evidence_usage,
          notes: associationForm.notes,
        }),
      });
      setAssociationForm((prev) => ({ ...prev, target_id: '', notes: '' }));
      await loadDocuments();
      await loadDetail(selected);
    } catch (error: any) {
      alert(error.message || 'No fue posible guardar la asociacion.');
    } finally {
      setWorking('');
    }
  };

  const setAssociationStatus = async (association: Association, active: boolean) => {
    if (!canManage) return;
    setWorking(association.id);
    try {
      await fetchJson(
        `${API_URL}/api/evidence-library/associations/${association.id}/${active ? 'reactivate' : 'deactivate'}`,
        token,
        { method: 'PATCH', body: JSON.stringify({}) }
      );
      await loadDetail();
      await loadDocuments();
    } catch (error: any) {
      alert(error.message || 'No fue posible actualizar la asociacion.');
    } finally {
      setWorking('');
    }
  };

  const reviewSuggestion = async (suggestion: Suggestion, action: 'accept' | 'reject') => {
    if (!canManage) return;
    setWorking(`${action}-${suggestion.id}`);
    try {
      await fetchJson(`${API_URL}/api/evidence-library/semantic/suggestions/${suggestion.id}/${action}`, token, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadDetail();
      await loadDocuments();
    } catch (error: any) {
      alert(error.message || 'No fue posible revisar la sugerencia.');
    } finally {
      setWorking('');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Evidencias</h1>
          <p className="mt-1 text-sm text-slate-500">Biblioteca documental del tenant</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs text-slate-500">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">{documents.length}</div>
            <div>Documentos visibles</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="font-bold text-slate-900">{semanticSummary.processed}/{documents.length}</div>
            <div>Procesados</div>
          </div>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Fuentes documentales</h2>
            <p className="text-sm text-slate-500">Conecta, sincroniza y gestiona fuentes de informacion.</p>
          </div>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            Nueva fuente
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {sources.map((source) => (
            <div key={source.source_type} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{source.source_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{source.documents_count || 0} documentos</div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass(source.status)}`}>
                  {source.status || 'available'}
                </span>
              </div>
              <div className="mt-4 text-xs text-slate-500">Ultima sincronizacion</div>
              <div className="mt-1 text-xs font-semibold text-slate-700">{formatDate(source.last_sync_at)}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadDocuments().catch(() => null);
            }}
            placeholder="Buscar documento por nombre o palabra clave"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm xl:col-span-2"
          />
          <select value={filters.origin} onChange={(event) => setFilters((prev) => ({ ...prev, origin: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Origen: todos</option>
            <option value="google_drive">Google Drive</option>
            <option value="zoho">Zoho Drive</option>
            <option value="manual_upload">Carga manual</option>
          </select>
          <select value={filters.document_type} onChange={(event) => setFilters((prev) => ({ ...prev, document_type: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tipo: todos</option>
            <option value="policy">Politica</option>
            <option value="procedure">Procedimiento</option>
            <option value="record">Registro</option>
            <option value="audit_evidence">Evidencia</option>
            <option value="risk_document">Riesgo</option>
            <option value="unknown">Sin clasificar</option>
          </select>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Estado: todos</option>
            <option value="indexed">Indexado</option>
            <option value="analyzed">Analizado</option>
            <option value="aprobada">Evidencia</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={filters.association} onChange={(event) => setFilters((prev) => ({ ...prev, association: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Asociacion: todas</option>
            <option value="not_associated">Sin asociar</option>
            <option value="control">Control</option>
            <option value="nonconformity">NC</option>
            <option value="finding">Hallazgo</option>
            <option value="process">Proceso</option>
            <option value="operation">Operacion</option>
            <option value="risk">Riesgo</option>
            <option value="action">Accion</option>
          </select>
          <div className="flex gap-2">
            <select value={filters.semantic_status} onChange={(event) => setFilters((prev) => ({ ...prev, semantic_status: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Semantica: todas</option>
              <option value="not_processed">No procesado</option>
              <option value="processed">Procesado</option>
              <option value="failed">Fallido</option>
            </select>
            <button onClick={() => loadDocuments().catch(() => null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              Buscar
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.version === 'all'}
              onChange={(event) => setFilters((prev) => ({ ...prev, version: event.target.checked ? 'all' : 'active' }))}
            />
            Mostrar versiones anteriores
          </label>
          <span>Por defecto se muestra solo la version activa mas reciente.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="font-bold text-slate-900">Biblioteca documental</h2>
            <p className="text-xs text-slate-500">Vista unica de documentos indexados y evidencias cargadas.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Origen</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Asociaciones</th>
                  <th className="px-3 py-3">Semantica</th>
                  <th className="px-3 py-3">Ultima indexacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando biblioteca...</td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay documentos disponibles con los filtros actuales.</td></tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => {
                        setSelected(doc);
                        setTab('summary');
                      }}
                      className={`cursor-pointer hover:bg-blue-50 ${selected?.id === doc.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{doc.filename || doc.title}</div>
                        <div className="text-xs text-slate-500">
                          {doc.active_version || 'v1'} {doc.is_active_version !== false ? '(Activa)' : '(Version anterior)'}
                        </div>
                      </td>
                      <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{typeLabel(doc.document_type)}</span></td>
                      <td className="px-3 py-3">{sourceBadge(doc.origin || doc.source_label)}</td>
                      <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(doc.status)}`}>{doc.status || 'indexed'}</span></td>
                      <td className="px-3 py-3">
                        {associationTotal(doc) > 0 ? (
                          <span className="font-semibold text-blue-700">{associationTotal(doc)} asociacion(es)</span>
                        ) : (
                          <span className="text-slate-400">Sin asociar</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(doc.semantic_status)}`}>
                          {doc.usefulness_score ? `${doc.usefulness_score}% util` : doc.semantic_status || 'not_processed'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{formatDate(doc.last_indexed_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-teal-200 bg-white shadow-sm">
          {!selected ? (
            <div className="p-5 text-sm text-slate-500">Selecciona un documento para ver detalle.</div>
          ) : (
            <>
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">{selected.filename || selected.title}</h2>
                    <div className="mt-1 text-xs text-slate-500">
                      {sourceBadge(selected.origin || selected.source_label)} · {selected.active_version || 'v1'}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={analyzeSelected}
                      disabled={working === 'analyze'}
                      className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {working === 'analyze' ? 'Analizando...' : 'Analizar utilidad'}
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['summary', 'associations', 'suggestions', 'chunks', 'versions', 'history'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setTab(item)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {item === 'summary' ? 'Resumen' : item === 'associations' ? 'Asociaciones' : item === 'suggestions' ? 'Sugerencias' : item === 'chunks' ? 'Fragmentos' : item === 'versions' ? 'Versiones' : 'Historial'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[740px] overflow-y-auto p-4">
                {tab === 'summary' && (
                  <div className="space-y-3 text-sm">
                    <Info label="Tipo sugerido" value={typeLabel(detail?.document?.profile?.document_type || selected.document_type)} />
                    <Info label="Estado semantico" value={detail?.document?.profile?.semantic_status || selected.semantic_status || 'not_processed'} />
                    <Info label="Score de utilidad" value={detail?.document?.profile?.usefulness_score ? `${detail.document.profile.usefulness_score}%` : selected.usefulness_score ? `${selected.usefulness_score}%` : '-'} />
                    <Info label="Ultima indexacion" value={formatDate(selected.last_indexed_at)} />
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                      AI sugiere, analiza y apoya. La revision humana sigue siendo obligatoria.
                    </div>
                  </div>
                )}

                {tab === 'associations' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {(detail?.associations || []).length === 0 ? (
                        <div className="text-sm text-slate-500">Sin asociaciones activas o historicas.</div>
                      ) : (
                        detail?.associations.map((association) => (
                          <div key={association.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                            <div className="font-semibold text-slate-900">
                              {targetLabels[association.target_type] || association.target_type}: {association.target_label || 'Objeto asociado'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Uso: {association.evidence_usage || 'supporting_evidence'} · {association.is_active ? 'Activa' : 'Inactiva'}
                            </div>
                            {canManage && (
                              <button
                                onClick={() => setAssociationStatus(association, !association.is_active)}
                                disabled={working === association.id}
                                className="mt-2 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold"
                              >
                                {association.is_active ? 'Desactivar' : 'Reactivar'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {canManage && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 text-sm font-bold">Nueva asociacion</div>
                        <div className="space-y-2">
                          <select value={targetType} onChange={(event) => {
                            setTargetType(event.target.value);
                            setAssociationForm((prev) => ({ ...prev, target_id: '' }));
                          }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            {Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <input value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Buscar objeto" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                            <button onClick={loadTargets} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Buscar</button>
                          </div>
                          <select value={associationForm.target_id} onChange={(event) => setAssociationForm((prev) => ({ ...prev, target_id: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            <option value="">Seleccionar objeto</option>
                            {targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label} {option.subtitle ? `- ${option.subtitle}` : ''}</option>)}
                          </select>
                          <select value={associationForm.evidence_usage} onChange={(event) => setAssociationForm((prev) => ({ ...prev, evidence_usage: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            {usageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <textarea value={associationForm.notes} onChange={(event) => setAssociationForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notas opcionales" className="min-h-[70px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                          <button onClick={saveAssociation} disabled={!associationForm.target_id || working === 'associate'} className="w-full rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            Guardar asociacion
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab === 'suggestions' && (
                  <div className="space-y-3">
                    {(detail?.suggestions || []).length === 0 ? (
                      <div className="text-sm text-slate-500">Sin sugerencias semanticas disponibles. Ejecuta el analisis documental.</div>
                    ) : (
                      detail?.suggestions.map((suggestion) => (
                        <div key={suggestion.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                          <div className="font-semibold text-slate-900">
                            {targetLabels[suggestion.target_type] || suggestion.target_type}: {suggestion.target_label || 'Objeto sugerido'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">Score: {suggestion.score || '-'} · Estado: {suggestion.status}</div>
                          <div className="mt-2 text-slate-700">{suggestion.reason || 'Sugerencia generada por coincidencias de contenido.'}</div>
                          {suggestion.snippet && <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{suggestion.snippet}</div>}
                          {canManage && suggestion.status === 'suggested' && (
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => reviewSuggestion(suggestion, 'accept')} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Aceptar</button>
                              <button onClick={() => reviewSuggestion(suggestion, 'reject')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold">Rechazar</button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'chunks' && (
                  <div className="space-y-3">
                    {(detail?.chunks || []).length === 0 ? (
                      <div className="text-sm text-slate-500">Sin fragmentos citables. Ejecuta el analisis documental.</div>
                    ) : (
                      detail?.chunks.map((chunk) => (
                        <div key={chunk.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="mb-2 text-xs font-semibold text-slate-500">Fragmento {chunk.chunk_index + 1}</div>
                          <div className="text-sm leading-6 text-slate-700">{chunk.chunk_text}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === 'versions' && (
                  <div className="space-y-2">
                    {(detail?.versions || []).map((version) => (
                      <div key={version.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                        <div className="font-semibold">{version.filename}</div>
                        <div className="text-xs text-slate-500">{version.active_version || 'v1'} · {version.is_active_version ? 'Activa' : 'Anterior'} · {formatDate(version.last_indexed_at)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'history' && (
                  <div className="space-y-2">
                    {(detail?.history || []).length === 0 ? (
                      <div className="text-sm text-slate-500">Sin historial disponible.</div>
                    ) : (
                      detail?.history.map((item, index) => (
                        <div key={`${item.event}-${index}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-xs text-slate-500">{formatDate(item.at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="mt-5 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-slate-900">Acciones rapidas</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={!selected} onClick={() => selected && setTab('summary')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Ver detalle</button>
          <button disabled={!selected || !canManage} onClick={analyzeSelected} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Actualizar analisis documental</button>
          <button disabled={!selected} onClick={() => setTab('associations')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Asociar a...</button>
          <button disabled className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 opacity-50">Descartar del indice</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value || '-'}</div>
    </div>
  );
}
