'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import CompanyProfileImpactPanel from '@/components/company-profile/CompanyProfileImpactPanel';
import { getUserFromToken } from '@/utils/auth';
import { clearAiAuditorDraft, formatAiAuditorDraftDescription, normalizeAiAuditorDraftPriority, readAiAuditorDraftFromSession, type AiAuditorDraftPayload } from '@/utils/aiAuditorDraft';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getComplianceStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel } from '@/i18n/statusLabels';
import { translateDisplayText, translateClauseLabel, translateControlLabel, translateStandardLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type OperationItem = {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  operation_type: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

type ScopeResponse = {
  operations: OperationItem[];
  standards: ScopeStandard[];
};

type ActionPlanEvidence = {
  id: string;
  description?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  status?: string | null;
  validated?: boolean | null;
  created_at?: string | null;
  linked_to_this_plan?: boolean;
};

type ActionPlanUpdate = {
  id: string;
  comment?: string | null;
  progress_percent?: number | null;
  status_after?: string | null;
  blocked_reason?: string | null;
  created_at?: string | null;
};

type ActionPlanItem = {
  id: string;
  tenant_id?: string;
  iso_code?: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  owner?: string;
  due_date?: string | null;
  source_type?: string;
  tenant_control_id?: string | null;
  source_id?: string | null;

  finding_id?: string | null;
  nonconformity_id?: string | null;
  audit_id?: string | null;
  asset_id?: string | null;

  approval_status?: string | null;
  approval_comment?: string | null;

  ai_trace_id?: string | null;
  ai_source_level?: string | null;
  ai_source_label?: string | null;
  ai_confidence?: string | null;
  ai_confidence_score?: number | string | null;
  ai_orchestration_json?: any;
  ai_enhanced_answer_json?: any;

  approval_requested_at?: string | null;
  approval_reviewed_at?: string | null;

  evidence_count?: number;
  approved_evidence_count?: number;
  pending_evidence_count?: number;
  rejected_evidence_count?: number;
  latest_evidence_at?: string | null;
  latest_evidence_status?: string | null;
  evidences_json?: ActionPlanEvidence[];

  updates_count?: number;
  latest_update_at?: string | null;
  latest_progress_percent?: number;
  latest_update_comment?: string | null;
  latest_status_after?: string | null;
  latest_blocked_reason?: string | null;
  updates_json?: ActionPlanUpdate[];

  control_iso?: string | null;
  control_clause?: string | null;
  control_description?: string | null;
  control_category?: string | null;
  tenant_control_status?: string | null;

  finding_title?: string | null;
  finding_type?: string | null;
  finding_severity?: string | null;

  nonconformity_title?: string | null;
  nonconformity_status?: string | null;

  audit_iso?: string | null;
  audit_start_date?: string | null;
  audit_end_date?: string | null;
  audit_auditor_name?: string | null;
  audit_auditor_type?: string | null;

  asset_name?: string | null;
  asset_type?: string | null;
  asset_owner?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
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

function isOperationalStandard(s: ScopeStandard) {
  return (
    (s?.is_active === true || s?.is_active === 'true' || s?.is_active === 1) &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function normalizeStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase().trim();

  if (['en progreso', 'in_progress', 'in progress'].includes(raw)) {
    return 'en progreso';
  }

  if (['bloqueado', 'blocked'].includes(raw)) {
    return 'bloqueado';
  }

  if (['completado', 'completed', 'cerrado', 'closed'].includes(raw)) {
    return 'completado';
  }

  if (['cancelado', 'cancelled'].includes(raw)) {
    return 'cancelado';
  }

  return 'abierto';
}

function normalizeApproval(value?: string | null) {
  const raw = String(value || '').toLowerCase().trim();

  if (raw === 'pendiente_aprobacion') return 'pendiente_aprobacion';
  if (raw === 'aprobada') return 'aprobada';
  if (raw === 'devuelta') return 'devuelta';

  return 'no_requerida';
}



function getApprovalDisplayLabel(value: string | null | undefined, t: (key: string) => string) {
  const normalized = normalizeApproval(value);
  const keyByStatus: Record<string, string> = {
    no_requerida: 'status.actionPlan.notRequired',
    pendiente_aprobacion: 'status.actionPlan.pendingApproval',
    aprobada: 'status.actionPlan.approved',
    devuelta: 'status.actionPlan.returned',
  };

  const key = keyByStatus[normalized];
  if (!key) return String(value || '');

  const translated = t(key);
  return translated !== key ? translated : String(value || '');
}

function getApprovalStatusLabel(value: string | null | undefined, t: (key: string) => string) {
  return getActionPlanStatusLabel(normalizeApproval(value), t);
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


function aiSafeText(value: any, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function getActionPlanAiTrace(row: ActionPlanItem) {
  const orchestration = row.ai_orchestration_json || {};
  const answer = row.ai_enhanced_answer_json || {};
  const searchTrace = orchestration?.search_trace || {};

  const sourceLevel = aiSafeText(
    row.ai_source_level ||
      orchestration?.source_level ||
      answer?.source_level ||
      ''
  );

  const sourceLabel = aiSafeText(
    row.ai_source_label ||
      orchestration?.source_label ||
      answer?.source_label ||
      ''
  );

  const confidence = aiSafeText(
    row.ai_confidence ||
      orchestration?.confidence ||
      answer?.confidence ||
      ''
  );

  const confidenceScore =
    row.ai_confidence_score ||
    orchestration?.confidence_score ||
    answer?.confidence_score ||
    null;

  const traceId = aiSafeText(
    row.ai_trace_id ||
      orchestration?.trace?.id ||
      ''
  );

  const sourceOrder = Array.isArray(searchTrace?.source_order)
    ? searchTrace.source_order
    : [];

  const tenantHits = Number(searchTrace?.tenant_hits ?? 0);
  const knowledgeHits = Number(searchTrace?.knowledge_hits ?? 0);
  const benchmarkHits = Number(searchTrace?.benchmark_hits ?? 0);
  const externalHits = Number(searchTrace?.external_hits ?? 0);

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
    executiveSummary: aiSafeText(answer?.executive_summary || ''),
    recommendation: aiSafeText(answer?.recommendation || ''),
    suggestedEvidence: Array.isArray(answer?.suggested_evidence)
      ? answer.suggested_evidence
      : [],
    nextSteps: Array.isArray(answer?.next_steps)
      ? answer.next_steps
      : [],
  };
}

function ActionPlanAiTraceCard({ row }: { row: ActionPlanItem }) {
  const trace = getActionPlanAiTrace(row);

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
    <div className="rounded-[26px] border border-blue-200 bg-blue-50 p-4 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
            Orquestación IA TCDX
          </div>

          <div className="mt-2 text-sm leading-6 text-blue-950">
            Este plan de acción conserva trazabilidad del motor IA usado para generar o enriquecer la recomendación.
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

      {(trace.executiveSummary || trace.recommendation) && (
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {trace.executiveSummary && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <div className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Resumen IA
              </div>
              <div className="text-sm leading-6 text-slate-700">
                {trace.executiveSummary}
              </div>
            </div>
          )}

          {trace.recommendation && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <div className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Recomendación IA
              </div>
              <div className="text-sm leading-6 text-slate-700">
                {trace.recommendation}
              </div>
            </div>
          )}
        </div>
      )}

      {(trace.suggestedEvidence.length > 0 || trace.nextSteps.length > 0) && (
        <details className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            Ver evidencias sugeridas y próximos pasos IA
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {trace.suggestedEvidence.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Evidencia sugerida
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.suggestedEvidence.slice(0, 8).map((item: string, index: number) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trace.nextSteps.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Próximos pasos
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.nextSteps.slice(0, 8).map((item: string, index: number) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}


export default function PlanAccionPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando planes de acción...</div>
        </AppLayout>
      }
    >
      <PlanAccionPageContent />
    </Suspense>
  );
}

function PlanAccionPageContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();

  const focusId = searchParams.get('id') || '';
  const focusISO = searchParams.get('iso') || '';
  const focusTenantControlId = searchParams.get('tenant_control_id') || '';
  const focusControlId = searchParams.get('control_id') || '';
  const aiAuditorDraftKey = searchParams.get('draft_key');
  const aiAuditorDraftSource = searchParams.get('source');
  const aiAuditorDraftMode = searchParams.get('draft');

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [scope, setScope] = useState<ScopeResponse>({
    operations: [],
    standards: [],
  });

  const [selectedISO, setSelectedISO] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState<ActionPlanItem[]>([]);

  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [openingFromControl, setOpeningFromControl] = useState(false);
  const [highlightPlanId, setHighlightPlanId] = useState('');
  const [expandedPlanId, setExpandedPlanId] = useState('');
  const [aiAuditorDraft, setAiAuditorDraft] = useState<AiAuditorDraftPayload | null>(null);
  const [aiAuditorDraftMessage, setAiAuditorDraftMessage] = useState('');

  const alreadyTriggeredQuickOpen = useRef(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'media',
    owner: '',
    due_date: '',
  });

  const tenantId = resolveTenantId(user);
  const isReadOnly = String(user?.role || '').toLowerCase() === 'auditor';

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);


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

    setForm((prev) => ({
      ...prev,
      title: draft.title || prev.title,
      description: formatAiAuditorDraftDescription(draft) || prev.description,
      priority: normalizeAiAuditorDraftPriority(draft.priority || draft.severity),
    }));

    const draftISO = draft.standard_code || draft.iso_code;
    if (draftISO) {
      setSelectedISO(draftISO);
    }
  }, [aiAuditorDraftSource, aiAuditorDraftMode, aiAuditorDraftKey]);

  const discardAiAuditorDraft = () => {
    clearAiAuditorDraft(aiAuditorDraftKey);
    setAiAuditorDraft(null);
    setAiAuditorDraftMessage('');
    setForm((prev) => ({
      ...prev,
      title: '',
      description: '',
      priority: 'media',
    }));
  };


  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (!authToken || !resolveTenantId(u)) {
      setLoadingStandards(false);
      setLoadingData(false);
    }
  }, []);

  const loadScope = async (resolvedTenantId: string, authToken: string) => {
    try {
      setLoadingStandards(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/tenant-standards/scope/${resolvedTenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ACTION PLAN SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setSelectedISO('');
        setErrorMessage(json?.error || 'No fue posible cargar normas operativas.');
        return;
      }

      const nextScope: ScopeResponse = {
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      };

      const activeStandards = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      if (activeStandards.length > 0) {
        setSelectedISO((prev: string) => {
          const preferred =
            activeStandards.find((s: ScopeStandard) => s.code === focusISO)?.code ||
            prev;

          const exists = activeStandards.some(
            (s: ScopeStandard) => s.code === preferred
          );

          return exists ? preferred : activeStandards[0].code;
        });
      } else {
        setSelectedISO('');
      }
    } catch (err: any) {
      console.error('ERROR LOAD ACTION PLAN SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setSelectedISO('');
      setErrorMessage(err?.message || 'Error cargando normas operativas.');
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadPlans = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string,
    status?: string
  ) => {
    try {
      setLoadingData(true);
      setErrorMessage('');

      const params = new URLSearchParams();
      if (iso) params.append('iso', iso);
      if (status) params.append('status', status);

      const res = await fetch(
        `${API_URL}/api/action-plans/${resolvedTenantId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ACTION PLANS:', json);
        setData([]);
        setErrorMessage(json?.error || 'No fue posible cargar planes de acción.');
        return;
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err: any) {
      console.error('ERROR LOAD ACTION PLANS:', err);
      setData([]);
      setErrorMessage(err?.message || 'Error cargando planes de acción.');
    } finally {
      setLoadingData(false);
    }
  };

  const openOrCreatePlanFromControl = async (
    resolvedTenantId: string,
    authToken: string,
    tenantControlId: string,
    isoCode: string
  ) => {
    try {
      setOpeningFromControl(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${tenantControlId}/quick-action-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            tenant_id: resolvedTenantId,
            iso_code: isoCode || undefined,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(
          json?.detail || json?.error || 'No fue posible abrir el plan de acción.'
        );
        return;
      }

      const actionPlan = json?.action_plan;
      if (actionPlan?.id) {
        setHighlightPlanId(actionPlan.id);
        setExpandedPlanId(actionPlan.id);

        if (actionPlan.iso_code) {
          setSelectedISO(actionPlan.iso_code);
          await loadPlans(
            resolvedTenantId,
            authToken,
            actionPlan.iso_code,
            statusFilter
          );
        } else if (isoCode) {
          await loadPlans(resolvedTenantId, authToken, isoCode, statusFilter);
        }
      }
    } catch (err: any) {
      console.error('ERROR QUICK ACTION PLAN:', err);
      setErrorMessage(
        err?.message || 'Error abriendo plan de acción desde control.'
      );
    } finally {
      setOpeningFromControl(false);
    }
  };

  useEffect(() => {
    if (!token || !tenantId) return;
    void loadScope(tenantId, token);
  }, [token, tenantId]);

  useEffect(() => {
    if (!token || !tenantId || !selectedISO) {
      if (!loadingStandards) setLoadingData(false);
      return;
    }

    void loadPlans(tenantId, token, selectedISO, statusFilter);
  }, [token, tenantId, selectedISO, statusFilter, loadingStandards]);

  useEffect(() => {
    if (!token || !tenantId || loadingStandards) return;
    if (!focusTenantControlId) return;
    if (alreadyTriggeredQuickOpen.current) return;
    if (!selectedISO && !focusISO) return;

    alreadyTriggeredQuickOpen.current = true;

    void openOrCreatePlanFromControl(
      tenantId,
      token,
      focusTenantControlId,
      focusISO || selectedISO
    );
  }, [
    token,
    tenantId,
    loadingStandards,
    focusTenantControlId,
    focusISO,
    selectedISO,
  ]);

  useEffect(() => {
    if (!focusTenantControlId && focusId) {
      setHighlightPlanId(focusId);
      setExpandedPlanId(focusId);
    }
  }, [focusId, focusTenantControlId]);

  useEffect(() => {
    if (!highlightPlanId || loadingData) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`action-plan-${highlightPlanId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [highlightPlanId, loadingData, data]);

  const save = async () => {
    if (!token || !tenantId) return;
    if (creating) return;

    if (!selectedISO) {
      alert('Debes seleccionar una norma');
      return;
    }

    if (!form.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          iso_code: selectedISO,
          title: form.title,
          description: form.description,
          priority: form.priority,
          owner: form.owner,
          due_date: form.due_date || null,
          source_type: 'manual',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando plan');
        return;
      }

      setForm({
        title: '',
        description: '',
        priority: 'media',
        owner: '',
        due_date: '',
      });

      await loadPlans(tenantId, token, selectedISO, statusFilter);

      if (json?.id) {
        setHighlightPlanId(json.id);
        setExpandedPlanId(json.id);
      }
    } catch (err) {
      console.error('ERROR CREATE ACTION PLAN:', err);
      alert('Error creando plan');
    } finally {
      setCreating(false);
    }
  };

  const updatePlan = async (row: ActionPlanItem, patch: Partial<ActionPlanItem>) => {
    if (!token) return;

    try {
      setSavingId(row.id);

      const res = await fetch(`${API_URL}/api/action-plans/${row.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: patch.title ?? row.title,
          description: patch.description ?? row.description,
          priority: patch.priority ?? row.priority,
          status: patch.status ?? row.status,
          owner: patch.owner ?? row.owner,
          due_date: patch.due_date ?? row.due_date,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error actualizando plan');
        return;
      }

      setData((prev: ActionPlanItem[]) =>
        prev.map((p: ActionPlanItem) => (p.id === row.id ? json : p))
      );
    } catch (err) {
      console.error('ERROR UPDATE ACTION PLAN:', err);
      alert('Error actualizando plan');
    } finally {
      setSavingId('');
    }
  };

  const deletePlan = async (id: string) => {
    if (!token) return;

    const ok = confirm('¿Eliminar este plan de acción?');
    if (!ok) return;

    const res = await fetch(`${API_URL}/api/action-plans/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || 'Error eliminando plan');
      return;
    }

    setData((prev: ActionPlanItem[]) =>
      prev.filter((p: ActionPlanItem) => p.id !== id)
    );
  };

  const metrics = useMemo(() => {
    return {
      total: data.length,
      abiertos: data.filter((d: ActionPlanItem) => normalizeStatus(d.status) === 'abierto')
        .length,
      progreso: data.filter((d: ActionPlanItem) => normalizeStatus(d.status) === 'en progreso')
        .length,
      completados: data.filter((d: ActionPlanItem) => normalizeStatus(d.status) === 'completado')
        .length,
      bloqueados: data.filter((d: ActionPlanItem) => normalizeStatus(d.status) === 'bloqueado')
        .length,
      aprobacionPendiente: data.filter(
        (d: ActionPlanItem) => normalizeApproval(d.approval_status) === 'pendiente_aprobacion'
      ).length,
    };
  }, [data]);

  const priorityColor = (value?: string | null) => {
    if (value === 'alta') return 'text-red-600';
    if (value === 'media') return 'text-amber-600';
    return 'text-emerald-600';
  };

  const statusBadge = (value?: string | null) => {
    const normalized = normalizeStatus(value);

    if (normalized === 'abierto') {
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    }

    if (normalized === 'en progreso') {
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    }

    if (normalized === 'bloqueado') {
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    }

    if (normalized === 'completado') {
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }

    return 'bg-rose-100 text-rose-700 border border-rose-200';
  };

  const approvalBadge = (value?: string | null) => {
    const normalized = normalizeApproval(value);

    if (normalized === 'pendiente_aprobacion') {
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    }

    if (normalized === 'aprobada') {
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }

    if (normalized === 'devuelta') {
      return 'bg-rose-100 text-rose-700 border border-rose-200';
    }

    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const getSourceLabel = (row: ActionPlanItem) => {
    switch (row.source_type) {
      case 'finding':
        return 'Hallazgo';
      case 'nonconformity':
        return 'No conformidad';
      case 'audit':
        return 'Auditoría';
      case 'risk':
        return 'Riesgo / activo';
      case 'control':
        return 'Control';
      case 'ia':
        return 'IA';
      default:
        return 'Manual';
    }
  };

  const getSourceDetail = (row: ActionPlanItem) => {
    if (row.finding_title) {
      return `Hallazgo: ${row.finding_title}`;
    }

    if (row.nonconformity_title) {
      return `NC: ${row.nonconformity_title}`;
    }

    if (row.asset_name) {
      return `Activo: ${row.asset_name}${row.asset_type ? ` (${row.asset_type})` : ''}`;
    }

    if (row.audit_iso) {
      return `Auditoría ${row.audit_iso}${row.audit_auditor_name ? ` · ${row.audit_auditor_name}` : ''}`;
    }

    if (row.control_description || row.control_clause) {
      return `${row.control_iso || row.iso_code} ${row.control_clause || ''} — ${row.control_description || 'Control vinculado'}`.trim();
    }

    return 'Plan de acción manual';
  };

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">{t('actionPlan.loadingStandards')}</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{t('actionPlan.title')}</h1>

          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">
              {t('actionPlan.noOperationalStandards')}
            </h2>

            <p className="text-sm text-gray-700">
              {t('actionPlan.noOperationalStandardsHelp')}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  {t('actionPlan.eyebrow')}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('actionPlan.badge')}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t('actionPlan.title')}
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                {t('actionPlan.subtitle')}
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-3">
              <MetricCard title={t('common.all')} value={metrics.total} tone="slate" />
              <MetricCard title={t('actionPlan.statuses.inProgress')} value={metrics.progreso} tone="blue" />
              <MetricCard
                title={t('actionPlan.pendingApproval')}
                value={metrics.aprobacionPendiente}
                tone="amber"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4 xl:grid-cols-5">
            <FilterCard label={t('dashboard.standard')}>
              <select
                value={selectedISO}
                onChange={(e) => setSelectedISO(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                {operationalStandards.map((s: ScopeStandard) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </FilterCard>

            <FilterCard label={t('common.status')}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="">{t('actionPlan.allStatuses')}</option>
                <option value="abierto">{t('statuses.findings.abierto')}</option>
                <option value="en progreso">{t('actionPlan.statuses.inProgress')}</option>
                <option value="bloqueado">{t('actionPlan.statuses.blocked')}</option>
                <option value="completado">{t('actionPlan.statuses.completed')}</option>
                <option value="cancelado">{t('statuses.audits.cancelada')}</option>
              </select>
            </FilterCard>

            <MetricInline label={t('statuses.findings.abierto')} value={metrics.abiertos} />
            <MetricInline label={t('actionPlan.statuses.completed')} value={metrics.completados} />
            <MetricInline label={t('actionPlan.statuses.blocked')} value={metrics.bloqueados} />
          </div>
        </section>

        <CompanyProfileImpactPanel
          moduleCode="action-plans"
          title="Recomendaciones de planes por Perfil Empresa"
          compact
        />

        {(errorMessage || openingFromControl || focusTenantControlId || focusControlId) && (
          <div className="space-y-3">
            {focusTenantControlId && (
              <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700 shadow-sm">
                Flujo iniciado desde Controles.
                {focusControlId ? ` Control catálogo: ${focusControlId}.` : ''}
              </div>
            )}

            {openingFromControl && (
              <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 shadow-sm">
                Abriendo o creando plan de acción asociado al control...
              </div>
            )}

            {errorMessage && (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {!isReadOnly && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {t('actionPlan.createManual')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('actionPlan.createManualHelp')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-4">
                <FieldBlock label={t('actionPlan.fields.title')}>
                  <input
                    placeholder={t('actionPlan.placeholders.title')}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </FieldBlock>

                <FieldBlock label={t('actionPlan.fields.description')}>
                  <textarea
                    placeholder={t('actionPlan.placeholders.description')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </FieldBlock>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldBlock label={t('actionPlan.fields.priority')}>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="alta">{t('statuses.findings.alto')}</option>
                      <option value="media">{t('statuses.findings.medio')}</option>
                      <option value="baja">{t('statuses.findings.bajo')}</option>
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t('actionPlan.fields.owner')}>
                    <input
                      placeholder={t('actionPlan.placeholders.owner')}
                      value={form.owner}
                      onChange={(e) => setForm({ ...form, owner: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                    />
                  </FieldBlock>
                </div>

                <FieldBlock label={t('actionPlan.fields.dueDate')}>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </FieldBlock>

                <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700">
                  {t('actionPlanLabels.fields.selectedStandard')}: <strong>{selectedISO || '—'}</strong>
                </div>

                <button
                  onClick={save}
                  disabled={creating}
                  className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creating ? t('common.saving') : t('actionPlanLabels.buttons.savePlan')}
                </button>
              </div>
            </div>
          </section>
        )}

        {loadingData ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            Cargando planes...
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            No hay planes de acción para esta norma.
          </div>
        ) : (
          <div className="space-y-5">
            {data.map((row: ActionPlanItem) => {
              const isHighlighted = row.id === highlightPlanId;
              const isExpanded = expandedPlanId === row.id;

              return (
                <article
                  key={row.id}
                  id={`action-plan-${row.id}`}
                  className={`rounded-[30px] border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all ${
                    isHighlighted
                      ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/40'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone="slate">{translateStandardLabel(row.iso_code, locale)}</Tag>
                        <Tag tone="blue">{getCategoryLabel(getSourceLabel(row), t)}</Tag>
                        <Tag tone="violet">{getActionPlanStatusLabel(normalizeStatus(row.status), t)}</Tag>
                        <Tag tone="amber">{getPriorityLabel(row.priority || 'media', t)}</Tag>
                        <Tag tone="emerald">
                          {t('actionPlanLabels.fields.progress')} {Number(row.latest_progress_percent || 0)}%
                        </Tag>
                        <Tag tone="rose">
                          {t('actionPlanLabels.fields.pendingEvidence')} {Number(row.evidence_count || 0)}
                        </Tag>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${approvalBadge(
                            row.approval_status
                          )}`}
                        >
                          {getApprovalDisplayLabel(row.approval_status, t)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {translateDisplayText(row.title, locale, 'actionPlan')}
                      </h3>

                      <div className="mt-2 text-sm text-slate-500">
                        {getSourceDetail(row)}
                      </div>

                      <div className="mt-4 rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                        {translateDisplayText(row.description || 'Sin descripción', locale, 'actionPlan')}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 xl:min-w-[300px]">
                      <MiniInfoCard label={t('actionPlanLabels.fields.responsible')} value={row.owner || '-'} />
                      <MiniInfoCard
                        label={t('actionPlanLabels.fields.dueDate')}
                        value={row.due_date ? String(row.due_date).slice(0, 10) : '-'}
                      />
                      <MiniInfoCard
                        label={t('actionPlanLabels.fields.priority')}
                        value={
                          <span className={priorityColor(row.priority)}>
                            {getPriorityLabel(row.priority, t) || '-'}
                          </span>
                        }
                      />
                      <MiniInfoCard
                        label={t('actionPlanLabels.fields.lastUpdate')}
                        value={formatDate(row.latest_update_at || row.updated_at)}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <FieldBlock label={t('actionPlanLabels.fields.status')}>
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {getActionPlanStatusLabel(normalizeStatus(row.status), t)}
                        </div>
                      ) : (
                        <select
                          value={normalizeStatus(row.status)}
                          onChange={(e) => updatePlan(row, { status: e.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          <option value="abierto">{getActionPlanStatusLabel('abierto', t)}</option>
                          <option value="en progreso">{getActionPlanStatusLabel('en progreso', t)}</option>
                          <option value="bloqueado">{getActionPlanStatusLabel('bloqueado', t)}</option>
                          <option value="completado">{getActionPlanStatusLabel('completado', t)}</option>
                          <option value="cancelado">{getActionPlanStatusLabel('cancelado', t)}</option>
                        </select>
                      )}
                    </FieldBlock>

                    <FieldBlock label={t('actionPlanLabels.fields.responsible')}>
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.owner || '-'}
                        </div>
                      ) : (
                        <input
                          value={row.owner || ''}
                          onChange={(e) =>
                            setData((prev: ActionPlanItem[]) =>
                              prev.map((p: ActionPlanItem) =>
                                p.id === row.id ? { ...p, owner: e.target.value } : p
                              )
                            )
                          }
                          onBlur={() => {
                            const updated = data.find(
                              (p: ActionPlanItem) => p.id === row.id
                            );
                            void updatePlan(row, { owner: updated?.owner || '' });
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      )}
                    </FieldBlock>

                    <FieldBlock label={t('actionPlanLabels.fields.dueDate')}>
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.due_date ? String(row.due_date).slice(0, 10) : '-'}
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={row.due_date ? String(row.due_date).slice(0, 10) : ''}
                          onChange={(e) =>
                            setData((prev: ActionPlanItem[]) =>
                              prev.map((p: ActionPlanItem) =>
                                p.id === row.id ? { ...p, due_date: e.target.value } : p
                              )
                            )
                          }
                          onBlur={() => {
                            const updated = data.find(
                              (p: ActionPlanItem) => p.id === row.id
                            );
                            void updatePlan(row, {
                              due_date: updated?.due_date || null,
                            });
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      )}
                    </FieldBlock>

                    <FieldBlock label={t('actionPlanLabels.fields.closingApproval')}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold ${approvalBadge(
                          row.approval_status
                        )}`}
                      >
                        {getApprovalDisplayLabel(row.approval_status, t)}
                      </div>
                    </FieldBlock>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <ProgressStat
                      label={t('actionPlanLabels.fields.progress')}
                      value={`${Number(row.latest_progress_percent || 0)}%`}
                    />
                    <ProgressStat
                      label={t('actionPlanLabels.fields.approvedEvidence')}
                      value={Number(row.approved_evidence_count || 0)}
                    />
                    <ProgressStat
                      label={t('actionPlanLabels.fields.pendingEvidence')}
                      value={Number(row.pending_evidence_count || 0)}
                    />
                    <ProgressStat
                      label={t('actionPlanLabels.fields.followUps')}
                      value={Number(row.updates_count || 0)}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlanId((prev) => (prev === row.id ? '' : row.id))
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {isExpanded ? t('actionPlanLabels.buttons.hideDetail') : t('actionPlanLabels.buttons.viewDetail')}
                    </button>

                    {row.id && (
                      <a
                        href={`/evidencias?iso=${encodeURIComponent(
                          row.iso_code || selectedISO
                        )}&action_plan_id=${encodeURIComponent(row.id)}${
                          row.tenant_control_id
                            ? `&tenant_control_id=${encodeURIComponent(row.tenant_control_id)}`
                            : ''
                        }`}
                        className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >{t('actionPlanLabels.buttons.viewEvidence')}</a>
                    )}

                    {!isReadOnly && (
                      <button
                        onClick={() => void deletePlan(row.id)}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >{t('actionPlanLabels.buttons.delete')}</button>
                    )}

                    {savingId === row.id && (
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                        Guardando...
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <ActionPlanAiTraceCard row={row} />

                      <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">{t('actionPlanLabels.sections.planContext')}</div>

                        <DetailRow label={t('actionPlanLabels.fields.source')} value={getCategoryLabel(getSourceLabel(row), t)} />
                        <DetailRow label={t('actionPlanLabels.fields.sourceDetail')} value={translateDisplayText(getSourceDetail(row), locale, 'actionPlan')} />
                        <DetailRow
                          label={t('actionPlanLabels.fields.linkedControl')}
                          value={
                            row.control_description || row.control_clause
                              ? `${translateStandardLabel(row.control_iso || row.iso_code, locale)} ${translateClauseLabel(row.control_clause || '', locale)} — ${translateControlLabel(row.control_description || 'Control', locale)}`
                              : '-'
                          }
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.controlStatus')}
                          value={getComplianceStatusLabel(row.tenant_control_status, t) || '-'}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.lastComment')}
                          value={translateDisplayText(row.latest_update_comment || '-', locale, 'actionPlan')}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.lastBlock')}
                          value={translateDisplayText(row.latest_blocked_reason || '-', locale, 'actionPlan')}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.createdAt')}
                          value={formatDateTime(row.created_at)}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.updatedAt')}
                          value={formatDateTime(row.updated_at)}
                        />
                      </div>

                      <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">{t('actionPlanLabels.sections.evidenceAndFollowUp')}</div>

                        <DetailRow
                          label={t('actionPlanLabels.fields.latestEvidence')}
                          value={formatDateTime(row.latest_evidence_at)}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.lastEvidenceStatus')}
                          value={getEvidenceStatusLabel(row.latest_evidence_status, t) || '-'}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.approvalRequest')}
                          value={formatDateTime(row.approval_requested_at)}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.approvalReview')}
                          value={formatDateTime(row.approval_reviewed_at)}
                        />
                        <DetailRow
                          label={t('actionPlanLabels.fields.approvalComment')}
                          value={row.approval_comment || '-'}
                        />

                        {Array.isArray(row.updates_json) && row.updates_json.length > 0 && (
                          <div className="pt-2">
                            <div className="mb-2 text-sm font-semibold text-slate-700">{t('actionPlanLabels.sections.latestFollowUps')}</div>
                            <div className="space-y-2">
                              {row.updates_json.slice(0, 3).map((upd) => (
                                <div
                                  key={upd.id}
                                  className="rounded-2xl border border-slate-200 bg-white p-3"
                                >
                                  <div className="text-sm font-medium text-slate-800">
                                    {upd.comment || 'Sin comentario'}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {formatDateTime(upd.created_at)} · {t('actionPlanLabels.fields.status')}:{' '}
                                    {getActionPlanStatusLabel(upd.status_after, t) || '-'} · {t('actionPlanLabels.fields.progress')}:{' '}
                                    {Number(upd.progress_percent || 0)}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {Array.isArray(row.evidences_json) && row.evidences_json.length > 0 && (
                          <div className="pt-2">
                            <div className="mb-2 text-sm font-semibold text-slate-700">{t('actionPlanLabels.sections.recentEvidence')}</div>
                            <div className="space-y-2">
                              {row.evidences_json.slice(0, 3).map((ev) => (
                                <div
                                  key={ev.id}
                                  className="rounded-2xl border border-slate-200 bg-white p-3"
                                >
                                  <div className="text-sm font-medium text-slate-800">
                                    {ev.file_name || translateDisplayText(ev.description || 'Evidencia', locale, 'evidence')}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {formatDateTime(ev.created_at)} · {t('actionPlanLabels.fields.status')}:{' '}
                                    {getEvidenceStatusLabel(ev.status, t) || '-'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
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
  tone,
}: {
  title: string;
  value: string | number;
  tone: 'slate' | 'blue' | 'amber';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white',
    blue: 'border-blue-200 bg-blue-50',
    amber: 'border-amber-200 bg-amber-50',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function MiniInfoCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ProgressStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="font-semibold text-slate-600">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'slate' | 'blue' | 'violet' | 'amber' | 'rose' | 'emerald';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
