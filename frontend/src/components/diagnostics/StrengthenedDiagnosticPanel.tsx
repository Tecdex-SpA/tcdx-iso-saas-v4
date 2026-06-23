'use client';

import { useMemo, useState } from 'react';
import { getApiBaseUrl, readJsonResponse } from '@/utils/apiClient';
import { getStoredValidToken, getUserFromToken, normalizeRole } from '@/utils/auth';

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  count?: number;
  warnings?: DiagnosticWarning[];
};

type Standard = {
  id?: string;
  standard_id?: string;
  standard_code?: string;
  display_name?: string;
  version_code?: string | null;
  diagnostic_available?: boolean;
};

type ProcessSummary = {
  process?: {
    id?: string | null;
    name?: string | null;
    operation_id?: string | null;
    operation_name?: string | null;
    area?: string | null;
    criticality?: string | null;
  };
  summary?: Record<string, unknown>;
};

type EvidenceRecommendation = {
  name?: string;
  purpose?: string;
  recommended_formats?: string[];
  recommended_format?: string[];
  minimum_fields?: string[];
  frequency?: string;
  owner_role?: string;
  how_to_present?: string;
  iso_use?: string[];
  evidence_strength?: string;
  maturity_level?: string;
};

type EvidenceItem = {
  name?: string;
  file_name?: string;
  description?: string;
  status?: string | null;
  source_type?: string;
  source_id?: string;
  confidence?: string;
  reason?: string;
};

type DiagnosticControl = {
  tenant_control_id?: string;
  catalog_control_id?: string;
  standard_code?: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  status?: string;
  priority?: string | null;
  process?: {
    id?: string | null;
    name?: string | null;
    area?: string | null;
    criticality?: string | null;
  };
  operation?: {
    id?: string | null;
    name?: string | null;
  };
  evidence?: {
    active_count?: number;
    candidate_count?: number;
    existing?: EvidenceItem[];
    candidates?: EvidenceItem[];
    recommended?: EvidenceRecommendation[];
  };
  gaps?: {
    open_count?: number;
    existing_count?: number;
    suggested_count?: number;
  };
  actions?: {
    open_count?: number;
    existing_count?: number;
    suggested_count?: number;
  };
  confidence?: string;
  traceability?: {
    source?: string;
    fragment?: string;
    documents?: EvidenceItem[];
  };
  human_review_required?: boolean;
};

type DiagnosticDetail = {
  standard?: {
    id?: string;
    standard_id?: string;
    standard_code?: string;
  };
  summary?: Record<string, number | string>;
  controls?: DiagnosticControl[];
  metadata?: {
    governance_notice?: string;
  };
};

type DiagnosticWarning = {
  code?: string;
  message?: string;
};

type AiItem = {
  control_id?: string;
  catalog_control_id?: string;
  control_code?: string;
  control_name?: string;
  process_id?: string | null;
  process_name?: string | null;
  operation_id?: string | null;
  operation_name?: string | null;
  deterministic_status?: string;
  ai_assessment?: {
    summary?: string;
    gap_statement?: string;
    audit_relevance?: string;
    confidence?: string;
    confidence_reason?: string;
  };
  recommended_evidence?: EvidenceRecommendation[];
  suggested_actions?: Array<{
    title?: string;
    description?: string;
    priority?: string;
    suggested_owner?: string;
    suggested_due_days?: number;
    human_review_required?: boolean;
  }>;
  sources?: Array<{
    source_type?: string;
    source_id?: string | null;
    document_title?: string | null;
    chunk_id?: string | null;
    snippet?: string;
    reason?: string;
  }>;
  human_review_required?: boolean;
};

type AiResponse = {
  standard_id?: string;
  standard_code?: string;
  process_id?: string | null;
  operation_id?: string | null;
  generated_at?: string;
  mode?: string;
  items?: AiItem[];
  warnings?: DiagnosticWarning[];
  metadata?: {
    ai_engine_used?: boolean;
    human_review_required?: boolean;
    persistence?: string;
  };
};

type RecommendationResponse = {
  control?: DiagnosticControl;
  recommendation?: {
    recommended_evidence?: EvidenceRecommendation[];
  };
};

const API_URL = getApiBaseUrl();

const GAP_ACCEPT_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'auditor',
]);

const ACTION_ACCEPT_ROLES = new Set([
  'admin',
  'tenant_admin',
  'admin_cumplimiento',
  'compliance_admin',
  'operativo',
  'responsable_area',
  'area_owner',
]);

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function standardId(standard?: Standard | null) {
  return standard?.standard_id || standard?.id || standard?.standard_code || '';
}

function controlId(control?: DiagnosticControl | null) {
  return control?.tenant_control_id || control?.catalog_control_id || '';
}

function processValue(process?: ProcessSummary) {
  const id = process?.process?.id;
  const operationId = process?.process?.operation_id;
  if (id) return `process:${id}`;
  if (operationId) return `operation:${operationId}`;
  return '';
}

function selectedScope(value: string) {
  if (value.startsWith('process:')) return { process_id: value.replace('process:', '') };
  if (value.startsWith('operation:')) return { operation_id: value.replace('operation:', '') };
  return {};
}

function diagnosticSearchParams(standard_id: string, scope: ReturnType<typeof selectedScope>) {
  const params = new URLSearchParams({ standard_id });
  if (scope.process_id) params.set('process_id', scope.process_id);
  if (scope.operation_id) params.set('operation_id', scope.operation_id);
  return params;
}

function label(value?: string | null, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    covered: 'Cubierto',
    partially_covered: 'Parcialmente cubierto',
    missing_evidence: 'Sin evidencia',
    needs_review: 'Requiere revisión',
    not_applicable: 'No aplicable',
  };
  return map[String(status || '')] || label(status, 'Sin estado');
}

function confidenceLabel(confidence?: string) {
  const map: Record<string, string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
  };
  return map[String(confidence || '').toLowerCase()] || label(confidence, 'Media');
}

function statusClass(status?: string) {
  if (status === 'covered') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partially_covered') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'missing_evidence') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'needs_review') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function evidenceFormats(item?: EvidenceRecommendation) {
  return item?.recommended_formats || item?.recommended_format || [];
}

function topRecommendation(control: DiagnosticControl, recommendationMap: Map<string, EvidenceRecommendation[]>) {
  const fromMap = recommendationMap.get(controlId(control)) || [];
  if (fromMap.length > 0) return fromMap;
  return control.evidence?.recommended || [];
}

function buildAiFallbackItem(control: DiagnosticControl, recommended: EvidenceRecommendation[]): AiItem {
  const first = recommended[0] || {};
  return {
    control_id: control.tenant_control_id,
    catalog_control_id: control.catalog_control_id,
    control_code: control.clause || control.category || control.catalog_control_id,
    control_name: control.category || control.description || 'Control',
    process_id: control.process?.id || null,
    process_name: control.process?.name || control.operation?.name || null,
    operation_id: control.operation?.id || null,
    operation_name: control.operation?.name || null,
    deterministic_status: control.status,
    ai_assessment: {
      summary: control.description || 'Control evaluado por diagnóstico determinístico.',
      gap_statement:
        control.traceability?.fragment ||
        'No se encontraron evidencias activas asociadas suficientes.',
      audit_relevance:
        first.iso_use?.join(', ') ||
        'Demostrar control operacional, trazabilidad y mejora continua ante auditoría.',
      confidence: control.confidence || 'medium',
      confidence_reason:
        control.traceability?.fragment ||
        'Resultado basado en cálculo determinístico; requiere revisión humana.',
    },
    recommended_evidence: recommended,
    suggested_actions: [
      {
        title: `Implementar o cargar ${first.name || 'evidencia del control'}`,
        description:
          first.how_to_present ||
          first.purpose ||
          'Cargar evidencia vigente y asociarla al control evaluado.',
        priority: control.status === 'missing_evidence' ? 'high' : 'medium',
        suggested_owner: first.owner_role || 'Responsable del proceso',
        suggested_due_days: control.status === 'missing_evidence' ? 15 : 30,
        human_review_required: true,
      },
    ],
    sources: [
      {
        source_type: control.traceability?.source === 'no_active_evidence' ? 'absence' : 'evidence',
        source_id: null,
        document_title: null,
        chunk_id: null,
        snippet: '',
        reason:
          control.traceability?.fragment ||
          'No se encontraron documentos activos asociados ni chunks suficientes.',
      },
    ],
    human_review_required: true,
  };
}

function Metric({
  label: metricLabel,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{metricLabel}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950">{value ?? 0}</div>
    </div>
  );
}

function RecommendationEvidence({ item }: { item: EvidenceRecommendation }) {
  const formats = evidenceFormats(item);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-950">{label(item.name, 'Evidencia recomendada')}</div>
      {item.purpose && <p className="mt-2 text-sm leading-6 text-slate-600">{item.purpose}</p>}

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-900">Cómo debe presentarse</dt>
          <dd className="mt-1 text-slate-600">{label(item.how_to_present, 'Cargar evidencia vigente con responsable, periodo, fuente y fecha de generación.')}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Responsable sugerido</dt>
          <dd className="mt-1 text-slate-600">{label(item.owner_role, 'Responsable del proceso')}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Frecuencia</dt>
          <dd className="mt-1 text-slate-600">{label(item.frequency, 'Revisión periódica según criticidad.')}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Tipo de evidencia</dt>
          <dd className="mt-1 text-slate-600">{label(item.evidence_strength, 'primary')}</dd>
        </div>
      </dl>

      {formats.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium text-slate-900">Formato recomendado</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {formats.map((format) => (
              <span key={format} className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                {format}
              </span>
            ))}
          </div>
        </div>
      )}

      {item.minimum_fields && item.minimum_fields.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium text-slate-900">Campos mínimos</div>
          <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
            {item.minimum_fields.slice(0, 18).map((field) => (
              <li key={field}>- {field}</li>
            ))}
          </ul>
        </div>
      )}

      {item.iso_use && item.iso_use.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium text-slate-900">Uso ISO</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.iso_use.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

function SourceTrace({ item }: { item: AiItem }) {
  const sources = item.sources || [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">Trazabilidad documental</div>
      {sources.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No se encontraron documentos activos asociados ni chunks suficientes.</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm text-slate-600">
          {sources.slice(0, 5).map((source, index) => (
            <li key={`${source.source_type || 'source'}-${source.source_id || index}`}>
              <div className="font-medium text-slate-800">
                {label(source.source_type, 'source')} {source.document_title ? `· ${source.document_title}` : ''}
              </div>
              {source.snippet && <div className="mt-1 italic text-slate-500">{source.snippet}</div>}
              <div className="mt-1">{label(source.reason, 'Razón no especificada.')}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StrengthenedDiagnosticPanel() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedProcess, setSelectedProcess] = useState('');
  const [detail, setDetail] = useState<DiagnosticDetail | null>(null);
  const [recommendations, setRecommendations] = useState<Map<string, EvidenceRecommendation[]>>(new Map());
  const [aiResult, setAiResult] = useState<AiResponse | null>(null);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [controlFilter, setControlFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const role = normalizeRole(
    getUserFromToken()?.role ||
      getUserFromToken()?.user_role ||
      getUserFromToken()?.userRole ||
      ''
  );

  const selectedStandardRecord = standards.find((standard) => standardId(standard) === selectedStandard);
  const selectedScopeParams = selectedScope(selectedProcess);
  const controls = useMemo(() => detail?.controls || [], [detail?.controls]);
  const actionableControls = controls.filter((control) =>
    ['missing_evidence', 'partially_covered', 'needs_review'].includes(String(control.status || ''))
  );

  const processFilterOptions = useMemo(() => {
    const map = new Map<string, string>();

    controls.forEach((control) => {
      const value = control.process?.id || control.operation?.id || control.process?.name || control.operation?.name || '';
      if (!value) return;
      map.set(value, control.process?.name || control.operation?.name || 'Sin proceso');
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [controls]);

  const filteredControls = useMemo(() => {
    const search = controlFilter.trim().toLowerCase();

    return controls.filter((control) => {
      const statusOk = !statusFilter || String(control.status || '') === statusFilter;
      const processOk =
        !processFilter ||
        control.process?.id === processFilter ||
        control.operation?.id === processFilter ||
        control.process?.name === processFilter ||
        control.operation?.name === processFilter;

      if (!statusOk || !processOk) return false;
      if (!search) return true;

      return [
        control.clause,
        control.category,
        control.description,
        control.process?.name,
        control.operation?.name,
        control.tenant_control_id,
        control.catalog_control_id,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search));
    });
  }, [controlFilter, controls, processFilter, statusFilter]);

  const hasControlFilters = Boolean(controlFilter || processFilter || statusFilter);

  const aiByControl = useMemo(() => {
    const map = new Map<string, AiItem>();
    for (const item of aiResult?.items || []) {
      if (item.control_id) map.set(String(item.control_id), item);
      if (item.catalog_control_id) map.set(String(item.catalog_control_id), item);
    }
    return map;
  }, [aiResult]);

  const canAcceptGap = GAP_ACCEPT_ROLES.has(role);
  const canAcceptAction = ACTION_ACCEPT_ROLES.has(role);
  const aiUnavailable = (aiResult?.warnings || []).some((warning) =>
    ['AI_ENRICHMENT_UNAVAILABLE', 'AI_RESPONSE_SCHEMA_FALLBACK'].includes(String(warning.code || ''))
  );

  async function loadStandards() {
    const token = getStoredValidToken();
    if (!token) {
      setError('La sesión expiró o no es válida. Vuelve a iniciar sesión.');
      return;
    }

    setLoadingStandards(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/api/diagnostics/standards`, {
        headers: authHeaders(token),
      });
      const json = await readJsonResponse<ApiResponse<Standard[]>>(response);
      const nextStandards = Array.isArray(json.data) ? json.data : [];
      setStandards(nextStandards);
      setSelectedStandard((current) => current || standardId(nextStandards[0]) || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar normas activas.');
    } finally {
      setLoadingStandards(false);
    }
  }

  async function loadProcesses(standard_id = selectedStandard) {
    const token = getStoredValidToken();
    if (!token || !standard_id) return;

    setLoadingProcesses(true);
    setError('');
    setProcesses([]);
    setSelectedProcess('');

    try {
      const params = new URLSearchParams({ standard_id });
      const response = await fetch(`${API_URL}/api/diagnostics/processes?${params.toString()}`, {
        headers: authHeaders(token),
      });
      const json = await readJsonResponse<ApiResponse<{ processes?: ProcessSummary[] }>>(response);
      setProcesses(Array.isArray(json.data?.processes) ? json.data.processes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar procesos.');
    } finally {
      setLoadingProcesses(false);
    }
  }

  async function loadDeterministicRecommendations(nextControls: DiagnosticControl[]) {
    const token = getStoredValidToken();
    if (!token || !selectedStandard) return;

    const map = new Map<string, EvidenceRecommendation[]>();
    const targets = nextControls
      .filter((control) => ['missing_evidence', 'partially_covered', 'needs_review'].includes(String(control.status || '')))
      .slice(0, 6);

    await Promise.all(
      targets.map(async (control) => {
        const id = controlId(control);
        if (!id) return;

        try {
          const response = await fetch(`${API_URL}/api/diagnostics/recommendations`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
              standard_id: selectedStandard,
              ...selectedScopeParams,
              control_id: id,
            }),
          });
          const json = await readJsonResponse<ApiResponse<RecommendationResponse>>(response);
          const recommended = json.data?.recommendation?.recommended_evidence || [];
          if (recommended.length > 0) map.set(id, recommended);
        } catch {
          if (control.evidence?.recommended?.length) map.set(id, control.evidence.recommended);
        }
      })
    );

    setRecommendations(map);
  }

  async function runDiagnostic() {
    const token = getStoredValidToken();
    if (!token || !selectedStandard) return;

    setRunningDiagnostic(true);
    setError('');
    setNotice('');
    setAiResult(null);
    setDetail(null);

    try {
      const detailParams = diagnosticSearchParams(selectedStandard, selectedScopeParams);
      const response = await fetch(`${API_URL}/api/diagnostics/process-detail?${detailParams.toString()}`, {
        headers: authHeaders(token),
      });
      const json = await readJsonResponse<ApiResponse<DiagnosticDetail>>(response);
      const nextDetail = json.data || null;
      setDetail(nextDetail);
      await loadDeterministicRecommendations(nextDetail?.controls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible ejecutar el diagnóstico.');
    } finally {
      setRunningDiagnostic(false);
    }
  }

  async function runAi() {
    const token = getStoredValidToken();
    if (!token || !selectedStandard) return;

    setRunningAi(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/api/diagnostics/ai-contextual-recommendations`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          standard_id: selectedStandard,
          ...selectedScopeParams,
          include_chunks: true,
          max_chunks: 8,
          mode: 'diagnostic_enrichment',
        }),
      });
      const json = await readJsonResponse<ApiResponse<AiResponse>>(response);
      setAiResult(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enriquecer con IA. Se muestra recomendación determinística.');
    } finally {
      setRunningAi(false);
    }
  }

  async function acceptSuggestion(kind: 'gap' | 'action', item: AiItem, control: DiagnosticControl) {
    const token = getStoredValidToken();
    if (!token) return;

    const permitted = kind === 'gap' ? canAcceptGap : canAcceptAction;
    if (!permitted) {
      setNotice('No tiene permiso para ejecutar esta acción.');
      return;
    }

    const ok = window.confirm(
      kind === 'gap'
        ? 'Se creará una brecha formal desde esta recomendación. ¿Continuar?'
        : 'Se creará un plan de acción formal desde esta recomendación. ¿Continuar?'
    );
    if (!ok) return;

    setActionLoading(`${kind}-${controlId(control)}`);
    setError('');
    setNotice('');

    try {
      const endpoint =
        kind === 'gap'
          ? '/api/diagnostics/suggestions/accept-gap'
          : '/api/diagnostics/suggestions/accept-action';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          standard_id: selectedStandard,
          ...selectedScopeParams,
          control_id: controlId(control),
          ai_assessment: item.ai_assessment,
          recommended_evidence: item.recommended_evidence,
          suggested_actions: item.suggested_actions,
          sources: item.sources,
        }),
      });
      const json = await readJsonResponse<ApiResponse<Record<string, unknown>>>(response);
      setNotice(
        json.data?.duplicate_prevented
          ? 'Ya existía un registro abierto equivalente. Se reutilizó el existente.'
          : kind === 'gap'
            ? 'Brecha creada desde revisión humana de diagnóstico.'
            : 'Plan de acción creado desde revisión humana de diagnóstico.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible ejecutar la acción.');
    } finally {
      setActionLoading('');
    }
  }

  const summary = detail?.summary || {};

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Diagnóstico fortalecido
          </div>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Norma activa, proceso y evidencia recomendada contextualizada
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Evalúa cobertura documental, brechas, evidencias faltantes y acciones sugeridas. La IA solo enriquece el análisis: no aprueba, no certifica y requiere revisión humana.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStandards}
          disabled={loadingStandards}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loadingStandards ? 'Cargando...' : standards.length > 0 ? 'Actualizar normas' : 'Cargar normas'}
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Requiere revisión humana. Las evidencias excluidas no se consideran cobertura activa.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
        <label className="block text-sm">
          <span className="font-medium text-slate-800">Norma activa</span>
          <select
            value={selectedStandard}
            onChange={(event) => {
              setSelectedStandard(event.target.value);
              setDetail(null);
              setAiResult(null);
              void loadProcesses(event.target.value);
            }}
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Seleccione una norma activa para iniciar diagnóstico.</option>
            {standards.map((standard) => (
              <option key={standardId(standard)} value={standardId(standard)}>
                {label(standard.display_name || standard.standard_code)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-slate-800">Proceso u operación</span>
          <select
            value={selectedProcess}
            onChange={(event) => {
              setSelectedProcess(event.target.value);
              setDetail(null);
              setAiResult(null);
            }}
            disabled={!selectedStandard || loadingProcesses}
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">Puede ejecutar diagnóstico general por norma o seleccionar un proceso.</option>
            {processes.map((process) => (
              <option key={processValue(process)} value={processValue(process)}>
                {label(process.process?.name || process.process?.operation_name, 'Proceso sin nombre')}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={runDiagnostic}
          disabled={!selectedStandard || runningDiagnostic}
          className="self-end rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {runningDiagnostic ? 'Ejecutando...' : 'Ejecutar diagnóstico'}
        </button>

        <button
          type="button"
          onClick={runAi}
          disabled={!selectedStandard || runningAi || controls.length === 0}
          className="self-end rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 disabled:opacity-50"
        >
          {runningAi ? 'Analizando...' : 'Analizar con auditor IA'}
        </button>
      </div>

      {!selectedStandard && standards.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">Seleccione una norma activa para iniciar diagnóstico.</p>
      )}

      {selectedStandardRecord && (
        <p className="mt-3 text-sm text-slate-500">
          Norma seleccionada: {label(selectedStandardRecord.display_name || selectedStandardRecord.standard_code)}
        </p>
      )}

      {error && (
        <div className="mt-4 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {detail && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Cobertura" value={`${Number(summary.coverage_level || 0).toFixed(1)}%`} />
            <Metric label="Cubiertos" value={summary.controls_covered} />
            <Metric label="Parciales" value={summary.controls_partially_covered} />
            <Metric label="Sin evidencia" value={summary.controls_missing_evidence} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Evidencias existentes" value={summary.evidences_existing} />
            <Metric label="Brechas abiertas" value={summary.gaps_open} />
            <Metric label="Acciones abiertas" value={summary.actions_open} />
            <Metric label="Confianza" value={label(String(summary.confidence_level || ''), 'Media')} />
          </div>

          {controls.length === 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No se encontraron controles aplicables para la norma/proceso seleccionado.
            </div>
          )}

          {controls.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">Controles del diagnóstico</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {filteredControls.length}/{controls.length} control(es) visibles.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[760px]">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Control</span>
                      <input
                        type="search"
                        value={controlFilter}
                        onChange={(event) => setControlFilter(event.target.value)}
                        placeholder="Buscar control, cláusula o descripción"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Proceso</span>
                      <select
                        value={processFilter}
                        onChange={(event) => setProcessFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <option value="">Todos</option>
                        {processFilterOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">Estado</span>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <option value="">Todos</option>
                        <option value="covered">{statusLabel('covered')}</option>
                        <option value="partially_covered">{statusLabel('partially_covered')}</option>
                        <option value="missing_evidence">{statusLabel('missing_evidence')}</option>
                        <option value="needs_review">{statusLabel('needs_review')}</option>
                        <option value="not_applicable">{statusLabel('not_applicable')}</option>
                      </select>
                    </label>
                  </div>
                </div>

                {hasControlFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setControlFilter('');
                      setProcessFilter('');
                      setStatusFilter('');
                    }}
                    className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className="max-h-[560px] overflow-auto tcdx-scrollbar">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">Control</th>
                    <th className="px-4 py-3">Proceso</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Evidencias</th>
                    <th className="px-4 py-3">Brechas/acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredControls.map((control) => (
                    <tr key={controlId(control)}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-950">{label(control.clause || control.category, 'Control')}</div>
                        <div className="mt-1 max-w-xl text-slate-600">{label(control.description, 'Sin descripción')}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {label(control.process?.name || control.operation?.name, 'Sin proceso')}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${statusClass(control.status)}`}>
                          {statusLabel(control.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {control.evidence?.active_count || 0} activas · {control.evidence?.candidate_count || 0} candidatas
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {control.gaps?.open_count || 0} brechas · {control.actions?.open_count || 0} acciones
                      </td>
                    </tr>
                  ))}
                  {filteredControls.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No hay controles que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {controls.length > 0 && (summary.evidences_existing || 0) === 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No se encontraron evidencias activas asociadas.
            </div>
          )}

          {aiUnavailable && (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No fue posible enriquecer con IA. Se muestra recomendación determinística.
            </div>
          )}

          {(aiResult?.warnings || []).length > 0 && (
            <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {(aiResult?.warnings || []).map((warning) => (
                <p key={`${warning.code}-${warning.message}`}>{warning.message || warning.code}</p>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Evidencias faltantes y recomendadas</h3>
              <p className="mt-1 text-sm text-slate-600">
                Recomendaciones operativas para controles sin evidencia, parcialmente cubiertos o que requieren revisión.
              </p>
            </div>

            {actionableControls.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No hay controles con evidencias faltantes o recomendaciones pendientes en el filtro actual.
              </div>
            ) : (
              actionableControls.map((control) => {
                const recommended = topRecommendation(control, recommendations);
                const aiItem =
                  aiByControl.get(controlId(control)) ||
                  aiByControl.get(String(control.catalog_control_id || '')) ||
                  buildAiFallbackItem(control, recommended);
                const loadingKey = actionLoading.endsWith(controlId(control));

                return (
                  <article key={`rec-${controlId(control)}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Control</div>
                        <h4 className="mt-1 text-lg font-semibold text-slate-950">
                          {label(control.clause || control.category || aiItem.control_name, 'Control evaluado')}
                        </h4>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                          {label(control.description || aiItem.ai_assessment?.summary, 'Sin descripción')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded border px-2 py-1 text-xs font-medium ${statusClass(control.status)}`}>
                          {statusLabel(control.status)}
                        </span>
                        <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                          Confianza {confidenceLabel(aiItem.ai_assessment?.confidence || control.confidence)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Evidencia existente</div>
                        {control.evidence?.existing && control.evidence.existing.length > 0 ? (
                          <ul className="mt-2 space-y-2 text-sm text-slate-600">
                            {control.evidence.existing.slice(0, 4).map((item) => (
                              <li key={`${item.source_type}-${item.source_id}`}>
                                {label(item.name || item.file_name || item.description, 'Evidencia')} · {label(item.status, 'activa')}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">No se encontraron evidencias activas asociadas.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Brecha o evidencia faltante</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {label(aiItem.ai_assessment?.gap_statement, control.traceability?.fragment || 'No existe evidencia suficiente asociada al control.')}
                        </p>
                        <div className="mt-3 text-sm font-medium text-slate-900">Valor ante auditoría</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {label(aiItem.ai_assessment?.audit_relevance, 'Permite demostrar trazabilidad documental y control operacional.')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {(aiItem.recommended_evidence || recommended).slice(0, 3).map((item, index) => (
                        <RecommendationEvidence key={`${controlId(control)}-evidence-${index}-${item.name}`} item={item} />
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900">Acciones sugeridas</div>
                        <ul className="mt-3 space-y-3 text-sm text-slate-600">
                          {(aiItem.suggested_actions || []).slice(0, 3).map((action, index) => (
                            <li key={`${controlId(control)}-action-${index}`}>
                              <div className="font-medium text-slate-800">{label(action.title, 'Acción sugerida')}</div>
                              <div className="mt-1">{label(action.description, 'Implementar evidencia y asociarla al control.')}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Prioridad {label(action.priority, 'medium')} · Responsable {label(action.suggested_owner, 'pendiente')} · {action.suggested_due_days || 30} días sugeridos
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <SourceTrace item={aiItem} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => acceptSuggestion('gap', aiItem, control)}
                        disabled={!canAcceptGap || loadingKey}
                        className="rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {loadingKey && actionLoading.startsWith('gap') ? 'Creando...' : 'Crear brecha'}
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptSuggestion('action', aiItem, control)}
                        disabled={!canAcceptAction || loadingKey}
                        className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {loadingKey && actionLoading.startsWith('action') ? 'Creando...' : 'Crear plan de acción'}
                      </button>
                      <a href="/evidencias" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                        Buscar evidencia
                      </a>
                      <a href="/evidencias" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                        Cargar evidencia
                      </a>
                      {(!canAcceptGap || !canAcceptAction) && (
                        <span className="self-center text-sm text-slate-500">No tiene permiso para una o más acciones de aceptación.</span>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
