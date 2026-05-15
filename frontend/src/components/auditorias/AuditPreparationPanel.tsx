'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type JsonRecord = Record<string, unknown>;

type PackageRow = {
  id: string;
  package_name: string;
  standard_code: string;
  period_year: number;
  status: string;
  audit_id?: string | null;
  latest_export_file_url?: string | null;
  generated_at?: string | null;
  updated_at?: string | null;
  summary_json?: JsonRecord;
};

type TemplateRow = {
  id: string;
  template_key: string;
  document_name: string;
  folder_path: string;
  document_type: string;
};

type DocumentRow = {
  id: string;
  document_name: string;
  folder_path: string;
  document_status: string;
  generated_file_url?: string | null;
  output_format?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  version?: string | null;
  revision_number?: number | null;
  approved_at?: string | null;
  generated_content?: string | null;
  pending_items_json?: unknown[];
  evidence_links_json?: unknown[];
  source_trace_json?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
};

type EvidenceRow = {
  id: string;
  evidence_name: string;
  source_module?: string | null;
  folder_path?: string | null;
  status: string;
  notes?: string | null;
  created_at?: string | null;
};

type PackageDetail = {
  package?: PackageRow;
  documents?: DocumentRow[];
  evidences?: EvidenceRow[];
  generation_runs?: JsonRecord[];
  uploaded_zips?: UploadedZipRow[];
  completion_summary?: JsonRecord;
};

type UploadedZipRow = {
  id: string;
  original_filename: string;
  analysis_status?: string | null;
  inventory_json?: unknown[];
  detected_structure_json?: JsonRecord;
  created_at?: string | null;
};

const maxZipBytes = 50 * 1024 * 1024;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function parseJsonResponse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || json?.message || 'Solicitud no completada');
  }
  return json;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (['approved', 'exported', 'complete', 'audit_ready'].includes(value)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['requires_validation', 'partial', 'advanced'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['failed', 'pending', 'insufficient'].includes(value)) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function readinessColor(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function jsonArrayCount(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : 0;
}

const defaultTemplateKeys = [
  'manual_calidad',
  'politica_calidad',
  'objetivos_calidad',
  'revision_por_la_direccion',
  'indice_evidencias',
  'guia_entrevistas_auditoria',
  'procedimiento_acciones_correctivas',
  'matriz_riesgos_calidad',
];

export default function AuditPreparationPanel({ auditId = '' }: { auditId?: string }) {
  const [token, setToken] = useState('');
  const [standardCode, setStandardCode] = useState('ISO9001');
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear() < 2026 ? 2026 : new Date().getFullYear()));
  const [packageName, setPackageName] = useState(`Auditoría ISO 9001 ${new Date().getFullYear() < 2026 ? 2026 : new Date().getFullYear()}`);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(defaultTemplateKeys);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedPackage = detail?.package || packages.find((pkg) => pkg.id === selectedPackageId) || null;
  const rawCompletion = (detail?.completion_summary?.completion_summary || detail?.completion_summary || selectedPackage?.summary_json?.completion_summary || {}) as JsonRecord;
  const completion = rawCompletion;
  const readinessScore = Number(completion.estimated_readiness_score || 0);
  const readinessStatus = String(completion.readiness_status || 'insufficient');

  const visibleTemplates = useMemo(() => {
    const preferred = new Set(defaultTemplateKeys);
    const preferredRows = templates.filter((template) => preferred.has(template.template_key));
    return preferredRows.length ? preferredRows : templates.slice(0, 12);
  }, [templates]);

  const selectedTemplateNames = useMemo(() => {
    const names = new Map(templates.map((item) => [item.template_key, item.document_name]));
    return selectedTemplates.map((key) => names.get(key) || key);
  }, [selectedTemplates, templates]);

  const request = async (path: string, options: RequestInit = {}) => {
    if (!token) throw new Error('Sesión no disponible');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (!(options.body instanceof FormData) && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    return parseJsonResponse(res);
  };

  const loadTemplates = async (activeToken = token) => {
    if (!activeToken) return;
    const res = await fetch(`${API_URL}/api/audit-preparation/templates?standard_code=${encodeURIComponent(standardCode)}`, {
      headers: authHeaders(activeToken),
    });
    const json = await parseJsonResponse(res);
    const rows = Array.isArray(json.templates) ? json.templates : [];
    setTemplates(rows);
    setSelectedTemplates((prev) => {
      const available = new Set(rows.map((item: TemplateRow) => item.template_key));
      const kept = prev.filter((key) => available.has(key));
      if (kept.length) return kept;
      return rows.slice(0, 6).map((item: TemplateRow) => item.template_key);
    });
  };

  const loadPackages = async (activeToken = token) => {
    if (!activeToken) return;
    const params = new URLSearchParams({ standard_code: standardCode, period_year: periodYear });
    if (auditId) params.set('audit_id', auditId);
    const res = await fetch(`${API_URL}/api/audit-preparation/packages?${params.toString()}`, {
      headers: authHeaders(activeToken),
    });
    const json = await parseJsonResponse(res);
    const rows = Array.isArray(json.packages) ? json.packages : [];
    setPackages(rows);
    if (!selectedPackageId && rows[0]?.id) setSelectedPackageId(rows[0].id);
  };

  const loadDetail = async (packageId = selectedPackageId) => {
    if (!packageId) {
      setDetail(null);
      return;
    }
    const json = await request(`/api/audit-preparation/packages/${packageId}`);
    setDetail(json);
  };

  useEffect(() => {
    const stored = localStorage.getItem('token') || '';
    setToken(stored);
    if (stored) {
      void loadTemplates(stored).catch((err) => setError(err.message));
      void loadPackages(stored).catch((err) => setError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadTemplates().catch((err) => setError(err.message));
    void loadPackages().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standardCode, periodYear, auditId]);

  useEffect(() => {
    if (!token || !selectedPackageId) return;
    void loadDetail(selectedPackageId).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedPackageId]);

  const runAction = async (name: string, action: () => Promise<void>) => {
    try {
      setLoading(name);
      setError('');
      setMessage('');
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la acción');
    } finally {
      setLoading('');
    }
  };

  const createPackage = async () => runAction('create', async () => {
    const json = await request('/api/audit-preparation/packages', {
      method: 'POST',
      body: JSON.stringify({
        standard_code: standardCode,
        period_year: Number(periodYear),
        package_name: packageName,
        audit_id: auditId || null,
      }),
    });
    setSelectedPackageId(json.package.id);
    setMessage('Paquete documental creado.');
    await loadPackages();
    await loadDetail(json.package.id);
  });

  const buildContext = async () => runAction('context', async () => {
    if (!selectedPackageId) return;
    await request(`/api/audit-preparation/packages/${selectedPackageId}/build-context`, { method: 'POST' });
    setMessage('Contexto construido con datos disponibles.');
    await loadDetail();
  });

  const generateDocuments = async () => runAction('generate', async () => {
    if (!selectedPackageId) return;
    await request(`/api/audit-preparation/packages/${selectedPackageId}/generate-documents`, {
      method: 'POST',
      body: JSON.stringify({
        template_keys: selectedTemplates,
        generation_scope: auditId ? 'audit_specific' : 'general_preparation',
      }),
    });
    setMessage(`Documentos generados: ${selectedTemplateNames.join(', ')}`);
    await loadDetail();
  });

  const generateEvidenceIndex = async () => runAction('evidence-index', async () => {
    if (!selectedPackageId) return;
    await request(`/api/audit-preparation/packages/${selectedPackageId}/generate-evidence-index`, { method: 'POST' });
    setMessage('Índice de evidencias generado.');
    await loadDetail();
  });

  const updateDocumentStatus = async (documentId: string, status: string) => runAction(`doc-${documentId}`, async () => {
    await request(`/api/audit-preparation/documents/${documentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ document_status: status }),
    });
    setMessage('Estado documental actualizado.');
    await loadDetail();
  });

  const updateEvidenceStatus = async (evidenceId: string, status: string) => runAction(`evidence-${evidenceId}`, async () => {
    await request(`/api/audit-preparation/evidences/${evidenceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setMessage('Estado de evidencia actualizado.');
    await loadDetail();
  });

  const uploadZip = async () => runAction('zip', async () => {
    if (!zipFile) throw new Error('Selecciona un ZIP');
    if (!zipFile.name.toLowerCase().endsWith('.zip')) throw new Error('El archivo debe tener extensión .zip');
    if (zipFile.size > maxZipBytes) throw new Error('El ZIP supera el máximo de 50 MB para esta etapa.');
    const fd = new FormData();
    fd.append('file', zipFile);
    fd.append('standard_code', standardCode);
    fd.append('period_year', periodYear);
    if (selectedPackageId) fd.append('package_id', selectedPackageId);
    if (auditId) fd.append('audit_id', auditId);
    fd.append('package_name', packageName);
    const json = await request('/api/audit-preparation/upload-zip', { method: 'POST', body: fd });
    setSelectedPackageId(json.package_id);
    setMessage('ZIP registrado e inventariado.');
    await loadPackages();
    await loadDetail(json.package_id);
  });

  const exportPackage = async () => runAction('export', async () => {
    if (!selectedPackageId) return;
    await request(`/api/audit-preparation/packages/${selectedPackageId}/export`, { method: 'POST' });
    setMessage('Export ZIP generado.');
    await loadDetail();
  });

  const downloadExport = async () => {
    if (!token || !selectedPackageId) return;
    const res = await fetch(`${API_URL}/api/audit-preparation/packages/${selectedPackageId}/download-export`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      setError('No fue posible descargar el export.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedPackage?.package_name || 'preparacion-auditoria'}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = async (content?: string | null) => {
    await navigator.clipboard.writeText(content || '');
    setMessage('Markdown copiado.');
  };

  const downloadDocument = async (doc: DocumentRow) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/audit-preparation/documents/${doc.id}/download`, {
      headers: authHeaders(token),
    });
    if (!res.ok) {
      setError('No fue posible descargar el documento.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.document_name || 'documento'}.${doc.output_format || 'docx'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-[1800px] space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">Preparación documental</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Carpeta de auditoría ISO</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Crea paquetes, construye contexto desde la plataforma, genera documentos auditables, revisa pendientes, sube ZIPs existentes y exporta una carpeta inicial.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">
              Norma
              <select value={standardCode} onChange={(e) => setStandardCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="ISO9001">ISO9001</option>
                <option value="ISO27001">ISO27001</option>
                <option value="ISO42001" disabled>ISO42001 próximamente</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Año
              <input value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <button onClick={createPackage} disabled={loading === 'create'} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
              {loading === 'create' ? 'Creando...' : 'Crear paquete'}
            </button>
          </div>
        </div>
        <input value={packageName} onChange={(e) => setPackageName(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {message && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</div>}
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-3">
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">Paquetes</h3>
            <div className="mt-3 space-y-2">
              {packages.length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay paquetes para esta norma/año.</p>
              ) : packages.map((pkg) => (
                <button key={pkg.id} type="button" onClick={() => setSelectedPackageId(pkg.id)} className={`w-full rounded-2xl border p-3 text-left text-sm transition ${selectedPackageId === pkg.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
                  <div className="font-black text-slate-900">{pkg.package_name}</div>
                  <div className="mt-1 text-xs text-slate-500">{pkg.standard_code} · {pkg.period_year}</div>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${statusBadge(pkg.status)}`}>{pkg.status}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">Subir ZIP existente</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Se extrae texto de DOCX/PDF/XLSX/PPTX cuando es posible y se conserva el ZIP original sin modificar.</p>
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && (!file.name.toLowerCase().endsWith('.zip') || file.size > maxZipBytes)) {
                  setError(!file.name.toLowerCase().endsWith('.zip') ? 'Selecciona un archivo .zip válido.' : 'El ZIP supera el máximo de 50 MB.');
                  setZipFile(null);
                  return;
                }
                setError('');
                setZipFile(file);
              }}
              className="mt-3 w-full text-xs"
            />
            {zipFile && <div className="mt-2 text-xs font-semibold text-slate-600">{zipFile.name} · {(zipFile.size / 1024 / 1024).toFixed(2)} MB</div>}
            <button onClick={uploadZip} disabled={!zipFile || loading === 'zip'} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50">
              {loading === 'zip' ? 'Subiendo...' : 'Subir ZIP'}
            </button>
          </div>
        </aside>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-black uppercase text-slate-500">Readiness</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{readinessScore || 0}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${readinessColor(readinessScore)}`} style={{ width: `${Math.min(100, readinessScore || 0)}%` }} /></div>
              <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${statusBadge(readinessStatus)}`}>{readinessStatus}</span>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-black uppercase text-slate-500">Documentos</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{detail?.documents?.length || 0}</div>
              <p className="text-xs text-slate-500">Generados/importados</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-black uppercase text-slate-500">Evidencias</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{detail?.evidences?.length || 0}</div>
              <p className="text-xs text-slate-500">Índice documental</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-black uppercase text-slate-500">ZIPs</div>
              <div className="mt-2 text-3xl font-black text-slate-950">{detail?.uploaded_zips?.length || 0}</div>
              <p className="text-xs text-slate-500">Registrados</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button onClick={buildContext} disabled={!selectedPackageId || loading === 'context'} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Construir contexto</button>
              <button onClick={generateDocuments} disabled={!selectedPackageId || loading === 'generate'} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Generar documentos</button>
              <button onClick={generateEvidenceIndex} disabled={!selectedPackageId || loading === 'evidence-index'} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50">Índice evidencias</button>
              <button onClick={exportPackage} disabled={!selectedPackageId || loading === 'export'} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50">Exportar ZIP</button>
              <button onClick={downloadExport} disabled={!selectedPackage?.latest_export_file_url} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50">Descargar export</button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {visibleTemplates.map((template) => (
                <label key={template.template_key} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(template.template_key)}
                    onChange={(e) => setSelectedTemplates((prev) => e.target.checked ? Array.from(new Set([...prev, template.template_key])) : prev.filter((key) => key !== template.template_key))}
                  />
                  <span>{template.document_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">Documentos</h3>
              <div className="mt-3 max-h-[520px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400"><tr><th className="py-2">Documento</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(detail?.documents || []).map((doc) => (
                      <tr key={doc.id}>
                        <td className="py-3">
                          <button onClick={() => setSelectedDocument(doc)} className="text-left font-bold text-slate-900 hover:text-blue-700">{doc.document_name}</button>
                          <div className="text-xs text-slate-500">{doc.folder_path?.replace(/\{\{period_year\}\}/g, periodYear)}</div>
                        </td>
                        <td>
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusBadge(doc.document_status)}`}>{doc.document_status}</span>
                          <div className="mt-1 text-[11px] text-slate-500">v{doc.version || '1.0'} r{doc.revision_number || 1} · {doc.output_format || 'md'}</div>
                        </td>
                        <td className="space-x-1 space-y-1">
                          <button onClick={() => downloadDocument(doc)} disabled={!doc.generated_file_url} className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-bold text-blue-700 disabled:opacity-50">Descargar</button>
                          <button onClick={() => updateDocumentStatus(doc.id, 'in_review')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700">Revisión</button>
                          <button onClick={() => updateDocumentStatus(doc.id, 'approved')} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700">Aprobar</button>
                          <button onClick={() => updateDocumentStatus(doc.id, 'rejected')} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700">Rechazar</button>
                          <button onClick={() => updateDocumentStatus(doc.id, 'obsolete')} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600">Obsoleto</button>
                          <button onClick={() => updateDocumentStatus(doc.id, 'requires_validation')} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-bold text-amber-700">Validar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!detail?.documents || detail.documents.length === 0) && <p className="py-6 text-sm text-slate-500">Sin documentos generados.</p>}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">Evidencias y gaps</h3>
              <div className="mt-3 max-h-[520px] space-y-2 overflow-auto">
                {(detail?.evidences || []).map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-bold text-slate-900">{ev.evidence_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{ev.source_module || '-'} · {ev.folder_path || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${statusBadge(ev.status)}`}>{ev.status}</span>
                      <button onClick={() => updateEvidenceStatus(ev.id, 'complete')} className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700">Completa</button>
                      <button onClick={() => updateEvidenceStatus(ev.id, 'requires_validation')} className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-bold text-amber-700">Validar</button>
                    </div>
                  </div>
                ))}
                {Array.isArray(detail?.completion_summary?.gaps) && detail.completion_summary.gaps.slice(0, 8).map((gap: unknown, index: number) => {
                  const item = (gap && typeof gap === 'object' ? gap : {}) as JsonRecord;
                  return (
                  <div key={`gap-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <b>{String(item.source || '-')}</b>: {String(item.message || '')}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          {detail?.uploaded_zips?.length ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-900">ZIPs registrados</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {detail.uploaded_zips.map((zip) => (
                  <div key={zip.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="font-black text-slate-900">{zip.original_filename}</div>
                    <div className="mt-1 text-xs text-slate-500">Estado: {zip.analysis_status} · {formatDate(zip.created_at)}</div>
                    <div className="mt-2 text-xs text-slate-600">Archivos detectados: {Array.isArray(zip.inventory_json) ? zip.inventory_json.length : 0}</div>
                    <div className="mt-2 text-xs text-slate-600">
                      Coincidencias: {jsonArrayCount(zip.detected_structure_json, 'matched_templates')} ·
                      Conflictos: {jsonArrayCount(zip.detected_structure_json, 'conflicts')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDocument && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">{selectedDocument.document_name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => downloadDocument(selectedDocument)} disabled={!selectedDocument.generated_file_url} className="rounded-xl border border-blue-300 px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-50">Descargar {selectedDocument.output_format || ''}</button>
                  <button onClick={() => copyMarkdown(selectedDocument.generated_content)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-700">Copiar markdown</button>
                </div>
              </div>
              <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{selectedDocument.generated_content || '[PENDIENTE DE VALIDACIÓN]'}</pre>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <h4 className="text-xs font-black uppercase text-amber-700">Pendientes</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                    {(selectedDocument.pending_items_json || []).map((item: unknown, index: number) => <li key={index}>{String(item)}</li>)}
                  </ul>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                  <h4 className="text-xs font-black uppercase text-blue-700">Fuentes</h4>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-blue-900">{JSON.stringify(selectedDocument.source_trace_json || {}, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
