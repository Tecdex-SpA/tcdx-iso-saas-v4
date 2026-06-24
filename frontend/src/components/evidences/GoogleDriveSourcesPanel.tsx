'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type Integration = {
  id: string;
  provider: string;
  status: string;
  display_name?: string | null;
  provider_account_email?: string | null;
  last_sync_at?: string | null;
};

type Source = {
  id: string;
  provider: string;
  source_name: string;
  status?: string | null;
  folder_id?: string | null;
  folder_path?: string | null;
  folder_display_name?: string | null;
  associated_standard_code?: string | null;
  include_subfolders?: boolean;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  sync_enabled?: boolean;
  integration_status?: string | null;
  provider_account_email?: string | null;
};

type DriveFolder = {
  id: string;
  name: string;
  web_view_url?: string | null;
  modified_at?: string | null;
};

type DocumentRow = {
  id: string;
  file_name: string;
  mime_type?: string | null;
  file_extension?: string | null;
  provider: string;
  source_name?: string | null;
  folder_path?: string | null;
  modified_at?: string | null;
  indexed_at?: string | null;
  status?: string | null;
  web_view_url?: string | null;
};

type DocumentAnalysis = {
  id: string;
  document_id: string;
  detected_document_type?: string | null;
  detected_standard_code?: string | null;
  summary?: string | null;
  confidence_score?: number | string | null;
  evidence_quality?: string | null;
  missing_elements?: any;
  recommended_actions?: any;
  analysis_json?: any;
  created_at?: string | null;
};

type DocumentSuggestion = {
  id: string;
  tenant_id: string;
  document_id: string;
  target_type: string;
  target_id?: string | null;
  suggested_standard_code?: string | null;
  suggested_control_ref?: string | null;
  suggested_reason?: string | null;
  confidence_score?: number | string | null;
  status: string;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
  file_name?: string | null;
  provider?: string | null;
  web_view_url?: string | null;
  mime_type?: string | null;
};

type SyncLog = {
  id: string;
  source_name?: string | null;
  provider?: string | null;
  status?: string | null;
  files_seen?: number | null;
  files_indexed?: number | null;
  files_updated?: number | null;
  files_skipped?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
};

type Breadcrumb = {
  id: string;
  name: string;
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL');
}

function pct(value?: number | string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function asArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function badgeClass(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (['connected', 'completed', 'indexed', 'updated', 'medium', 'high'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (['failed', 'error', 'disconnected', 'low', 'insufficient'].includes(value)) {
    return 'bg-red-50 text-red-700 ring-red-200';
  }
  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

export default function GoogleDriveSourcesPanel({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [folderOpen, setFolderOpen] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Breadcrumb[]>([{ id: 'root', name: 'Mi unidad' }]);
  const [selectedAnalysisDocument, setSelectedAnalysisDocument] = useState<DocumentRow | null>(null);
  const [documentAnalyses, setDocumentAnalyses] = useState<DocumentAnalysis[]>([]);
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentSourceFilter, setDocumentSourceFilter] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('google_drive');
  const [mountedSharePath, setMountedSharePath] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [associatedStandard, setAssociatedStandard] = useState('');
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingExpiresAt, setPairingExpiresAt] = useState('');

  const googleIntegration = useMemo(
    () => integrations.find((item) => item.provider === 'google_drive' && item.status === 'connected') || null,
    [integrations]
  );

  const documentTypeOptions = useMemo(() => {
    return Array.from(
      new Set(
        documents
          .map((doc) => doc.file_extension || doc.mime_type || 'sin_tipo')
          .filter(Boolean)
          .map((item) => String(item))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const documentSourceOptions = useMemo(() => {
    return Array.from(
      new Set(documents.map((doc) => doc.source_name).filter(Boolean).map((item) => String(item)))
    ).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const q = documentSearch.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSource = !documentSourceFilter || doc.source_name === documentSourceFilter;
      const docType = String(doc.file_extension || doc.mime_type || 'sin_tipo');
      const matchesType = !documentTypeFilter || docType === documentTypeFilter;
      const haystack = [
        doc.file_name,
        doc.mime_type,
        doc.file_extension,
        doc.source_name,
        doc.folder_path,
        doc.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesSource && matchesType && matchesSearch;
    });
  }, [documents, documentSearch, documentSourceFilter, documentTypeFilter]);

  const pendingSuggestions = useMemo(
    () => suggestions.filter((item) => item.status === 'pending'),
    [suggestions]
  );

  const approvedSuggestions = useMemo(
    () => suggestions.filter((item) => item.status === 'approved'),
    [suggestions]
  );

  const supersededSuggestions = useMemo(
    () => suggestions.filter((item) => item.status === 'superseded'),
    [suggestions]
  );

  const fetchJson = useCallback(async (url: string, options: RequestInit = {}) => {
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
      const code = json?.code || '';
      const message = code === 'GOOGLE_RECONNECT_REQUIRED'
        ? 'Debe reconectar Google Drive para permitir lectura/exportación de documentos existentes en la carpeta seleccionada.'
        : (json?.error || 'Error en la operación');
      throw new Error(message);
    }

    return json;
  }, []);

  const refresh = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);

      const [
        integrationsJson,
        sourcesJson,
        documentsJson,
        logsJson,
        pendingSuggestionsJson,
        approvedSuggestionsJson,
        supersededSuggestionsJson,
      ] = await Promise.all([
        fetchJson(`${API_URL}/api/document-integrations/integrations?tenant_id=${tenantId}`),
        fetchJson(`${API_URL}/api/document-integrations/sources?tenant_id=${tenantId}`),
        fetchJson(`${API_URL}/api/document-integrations/documents?tenant_id=${tenantId}&limit=500&include_folders=false`),
        fetchJson(`${API_URL}/api/document-integrations/sync-logs?tenant_id=${tenantId}`),
        fetchJson(`${API_URL}/api/document-integrations/suggestions?tenant_id=${tenantId}&status=pending&limit=200`),
        fetchJson(`${API_URL}/api/document-integrations/suggestions?tenant_id=${tenantId}&status=approved&limit=200`),
        fetchJson(`${API_URL}/api/document-integrations/suggestions?tenant_id=${tenantId}&status=superseded&limit=200`),
      ]);

      setIntegrations(integrationsJson.integrations || []);
      setSources(sourcesJson.sources || []);
      setDocuments(documentsJson.documents || []);
      setLogs(logsJson.logs || []);
      setSuggestions([
        ...(pendingSuggestionsJson.suggestions || []),
        ...(approvedSuggestionsJson.suggestions || []),
        ...(supersededSuggestionsJson.suggestions || []),
      ]);
    } catch (err: any) {
      setMessage(err.message || 'No fue posible cargar fuentes documentales.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson, tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connectGoogle = async () => {
    try {
      setWorking('connect');
      const json = await fetchJson(`${API_URL}/api/document-integrations/google/oauth/start`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!json.auth_url) throw new Error('Google no devolvió URL de autorización.');
      window.location.href = json.auth_url;
    } catch (err: any) {
      setMessage(err.message || 'No fue posible iniciar Google Drive.');
    } finally {
      setWorking('');
    }
  };

  const connectZoho = async () => {
    try {
      setWorking('connect-zoho');
      const json = await fetchJson(`${API_URL}/api/document-integrations/zoho/oauth/start`);
      if (!json.auth_url) throw new Error('Zoho no devolvió URL de autorización.');
      window.location.href = json.auth_url;
    } catch (err: any) {
      setMessage(err.message || 'No fue posible iniciar Zoho WorkDrive.');
    } finally {
      setWorking('');
    }
  };

  const createMountedShare = async () => {
    try {
      setWorking('create-mounted-share');
      await fetchJson(`${API_URL}/api/document-integrations/sources`, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'mounted_share',
          source_name: sourceName || mountedSharePath || 'Carpeta compartida',
          folder_path: mountedSharePath,
          include_subfolders: includeSubfolders,
          associated_standard_code: associatedStandard || null,
        }),
      });
      setMessage('Fuente mounted_share creada.');
      setWizardOpen(false);
      setMountedSharePath('');
      setSourceName('');
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible crear la fuente mounted_share.');
    } finally {
      setWorking('');
    }
  };

  const generatePairingCode = async () => {
    try {
      setWorking('pairing-code');
      const json = await fetchJson(`${API_URL}/api/document-integrations/agents/pairing-codes`, {
        method: 'POST',
        body: JSON.stringify({
          source_name: sourceName || 'TCDX Sync Agent',
        }),
      });
      setPairingCode(json.pairing_code || '');
      setPairingExpiresAt(json.expires_at || '');
      setMessage('Código de vinculación generado. Se muestra una sola vez.');
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible generar código de vinculación.');
    } finally {
      setWorking('');
    }
  };

  const loadFolders = async (parent: Breadcrumb) => {
    if (!googleIntegration) return;
    try {
      setWorking(`folders-${parent.id}`);
      const json = await fetchJson(
        `${API_URL}/api/document-integrations/google/folders?tenant_id=${tenantId}&integration_id=${googleIntegration.id}&parent_id=${encodeURIComponent(parent.id)}`
      );
      setFolders(json.folders || []);
    } catch (err: any) {
      setMessage(err.message || 'No fue posible listar carpetas.');
    } finally {
      setWorking('');
    }
  };

  const openFolderPicker = async () => {
    setFolderOpen(true);
    const root = { id: 'root', name: 'Mi unidad' };
    setBreadcrumb([root]);
    await loadFolders(root);
  };

  const enterFolder = async (folder: DriveFolder) => {
    const next = { id: folder.id, name: folder.name };
    setBreadcrumb((prev) => [...prev, next]);
    await loadFolders(next);
  };

  const goToBreadcrumb = async (index: number) => {
    const nextCrumbs = breadcrumb.slice(0, index + 1);
    setBreadcrumb(nextCrumbs);
    await loadFolders(nextCrumbs[nextCrumbs.length - 1]);
  };

  const selectFolder = async (folder: DriveFolder) => {
    if (!googleIntegration) return;
    const path = [...breadcrumb.slice(1).map((item) => item.name), folder.name].join(' / ') || folder.name;
    try {
      setWorking(`select-${folder.id}`);
      await fetchJson(`${API_URL}/api/document-integrations/sources`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          provider: 'google_drive',
          integration_id: googleIntegration.id,
          source_name: folder.name,
          folder_id: folder.id,
          folder_path: path,
          include_subfolders: includeSubfolders,
        }),
      });
      setMessage(`Fuente documental creada: ${folder.name}`);
      setFolderOpen(false);
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible crear la fuente documental.');
    } finally {
      setWorking('');
    }
  };

  const syncSource = async (source: Source) => {
    try {
      setWorking(`sync-${source.id}`);
      await fetchJson(`${API_URL}/api/document-integrations/sources/${source.id}/sync`, {
        method: 'POST',
      });
      setMessage(`Sincronización finalizada: ${source.source_name}`);
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible sincronizar la fuente.');
    } finally {
      setWorking('');
    }
  };

  const disconnectSource = async (source: Source) => {
    if (!window.confirm('Esto detendrá la sincronización de esta carpeta. No se eliminarán evidencias históricas.')) return;
    try {
      setWorking(`disconnect-${source.id}`);
      await fetchJson(`${API_URL}/api/document-integrations/sources/${source.id}`, {
        method: 'DELETE',
      });
      setMessage(`Fuente desconectada: ${source.source_name}. Las evidencias históricas se conservan.`);
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible desconectar la fuente.');
    } finally {
      setWorking('');
    }
  };

  const viewAnalysis = async (doc: DocumentRow) => {
    try {
      setWorking(`analysis-${doc.id}`);
      setSelectedAnalysisDocument(doc);
      const json = await fetchJson(`${API_URL}/api/document-integrations/documents/${doc.id}/analysis?tenant_id=${tenantId}`);
      setDocumentAnalyses(json.analyses || []);
    } catch (err: any) {
      setMessage(err.message || 'No fue posible cargar análisis del documento.');
    } finally {
      setWorking('');
    }
  };

  const analyzeDocument = async (doc: DocumentRow) => {
    try {
      setWorking(`analyze-${doc.id}`);
      const json = await fetchJson(`${API_URL}/api/document-integrations/documents/${doc.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setSelectedAnalysisDocument(doc);
      setDocumentAnalyses(json.analysis ? [json.analysis] : []);
      const created = Number(json.suggestions_created || 0);
      setMessage(
        created > 0
          ? `Análisis generado para: ${doc.file_name}. Sugerencias nuevas: ${created}.`
          : `Análisis generado para: ${doc.file_name}. No se crearon sugerencias nuevas.`
      );
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible analizar el documento.');
    } finally {
      setWorking('');
    }
  };

  const reviewSuggestion = async (suggestion: DocumentSuggestion, action: 'approve' | 'reject') => {
    try {
      setWorking(`${action}-suggestion-${suggestion.id}`);

      await fetchJson(`${API_URL}/api/document-integrations/suggestions/${suggestion.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      setMessage(
        action === 'approve'
          ? 'Sugerencia aprobada. No se creó evidencia formal automáticamente.'
          : 'Sugerencia rechazada.'
      );

      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible revisar la sugerencia.');
    } finally {
      setWorking('');
    }
  };

  const createEvidenceFromSuggestion = async (suggestion: DocumentSuggestion) => {
    try {
      setWorking(`create-evidence-${suggestion.id}`);

      const json = await fetchJson(`${API_URL}/api/document-integrations/suggestions/${suggestion.id}/create-evidence`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      if (json?.already_exists) {
        setMessage('La evidencia ya existía para esta sugerencia. No se duplicó.');
      } else {
        setMessage('Evidencia formal creada en estado pendiente. Requiere aprobación humana para impactar cumplimiento.');
      }

      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible crear evidencia desde la sugerencia.');
    } finally {
      setWorking('');
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Fuentes documentales</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Fuentes documentales tenant-scoped</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Conecta carpetas Google Drive, Zoho WorkDrive, agentes locales o rutas montadas seguras. Cada fuente, documento y sugerencia queda aislada por tenant y requiere revisión humana antes de crear evidencia formal.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {message}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Integración</p>
          <p className="mt-2 text-xl font-black text-slate-900">{googleIntegration ? 'Conectada' : 'Pendiente'}</p>
          <p className="mt-1 text-xs text-slate-500">{googleIntegration?.provider_account_email || 'Google Drive no conectado'}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fuentes</p>
          <p className="mt-2 text-xl font-black text-slate-900">{sources.length}</p>
          <p className="mt-1 text-xs text-slate-500">Carpetas configuradas</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Documentos</p>
          <p className="mt-2 text-xl font-black text-slate-900">{documents.length}</p>
          <p className="mt-1 text-xs text-slate-500">Últimos indexados visibles</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Logs</p>
          <p className="mt-2 text-xl font-black text-slate-900">{logs.length}</p>
          <p className="mt-1 text-xs text-slate-500">Eventos de sincronización</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => setWizardOpen((value) => !value)}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
        >
          {wizardOpen ? 'Cerrar conexión' : 'Conectar fuente externa'}
        </button>
        {!googleIntegration ? (
          <button
            onClick={connectGoogle}
            disabled={working === 'connect'}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {working === 'connect' ? 'Conectando...' : 'Conectar Google Drive'}
          </button>
        ) : (
          <button
            onClick={openFolderPicker}
            disabled={Boolean(working)}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            Seleccionar carpeta de Google Drive
          </button>
        )}
      </div>

      {wizardOpen && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {[
              ['google_drive', 'Google Drive'],
              ['zoho_workdrive', 'Zoho WorkDrive'],
              ['local_agent', 'TCDX Sync Agent'],
              ['mounted_share', 'Carpeta montada'],
              ['manual_upload', 'Carga manual'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedProvider(value)}
                className={`rounded-2xl border px-3 py-3 text-sm font-black ${
                  selectedProvider === value
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedProvider === 'google_drive' && (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-700">Autoriza Google Drive y luego selecciona una carpeta específica. No se sincroniza todo Mi unidad por defecto.</p>
              <label className="mt-3 flex w-fit items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={includeSubfolders} onChange={(e) => setIncludeSubfolders(e.target.checked)} />
                Incluir subcarpetas al sincronizar
              </label>
              <button onClick={connectGoogle} disabled={working === 'connect'} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                {working === 'connect' ? 'Conectando...' : googleIntegration ? 'Reconectar Google Drive' : 'Conectar con Google'}
              </button>
            </div>
          )}

          {selectedProvider === 'zoho_workdrive' && (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-700">Zoho WorkDrive usa OAuth por tenant. Si el conector no está configurado, el backend responderá con error controlado.</p>
              <button onClick={connectZoho} disabled={working === 'connect-zoho'} className="mt-3 rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                {working === 'connect-zoho' ? 'Conectando...' : 'Conectar con Zoho'}
              </button>
            </div>
          )}

          {selectedProvider === 'local_agent' && (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-700">Instale TCDX Sync Agent en el PC o servidor donde está la carpeta local y vincúlelo con un código temporal.</p>
              <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Nombre visible de la fuente" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <button onClick={generatePairingCode} disabled={working === 'pairing-code'} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                {working === 'pairing-code' ? 'Generando...' : 'Generar código de vinculación'}
              </button>
              {pairingCode && (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <div className="font-black">Código: {pairingCode}</div>
                  <div className="mt-1 text-xs">Expira: {fmtDate(pairingExpiresAt)}</div>
                  <code className="mt-2 block rounded-lg bg-white p-2 text-xs text-slate-800">
                    node agent.js register --base-url {API_URL} --pairing-code {pairingCode} --folder /ruta/local
                  </code>
                </div>
              )}
            </div>
          )}

          {selectedProvider === 'mounted_share' && (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-700">Use una ruta relativa bajo LOCAL_DOCUMENT_ROOT. No se aceptan rutas absolutas ni “..”.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Nombre visible" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input value={mountedSharePath} onChange={(e) => setMountedSharePath(e.target.value)} placeholder="rieltec/evidencias" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <select value={associatedStandard} onChange={(e) => setAssociatedStandard(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Sin norma asociada</option>
                  <option value="ISO9001">ISO9001</option>
                  <option value="ISO27001">ISO27001</option>
                  <option value="ISO42001">ISO42001</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={includeSubfolders} onChange={(e) => setIncludeSubfolders(e.target.checked)} />
                  Incluir subcarpetas
                </label>
              </div>
              <button onClick={createMountedShare} disabled={working === 'create-mounted-share'} className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                {working === 'create-mounted-share' ? 'Creando...' : 'Guardar carpeta montada'}
              </button>
            </div>
          )}

          {selectedProvider === 'manual_upload' && (
            <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              La carga manual existente sigue disponible en esta vista. Los archivos se guardan tenant-scoped y no se exponen por URL pública.
            </div>
          )}
        </div>
      )}

      {folderOpen && googleIntegration && (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">Selector de carpeta</h3>
              <p className="text-sm text-slate-500">Elige una carpeta específica. No se sincronizará todo Mi unidad por defecto.</p>
            </div>
            <button onClick={() => setFolderOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white">
              Cerrar
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            {breadcrumb.map((item, index) => (
              <button key={`${item.id}-${index}`} onClick={() => goToBreadcrumb(index)} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 hover:bg-slate-100">
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {folders.map((folder) => (
              <div key={folder.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-black text-slate-900">{folder.name}</div>
                <div className="mt-1 text-xs text-slate-500">Modificada: {fmtDate(folder.modified_at)}</div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => enterFolder(folder)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    Entrar
                  </button>
                  <button onClick={() => selectFolder(folder)} disabled={working === `select-${folder.id}`} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-60">
                    Seleccionar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {folders.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No hay subcarpetas en esta ubicación.
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 p-4">
          <h3 className="text-lg font-black text-slate-900">Fuentes configuradas</h3>
          <div className="mt-4 space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-900">{source.source_name}</div>
                    <div className="mt-1 text-xs text-slate-500">{source.provider} · {source.status || 'active'}</div>
                    <div className="mt-1 text-xs text-slate-500">{source.folder_display_name || source.folder_path || source.folder_id || 'Sin carpeta'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Subcarpetas: {source.include_subfolders === false ? 'no' : 'sí'} · Último estado: {source.last_sync_status || '—'}
                    </div>
                    {source.last_sync_error && <div className="mt-1 text-xs font-semibold text-red-700">{source.last_sync_error}</div>}
                    {source.associated_standard_code && <div className="mt-1 text-xs font-bold text-blue-700">{source.associated_standard_code}</div>}
                    <div className="mt-1 text-xs text-slate-500">Última sync: {fmtDate(source.last_sync_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => syncSource(source)} disabled={working === `sync-${source.id}` || source.status === 'disconnected'} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60">
                      {working === `sync-${source.id}` ? 'Sincronizando...' : 'Sincronizar ahora'}
                    </button>
                    {source.provider === 'google_drive' && (
                      <button onClick={connectGoogle} disabled={working === 'connect'} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                        Reconectar
                      </button>
                    )}
                    {source.status !== 'disconnected' && (
                      <button onClick={() => disconnectSource(source)} disabled={working === `disconnect-${source.id}`} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60">
                        {working === `disconnect-${source.id}` ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {sources.length === 0 && <p className="text-sm text-slate-500">Aún no hay carpetas configuradas.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 p-4">
          <h3 className="text-lg font-black text-slate-900">Logs recientes</h3>
          <div className="mt-4 space-y-3">
            {logs.slice(0, 6).map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{log.source_name || 'Fuente documental'}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${badgeClass(log.status)}`}>{log.status || '—'}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-500">
                  <span>Vistos: {log.files_seen ?? 0}</span>
                  <span>Indexados: {log.files_indexed ?? 0}</span>
                  <span>Actualizados: {log.files_updated ?? 0}</span>
                  <span>Omitidos: {log.files_skipped ?? 0}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">{fmtDate(log.started_at)}</div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-slate-500">Aún no hay logs.</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Revisión humana requerida</p>
            <h3 className="mt-2 text-lg font-black text-amber-950">Sugerencias de asociación documental</h3>
            <p className="mt-1 text-sm text-amber-800">
              Estas sugerencias vienen del análisis IA. Primero se revisan; luego puedes crear evidencia formal pendiente. Nada impacta cumplimiento hasta que la evidencia sea aprobada por un humano.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-amber-200">
              <div className="text-2xl font-black text-amber-900">{pendingSuggestions.length}</div>
              <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Pendientes</div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-emerald-200">
              <div className="text-2xl font-black text-emerald-900">{approvedSuggestions.length}</div>
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Aprobadas</div>
            </div>

            <div className="rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-slate-200">
              <div className="text-2xl font-black text-slate-900">{supersededSuggestions.length}</div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Con evidencia</div>
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-[360px] overflow-y-auto pr-1">
          <div className="space-y-3">
            {pendingSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-2xl border border-amber-100 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">
                      {suggestion.file_name || 'Documento indexado'}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                        Target: {suggestion.target_type}
                      </span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-200">
                        Norma: {suggestion.suggested_standard_code || '—'}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-200">
                        Control: {suggestion.suggested_control_ref || '—'}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200">
                        Confianza: {pct(suggestion.confidence_score)}
                      </span>
                    </div>

                    {suggestion.suggested_reason && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {suggestion.suggested_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {suggestion.web_view_url && (
                      <a
                        href={suggestion.web_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        Abrir doc
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => reviewSuggestion(suggestion, 'approve')}
                      disabled={working === `approve-suggestion-${suggestion.id}`}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Aprobar
                    </button>

                    <button
                      type="button"
                      onClick={() => reviewSuggestion(suggestion, 'reject')}
                      disabled={working === `reject-suggestion-${suggestion.id}`}
                      className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {pendingSuggestions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-white p-5 text-sm text-amber-800">
                No hay sugerencias pendientes. Ejecuta análisis documental sobre archivos indexados para generarlas.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Paso siguiente</p>
            <h3 className="mt-2 text-lg font-black text-emerald-950">Sugerencias aprobadas listas para crear evidencia</h3>
            <p className="mt-1 text-sm text-emerald-800">
              Al crear evidencia, quedará en estado pendiente. No mejora salud ni cumplimiento hasta aprobación humana.
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-[300px] overflow-y-auto pr-1">
          <div className="space-y-3">
            {approvedSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">
                      {suggestion.file_name || 'Documento indexado'}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-200">
                        Norma: {suggestion.suggested_standard_code || '—'}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-200">
                        Control: {suggestion.suggested_control_ref || '—'}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200">
                        Confianza: {pct(suggestion.confidence_score)}
                      </span>
                    </div>

                    {suggestion.suggested_reason && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {suggestion.suggested_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {suggestion.web_view_url && (
                      <a
                        href={suggestion.web_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                      >
                        Abrir doc
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => createEvidenceFromSuggestion(suggestion)}
                      disabled={working === `create-evidence-${suggestion.id}`}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {working === `create-evidence-${suggestion.id}` ? 'Creando...' : 'Crear evidencia'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {approvedSuggestions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-5 text-sm text-emerald-800">
                No hay sugerencias aprobadas pendientes de convertir en evidencia.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Historial</p>
            <h3 className="mt-2 text-lg font-black text-slate-900">Sugerencias ya convertidas en evidencia</h3>
            <p className="mt-1 text-sm text-slate-600">
              Estas sugerencias quedaron cerradas porque ya generaron una evidencia formal.
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-[220px] overflow-y-auto pr-1">
          <div className="space-y-3">
            {supersededSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">
                      {suggestion.file_name || 'Documento indexado'}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                        Evidencia creada
                      </span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue-200">
                        Norma: {suggestion.suggested_standard_code || '—'}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-200">
                        Control: {suggestion.suggested_control_ref || '—'}
                      </span>
                    </div>

                    {suggestion.suggested_reason && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {suggestion.suggested_reason}
                      </p>
                    )}
                  </div>

                  {suggestion.web_view_url && (
                    <a
                      href={suggestion.web_view_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                    >
                      Abrir doc
                    </a>
                  )}
                </div>
              </div>
            ))}

            {supersededSuggestions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                Aún no hay sugerencias convertidas en evidencia.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">Documentos indexados</h3>
            <p className="mt-1 text-sm text-slate-500">
              Listado con scroll interno. No agranda la página aunque existan muchos documentos.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-3 xl:w-[760px]">
            <input
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              placeholder="Buscar por archivo, tipo, fuente o estado"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none ring-blue-100 focus:ring-2"
            />

            <select
              value={documentSourceFilter}
              onChange={(event) => setDocumentSourceFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none ring-blue-100 focus:ring-2"
            >
              <option value="">Todas las fuentes</option>
              {documentSourceOptions.map((sourceName) => (
                <option key={sourceName} value={sourceName}>
                  {sourceName}
                </option>
              ))}
            </select>

            <select
              value={documentTypeFilter}
              onChange={(event) => setDocumentTypeFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none ring-blue-100 focus:ring-2"
            >
              <option value="">Todos los tipos</option>
              {documentTypeOptions.map((typeName) => (
                <option key={typeName} value={typeName}>
                  {typeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
          <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">
            Mostrando {filteredDocuments.length} de {documents.length}
          </span>
          {documentSearch && (
            <button
              type="button"
              onClick={() => setDocumentSearch('')}
              className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>

        <div className="mt-4 max-h-[460px] overflow-y-auto overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-slate-400 shadow-sm">
              <tr>
                <th className="px-3 py-3">Archivo</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Fuente</th>
                <th className="px-3 py-3">Modificado</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="max-w-[360px] px-3 py-3">
                    <div className="truncate font-semibold text-slate-800" title={doc.file_name}>
                      {doc.file_name}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-400">
                      {doc.id}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{doc.file_extension || doc.mime_type || '—'}</td>
                  <td className="px-3 py-3 text-slate-500">{doc.source_name || '—'}</td>
                  <td className="px-3 py-3 text-slate-500">{fmtDate(doc.modified_at)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${badgeClass(doc.status)}`}>
                      {doc.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {doc.web_view_url && (
                        <a href={doc.web_view_url} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                          Abrir
                        </a>
                      )}
                      <button onClick={() => analyzeDocument(doc)} disabled={working === `analyze-${doc.id}` || ['missing', 'ignored', 'error'].includes(String(doc.status || '').toLowerCase())} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60">
                        {working === `analyze-${doc.id}` ? 'Analizando...' : 'Analizar'}
                      </button>
                      <button onClick={() => viewAnalysis(doc)} disabled={working === `analysis-${doc.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                        Ver análisis
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredDocuments.length === 0 && (
            <p className="bg-white p-4 text-sm text-slate-500">
              No hay documentos que coincidan con los filtros.
            </p>
          )}
        </div>
      </div>

      {selectedAnalysisDocument && (
        <div className="mt-6 rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Análisis documental IA</p>
              <h3 className="mt-2 text-lg font-black text-indigo-950">{selectedAnalysisDocument.file_name}</h3>
              <p className="mt-1 text-sm text-indigo-800">Resultado preliminar. Requiere revisión humana y no modifica evidencias ni cumplimiento.</p>
            </div>
            <button onClick={() => { setSelectedAnalysisDocument(null); setDocumentAnalyses([]); }} className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
              Cerrar
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {documentAnalyses.map((analysis) => {
              const missing = asArray(analysis.missing_elements);
              const actions = asArray(analysis.recommended_actions);
              return (
                <div key={analysis.id} className="rounded-2xl border border-indigo-100 bg-white p-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">Tipo: {analysis.detected_document_type || '—'}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">Norma: {analysis.detected_standard_code || 'Sin detectar'}</span>
                    <span className={`rounded-full px-3 py-1 font-bold ring-1 ${badgeClass(analysis.evidence_quality)}`}>Calidad: {analysis.evidence_quality || '—'}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">Confianza: {pct(analysis.confidence_score)}</span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">Fecha: {fmtDate(analysis.created_at)}</span>
                  </div>

                  {analysis.summary && (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {analysis.summary}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Elementos faltantes</div>
                      {missing.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {missing.slice(0, 6).map((item, idx) => <li key={`m-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-slate-500">Sin observaciones relevantes.</p>}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Acciones recomendadas</div>
                      {actions.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {actions.slice(0, 6).map((item, idx) => <li key={`a-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>)}
                        </ul>
                      ) : <p className="mt-2 text-sm text-slate-500">Sin acciones sugeridas.</p>}
                    </div>
                  </div>
                </div>
              );
            })}
            {documentAnalyses.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">Este documento aún no tiene análisis guardados.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
