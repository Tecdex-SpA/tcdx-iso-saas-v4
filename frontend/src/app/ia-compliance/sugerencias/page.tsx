'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type SuggestionRow = {
  id: string;
  tenant_id: string;
  suggestion_type: string;
  source_module: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  title: string | null;
  input_payload: Record<string, any> | null;
  output_payload: Record<string, any> | null;
  confidence: string | null;
  status: string;
  created_by: string | null;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

type PreviewData = {
  title: string;
  body: string;
};


function aiTraceText(value: any, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function formatSourceModule(value?: string | null) {
  const labels: Record<string, string> = {
    ia_compliance: 'IA Compliance',
    ia_compliance_apply: 'IA Compliance - aplicación',
    ia_module_in_page: 'Hallazgos - IA en página',
    nc_module_in_page: 'No conformidades - IA en página',
    frontend_hallazgos: 'Hallazgos',
    diagnostic: 'Diagnóstico',
    control: 'Controles',
    audit: 'Auditorías',
    soa: 'SoA',
  };

  const raw = String(value || '').trim();
  return labels[raw] || raw.replaceAll('_', ' ') || 'No informado';
}

function formatSourceEntityType(value?: string | null) {
  const labels: Record<string, string> = {
    tenant: 'Cliente / tenant',
    finding: 'Hallazgo',
    nonconformity: 'No conformidad',
    action_plan: 'Plan de acción',
    manual_input: 'Entrada manual',
    evidence: 'Evidencia',
    control: 'Control',
    audit: 'Auditoría',
  };

  const raw = String(value || '').trim();
  return labels[raw] || raw.replaceAll('_', ' ') || 'No informado';
}

function shortReference(value?: string | null) {
  const raw = String(value || '').trim();

  if (!raw) return 'No informado';

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return `Referencia ${raw.slice(0, 8)}`;
  }

  return raw;
}

function buildOriginSummary(row: SuggestionRow) {
  const moduleLabel = formatSourceModule(row.source_module);
  const entityLabel = formatSourceEntityType(row.source_entity_type);
  const reference = shortReference(row.source_entity_id);

  if (row.source_entity_id) {
    return `${moduleLabel} · ${entityLabel} · ${reference}`;
  }

  return `${moduleLabel} · ${entityLabel}`;
}

function getSuggestionAiTrace(row: SuggestionRow) {
  const output = row.output_payload || {};
  const structuredResult = output.structured_result || output.enhanced_answer?.structured_result || {};
  const enhanced = output.enhanced_orchestration || output.enhanced || {};
  const enhancedAnswer = output.enhanced_answer || enhanced.answer || {};
  const structured = output.structured_guided || {};
  const knowledgeSources = structured.knowledge_sources || {};
  const searchTrace =
    enhanced.search_trace ||
    knowledgeSources ||
    output.search_trace ||
    {};

  const sourceLevel = aiTraceText(
    output.enhanced_source_level ||
      enhanced.source_level ||
      enhancedAnswer.source_level ||
      knowledgeSources.source_level ||
      structured.source_level ||
      ''
  );

  const sourceLabel = aiTraceText(
    output.enhanced_source_label ||
      enhanced.source_label ||
      enhancedAnswer.source_label ||
      knowledgeSources.source_label ||
      structured.source_label ||
      ''
  );

  const confidence = aiTraceText(
    output.enhanced_confidence ||
      enhanced.confidence ||
      enhancedAnswer.confidence ||
      knowledgeSources.confidence ||
      structured.confidence ||
      row.confidence ||
      structuredResult.confidence ||
      ''
  );

  const confidenceScore =
    enhanced.confidence_score ||
    enhancedAnswer.confidence_score ||
    knowledgeSources.confidence_score ||
    null;

  const traceId = aiTraceText(
    output.enhanced_trace_id ||
      enhanced.trace?.id ||
      structured.trace_id ||
      knowledgeSources.trace_id ||
      ''
  );

  const sourceOrder = Array.isArray(searchTrace.source_order)
    ? searchTrace.source_order
    : [];

  const tenantHits = Number(searchTrace.tenant_hits ?? 0);
  const knowledgeHits = Number(searchTrace.knowledge_hits ?? 0);
  const benchmarkHits = Number(searchTrace.benchmark_hits ?? 0);
  const externalHits = Number(searchTrace.external_hits ?? 0);

  const hasTrace =
    Boolean(traceId) ||
    Boolean(sourceLevel) ||
    Boolean(sourceLabel) ||
    Boolean(confidence) ||
    sourceOrder.length > 0 ||
    tenantHits > 0 ||
    knowledgeHits > 0 ||
    benchmarkHits > 0 ||
    externalHits > 0;

  return {
    hasTrace,
    sourceLevel,
    sourceLabel,
    confidence,
    confidenceScore,
    traceId,
    sourceOrder,
    tenantHits,
    knowledgeHits,
    benchmarkHits,
    externalHits,
  };
}

function StructuredSuggestionResult({ row }: { row: SuggestionRow }) {
  const output = row.output_payload || {};
  const structured = output.structured_result || output.enhanced_answer?.structured_result || null;
  if (!structured || typeof structured !== 'object') return null;

  const gaps = Array.isArray(structured.gaps) ? structured.gaps : [];
  const actions = Array.isArray(structured.recommended_actions) ? structured.recommended_actions : [];
  const limitations = Array.isArray(structured.limitations) ? structured.limitations : [];

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
            Resultado estructurado AI v2
          </div>
          <p className="mt-2 text-sm leading-6 text-indigo-950">
            {structured.executive_summary || structured.diagnosis || 'Sin resumen estructurado.'}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
          Confianza: {Math.round(Number(structured.confidence || 0) * 100)}%
        </span>
      </div>

      {(gaps.length > 0 || actions.length > 0 || limitations.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {gaps.length > 0 && (
            <MiniStructuredList title="Brechas" items={gaps.slice(0, 3).map((item: any) => item.title || item.description)} />
          )}
          {actions.length > 0 && (
            <MiniStructuredList title="Acciones" items={actions.slice(0, 3).map((item: any) => item.title || item.description)} />
          )}
          {limitations.length > 0 && (
            <MiniStructuredList title="Limitaciones" items={limitations.slice(0, 3)} />
          )}
        </div>
      )}
    </div>
  );
}

function MiniStructuredList({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-indigo-100">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item, index) => <li key={index}>{String(item)}</li>)}
      </ul>
    </div>
  );
}

function SuggestionAiTraceCard({ row }: { row: SuggestionRow }) {
  const trace = getSuggestionAiTrace(row);

  if (!trace.hasTrace) return null;

  const sourceLabels: Record<string, string> = {
    tenant_internal: 'Tenant',
    tcdx_knowledge: 'Base TCDX',
    anonymized_benchmark: 'Benchmark',
    external_web: 'Internet',
    best_effort: 'Mejor esfuerzo',
  };

  const sourceName =
    trace.sourceLabel ||
    sourceLabels[trace.sourceLevel] ||
    trace.sourceLevel ||
    'Motor IA TCDX';

  const sourceOrderText = trace.sourceOrder.length
    ? trace.sourceOrder.map((item: string) => sourceLabels[item] || item).join(' → ')
    : 'No informada';

  const sourceClass =
    trace.sourceLevel === 'external_web'
      ? 'bg-cyan-50 text-cyan-800 ring-cyan-200'
      : trace.sourceLevel === 'anonymized_benchmark'
        ? 'bg-purple-50 text-purple-800 ring-purple-200'
        : trace.sourceLevel === 'tcdx_knowledge'
          ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
          : trace.sourceLevel === 'tenant_internal'
            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
            Orquestación IA TCDX
          </div>
          <div className="mt-2 text-sm leading-6 text-blue-950">
            Esta sugerencia conserva trazabilidad del motor IA central usado para generarla.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-bold ring-1 ${sourceClass}`}>
            Origen: {sourceName}
          </span>

          {trace.confidence && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              Confianza: {trace.confidence}
              {trace.confidenceScore ? ` · ${trace.confidenceScore}%` : ''}
            </span>
          )}

          {trace.traceId && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              Trace: {trace.traceId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Ruta: {sourceOrderText}
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Tenant: {trace.tenantHits}
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          TCDX: {trace.knowledgeHits}
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Benchmark: {trace.benchmarkHits}
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Internet: {trace.externalHits}
        </div>
      </div>
    </div>
  );
}


export default function AiSuggestionsPage() {
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseSuggestions = !entitlementsLoading && canUseAiFeature('suggestions');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<SuggestionRow[]>([]);

  useEffect(() => {
    if (entitlementsLoading) return;

    if (!canUseSuggestions) {
      window.location.replace('/dashboard');
      return;
    }

    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (!authToken || !u?.tenant_id) {
      setLoading(false);
      setError('No se pudo obtener la sesión del usuario.');
      return;
    }

    loadSuggestions('');
  }, [canUseSuggestions, entitlementsLoading]);

  const getWithAuth = async (url: string) => {
    const authToken = localStorage.getItem('token');

    if (!authToken) {
      window.location.href = '/login';
      throw new Error('Sesión no disponible');
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const text = await res.text();

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta inválida desde ${url}`);
    }

    if (!res.ok) {
      throw new Error(json?.error || json?.detail || 'Error consultando sugerencias IA');
    }

    return json;
  };

  const postWithAuth = async (url: string, body: any) => {
    const authToken = localStorage.getItem('token');

    if (!authToken) {
      window.location.href = '/login';
      throw new Error('Sesión no disponible');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Respuesta inválida desde ${url}`);
    }

    if (!res.ok) {
      throw new Error(json?.error || json?.detail || 'Error aplicando sugerencia IA');
    }

    return json;
  };

  const loadSuggestions = async (forcedType?: string) => {
    try {
      setLoading(true);
      setError('');

      const effectiveType =
        typeof forcedType === 'string' ? forcedType : typeFilter;

      const params = new URLSearchParams();
      if (effectiveType) {
        params.append('suggestion_type', effectiveType);
      }

      const json = await getWithAuth(
        `${API_URL}/api/ai-compliance/suggestions${
          params.toString() ? `?${params.toString()}` : ''
        }`
      );

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err: any) {
      console.error('ERROR LOAD AI SUGGESTIONS:', err);
      setRows([]);
      setError(err.message || 'No fue posible cargar las sugerencias IA.');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (
    row: SuggestionRow,
    applyMode: 'mark_only' | 'create_action_plan_draft'
  ) => {
    try {
      setSavingId(`${row.id}-${applyMode}`);
      setError('');

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/suggestions/${row.id}/apply`,
        {
          apply_mode: applyMode,
        }
      );

      const updated = result?.data;
      const appliedArtifact = result?.applied_artifact || null;

      if (updated) {
        setRows((prev) =>
          prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item))
        );
      }

      if (appliedArtifact) {
        alert('Sugerencia aplicada y plan de acción borrador creado correctamente.');
      } else {
        alert('Sugerencia marcada como aplicada.');
      }
    } catch (err: any) {
      console.error('ERROR APPLY AI SUGGESTION:', err);
      setError(err.message || 'No fue posible aplicar la sugerencia IA.');
    } finally {
      setSavingId('');
    }
  };

  const isSeniorAuditorSuggestionType = (value: string) =>
    [
      'senior_auditor_task',
      'senior_auditor_risk_alert',
      'senior_auditor_evidence_gap',
      'senior_auditor_insight',
    ].includes(value);

  const getTypeLabel = (value: string) => {
    switch (value) {
      case 'finding_analysis':
        return 'Análisis de hallazgo';
      case 'action_plan_suggestion':
        return 'Plan de acción sugerido';
      case 'senior_auditor_task':
        return 'Tarea auditor senior';
      case 'senior_auditor_risk_alert':
        return 'Alerta de riesgo senior';
      case 'senior_auditor_evidence_gap':
        return 'Brecha de evidencia senior';
      case 'senior_auditor_insight':
        return 'Insight auditor senior';
      case 'nonconformity_draft':
        return 'Borrador de no conformidad';
      case 'executive_brief':
        return 'Resumen gerencial';
      default:
        return value || 'Sin tipo';
    }
  };

  const getTypeBadge = (value: string) => {
    switch (value) {
      case 'finding_analysis':
        return 'border-indigo-200 bg-indigo-50 text-indigo-700';
      case 'action_plan_suggestion':
        return 'border-violet-200 bg-violet-50 text-violet-700';
      case 'senior_auditor_task':
      case 'senior_auditor_risk_alert':
      case 'senior_auditor_evidence_gap':
      case 'senior_auditor_insight':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'nonconformity_draft':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'executive_brief':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  };

  const getStatusBadge = (value: string) => {
    if (value === 'applied') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (value === 'discarded') {
      return 'border-red-200 bg-red-50 text-red-700';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  const getStatusLabel = (value?: string | null) => {
    switch (String(value || 'draft').toLowerCase()) {
      case 'applied':
        return 'Aplicada';
      case 'discarded':
        return 'Descartada';
      case 'draft':
        return 'Borrador';
      default:
        return String(value || 'Borrador').replaceAll('_', ' ');
    }
  };

  const getPreview = (row: SuggestionRow): PreviewData => {
    const output = row.output_payload || {};

    if (row.suggestion_type === 'finding_analysis') {
      return {
        title: String(output.summary || row.title || 'Análisis IA'),
        body: String(
          output.impact ||
            (Array.isArray(output.recommended_actions)
              ? output.recommended_actions.join(' | ')
              : '') ||
            'Sin detalle'
        ),
      };
    }

    if (row.suggestion_type === 'action_plan_suggestion') {
      return {
        title: String(output.objective || row.title || 'Plan sugerido IA'),
        body: String(
          Array.isArray(output.immediate_actions) && output.immediate_actions.length
            ? output.immediate_actions.join(' | ')
            : 'Sin acciones inmediatas'
        ),
      };
    }

    if (isSeniorAuditorSuggestionType(row.suggestion_type)) {
      return {
        title: String(output.title || row.title || 'Sugerencia auditor senior'),
        body: String(
          output.recommended_action ||
            output.summary ||
            output.reason ||
            'Sin detalle'
        ),
      };
    }

    if (row.suggestion_type === 'nonconformity_draft') {
      return {
        title: String(output.draft_title || row.title || 'Borrador IA'),
        body: String(output.statement || output.corrective_action || 'Sin detalle'),
      };
    }

    if (row.suggestion_type === 'executive_brief') {
      return {
        title: String(output.headline || row.title || 'Resumen gerencial'),
        body: String(output.executive_summary || 'Sin resumen'),
      };
    }

    return {
      title: String(row.title || 'Sugerencia IA'),
      body: 'Sin detalle',
    };
  };

  const getKeyDetails = (row: SuggestionRow): string[] => {
    const output = row.output_payload || {};

    if (row.suggestion_type === 'action_plan_suggestion') {
      return Array.isArray(output.success_criteria)
        ? output.success_criteria
            .filter((item: unknown) => typeof item === 'string')
            .slice(0, 3)
        : [];
    }

    if (isSeniorAuditorSuggestionType(row.suggestion_type)) {
      return [
        output.reason ? `Razón: ${output.reason}` : '',
        output.recommended_action
          ? `Acción: ${output.recommended_action}`
          : '',
        output.priority ? `Prioridad: ${output.priority}` : '',
      ]
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .slice(0, 3);
    }

    if (row.suggestion_type === 'finding_analysis') {
      return Array.isArray(output.recommended_actions)
        ? output.recommended_actions
            .filter((item: unknown) => typeof item === 'string')
            .slice(0, 3)
        : [];
    }

    if (row.suggestion_type === 'nonconformity_draft') {
      const details = [
        output.objective_evidence,
        output.risk_statement,
        output.immediate_correction,
      ].filter((item: unknown): item is string => typeof item === 'string' && item.length > 0);

      return details.slice(0, 3);
    }

    if (row.suggestion_type === 'executive_brief') {
      return Array.isArray(output.management_actions)
        ? output.management_actions
            .filter((item: unknown) => typeof item === 'string')
            .slice(0, 3)
        : [];
    }

    return [];
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus = statusFilter ? row.status === statusFilter : true;

      if (!matchesStatus) return false;

      if (!term) return true;

      const preview = getPreview(row);
      const text = [
        row.title,
        row.suggestion_type,
        row.source_module,
        row.source_entity_type,
        preview.title,
        preview.body,
        JSON.stringify(row.input_payload || {}),
        JSON.stringify(row.output_payload || {}),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(term);
    });
  }, [rows, statusFilter, search]);

  const metrics = useMemo(() => {
    return {
      total: rows.length,
      drafts: rows.filter((r) => r.status !== 'applied').length,
      applied: rows.filter((r) => r.status === 'applied').length,
      actionPlans: rows.filter((r) => r.suggestion_type === 'action_plan_suggestion').length,
      findings: rows.filter((r) => r.suggestion_type === 'finding_analysis').length,
      seniorAuditor: rows.filter((r) => isSeniorAuditorSuggestionType(r.suggestion_type)).length,
    };
  }, [rows]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 bg-[#f5f7fb] min-h-screen">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Sugerencias IA guardadas
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Revisa borradores generados por IA, deja trazabilidad y aplica acciones cuando corresponda.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadSuggestions(typeFilter)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refrescar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Total" value={metrics.total} />
          <MetricCard title="Pendientes" value={metrics.drafts} />
          <MetricCard title="Aplicadas" value={metrics.applied} />
          <MetricCard title="Planes IA" value={metrics.actionPlans} />
          <MetricCard title="Hallazgos IA" value={metrics.findings} />
          <MetricCard title="Auditor senior" value={metrics.seniorAuditor} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setTypeFilter(value);
                  loadSuggestions(value);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Todos</option>
                <option value="finding_analysis">Análisis de hallazgo</option>
                <option value="action_plan_suggestion">Plan de acción sugerido</option>
                <option value="senior_auditor_task">Tarea auditor senior</option>
                <option value="senior_auditor_risk_alert">Alerta de riesgo senior</option>
                <option value="senior_auditor_evidence_gap">Brecha de evidencia senior</option>
                <option value="senior_auditor_insight">Insight auditor senior</option>
                <option value="nonconformity_draft">Borrador de no conformidad</option>
                <option value="executive_brief">Resumen gerencial</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Estado</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Todos</option>
                <option value="draft">Borrador</option>
                <option value="applied">Aplicada</option>
                <option value="discarded">Descartada</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-600">Buscar</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, resumen, tipo, payload..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
            Cargando sugerencias IA...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-slate-500">
            No hay sugerencias IA para los filtros actuales.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((row) => {
              const preview = getPreview(row);
              const keyDetails: string[] = getKeyDetails(row);
              const canCreateDraftPlan =
                (row.suggestion_type === 'action_plan_suggestion' ||
                  isSeniorAuditorSuggestionType(row.suggestion_type)) &&
                row.status !== 'applied';

              const canMarkApplied = row.status !== 'applied';

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getTypeBadge(
                            row.suggestion_type
                          )}`}
                        >
                          {getTypeLabel(row.suggestion_type)}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(
                            row.status
                          )}`}
                        >
                          {getStatusLabel(row.status)}
                        </span>

                        {row.confidence && (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            Confianza: {row.confidence}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-xl font-bold text-slate-900">
                        {preview.title}
                      </h2>

                      <div className="mt-1 text-sm text-slate-500">
                        {row.title || 'Sin título manual'} · {buildOriginSummary(row)}
                      </div>

                      <div className="mt-3 text-sm leading-6 text-slate-700">
                        {preview.body}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 text-right">
                      <div>Creada: {formatDateTime(row.created_at)}</div>
                      <div>Aplicada: {formatDateTime(row.applied_at)}</div>
                    </div>
                  </div>

                  <SuggestionAiTraceCard row={row} />
                  <StructuredSuggestionResult row={row} />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900 mb-2">
                        Contexto de origen
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <InfoItem
                          label="Módulo"
                          value={formatSourceModule(row.source_module)}
                        />
                        <InfoItem
                          label="Entidad origen"
                          value={formatSourceEntityType(row.source_entity_type)}
                        />
                        <InfoItem
                          label="Registro relacionado"
                          value={shortReference(row.source_entity_id)}
                        />
                        <InfoItem
                          label="Cliente"
                          value="Cliente actual"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900 mb-2">
                        Puntos clave
                      </div>

                      {keyDetails.length === 0 ? (
                        <div className="text-sm text-slate-500">
                          Sin puntos destacados para esta sugerencia.
                        </div>
                      ) : (
                        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                          {keyDetails.map((item: string, index: number) => (
                            <li key={`${row.id}-detail-${index}`}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canCreateDraftPlan && (
                      <button
                        type="button"
                        onClick={() =>
                          applySuggestion(row, 'create_action_plan_draft')
                        }
                        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                      >
                        {savingId === `${row.id}-create_action_plan_draft`
                          ? 'Creando...'
                          : 'Crear plan borrador'}
                      </button>
                    )}

                    {canMarkApplied && (
                      <button
                        type="button"
                        onClick={() => applySuggestion(row, 'mark_only')}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        {savingId === `${row.id}-mark_only`
                          ? 'Aplicando...'
                          : 'Marcar aplicada'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value || '-'}
      </div>
    </div>
  );
}
