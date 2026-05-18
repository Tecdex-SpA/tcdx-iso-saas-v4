'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { clearAiAuditorDraft, formatAiAuditorDraftDescription, normalizeAiAuditorDraftPriority, readAiAuditorDraftFromSession, type AiAuditorDraftPayload } from '@/utils/aiAuditorDraft';
import { useTranslation } from '@/hooks/useTranslation';
import { translateDisplayText, translateStatusLabel, translatePriorityLabel, translateStandardLabel, translateClauseLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type AiNcDraftResponse = {
  ok: boolean;
  context?: any;
  ai?: {
    draft_title: string;
    statement: string;
    objective_evidence: string;
    risk_statement: string;
    immediate_correction: string;
    corrective_action: string;
    confidence?: string;
  };
};

type ActionPlanRow = {
  id: string;
  iso_code?: string | null;
  status?: string | null;
  title?: string | null;
  priority?: string | null;
  nonconformity_id?: string | null;
  approval_status?: string | null;
  owner?: string | null;
  due_date?: string | null;
  evidence_count?: number;
  approved_evidence_count?: number;
  pending_evidence_count?: number;
  latest_progress_percent?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type ScopeResponse = {
  standards: ScopeStandard[];
  operations: any[];
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

function resolveRole(user: any): string {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function isOperationalStandard(s: ScopeStandard) {
  return (
    (s?.is_active === true || s?.is_active === 'true' || s?.is_active === 1) &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);

  return d.toLocaleDateString('es-CL');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeActionStatus(value: string | null | undefined) {
  const raw = String(value || '').toLowerCase().trim();

  if (['completed', 'completado', 'cerrado', 'closed', 'resuelto', 'resuelta'].includes(raw)) {
    return 'completado';
  }

  if (['cancelado', 'cancelada', 'cancelled'].includes(raw)) {
    return 'cancelado';
  }

  if (['blocked', 'bloqueado'].includes(raw)) {
    return 'bloqueado';
  }

  if (['in_progress', 'in progress', 'en progreso', 'progreso'].includes(raw)) {
    return 'en progreso';
  }

  return 'abierto';
}

function isClosedAction(action?: ActionPlanRow | null) {
  const normalized = normalizeActionStatus(action?.status);
  return normalized === 'completado' || normalized === 'cancelado';
}

function rankActionStatus(value: string | null | undefined) {
  const normalized = normalizeActionStatus(value);

  if (normalized === 'abierto') return 1;
  if (normalized === 'en progreso') return 2;
  if (normalized === 'bloqueado') return 3;
  if (normalized === 'completado') return 4;
  if (normalized === 'cancelado') return 5;
  return 9;
}


function aiSafeText(value: any, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function getAiOrchestrationTrace(result: any) {
  const ai = result?.ai || {};
  const enhanced = result?.enhanced || {};
  const structured = ai?.structured_guided || {};
  const knowledgeSources =
    structured?.knowledge_sources ||
    ai?.enhanced_answer?.knowledge_sources ||
    {};

  const enhancedOrchestration = ai?.enhanced_orchestration || {};

  const sourceLevel = aiSafeText(
    ai?.enhanced_source_level ||
      enhanced?.answer?.source_level ||
      enhancedOrchestration?.source_level ||
      knowledgeSources?.source_level ||
      ''
  );

  const sourceLabel = aiSafeText(
    ai?.enhanced_source_label ||
      enhanced?.answer?.source_label ||
      enhancedOrchestration?.source_label ||
      knowledgeSources?.source_label ||
      ''
  );

  const confidence = aiSafeText(
    ai?.enhanced_confidence ||
      enhanced?.answer?.confidence ||
      enhancedOrchestration?.confidence ||
      knowledgeSources?.confidence ||
      ''
  );

  const traceId = aiSafeText(
    ai?.enhanced_trace_id ||
      enhanced?.trace?.id ||
      enhancedOrchestration?.trace?.id ||
      structured?.trace_id ||
      knowledgeSources?.trace_id ||
      ''
  );

  const searchTrace =
    enhanced?.search_trace ||
    enhancedOrchestration?.search_trace ||
    knowledgeSources ||
    {};

  const sourceOrder = Array.isArray(searchTrace?.source_order)
    ? searchTrace.source_order
    : [];

  const tenantHits = Number(searchTrace?.tenant_hits ?? 0);
  const knowledgeHits = Number(searchTrace?.knowledge_hits ?? 0);
  const benchmarkHits = Number(searchTrace?.benchmark_hits ?? 0);
  const externalHits = Number(searchTrace?.external_hits ?? 0);

  const hasTrace =
    Boolean(sourceLevel) ||
    Boolean(sourceLabel) ||
    Boolean(confidence) ||
    Boolean(traceId) ||
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
    traceId,
    sourceOrder,
    tenantHits,
    knowledgeHits,
    benchmarkHits,
    externalHits,
  };
}

function AiOrchestrationTrace({ result }: { result?: any }) {
  const trace = getAiOrchestrationTrace(result);

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
    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
            Orquestación IA TCDX
          </div>
          <div className="mt-2 text-sm leading-6 text-blue-950">
            Este borrador fue enriquecido por el motor central usando capas de conocimiento y trazabilidad.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-bold ring-1 ${sourceClass}`}>
            Origen: {sourceName}
          </span>

          {trace.confidence && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              Confianza: {trace.confidence}
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


export default function NoConformidadesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando...</div>
        </AppLayout>
      }
    >
      <NoConformidadesPageContent />
    </Suspense>
  );
}

function NoConformidadesPageContent() {
  const { locale } = useTranslation();
  const searchParams = useSearchParams();
  const aiAuditorDraftKey = searchParams.get('draft_key');
  const aiAuditorDraftSource = searchParams.get('source');
  const aiAuditorDraftMode = searchParams.get('draft');
  const [data, setData] = useState<any[]>([]);
  const [actions, setActions] = useState<ActionPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [actionLoading, setActionLoading] = useState<string>('');

  const [iso, setIso] = useState('');
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeResponse>({ standards: [], operations: [] });

  const [aiError, setAiError] = useState('');
  const [aiDraftLoadingId, setAiDraftLoadingId] = useState<string>('');
  const [aiSaveLoadingId, setAiSaveLoadingId] = useState<string>('');
  const [aiApplyLoadingId, setAiApplyLoadingId] = useState<string>('');
  const [aiDraftsByNcId, setAiDraftsByNcId] = useState<
    Record<string, AiNcDraftResponse>
  >({});
  const [expandedNcId, setExpandedNcId] = useState<string>('');
  const [aiAuditorDraft, setAiAuditorDraft] = useState<AiAuditorDraftPayload | null>(null);
  const [aiAuditorDraftMessage, setAiAuditorDraftMessage] = useState('');

  const isAuditor = resolveRole(user) === 'auditor';
  const tenantId = resolveTenantId(user);

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const operationalCodes = useMemo(() => {
    return new Set(operationalStandards.map((s) => s.code).filter(Boolean));
  }, [operationalStandards]);

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
      throw new Error(json?.error || json?.detail || 'Error consultando IA');
    }

    return json;
  };

  const getNcIso = (nc: any) => nc?.iso || nc?.iso_code || iso || '';

  const getNcClause = (nc: any) => String(nc?.clause || '').trim();

  const getNcCategory = (nc: any) => String(nc?.category || 'General').trim();

  const getNcControlDescription = (nc: any) =>
    String(nc?.control_description || '').trim();

  const getNcTitle = (nc: any) => {
    const clause = getNcClause(nc);
    const controlDescription = getNcControlDescription(nc);
    const category = getNcCategory(nc);

    if (clause && controlDescription) {
      return `No conformidad cláusula ${clause} - ${controlDescription}`;
    }

    if (controlDescription) {
      return `No conformidad - ${controlDescription}`;
    }

    if (clause) {
      return `No conformidad cláusula ${clause}`;
    }

    return `No conformidad - ${category}`;
  };

  const getNcDescription = (nc: any) => {
    return (
      getNcControlDescription(nc) ||
      getNcCategory(nc) ||
      'No conformidad sin descripción'
    );
  };

  const getNcSeverity = (nc: any) => {
    if (nc?.status === 'abierta') return 'alta';
    if (nc?.status === 'en progreso') return 'media';
    return 'media';
  };

  const buildAiDraftFallbackInput = (nc: any) => {
    return {
      nonconformity_id: nc.id,
      iso_code: getNcIso(nc),
      title: getNcTitle(nc),
      description: getNcDescription(nc),
      severity: getNcSeverity(nc),
    };
  };

  const buildApplyActionPayload = (nc: any, aiResult?: AiNcDraftResponse | null) => {
    return {
      nonconformity_id: nc.id,
      iso_code: getNcIso(nc),
      nc_title: getNcTitle(nc),
      nc_description: getNcDescription(nc),
      owner: '',
      due_date: null,
      ...(aiResult ? { ai_result: aiResult } : {}),
    };
  };

  const goToActionPlan = (action: ActionPlanRow | null | undefined, actionIso?: string) => {
    if (!action?.id) return;

    const params = new URLSearchParams();
    params.append('id', action.id);

    if (actionIso || action.iso_code || iso) {
      params.append('iso', actionIso || action.iso_code || iso);
    }

    window.location.href = `/plan-accion?${params.toString()}`;
  };

  const saveAiSuggestion = async ({
    nc,
    result,
  }: {
    nc: any;
    result: AiNcDraftResponse;
  }) => {
    try {
      setAiError('');
      setAiSaveLoadingId(nc.id);

      await postWithAuth(`${API_URL}/api/ai-compliance/suggestions/save`, {
        suggestion_type: 'nonconformity_draft',
        source_module: 'nc_module_in_page',
        source_entity_type: 'nonconformity',
        source_entity_id: nc.id,
        title:
          result.ai?.draft_title ||
          `No conformidad IA - ${getNcClause(nc) || 'Sin cláusula'}`,
        input_payload: result.context || buildAiDraftFallbackInput(nc),
        output_payload: result.ai || {},
        confidence: result.ai?.confidence || null,
      });

      alert('Borrador IA guardado correctamente');
    } catch (err: any) {
      console.error('ERROR SAVE AI NC DRAFT:', err);
      setAiError(err.message || 'No fue posible guardar el borrador IA.');
    } finally {
      setAiSaveLoadingId('');
    }
  };

  const createActionPlanFromAiDraft = async (nc: any) => {
    const draft = aiDraftsByNcId[nc.id];
    const aiData = draft?.ai || null;

    if (!aiData) {
      alert('Primero debes generar el borrador IA.');
      return;
    }

    try {
      setAiError('');
      setAiApplyLoadingId(nc.id);

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/apply/nonconformity-draft-to-action-plan`,
        buildApplyActionPayload(nc, draft)
      );

      if (result?.data) {
        await refreshAll();
      }

      alert('Plan de acción generado o reutilizado correctamente desde IA');
    } catch (err: any) {
      console.error('ERROR APPLY AI NC DRAFT TO ACTION PLAN:', err);
      setAiError(
        err.message || 'No fue posible crear una acción desde el borrador IA.'
      );
    } finally {
      setAiApplyLoadingId('');
    }
  };

  const generateNcDraftWithAI = async (nc: any) => {
    try {
      setAiError('');
      setAiDraftLoadingId(nc.id);

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/nonconformity-draft`,
        {
          nonconformity_id: nc.id,
        }
      );

      setAiDraftsByNcId((prev) => ({
        ...prev,
        [nc.id]: result,
      }));
      setExpandedNcId(nc.id);
    } catch (err: any) {
      console.error('ERROR AI NC DRAFT:', err);
      setAiError(err.message || 'No fue posible redactar la no conformidad con IA.');
    } finally {
      setAiDraftLoadingId('');
    }
  };

  const loadScope = async (tenantIdValue: string, authToken: string) => {
    try {
      setLoadingStandards(true);

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${tenantIdValue}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD NC SCOPE:', json);
        setScope({ standards: [], operations: [] });
        setIso('');
        return;
      }

      const nextScope: ScopeResponse = {
        standards: Array.isArray(json?.standards) ? json.standards : [],
        operations: Array.isArray(json?.operations) ? json.operations : [],
      };

      const activeStandards = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      if (activeStandards.length > 0) {
        setIso((prev) => {
          const exists = activeStandards.some((s) => s.code === prev);
          return exists ? prev : activeStandards[0].code;
        });
      } else {
        setIso('');
      }
    } catch (err) {
      console.error('ERROR LOAD NC SCOPE:', err);
      setScope({ standards: [], operations: [] });
      setIso('');
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadNC = async (
    tenantIdValue: string,
    authToken: string,
    selectedIso: string
  ) => {
    try {
      setLoading(true);

      if (!selectedIso) {
        setData([]);
        return;
      }

      if (!operationalCodes.has(selectedIso)) {
        setData([]);
        return;
      }

      const res = await fetch(
        `${API_URL}/api/nonconformities/${tenantIdValue}?iso=${encodeURIComponent(
          selectedIso
        )}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD NC:', json);
        setData([]);
        return;
      }

      const safeRows = Array.isArray(json)
        ? json.filter((row: any) => operationalCodes.has(row.iso || row.iso_code))
        : [];

      setData(safeRows);
    } catch (err) {
      console.error('ERROR LOAD NC:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActions = async (
    tenantIdValue: string,
    authToken: string,
    selectedIso: string
  ) => {
    try {
      setLoadingActions(true);

      if (!selectedIso) {
        setActions([]);
        return;
      }

      if (!operationalCodes.has(selectedIso)) {
        setActions([]);
        return;
      }

      const res = await fetch(
        `${API_URL}/api/action-plans/${tenantIdValue}?iso=${encodeURIComponent(
          selectedIso
        )}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ACTIONS:', json);
        setActions([]);
        return;
      }

      const safeRows = Array.isArray(json)
        ? json.filter((row: any) => operationalCodes.has(row.iso_code || row.control_iso))
        : [];

      setActions(safeRows);
    } catch (err) {
      console.error('ERROR LOAD ACTIONS:', err);
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  };


  useEffect(() => {
    if (aiAuditorDraftSource !== 'ai-auditor' || aiAuditorDraftMode !== '1') return;
    if (!aiAuditorDraftKey) return;

    const draft = readAiAuditorDraftFromSession(aiAuditorDraftKey);

    if (!draft) {
      setAiAuditorDraftMessage('No fue posible leer el borrador preparado por IA Auditor Senior.');
      return;
    }

    setAiAuditorDraft(draft);
    setAiAuditorDraftMessage('Borrador preparado por IA Auditor Senior. Revísalo antes de guardar.');

    const draftISO = draft.standard_code || draft.iso_code;
    if (draftISO) {
      setIso(draftISO);
    }
  }, [aiAuditorDraftSource, aiAuditorDraftMode, aiAuditorDraftKey]);

  const discardAiAuditorDraft = () => {
    clearAiAuditorDraft(aiAuditorDraftKey);
    setAiAuditorDraft(null);
    setAiAuditorDraftMessage('');
  };


  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setUser(u);
    setToken(authToken);

    if (!authToken || !resolveTenantId(u)) {
      setLoading(false);
      setLoadingStandards(false);
      setLoadingActions(false);
      return;
    }

    loadScope(resolveTenantId(u), authToken);
  }, []);

  useEffect(() => {
    if (!token || !tenantId || !iso) {
      if (!loadingStandards) {
        setLoading(false);
        setLoadingActions(false);
      }
      return;
    }

    if (!loadingStandards) {
      loadNC(tenantId, token, iso);
      loadActions(tenantId, token, iso);
    }
  }, [token, tenantId, iso, loadingStandards, operationalCodes]);

  const refreshAll = async () => {
    if (tenantId && token && iso) {
      await Promise.all([
        loadNC(tenantId, token, iso),
        loadActions(tenantId, token, iso),
      ]);
    }
  };

  const update = async (id: string, status: string) => {
    const authToken = localStorage.getItem('token');

    const res = await fetch(`${API_URL}/api/nonconformities/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || 'Error actualizando no conformidad');
      return;
    }

    await refreshAll();
  };

  const createActionFromNC = async (nc: any) => {
    if (!token || !tenantId) return;

    const ncIso = getNcIso(nc);

    if (!operationalCodes.has(iso)) {
      alert('No puedes crear acciones sobre una norma fuera del alcance operativo.');
      return;
    }

    if (ncIso && !operationalCodes.has(ncIso)) {
      alert('La no conformidad pertenece a una norma fuera del alcance operativo.');
      return;
    }

    try {
      setAiError('');
      setActionLoading(nc.id);

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/apply/nonconformity-draft-to-action-plan`,
        buildApplyActionPayload(nc)
      );

      if (result?.data) {
        await refreshAll();
      }

      alert('Plan de acción generado o reutilizado correctamente');
    } catch (err: any) {
      console.error('ERROR CREATE ACTION FROM NC:', err);
      setAiError(err.message || 'Error creando plan de acción');
    } finally {
      setActionLoading('');
    }
  };

  const openActionsByNc = useMemo(() => {
    const map: Record<string, ActionPlanRow> = {};

    actions.forEach((action) => {
      if (!action.nonconformity_id) return;
      if (isClosedAction(action)) return;

      const existing = map[action.nonconformity_id];
      if (!existing) {
        map[action.nonconformity_id] = action;
        return;
      }

      const existingRank = rankActionStatus(existing.status);
      const nextRank = rankActionStatus(action.status);

      if (nextRank < existingRank) {
        map[action.nonconformity_id] = action;
        return;
      }

      const existingUpdatedAt = existing.updated_at || existing.created_at || '';
      const nextUpdatedAt = action.updated_at || action.created_at || '';

      if (nextRank === existingRank && nextUpdatedAt > existingUpdatedAt) {
        map[action.nonconformity_id] = action;
      }
    });

    return map;
  }, [actions]);

  const latestActionsByNc = useMemo(() => {
    const map: Record<string, ActionPlanRow> = {};

    actions.forEach((action) => {
      if (!action.nonconformity_id) return;

      const existing = map[action.nonconformity_id];
      if (!existing) {
        map[action.nonconformity_id] = action;
        return;
      }

      const existingUpdatedAt = existing.updated_at || existing.created_at || '';
      const nextUpdatedAt = action.updated_at || action.created_at || '';

      if (nextUpdatedAt > existingUpdatedAt) {
        map[action.nonconformity_id] = action;
      }
    });

    return map;
  }, [actions]);

  const abiertas = data.filter((d) => d.status !== 'resuelta').length;
  const resueltas = data.filter((d) => d.status === 'resuelta').length;
  const enProgreso = data.filter((d) => d.status === 'en progreso').length;
  const pendientesAprobacion = data.filter(
    (d) => d.status === 'pendiente_aprobacion'
  ).length;

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas operativas...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">No Conformidades</h1>

          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">
              No hay normas operativas para esta empresa
            </h2>

            <p className="text-sm text-gray-700">
              Primero debes dejar una norma activa con al menos una operación activa asignada.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading || loadingActions) {
    return (
      <AppLayout>
        <div className="p-6">Cargando...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">

        {aiAuditorDraft && (
          <div className="rounded-[26px] border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
                  IA Auditor Senior
                </div>
                <div className="mt-1 text-sm font-bold">
                  {aiAuditorDraftMessage || 'Borrador preparado por IA Auditor Senior'}
                </div>
                <div className="mt-1 text-sm leading-6 text-indigo-800">
                  Debe ser revisado y confirmado por un humano antes de guardar. No se creó ninguna no conformidad automáticamente.
                </div>
              </div>
              <button
                type="button"
                onClick={discardAiAuditorDraft}
                className="rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Descartar borrador
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Título sugerido
                </div>
                <div className="mt-2 text-sm font-bold text-slate-800">
                  {aiAuditorDraft.title || '-'}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Prioridad / severidad
                </div>
                <div className="mt-2 text-sm font-bold text-slate-800">
                  {normalizeAiAuditorDraftPriority(aiAuditorDraft.priority || aiAuditorDraft.severity)}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Norma
                </div>
                <div className="mt-2 text-sm font-bold text-slate-800">
                  {aiAuditorDraft.standard_code || aiAuditorDraft.iso_code || '-'}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-indigo-100 bg-white p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Descripción preparada
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {formatAiAuditorDraftDescription(aiAuditorDraft)}
              </pre>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  Gestión de no conformidades
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Alcance operativo + trazabilidad + IA
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                No Conformidades
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                Controla el ciclo completo de la no conformidad: apertura, avance,
                aprobación, evidencia automática y enlace directo al plan correctivo.
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title="Abiertas" value={abiertas} color="red" />
              <MetricCard title="Resueltas" value={resueltas} color="green" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <FilterCard label="Norma">
              <select
                value={iso}
                onChange={(e) => setIso(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                {operationalStandards.map((s) => (
                  <option key={s.code} value={s.code}>
                    {translateStandardLabel(s.code, locale)} - {translateDisplayText(s.name, locale, 'standard')}
                  </option>
                ))}
              </select>
            </FilterCard>

            <MetricInline label="En progreso" value={enProgreso} />
            <MetricInline label="Pend. aprobación" value={pendientesAprobacion} />
            <MetricInline label="Con acción activa" value={Object.keys(openActionsByNc).length} />
            <MetricInline label="Solo lectura" value={isAuditor ? 'Sí' : 'No'} />
          </div>
        </section>

        {aiError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {aiError}
          </div>
        )}

        {data.length === 0 ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            No hay no conformidades registradas para esta norma.
          </div>
        ) : (
          <div className="space-y-5">
            {data.map((nc) => {
              const openLinkedAction = openActionsByNc[nc.id];
              const latestLinkedAction = latestActionsByNc[nc.id];
              const aiDraft = aiDraftsByNcId[nc.id];
              const aiDraftData = aiDraft?.ai || null;
              const canCreateNewAction = !openLinkedAction;
              const actionIso = getNcIso(nc);
              const expanded = expandedNcId === nc.id;

              return (
                <article
                  key={nc.id}
                  className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone="slate">{translateStandardLabel(getNcIso(nc), locale)}</Tag>
                        <Tag tone="amber">{translateClauseLabel(nc.clause || 'Sin cláusula', locale)}</Tag>
                        <StatusChip status={nc.status} locale={locale} />
                        {openLinkedAction && <Tag tone="emerald">Con acción activa</Tag>}
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {translateDisplayText(getNcTitle(nc), locale, 'nonconformity')}
                      </h3>

                      <div className="mt-2 text-sm text-slate-500">
                        Categoría: {translateDisplayText(nc.category || 'General', locale, 'category')}
                      </div>

                      <div className="mt-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {translateDisplayText(getNcDescription(nc), locale, 'nonconformity')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 xl:min-w-[300px]">
                      <MiniInfoCard label="Detectada" value={formatDate(nc.detected_at)} />
                      <MiniInfoCard label="Resuelta" value={formatDate(nc.resolved_at)} />
                      <MiniInfoCard label="Operación" value={translateDisplayText(nc.operation_name || '-', locale, 'operation')} />
                      <MiniInfoCard label="Código op." value={nc.operation_code || '-'} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {!isAuditor && (
                        <>
                          <button
                            onClick={() => createActionFromNC(nc)}
                            disabled={!canCreateNewAction || actionLoading === nc.id}
                            className="rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50"
                          >
                            {!canCreateNewAction
                              ? 'Acción abierta existente'
                              : actionLoading === nc.id
                              ? 'Creando...'
                              : 'Crear acción'}
                          </button>

                          <button
                            type="button"
                            onClick={() => generateNcDraftWithAI(nc)}
                            disabled={aiDraftLoadingId === nc.id}
                            className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                          >
                            {aiDraftLoadingId === nc.id
                              ? 'IA redactando...'
                              : 'IA redactar NC'}
                          </button>
                        </>
                      )}

                      {(openLinkedAction || latestLinkedAction) && (
                        <button
                          type="button"
                          onClick={() =>
                            goToActionPlan(openLinkedAction || latestLinkedAction, actionIso)
                          }
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Abrir plan relacionado
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNcId((prev) => (prev === nc.id ? '' : nc.id))
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                    </div>

                    {isAuditor && nc.status === 'pendiente_aprobacion' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => update(nc.id, 'resuelta')}
                          className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() => update(nc.id, 'en progreso')}
                          className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <select
                        value={nc.status}
                        onChange={(e) => update(nc.id, e.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      >
                        <option value="abierta">{translateStatusLabel('No resuelta', locale)}</option>
                        <option value="en progreso">{translateStatusLabel('en progreso', locale)}</option>
                        <option value="pendiente_aprobacion">{translateStatusLabel('pendiente aprobacion', locale)}</option>
                        <option value="resuelta">{translateStatusLabel('resuelta', locale)}</option>
                      </select>
                    )}
                  </div>

                  {(openLinkedAction || latestLinkedAction) && (
                    <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        Trazabilidad de acción correctiva
                      </div>

                      {openLinkedAction ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag tone="emerald">
                            Plan activo: {translateDisplayText(openLinkedAction.title || openLinkedAction.id, locale, 'actionPlan')}
                          </Tag>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getActionStatusColor(
                              openLinkedAction.status
                            )}`}
                          >
                            {translateStatusLabel(normalizeActionStatus(openLinkedAction.status), locale)}
                          </span>

                          <Tag tone="slate">
                            Prioridad: {translatePriorityLabel(openLinkedAction.priority || 'media', locale)}
                          </Tag>

                          <Tag tone="slate">
                            Evidencias: {openLinkedAction.evidence_count || 0}
                          </Tag>

                          <Tag tone="slate">
                            Aprobadas: {openLinkedAction.approved_evidence_count || 0}
                          </Tag>

                          {typeof openLinkedAction.latest_progress_percent === 'number' && (
                            <Tag tone="blue">
                              Avance: {openLinkedAction.latest_progress_percent}%
                            </Tag>
                          )}
                        </div>
                      ) : latestLinkedAction ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag tone="slate">
                            Última acción: {translateDisplayText(latestLinkedAction.title || latestLinkedAction.id, locale, 'actionPlan')}
                          </Tag>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getActionStatusColor(
                              latestLinkedAction.status
                            )}`}
                          >
                            {translateStatusLabel(normalizeActionStatus(latestLinkedAction.status), locale)}
                          </span>

                          <Tag tone="amber">Cierre anterior detectado</Tag>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {expanded && (
                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <SectionCard title="Detalle de la no conformidad">
                        <DetailRow label="Norma" value={translateStandardLabel(getNcIso(nc), locale)} />
                        <DetailRow label="Cláusula" value={translateClauseLabel(nc.clause || '-', locale)} />
                        <DetailRow label="Categoría" value={translateDisplayText(nc.category || 'General', locale, 'category')} />
                        <DetailRow label="Estado" value={translateStatusLabel(nc.status || '-', locale)} />
                        <DetailRow label="Operación" value={translateDisplayText(nc.operation_name || '-', locale, 'operation')} />
                        <DetailRow label="Tipo operación" value={translateDisplayText(nc.operation_type || '-', locale, 'operation')} />
                        <DetailRow label="Detección" value={formatDateTime(nc.detected_at)} />
                        <DetailRow label="Resolución" value={formatDateTime(nc.resolved_at)} />
                      </SectionCard>

                      {aiDraftData ? (
                        <SectionCard title="Borrador IA de no conformidad">
                          <AiOrchestrationTrace result={aiDraft} />
                          <AiBlock title="Redacción sugerida">
                            {aiDraftData.statement}
                          </AiBlock>

                          <AiBlock title="Evidencia objetiva">
                            {aiDraftData.objective_evidence}
                          </AiBlock>

                          <AiBlock title="Riesgo / impacto">
                            {aiDraftData.risk_statement}
                          </AiBlock>

                          <AiBlock title="Corrección inmediata">
                            {aiDraftData.immediate_correction}
                          </AiBlock>

                          <AiBlock title="Acción correctiva">
                            {aiDraftData.corrective_action}
                          </AiBlock>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {!openLinkedAction && !isAuditor && (
                              <button
                                type="button"
                                onClick={() => createActionPlanFromAiDraft(nc)}
                                disabled={aiApplyLoadingId === nc.id}
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              >
                                {aiApplyLoadingId === nc.id
                                  ? 'Creando...'
                                  : 'Crear acción desde IA'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => saveAiSuggestion({ nc, result: aiDraft })}
                              disabled={aiSaveLoadingId === nc.id}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {aiSaveLoadingId === nc.id
                                ? 'Guardando...'
                                : 'Guardar borrador IA'}
                            </button>
                          </div>
                        </SectionCard>
                      ) : (
                        <SectionCard title="Asistencia IA">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            Genera un borrador IA para estructurar la redacción,
                            evidencia objetiva, riesgo, corrección inmediata y acción
                            correctiva.
                          </div>
                        </SectionCard>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FilterCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricInline({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: 'red' | 'amber' | 'blue' | 'green';
}) {
  const styles =
    color === 'red'
      ? 'bg-red-100 text-red-700 border-red-200'
      : color === 'amber'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : color === 'blue'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-green-100 text-green-700 border-green-200';

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${styles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function MiniInfoCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'slate' | 'amber' | 'emerald' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusChip({ status, locale = 'es' }: { status: string; locale?: string }) {
  const styles =
    status === 'resuelta'
      ? 'bg-green-100 text-green-700 border-green-200'
      : status === 'en progreso'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : status === 'pendiente_aprobacion'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-red-100 text-red-700 border-red-200';

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      {translateStatusLabel(status, locale)}
    </span>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="font-semibold text-slate-600">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function AiBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </div>
      {children}
    </div>
  );
}

function getActionStatusColor(status?: string | null) {
  const normalized = normalizeActionStatus(status);

  if (normalized === 'completado') return 'bg-green-100 text-green-700';
  if (normalized === 'bloqueado') return 'bg-red-100 text-red-700';
  if (normalized === 'en progreso') return 'bg-blue-100 text-blue-700';
  if (normalized === 'cancelado') return 'bg-slate-200 text-slate-700';
  return 'bg-amber-100 text-amber-700';
}
