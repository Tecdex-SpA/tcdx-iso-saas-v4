'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type UnknownRecord = { [key: string]: unknown };

type SourceCard = {
  source_type: string;
  source_name: string;
  status: string;
  source_id?: string | null;
  connected?: boolean;
  root_folder_id?: string | null;
  root_folder_name?: string | null;
  account_email?: string | null;
  provider_account_email?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  documents_count?: number;
  last_sync_at?: string | null;
  actions?: SourceAction[];
};

type ApiError = Error & {
  code?: string;
  status?: number;
  details?: UnknownRecord;
};

type SourceAction = {
  key: string;
  label: string;
  method?: string;
  path?: string | null;
  kind?: 'api' | 'oauth' | 'link' | 'info' | 'upload_files' | 'upload_zip' | 'google_folder_selector' | 'zoho_folder_selector' | 'zoho_folder_url' | 'disconnect_provider';
  enabled?: boolean;
  reason?: string | null;
  body?: UnknownRecord | null;
};

type GoogleFolder = {
  id: string;
  name: string;
  path?: string | null;
  display_path?: string | null;
  parent_id?: string | null;
  type?: string | null;
  item_type?: string | null;
  provider?: string | null;
  can_open?: boolean;
  can_select?: boolean;
  children_count?: number | null;
  mime_type?: string | null;
  web_view_url?: string | null;
};

type LibraryDocument = {
  id: string;
  library_item_id?: string | null;
  operation_ref?: string | null;
  source_type: 'document_index' | 'evidence';
  source_id: string;
  source_id_shape?: string | null;
  source_table?: string;
  document_key?: string;
  document_source_id?: string | null;
  provider_file_id?: string | null;
  provider_file_id_shape?: string | null;
  item_type?: 'file' | 'folder' | 'source';
  can_analyze?: boolean;
  can_associate?: boolean;
  can_open?: boolean;
  can_sync?: boolean;
  can_exclude?: boolean;
  can_restore?: boolean;
  is_excluded?: boolean;
  exclusion_scope?: string | null;
  exclusion_id?: string | null;
  disabled_reason?: string | null;
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
  profile?: unknown;
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

type FolderNavigationFrame = {
  folder: LibraryDocument;
  documents: LibraryDocument[];
  selected: LibraryDocument | null;
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

const fallbackSources: SourceCard[] = [
  { source_type: 'google_drive', source_name: 'Google Drive', status: 'available', documents_count: 0, actions: [{ key: 'connect', label: 'Conectar Google Drive', method: 'POST', path: '/api/document-integrations/google/oauth/start', kind: 'oauth', enabled: true }] },
  { source_type: 'zoho_drive', source_name: 'Zoho Drive', status: 'available', documents_count: 0, actions: [{ key: 'connect', label: 'Conectar Zoho Drive', method: 'GET', path: '/api/document-integrations/zoho/oauth/start', kind: 'oauth', enabled: true }] },
  { source_type: 'sync_agent', source_name: 'Sync Agent', status: 'available', documents_count: 0, actions: [{ key: 'configure', label: 'Configurar agente', method: 'POST', path: '/api/document-integrations/agents/pairing-codes', kind: 'api', enabled: true }] },
  { source_type: 'mounted_folder', source_name: 'Carpeta montada', status: 'available', documents_count: 0, actions: [{ key: 'configure', label: 'Configurar carpeta', kind: 'info', enabled: false, reason: 'Configuración pendiente: requiere registrar una ruta montada autorizada.' }] },
  { source_type: 'manual_upload', source_name: 'Carga manual', status: 'available', documents_count: 0, actions: [
    { key: 'upload_files', label: 'Subir archivos', kind: 'upload_files', enabled: true, path: '/api/evidence-library/manual-upload/files', method: 'POST' },
    { key: 'upload_zip', label: 'Subir ZIP', kind: 'upload_zip', enabled: true, path: '/api/evidence-library/manual-upload/zip', method: 'POST' },
  ] },
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return fallback;
}

function toApiError(error: unknown, fallback: string): ApiError {
  if (error instanceof Error) return error as ApiError;
  return new Error(getErrorMessage(error, fallback)) as ApiError;
}

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
    folder: 'Carpeta',
    unknown: 'Sin clasificar',
  };
  return labels[String(type || 'unknown')] || String(type || 'Sin clasificar');
}

function statusClass(value?: string | null) {
  const status = String(value || '').toLowerCase();
  if (status === 'configuration_required') {
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }
  if (['processed', 'indexed', 'evidence', 'active', 'aprobada'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['pending_review', 'pending', 'not_processed', 'pendiente'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (status === 'folder_required') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (status === 'excluded') {
    return 'border-slate-300 bg-slate-100 text-slate-700';
  }
  if (['failed', 'rejected', 'rechazada', 'error', 'zoho_oauth_unauthorized'].includes(status)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function sourceActionLabel(sourceType?: string | null, status?: string | null) {
  const source = String(sourceType || '').toLowerCase();
  const currentStatus = String(status || '').toLowerCase();
  if (source.includes('manual')) return 'Subir archivo';
  if (source.includes('sync')) return currentStatus === 'active' ? 'Validar' : 'Configurar';
  if (source.includes('mounted')) return currentStatus === 'active' ? 'Sincronizar' : 'Configurar';
  return currentStatus === 'active' ? 'Sincronizar' : 'Conectar';
}

function itemTypeLabel(itemType?: string | null) {
  if (itemType === 'folder') return 'Carpeta';
  if (itemType === 'source') return 'Fuente';
  if (itemType === 'file') return 'Archivo';
  return 'Documento';
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
    const error = new Error(json.error || json.message || 'Solicitud no procesada') as ApiError;
    error.code = json.code;
    error.status = res.status;
    error.details = json.details;
    throw error;
  }
  return json;
}

async function fetchMultipart(url: string, token: string, formData: FormData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || json.message || 'Carga no procesada') as ApiError;
    error.code = json.code;
    error.status = res.status;
    throw error;
  }
  return json;
}

function isUuidLike(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function isOperationRef(value?: string | null) {
  return /^(document_index|evidence):[0-9a-fA-F-]{36}$/.test(String(value || '').trim());
}

function getDocumentIndexId(item?: Partial<LibraryDocument> | null) {
  const candidates = [item?.source_id, item?.operation_ref, item?.library_item_id, item?.id];
  for (const raw of candidates) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const normalized = value.startsWith('document_index:') ? value.replace('document_index:', '') : value;
    if (isUuidLike(normalized)) return normalized;
  }
  const fallback = String(candidates.find(Boolean) || '').trim();
  return fallback.startsWith('document_index:') ? fallback.replace('document_index:', '') : fallback;
}

function resolveLibraryActionSource(doc: LibraryDocument | null) {
  if (!doc) return null;
  if (doc.source_type === 'document_index') {
    const documentIndexId = getDocumentIndexId(doc);
    if (isUuidLike(documentIndexId)) {
      return {
        operation_ref: `document_index:${documentIndexId}`,
        source_type: doc.source_type,
        source_id: documentIndexId,
      };
    }
    return null;
  }

  const rawSourceId = String(doc.source_id || '').trim();
  const operationRef = String(doc.operation_ref || '').trim();
  if (doc.source_type === 'evidence' && isUuidLike(rawSourceId)) {
    return {
      operation_ref: isOperationRef(operationRef) ? operationRef : `evidence:${rawSourceId}`,
      source_type: doc.source_type,
      source_id: rawSourceId,
    };
  }
  return null;
}

function traceLibraryAction(action: string, doc: LibraryDocument | null, source: ReturnType<typeof resolveLibraryActionSource>) {
  if (process.env.NODE_ENV === 'production') return;
  console.debug('Evidence library action contract', {
    action,
    operation_ref: source?.operation_ref || doc?.operation_ref || null,
    library_item_id: doc?.library_item_id || doc?.id || null,
    source_type: source?.source_type || doc?.source_type || null,
    source_id: source?.source_id || doc?.source_id || null,
    source_id_shape: doc?.source_id_shape || null,
    provider_file_id_shape: doc?.provider_file_id_shape || null,
    item_type: doc?.item_type || null,
    can_analyze: doc?.can_analyze,
    can_associate: doc?.can_associate,
    can_open: doc?.can_open,
  });
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
  const [sourcesError, setSourcesError] = useState<ApiError | null>(null);
  const [libraryError, setLibraryError] = useState<ApiError | null>(null);
  const [folderChildren, setFolderChildren] = useState<LibraryDocument[]>([]);
  const [folderChildrenFor, setFolderChildrenFor] = useState('');
  const [folderChildrenLoading, setFolderChildrenLoading] = useState(false);
  const [folderChildrenMessage, setFolderChildrenMessage] = useState('');
  const [folderNavigationStack, setFolderNavigationStack] = useState<FolderNavigationFrame[]>([]);
  const [folderContextMessage, setFolderContextMessage] = useState('');
  const [manualUploadMessage, setManualUploadMessage] = useState('');
  const [manualUploadOpen, setManualUploadOpen] = useState(false);
  const [manualUploadMode, setManualUploadMode] = useState<'files' | 'zip'>('files');
  const [manualUploadFiles, setManualUploadFiles] = useState<File[]>([]);
  const [manualUploadType, setManualUploadType] = useState('unknown');
  const [googleFolderSelectorOpen, setGoogleFolderSelectorOpen] = useState(false);
  const [googleFolderSource, setGoogleFolderSource] = useState<SourceCard | null>(null);
  const [googleFolders, setGoogleFolders] = useState<GoogleFolder[]>([]);
  const [googleFolderParentId, setGoogleFolderParentId] = useState('root');
  const [googleFolderTrail, setGoogleFolderTrail] = useState<Array<{ id: string; name: string }>>([{ id: 'root', name: 'Mi unidad' }]);
  const [googleFolderMessage, setGoogleFolderMessage] = useState('');
  const [googleFolderHadError, setGoogleFolderHadError] = useState(false);
  const [zohoUrlOpen, setZohoUrlOpen] = useState(false);
  const [zohoUrlSource, setZohoUrlSource] = useState<SourceCard | null>(null);
  const [zohoFolderUrl, setZohoFolderUrl] = useState('');
  const [zohoFolderName, setZohoFolderName] = useState('');
  const [zohoUrlMessage, setZohoUrlMessage] = useState('');
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
  const selectedIsExcluded = Boolean(selected?.is_excluded || String(selected?.status || '').toLowerCase() === 'excluded');
  const selectedCanAnalyze = Boolean(selected && !selectedIsExcluded && selected.can_analyze !== false && selected.item_type !== 'folder');
  const selectedCanAssociate = Boolean(selected && !selectedIsExcluded && selected.can_associate !== false && selected.item_type !== 'folder');
  const selectedCanOpen = Boolean(selected && !selectedIsExcluded && selected.can_open === true);
  const selectedCanExclude = Boolean(selected && canManage && !selectedIsExcluded && selected.source_type === 'document_index' && selected.can_exclude !== false);
  const selectedCanRestore = Boolean(selected && canManage && selectedIsExcluded && selected.source_type === 'document_index' && selected.can_restore !== false);
  const selectedProfile = asRecord(detail?.document?.profile);
  const visibleSources = sources.length ? sources : fallbackSources;
  const currentFolder = folderNavigationStack[folderNavigationStack.length - 1]?.folder || null;
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.origin ||
      filters.document_type ||
      filters.status ||
      filters.association ||
      filters.semantic_status ||
      filters.version !== 'active'
  );

  const clearFilters = () => {
    setFilters({
      search: '',
      origin: '',
      document_type: '',
      status: '',
      association: '',
      semantic_status: '',
      version: 'active',
    });
  };

  const restoreDocumentList = (rows: LibraryDocument[], preferred: LibraryDocument | null) => {
    setDocuments(rows);
    setSelected((preferred && rows.some((row) => row.id === preferred.id)) ? preferred : (rows[0] || null));
    setDetail(null);
    setTab('summary');
    setFolderChildren([]);
    setFolderChildrenFor('');
    setFolderChildrenMessage('');
    setFolderContextMessage('');
  };

  const goUpFolder = () => {
    if (folderNavigationStack.length === 0) return;
    const previousFrame = folderNavigationStack[folderNavigationStack.length - 1];
    setFolderNavigationStack((prev) => prev.slice(0, -1));
    restoreDocumentList(previousFrame.documents, previousFrame.selected);
  };

  const returnToLibraryRoot = () => {
    if (folderNavigationStack.length === 0) return;
    const rootFrame = folderNavigationStack[0];
    setFolderNavigationStack([]);
    restoreDocumentList(rootFrame.documents, rootFrame.selected);
  };

  const selectDocument = (doc: LibraryDocument) => {
    setSelected(doc);
    setTab('summary');
    setFolderChildren([]);
    setFolderChildrenFor('');
    setFolderChildrenMessage('');
  };

  const loadSources = useCallback(async () => {
    try {
      setSourcesError(null);
      const json = await fetchJson(`${API_URL}/api/evidence-library/sources`, token);
      setSources(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      setSourcesError(toApiError(error, 'No fue posible cargar fuentes.'));
      setSources([]);
    }
  }, [token]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      setLibraryError(null);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const json = await fetchJson(`${API_URL}/api/evidence-library/documents?${params.toString()}`, token);
      const rows = Array.isArray(json.data) ? json.data : [];
      setFolderNavigationStack([]);
      setFolderContextMessage('');
      setFolderChildren([]);
      setFolderChildrenFor('');
      setFolderChildrenMessage('');
      setDocuments(rows);
      setSelected((prev) => {
        if (prev && rows.some((row: LibraryDocument) => row.id === prev.id)) return prev;
        return rows[0] || null;
      });
    } catch (error) {
      setLibraryError(toApiError(error, 'No fue posible cargar documentos.'));
      setFolderNavigationStack([]);
      setFolderContextMessage('');
      setFolderChildren([]);
      setFolderChildrenFor('');
      setFolderChildrenMessage('');
      setDocuments([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  const loadDetail = useCallback(async (doc = selected) => {
    if (!doc) {
      setDetail(null);
      return;
    }
    const source = resolveLibraryActionSource(doc);
    traceLibraryAction('detail', doc, source);
    if (!source) {
      setDetail(null);
      return;
    }
    const json = await fetchJson(
      `${API_URL}/api/evidence-library/documents/${source.source_type}/${source.source_id}`,
      token
    );
    setDetail(json.data || null);
  }, [selected, token]);

  const openFolder = async (doc = selected) => {
    if (!doc || doc.item_type !== 'folder' || !doc.can_open) return;
    const source = resolveLibraryActionSource(doc);
    traceLibraryAction('open_folder', doc, source);
    const documentIndexId = getDocumentIndexId(doc);
    if (!source || source.source_type !== 'document_index' || !isUuidLike(documentIndexId)) {
      setFolderChildren([]);
      setFolderChildrenFor(doc.id);
      setFolderChildrenMessage('Identificador de carpeta inválido. Seleccione una carpeta indexada de la biblioteca.');
      return;
    }
    setFolderChildrenLoading(true);
    setFolderChildrenMessage('');
    try {
      const url = `${API_URL}/api/evidence-library/documents/document_index/${documentIndexId}/children?version=${encodeURIComponent(filters.version || 'active')}`;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('OPEN_FOLDER_REQUEST', {
          source_id: doc.source_id || null,
          provider_file_id: doc.provider_file_id || null,
          origin: doc.origin || doc.source_label || null,
          item_type: doc.item_type || null,
          url,
        });
      }
      const json = await fetchJson(url, token);
      const rows = Array.isArray(json.data) ? json.data : [];
      if (process.env.NODE_ENV !== 'production') {
        console.debug('OPEN_FOLDER_RESPONSE', {
          ok: Boolean(json.ok),
          total: typeof json.total === 'number' ? json.total : null,
          rows_len: rows.length,
        });
      }
      setFolderNavigationStack((prev) => [...prev, { folder: doc, documents, selected }]);
      setDocuments(rows);
      setSelected(rows[0] || null);
      setDetail(null);
      setTab('summary');
      setFolderChildren([]);
      setFolderChildrenFor('');
      setFolderChildrenMessage('');
      setFolderContextMessage(rows.length === 0 ? 'Esta carpeta no tiene documentos o subcarpetas visibles.' : '');
    } catch (error) {
      setFolderChildren([]);
      setFolderChildrenFor(doc.id);
      const apiError = toApiError(error, 'No fue posible abrir la carpeta.');
      const details = apiError.details || {};
      setFolderChildrenMessage(
        (typeof details.message === 'string' ? details.message : '') ||
          apiError.message ||
          'No fue posible abrir la carpeta.'
      );
    } finally {
      setFolderChildrenLoading(false);
    }
  };

  const loadTargets = useCallback(async () => {
    const params = new URLSearchParams();
    if (targetSearch.trim()) params.set('search', targetSearch.trim());
    const json = await fetchJson(`${API_URL}/api/evidence-library/targets/${targetType}?${params.toString()}`, token);
    setTargetOptions(Array.isArray(json.data) ? json.data : []);
  }, [targetSearch, targetType, token]);

  const folderProviderPath = (source: SourceCard) => source.source_type === 'zoho_drive' ? 'zoho' : 'google';
  const folderProviderLabel = (source: SourceCard) => source.source_type === 'zoho_drive' ? 'Zoho WorkDrive' : 'Google Drive';

  const loadGoogleFolders = async (source: SourceCard, parentId = 'root', trail = [{ id: 'root', name: 'Raíz' }]) => {
    if (!source.source_id) {
      setGoogleFolders([]);
      setGoogleFolderMessage(`${folderProviderLabel(source)} está conectado sin fuente operativa. Reconecte la cuenta.`);
      setGoogleFolderHadError(true);
      return;
    }
    setWorking('google-folders');
    setGoogleFolderMessage('');
    setGoogleFolderHadError(false);
    try {
      const params = new URLSearchParams({ source_id: source.source_id, parentId });
      const providerPath = folderProviderPath(source);
      const json = await fetchJson(`${API_URL}/api/document-integrations/${providerPath}/folders?${params.toString()}`, token);
      const rows = Array.isArray(json.data?.folders) ? json.data.folders : (Array.isArray(json.folders) ? json.folders : []);
      const breadcrumbs = Array.isArray(json.data?.breadcrumbs) ? json.data.breadcrumbs : null;
      const current = json.data?.current || json.current || null;
      const details = json.data?.details || json.details || null;
      setGoogleFolders(rows);
      setGoogleFolderParentId(current?.id || parentId);
      setGoogleFolderTrail(breadcrumbs || trail);
      if (rows.length === 0) {
        setGoogleFolderMessage(details?.message || 'Esta carpeta no contiene subcarpetas visibles.');
      }
    } catch (error) {
      setGoogleFolders([]);
      setGoogleFolderHadError(true);
      const apiError = toApiError(error, `No fue posible listar carpetas de ${folderProviderLabel(source)}.`);
      const details = apiError.details || {};
      const hint = typeof details.hint === 'string' ? ` ${details.hint}` : '';
      const provider = typeof details.provider_status === 'string' ? ` Estado proveedor: ${details.provider_status}.` : '';
      const providerCode = typeof details.provider_code === 'string' ? ` Código: ${details.provider_code}.` : '';
      const providerMessage = typeof details.provider_message === 'string' ? ` Mensaje proveedor: ${details.provider_message}.` : '';
      const stage = typeof details.stage === 'string' ? ` Etapa: ${details.stage}.` : '';
      setGoogleFolderMessage(`${apiError.message || `No fue posible listar carpetas de ${folderProviderLabel(source)}.`}${stage}${provider}${providerCode}${providerMessage}${hint}`);
    } finally {
      setWorking('');
    }
  };

  const openGoogleFolderSelector = async (source: SourceCard) => {
    setGoogleFolderSource(source);
    setGoogleFolderSelectorOpen(true);
    await loadGoogleFolders(source, 'root', [{ id: 'root', name: source.source_type === 'zoho_drive' ? 'Zoho WorkDrive' : 'Mi unidad' }]);
  };

  const enterGoogleFolder = async (folder: GoogleFolder) => {
    if (!googleFolderSource) return;
    await loadGoogleFolders(
      googleFolderSource,
      folder.id,
      [...googleFolderTrail, { id: folder.id, name: folder.name }]
    );
  };

  const selectGoogleFolder = async (folder: GoogleFolder) => {
    if (!googleFolderSource?.source_id) return;
    setWorking(`google-select-${folder.id}`);
    try {
      const providerPath = folderProviderPath(googleFolderSource);
      await fetchJson(`${API_URL}/api/document-integrations/${providerPath}/select-folder`, token, {
        method: 'POST',
        body: JSON.stringify({
          source_id: googleFolderSource.source_id,
          folder_id: folder.id,
          folder_name: folder.name,
          folder_path: folder.display_path || folder.path || folder.name,
        }),
      });
      setGoogleFolderSelectorOpen(false);
      setGoogleFolderMessage('');
      await loadSources();
    } catch (error) {
      setGoogleFolderMessage(getErrorMessage(error, 'No fue posible seleccionar la carpeta.'));
    } finally {
      setWorking('');
    }
  };

  const openZohoUrlSelector = (source: SourceCard) => {
    setZohoUrlSource(source);
    setZohoFolderUrl('');
    setZohoFolderName('');
    setZohoUrlMessage('');
    setZohoUrlOpen(true);
  };

  const submitZohoFolderUrl = async () => {
    if (!zohoUrlSource?.source_id || !zohoFolderUrl.trim()) {
      setZohoUrlMessage('Pegue una URL de carpeta Zoho WorkDrive.');
      return;
    }
    setWorking('zoho-folder-url');
    setZohoUrlMessage('');
    try {
      const json = await fetchJson(`${API_URL}/api/document-integrations/zoho/select-folder-url`, token, {
        method: 'POST',
        body: JSON.stringify({
          source_id: zohoUrlSource.source_id,
          folder_url: zohoFolderUrl.trim(),
          folder_name: zohoFolderName.trim() || undefined,
        }),
      });
      const validation = json.validation || {};
      setZohoUrlMessage(
        `Carpeta seleccionada. Archivos visibles: ${validation.files_count || 0}. Carpetas visibles: ${validation.folders_count || 0}.`
      );
      setZohoUrlOpen(false);
      await loadSources();
      await loadDocuments();
    } catch (error) {
      const apiError = toApiError(error, 'No fue posible seleccionar la carpeta desde la URL.');
      const details = apiError.details || {};
      const provider = typeof details.provider_status === 'string' ? ` Estado proveedor: ${details.provider_status}.` : '';
      const providerCode = typeof details.provider_code === 'string' ? ` Código: ${details.provider_code}.` : '';
      const stage = typeof details.stage === 'string' ? ` Etapa: ${details.stage}.` : '';
      const hint = typeof details.hint === 'string' ? ` ${details.hint}` : '';
      setZohoUrlMessage(`${apiError.message || 'No fue posible seleccionar la carpeta desde la URL.'}${stage}${provider}${providerCode}${hint}`);
    } finally {
      setWorking('');
    }
  };

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    loadDetail().catch((error) => console.error('ERROR LOAD EVIDENCE DETAIL:', error));
  }, [loadDetail, selectedSourceId, selectedSourceType]);

  useEffect(() => {
    if (!canManage) return;
    loadTargets().catch((error) => console.error('ERROR LOAD TARGETS:', error));
  }, [canManage, loadTargets]);

  const associationTotal = (doc: LibraryDocument) =>
    Object.values(doc.association_counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  const semanticSummary = useMemo(() => {
    const processed = documents.filter((doc) => doc.semantic_status === 'processed').length;
    const pending = documents.filter((doc) => doc.semantic_status !== 'processed').length;
    return { processed, pending };
  }, [documents]);

  const analyzeSelected = async () => {
    if (!selected || !canManage) return;
    const source = resolveLibraryActionSource(selected);
    traceLibraryAction('analyze', selected, source);
    if (!selectedCanAnalyze) {
      alert('Seleccione un archivo/documento, no una carpeta.');
      return;
    }
    if (!source) {
      alert('El elemento seleccionado no tiene un identificador operativo válido. Actualice la biblioteca o sincronice la fuente.');
      return;
    }
    setWorking('analyze');
    try {
      await fetchJson(`${API_URL}/api/evidence-library/semantic/analyze`, token, {
        method: 'POST',
        body: JSON.stringify({
          operation_ref: source.operation_ref,
          source_type: source.source_type,
          source_id: source.source_id,
        }),
      });
      await loadDocuments();
      await loadDetail(selected);
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible analizar el documento.'));
    } finally {
      setWorking('');
    }
  };

  const saveAssociation = async () => {
    if (!selected || !associationForm.target_id || !canManage) return;
    const source = resolveLibraryActionSource(selected);
    traceLibraryAction('associate', selected, source);
    if (!selectedCanAssociate) {
      alert('Las carpetas no se pueden asociar como evidencia. Abra la carpeta y seleccione un archivo.');
      return;
    }
    if (!source) {
      alert('El elemento seleccionado no tiene un identificador operativo válido. Actualice la biblioteca o sincronice la fuente.');
      return;
    }
    setWorking('associate');
    try {
      await fetchJson(`${API_URL}/api/evidence-library/associations`, token, {
        method: 'POST',
        body: JSON.stringify({
          operation_ref: source.operation_ref,
          source_type: source.source_type,
          source_id: source.source_id,
          target_type: targetType,
          target_id: associationForm.target_id,
          evidence_usage: associationForm.evidence_usage,
          notes: associationForm.notes,
        }),
      });
      setAssociationForm((prev) => ({ ...prev, target_id: '', notes: '' }));
      await loadDocuments();
      await loadDetail(selected);
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible guardar la asociacion.'));
    } finally {
      setWorking('');
    }
  };

  const excludeSelected = async (scope: 'item' | 'subtree') => {
    if (!selected || !selectedCanExclude) return;
    const source = resolveLibraryActionSource(selected);
    if (!source || source.source_type !== 'document_index') {
      alert('Seleccione un elemento indexado válido de la biblioteca.');
      return;
    }
    const isFolder = selected.item_type === 'folder';
    const message = isFolder
      ? (scope === 'subtree'
        ? 'Esta carpeta y su contenido indexado dejarán de mostrarse en la biblioteca documental. No se eliminarán archivos del proveedor ni asociaciones históricas.'
        : 'Esta carpeta dejará de mostrarse en la biblioteca documental. No se eliminará del proveedor.')
      : 'Este archivo dejará de mostrarse en la biblioteca documental. No se eliminará del proveedor ni se borrarán asociaciones históricas.';
    if (!window.confirm(message)) return;

    setWorking(`exclude-${scope}`);
    setManualUploadMessage('');
    try {
      const json = await fetchJson(`${API_URL}/api/evidence-library/index/exclusions`, token, {
        method: 'POST',
        body: JSON.stringify({
          source_type: source.source_type,
          source_id: source.source_id,
          scope,
          reason: 'not_useful',
          notes: '',
        }),
      });
      const excluded = json.excluded || {};
      const warnings = Array.isArray(excluded.warnings) && excluded.warnings.length
        ? ` Advertencias: ${excluded.warnings.join(' ')}`
        : '';
      setManualUploadMessage(`Elemento excluido del índice. Afectados: ${excluded.affected_count || 1}.${warnings}`);
      await loadDocuments();
      await loadSources();
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible excluir el elemento del índice.'));
    } finally {
      setWorking('');
    }
  };

  const restoreSelected = async (restoreScope: 'item' | 'subtree' = 'item') => {
    if (!selected || !selectedCanRestore) return;
    const source = resolveLibraryActionSource(selected);
    if (!source || source.source_type !== 'document_index') {
      alert('Seleccione un elemento indexado válido de la biblioteca.');
      return;
    }
    if (!window.confirm('Este elemento volverá a mostrarse en la biblioteca documental.')) return;

    setWorking(`restore-${restoreScope}`);
    setManualUploadMessage('');
    try {
      const json = await fetchJson(`${API_URL}/api/evidence-library/index/restore`, token, {
        method: 'POST',
        body: JSON.stringify({
          source_type: source.source_type,
          source_id: source.source_id,
          restore_scope: restoreScope,
        }),
      });
      const warnings = Array.isArray(json.warnings) && json.warnings.length
        ? ` Advertencias: ${json.warnings.join(' ')}`
        : '';
      setManualUploadMessage(`Elemento restaurado al índice. Restaurados: ${json.restored_count || 0}.${warnings}`);
      await loadDocuments();
      await loadSources();
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible restaurar el elemento al índice.'));
    } finally {
      setWorking('');
    }
  };

  const runSourceAction = async (source: SourceCard, actionItem?: SourceAction) => {
    const resolvedAction = actionItem || source.actions?.[0] || {
      key: 'fallback',
      label: sourceActionLabel(source.source_type, source.status),
      enabled: false,
      kind: 'info' as const,
      reason: 'Conector no implementado para esta fuente.',
    };

    if (!canManage) {
      alert('El rol actual no puede modificar fuentes documentales.');
      return;
    }
    if (source.source_type === 'manual_upload' && ['upload_files', 'upload_zip'].includes(resolvedAction.kind || resolvedAction.key)) {
      setManualUploadMode((resolvedAction.kind || resolvedAction.key) === 'upload_zip' ? 'zip' : 'files');
      setManualUploadFiles([]);
      setManualUploadMessage('');
      setManualUploadOpen(true);
      return;
    }
    if (resolvedAction.kind === 'google_folder_selector' || resolvedAction.kind === 'zoho_folder_selector') {
      await openGoogleFolderSelector(source);
      return;
    }
    if (resolvedAction.kind === 'zoho_folder_url') {
      openZohoUrlSelector(source);
      return;
    }
    if (resolvedAction.kind === 'disconnect_provider') {
      const providerLabel = source.source_type === 'zoho_drive' ? 'Zoho WorkDrive' : 'Google Drive';
      const confirmed = window.confirm(
        `¿Deseas desconectar ${providerLabel}?\nNo se eliminarán documentos ya indexados ni asociaciones existentes, pero se detendrá la sincronización y se eliminarán credenciales locales.`
      );
      if (!confirmed) return;
      setWorking(`source-${source.source_type}-${resolvedAction.key}`);
      setManualUploadMessage('');
      try {
        const json = await fetchJson(`${API_URL}${resolvedAction.path}`, token, {
          method: resolvedAction.method || 'POST',
          body: JSON.stringify({ ...(resolvedAction.body || {}), reason: 'user_requested' }),
        });
        const warning = json.revocation?.warning ? ` ${json.revocation.warning}` : '';
        setManualUploadMessage(`${json.message || `${providerLabel} desconectado.`}${warning}`);
        await loadSources();
        await loadDocuments();
      } catch (error) {
        setManualUploadMessage(getErrorMessage(error, `No fue posible desconectar ${providerLabel}.`));
      } finally {
        setWorking('');
      }
      return;
    }
    if (resolvedAction.enabled === false || !resolvedAction.path) {
      alert(resolvedAction.reason || 'Configuración pendiente.');
      return;
    }
    if (resolvedAction.kind === 'link') {
      window.location.href = resolvedAction.path;
      return;
    }
    setWorking(`source-${source.source_type}-${resolvedAction.key}`);
    try {
      const json = await fetchJson(`${API_URL}${resolvedAction.path}`, token, {
        method: resolvedAction.method || 'GET',
        body: ['POST', 'PUT', 'PATCH'].includes(String(resolvedAction.method || 'GET').toUpperCase())
          ? JSON.stringify(resolvedAction.body || {})
          : undefined,
      });
      const authUrl = json.auth_url || json.url || json.data?.auth_url;
      if (resolvedAction.kind === 'oauth' && authUrl) {
        window.location.href = authUrl;
        return;
      }
      await loadSources();
      await loadDocuments();
      const summary = json.files_seen !== undefined
        ? `Sincronización completada. Archivos vistos: ${json.files_seen || 0}. Indexados: ${json.files_indexed || 0}. Carpetas: ${json.folders_seen || 0}. Errores: ${json.files_errors || 0}.`
        : null;
      alert(json.message || summary || 'Acción de fuente ejecutada.');
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible ejecutar la acción de fuente.'));
    } finally {
      setWorking('');
    }
  };

  const submitManualUpload = async () => {
    if (!canManage) return;
    if (!manualUploadFiles.length) {
      setManualUploadMessage('Seleccione archivo(s) para cargar.');
      return;
    }
    if (manualUploadMode === 'zip' && manualUploadFiles.length !== 1) {
      setManualUploadMessage('Seleccione un único archivo ZIP.');
      return;
    }

    const formData = new FormData();
    formData.append('document_type', manualUploadType || 'unknown');
    if (manualUploadMode === 'zip') {
      formData.append('zip', manualUploadFiles[0]);
    } else {
      manualUploadFiles.forEach((file) => formData.append('files', file));
    }

    setWorking(`manual-upload-${manualUploadMode}`);
    try {
      const endpoint = manualUploadMode === 'zip'
        ? '/api/evidence-library/manual-upload/zip'
        : '/api/evidence-library/manual-upload/files';
      const json = await fetchMultipart(`${API_URL}${endpoint}`, token, formData);
      const summary = json.data?.summary || {};
      const errors = Array.isArray(summary.errors) && summary.errors.length
        ? ` Omitidos: ${summary.errors.map((item: UnknownRecord) => `${String(item.filename || '')}: ${String(item.reason || '')}`).join('; ')}`
        : '';
      setManualUploadMessage(`${summary.indexed || 0} archivos indexados. ${summary.folders_indexed || 0} carpetas indexadas. ${summary.skipped || 0} omitidos.${errors}`);
      setManualUploadFiles([]);
      setManualUploadOpen(false);
      await loadSources();
      await loadDocuments();
    } catch (error) {
      setManualUploadMessage(getErrorMessage(error, 'No fue posible cargar documentos.'));
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
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible actualizar la asociacion.'));
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
    } catch (error) {
      alert(getErrorMessage(error, 'No fue posible revisar la sugerencia.'));
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
          <button
            onClick={() => setManualUploadMessage('Nueva fuente: usa las acciones de cada tarjeta disponible. Los conectores sin ruta configurada se muestran como configuración pendiente.')}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Nueva fuente
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {visibleSources.map((source) => (
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
              {(source.provider_account_email || source.account_email) && (
                <div className="mt-2 truncate text-xs text-slate-500">Cuenta: {source.provider_account_email || source.account_email}</div>
              )}
              {source.root_folder_name && (
                <div className="mt-1 truncate text-xs text-slate-500">Carpeta: {source.root_folder_name}</div>
              )}
              {source.source_type === 'google_drive' && source.status === 'folder_required' && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Google Drive conectado. Seleccione una carpeta para sincronizar.
                </div>
              )}
              {source.source_type === 'zoho_drive' && source.status === 'folder_required' && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Zoho WorkDrive conectado. Seleccione una carpeta para sincronizar.
                </div>
              )}
              {source.source_type === 'zoho_drive' && source.status === 'zoho_oauth_unauthorized' && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                  Zoho conectado, pero sin permisos WorkDrive suficientes. Reconecte aceptando los permisos requeridos.
                  {source.last_sync_error ? ` ${source.last_sync_error}` : ''}
                </div>
              )}
              {source.source_type === 'zoho_drive' && source.status === 'configuration_required' && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                  Zoho WorkDrive no está configurado por la plataforma.
                </div>
              )}
              {source.last_sync_error && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                  {source.last_sync_error}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2">
                {(source.actions?.length ? source.actions : [{ key: 'fallback', label: sourceActionLabel(source.source_type, source.status), enabled: false, kind: 'info' as const, reason: 'Conector no implementado.' }]).map((sourceAction) => (
                  <button
                    key={sourceAction.key}
                    onClick={() => runSourceAction(source, sourceAction)}
                    disabled={!canManage || sourceAction.enabled === false || working === `source-${source.source_type}-${sourceAction.key}`}
                    title={sourceAction.enabled === false ? sourceAction.reason || 'Configuración pendiente' : sourceAction.label}
                    className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                      sourceAction.kind === 'disconnect_provider'
                        ? 'border-red-200 bg-white text-red-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {working === `source-${source.source_type}-${sourceAction.key}` ? 'Ejecutando...' : sourceAction.label}
                  </button>
                ))}
                {source.actions?.some((sourceAction) => sourceAction.enabled === false && sourceAction.reason) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    {source.actions.find((sourceAction) => sourceAction.enabled === false && sourceAction.reason)?.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {sourcesError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            No fue posible cargar fuentes documentales. {sourcesError.code === 'RBAC_DENIED' ? 'El rol actual no tiene permiso para esta biblioteca.' : sourcesError.message}
          </div>
        )}
        {manualUploadMessage && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div className="font-semibold">Acción de fuente</div>
            <div className="mt-1">{manualUploadMessage}</div>
          </div>
        )}
        {manualUploadOpen && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">
                  {manualUploadMode === 'zip' ? 'Subir ZIP a biblioteca documental' : 'Subir archivos a biblioteca documental'}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Los archivos se indexan para este tenant y luego pueden asociarse desde el panel de detalle.
                </div>
              </div>
              <button
                onClick={() => setManualUploadOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input
                type="file"
                multiple={manualUploadMode === 'files'}
                accept={manualUploadMode === 'zip' ? '.zip,application/zip,application/x-zip-compressed' : '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.png,.jpg,.jpeg'}
                onChange={(event) => setManualUploadFiles(Array.from(event.target.files || []))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <select
                value={manualUploadType}
                onChange={(event) => setManualUploadType(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="unknown">Tipo desconocido</option>
                <option value="policy">Política</option>
                <option value="procedure">Procedimiento</option>
                <option value="record">Registro</option>
                <option value="form">Formulario</option>
                <option value="report">Reporte</option>
                <option value="certificate">Certificado</option>
                <option value="audit_evidence">Evidencia auditoría</option>
                <option value="risk_document">Documento de riesgo</option>
                <option value="control_evidence">Evidencia de control</option>
              </select>
              <button
                onClick={submitManualUpload}
                disabled={!manualUploadFiles.length || working === `manual-upload-${manualUploadMode}`}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === `manual-upload-${manualUploadMode}` ? 'Subiendo...' : 'Subir e indexar'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {manualUploadMode === 'zip'
                ? 'El ZIP se extrae con controles anti traversal; se preservan rutas relativas permitidas.'
                : 'No se crea asociación automática. Seleccione el documento cargado y use Asociaciones.'}
            </div>
          </div>
        )}
        {googleFolderSelectorOpen && googleFolderSource && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Seleccionar carpeta raíz de {folderProviderLabel(googleFolderSource)}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Cuenta: {googleFolderSource.provider_account_email || googleFolderSource.account_email || `${folderProviderLabel(googleFolderSource)} conectado`}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-500">
                  {googleFolderTrail.map((item, index) => (
                    <button
                      key={`${item.id}-${index}`}
                      onClick={() => loadGoogleFolders(googleFolderSource, item.id, googleFolderTrail.slice(0, index + 1))}
                      className="rounded-full border border-emerald-200 bg-white px-2 py-1 font-semibold text-emerald-700"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setGoogleFolderSelectorOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cerrar
              </button>
            </div>
            {googleFolderMessage && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {googleFolderMessage}
              </div>
            )}
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-emerald-100 bg-white">
              {working === 'google-folders' ? (
                <div className="px-3 py-4 text-sm text-slate-500">Cargando carpetas...</div>
              ) : googleFolders.length === 0 && !googleFolderHadError ? (
                <div className="px-3 py-4 text-sm text-slate-500">No hay subcarpetas visibles en esta ubicación.</div>
              ) : googleFolders.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">No se cargaron carpetas por el error anterior.</div>
              ) : (
                googleFolders.map((folder) => (
                  <div key={folder.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{folder.name}</div>
                      <div className="text-xs text-slate-500">
                        {folder.type === 'private_space' ? 'Mis carpetas'
                          : folder.type === 'team_folder_root' ? 'Contenedor de carpetas del equipo'
                            : `Carpeta ${folderProviderLabel(googleFolderSource)}`}
                        {typeof folder.children_count === 'number' ? ` · ${folder.children_count} visibles` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => enterGoogleFolder(folder)}
                        disabled={folder.can_open === false}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Entrar
                      </button>
                      <button
                        onClick={() => selectGoogleFolder(folder)}
                        disabled={working === `google-select-${folder.id}` || folder.can_select === false}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {working === `google-select-${folder.id}` ? 'Guardando...' : folder.can_select === false ? 'No seleccionable' : 'Usar esta carpeta'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Carpeta actual: {googleFolderTrail[googleFolderTrail.length - 1]?.name || googleFolderParentId}
            </div>
          </div>
        )}
        {zohoUrlOpen && zohoUrlSource && (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">Pegar URL de carpeta Zoho WorkDrive</div>
                <div className="mt-1 text-sm text-slate-600">
                  Copie la URL desde una carpeta real de Zoho WorkDrive. No use la raíz general.
                </div>
              </div>
              <button
                onClick={() => setZohoUrlOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input
                value={zohoFolderUrl}
                onChange={(event) => setZohoFolderUrl(event.target.value)}
                placeholder="https://workplace.zoho.com/#workdrive_app/.../privatespace/folders/..."
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={zohoFolderName}
                onChange={(event) => setZohoFolderName(event.target.value)}
                placeholder="Nombre opcional"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={submitZohoFolderUrl}
                disabled={!zohoFolderUrl.trim() || working === 'zoho-folder-url'}
                className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working === 'zoho-folder-url' ? 'Validando...' : 'Usar URL'}
              </button>
            </div>
            {zohoUrlMessage && (
              <div className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700">
                {zohoUrlMessage}
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">
              Formatos aceptados: workdrive.zoho.com/folder/&lt;id&gt; o workplace.zoho.com/#workdrive_app/&lt;workspace&gt;/privatespace/folders/&lt;id&gt;.
            </div>
          </div>
        )}
      </section>

      <div className="mb-5 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-8">
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
            <option value="">Estado documental: todos</option>
            <option value="indexed">Indexado</option>
            <option value="updated">Actualizado</option>
            <option value="excluded">Excluido</option>
            <option value="analyzed">Analizado</option>
            <option value="aprobada">Evidencia</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <select value={filters.version} onChange={(event) => setFilters((prev) => ({ ...prev, version: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="active">Estado: Activos</option>
            <option value="excluded">Estado: Excluidos</option>
            <option value="all">Estado: Todos</option>
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
            <button onClick={clearFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">
              Limpiar
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span>Por defecto se muestran solo documentos activos/indexados. Los excluidos se revisan con el filtro Estado.</span>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-h-0 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Biblioteca documental</h2>
                <p className="text-xs text-slate-500">
                  {currentFolder
                    ? `Carpeta actual: ${currentFolder.filename || currentFolder.title} · ${documents.length} elementos`
                    : 'Vista unica de documentos indexados y evidencias cargadas.'}
                </p>
              </div>
              {currentFolder && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={goUpFolder}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Subir nivel
                  </button>
                  <button
                    onClick={returnToLibraryRoot}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                  >
                    Volver a Biblioteca Documental
                  </button>
                </div>
              )}
            </div>
            {folderContextMessage && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {folderContextMessage}
              </div>
            )}
          </div>
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 shadow-sm">
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
                ) : libraryError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8">
                      <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
                        <div className="font-bold">
                          {libraryError.code === 'RBAC_DENIED' ? 'Sin permiso para consultar la biblioteca documental' : 'No fue posible cargar la biblioteca documental'}
                        </div>
                        <div className="mt-1">{libraryError.message}</div>
                      </div>
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {currentFolder ? (
                        <div>
                          <div className="font-semibold text-slate-700">Esta carpeta no tiene documentos o subcarpetas visibles.</div>
                          <button onClick={goUpFolder} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                            Subir nivel
                          </button>
                        </div>
                      ) : hasActiveFilters ? (
                        <div>
                          <div className="font-semibold text-slate-700">No hay documentos que coincidan con los filtros actuales.</div>
                          <button onClick={clearFilters} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                            Limpiar filtros
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-700">No hay documentos indexados visibles todavía.</div>
                          <div className="mt-1 text-sm">Conecta o sincroniza una fuente documental, o sube un archivo manualmente.</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => selectDocument(doc)}
                      className={`cursor-pointer hover:bg-blue-50 ${selected?.id === doc.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-200' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{doc.filename || doc.title}</div>
                        <div className="text-xs text-slate-500">
                          {itemTypeLabel(doc.item_type)} · {doc.active_version || 'v1'} {doc.is_active_version !== false ? '(Activa)' : '(Version anterior)'}
                          {doc.item_type === 'folder' ? (
                            <>
                              {' · '}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openFolder(doc);
                                }}
                                disabled={folderChildrenLoading}
                                className="font-semibold text-amber-700 underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                Abrir para ver contenido
                              </button>
                            </>
                          ) : null}
                          {doc.is_excluded ? ' · Excluido' : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{typeLabel(doc.document_type)}</span></td>
                      <td className="px-3 py-3">{sourceBadge(doc.origin || doc.source_label)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(doc.status)}`}>{doc.status || 'indexed'}</span>
                          {doc.is_excluded && <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Excluido</span>}
                        </div>
                      </td>
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

        <aside className="max-h-[76vh] overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm xl:sticky xl:top-4">
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
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={!selected || !canManage || !selectedCanAnalyze}
                    title={!selectedCanAnalyze ? (selectedIsExcluded ? 'Restaurar al índice antes de analizar.' : 'Seleccione un archivo/documento, no una carpeta.') : 'Actualizar análisis documental'}
                    onClick={analyzeSelected}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working === 'analyze' ? 'Analizando...' : 'Actualizar análisis documental'}
                  </button>
                  <button
                    disabled={!selected || !selectedCanAssociate}
                    title={!selectedCanAssociate ? (selectedIsExcluded ? 'Restaurar al índice antes de asociar.' : 'Las carpetas no se pueden asociar como evidencia.') : 'Asociar documento'}
                    onClick={() => setTab('associations')}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Asociar a...
                  </button>
                  {selectedCanExclude && selected?.item_type !== 'folder' && (
                    <button
                      disabled={working === 'exclude-item'}
                      onClick={() => excludeSelected('item')}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Excluir del índice
                    </button>
                  )}
                  {selectedCanExclude && selected?.item_type === 'folder' && (
                    <>
                      <button
                        disabled={working === 'exclude-item'}
                        onClick={() => excludeSelected('item')}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Excluir carpeta
                      </button>
                      <button
                        disabled={working === 'exclude-subtree'}
                        onClick={() => excludeSelected('subtree')}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Excluir carpeta y contenido
                      </button>
                    </>
                  )}
                  {selectedCanRestore && (
                    <button
                      disabled={working === 'restore-item'}
                      onClick={() => restoreSelected('item')}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restaurar al índice
                    </button>
                  )}
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

              <div className="max-h-[calc(76vh-132px)] overflow-y-auto p-4">
                {tab === 'summary' && (
                  <div className="space-y-3 text-sm">
                    <Info label="Tipo de elemento" value={itemTypeLabel(selected.item_type)} />
                    {selectedIsExcluded && <Info label="Estado del índice" value="Excluido" />}
                    <Info label="Tipo sugerido" value={typeLabel(String(selectedProfile.document_type || selected.document_type || ''))} />
                    <Info label="Estado semantico" value={String(selectedProfile.semantic_status || selected.semantic_status || 'not_processed')} />
                    <Info label="Score de utilidad" value={selectedProfile.usefulness_score ? `${selectedProfile.usefulness_score}%` : selected.usefulness_score ? `${selected.usefulness_score}%` : '-'} />
                    <Info label="Ultima indexacion" value={formatDate(selected.last_indexed_at)} />
                    {selectedCanOpen && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <div className="font-bold">Carpeta indexada</div>
                        <div className="mt-1">Las carpetas no se pueden analizar ni asociar como evidencia. Abra la carpeta y seleccione un archivo.</div>
                        <button
                          onClick={() => openFolder(selected)}
                          disabled={folderChildrenLoading}
                          className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {folderChildrenLoading ? 'Abriendo...' : 'Abrir carpeta / Ver contenido'}
                        </button>
                        {folderChildrenFor === selected.id && (
                          <div className="mt-3 space-y-2">
                            {folderChildren.length === 0 ? (
                              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800">
                                {folderChildrenMessage || 'Esta carpeta no tiene contenido indexado. Sincronice la fuente o carpeta.'}
                              </div>
                            ) : (
                              folderChildren.map((child) => (
                                <button
                                  key={child.id}
                                  onClick={() => selectDocument(child)}
                                  className="block w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-left text-xs text-slate-700 hover:bg-amber-100"
                                >
                                  <span className="font-semibold">{child.filename || child.title}</span>
                                  <span className="ml-2 text-slate-500">{itemTypeLabel(child.item_type)}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
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

                    {canManage && !selectedCanAssociate && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {selectedIsExcluded
                          ? 'Este elemento está excluido del índice. Restáurelo antes de asociarlo como evidencia.'
                          : 'Las carpetas no se pueden asociar como evidencia. Abra la carpeta y seleccione un archivo.'}
                      </div>
                    )}

                    {canManage && selectedCanAssociate && (
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
          <button disabled={!selected || !canManage || !selectedCanAnalyze} title={!selectedCanAnalyze ? (selectedIsExcluded ? 'Restaurar al índice antes de analizar.' : 'Seleccione un archivo/documento, no una carpeta.') : 'Actualizar análisis documental'} onClick={analyzeSelected} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Actualizar analisis documental</button>
          {selectedCanOpen && (
            <button disabled={!selected} onClick={() => openFolder(selected)} className="rounded-xl border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50">Abrir carpeta</button>
          )}
          <button disabled={!selected || !selectedCanAssociate} title={!selectedCanAssociate ? (selectedIsExcluded ? 'Restaurar al índice antes de asociar.' : 'Las carpetas no se pueden asociar como evidencia.') : 'Asociar documento'} onClick={() => setTab('associations')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">Asociar a...</button>
        </div>
        {selected?.disabled_reason && (
          <div className="mt-2 text-xs text-amber-700">{selected.disabled_reason}</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-800">{value || '-'}</div>
    </div>
  );
}
