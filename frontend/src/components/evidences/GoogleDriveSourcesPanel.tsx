'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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
  folder_id?: string | null;
  folder_path?: string | null;
  last_sync_at?: string | null;
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
  modified_at?: string | null;
  indexed_at?: string | null;
  status?: string | null;
  web_view_url?: string | null;
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

function badgeClass(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (['connected', 'completed', 'indexed', 'updated'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (['failed', 'error', 'disconnected'].includes(value)) {
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

  const googleIntegration = useMemo(
    () => integrations.find((item) => item.provider === 'google_drive' && item.status === 'connected') || null,
    [integrations]
  );

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

  const refresh = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const [integrationsJson, sourcesJson, documentsJson, logsJson] = await Promise.all([
        fetchJson(`${API_URL}/api/document-integrations/integrations?tenant_id=${tenantId}`),
        fetchJson(`${API_URL}/api/document-integrations/sources?tenant_id=${tenantId}`),
        fetchJson(`${API_URL}/api/document-integrations/documents?tenant_id=${tenantId}&limit=50`),
        fetchJson(`${API_URL}/api/document-integrations/sync-logs?tenant_id=${tenantId}`),
      ]);
      setIntegrations(integrationsJson.integrations || []);
      setSources(sourcesJson.sources || []);
      setDocuments(documentsJson.documents || []);
      setLogs(logsJson.logs || []);
    } catch (err: any) {
      setMessage(err.message || 'No fue posible cargar fuentes documentales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [tenantId]);

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
      await fetchJson(`${API_URL}/api/document-integrations/sources/${source.id}/sync-google`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setMessage(`Sincronización finalizada: ${source.source_name}`);
      await refresh();
    } catch (err: any) {
      setMessage(err.message || 'No fue posible sincronizar la fuente.');
    } finally {
      setWorking('');
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Fuentes documentales</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Google Drive conectado a evidencias</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Conecta una cuenta Google Drive, selecciona una carpeta específica de evidencias ISO y sincroniza solo metadata documental. No se descargan archivos ni se ejecuta análisis IA en esta etapa.
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
                    <div className="mt-1 text-xs text-slate-500">{source.folder_path || source.folder_id || 'Sin carpeta'}</div>
                    <div className="mt-1 text-xs text-slate-500">Última sync: {fmtDate(source.last_sync_at)}</div>
                  </div>
                  <button onClick={() => syncSource(source)} disabled={working === `sync-${source.id}`} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60">
                    {working === `sync-${source.id}` ? 'Sincronizando...' : 'Sincronizar ahora'}
                  </button>
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

      <div className="mt-6 rounded-3xl border border-slate-200 p-4">
        <h3 className="text-lg font-black text-slate-900">Documentos indexados</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Modificado</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.slice(0, 20).map((doc) => (
                <tr key={doc.id}>
                  <td className="px-3 py-3 font-semibold text-slate-800">{doc.file_name}</td>
                  <td className="px-3 py-3 text-slate-500">{doc.file_extension || doc.mime_type || '—'}</td>
                  <td className="px-3 py-3 text-slate-500">{doc.source_name || '—'}</td>
                  <td className="px-3 py-3 text-slate-500">{fmtDate(doc.modified_at)}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ring-1 ${badgeClass(doc.status)}`}>{doc.status || '—'}</span></td>
                  <td className="px-3 py-3">
                    {doc.web_view_url ? (
                      <a href={doc.web_view_url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:text-blue-800">
                        Abrir en Drive
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 && <p className="p-4 text-sm text-slate-500">Aún no hay documentos indexados.</p>}
        </div>
      </div>
    </section>
  );
}
