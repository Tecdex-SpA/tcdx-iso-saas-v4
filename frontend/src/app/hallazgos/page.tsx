'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { clearAiAuditorDraft, formatAiAuditorDraftDescription, normalizeAiAuditorDraftPriority, readAiAuditorDraftFromSession, type AiAuditorDraftPayload } from '@/utils/aiAuditorDraft';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel } from '@/i18n/statusLabels';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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

type AiFindingAnalysisResponse = {
  ok: boolean;
  context?: any;
  ai?: {
    summary: string;
    impact: string;
    priority: string;
    likely_causes: string[];
    recommended_actions: string[];
    confidence?: string;
  };
};

type AiActionPlanSuggestionResponse = {
  ok: boolean;
  context?: any;
  ai?: {
    priority: string;
    objective: string;
    immediate_actions: string[];
    action_plan: Array<{
      step: number;
      title: string;
      owner_role: string;
      target_days: number;
      description: string;
    }>;
    success_criteria: string[];
    confidence?: string;
  };
};

type ActionPlanRow = {
  id: string;
  finding_id?: string | null;
  status?: string | null;
  title?: string | null;
  priority?: string | null;
  approval_status?: string | null;
  owner?: string | null;
  due_date?: string | null;
  iso_code?: string | null;
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

export default function HallazgosPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando hallazgos...</div>
        </AppLayout>
      }
    >
      <HallazgosPageContent />
    </Suspense>
  );
}

function HallazgosPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');
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
  const [typeFilter, setTypeFilter] = useState('');

  const [controls, setControls] = useState<any[]>([]);
  const [loadingControls, setLoadingControls] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [actions, setActions] = useState<ActionPlanRow[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [savingId, setSavingId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [creatingFinding, setCreatingFinding] = useState(false);
  const [aiAuditorDraft, setAiAuditorDraft] = useState<AiAuditorDraftPayload | null>(null);
  const [aiAuditorDraftMessage, setAiAuditorDraftMessage] = useState('');

  const [focusedFindingId, setFocusedFindingId] = useState<string>('');
  const [focusMessage, setFocusMessage] = useState('');
  const [autoFindingFocus, setAutoFindingFocus] = useState(false);
  const [focusResolved, setFocusResolved] = useState(false);

  const [aiError, setAiError] = useState('');
  const [aiLoadingById, setAiLoadingById] = useState<Record<string, string>>({});
  const [aiSaveLoadingId, setAiSaveLoadingId] = useState<string>('');
  const [aiApplyLoadingId, setAiApplyLoadingId] = useState<string>('');
  const [aiAnalysisById, setAiAnalysisById] = useState<
    Record<string, AiFindingAnalysisResponse>
  >({});
  const [aiPlanById, setAiPlanById] = useState<
    Record<string, AiActionPlanSuggestionResponse>
  >({});

  const searchedStandardsRef = useRef<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: '',
    description: '',
    finding_type: 'observacion',
    severity: 'media',
    owner: '',
    detected_by: '',
    due_date: '',
    tenant_control_id: '',
  });

  const tenantId = resolveTenantId(user);
  const isReadOnly = String(user?.role || '').toLowerCase() === 'auditor';

  const operationalStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const operationalStandardCodes = useMemo(() => {
    return new Set(operationalStandards.map((s) => s.code).filter(Boolean));
  }, [operationalStandards]);


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
      severity: normalizeAiAuditorDraftPriority(draft.severity || draft.priority),
      tenant_control_id: draft.tenant_control_id || prev.tenant_control_id,
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
      severity: 'media',
      tenant_control_id: '',
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
      setLoadingControls(false);
      setLoadingActions(false);
    }
  }, []);

  useEffect(() => {
    searchedStandardsRef.current = new Set();
    setFocusResolved(false);
    setFocusedFindingId('');
    setFocusMessage('');
  }, [focusId, focusISO]);

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


  const asTextArray = (value: any): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item?.title && item?.description) return `${item.title}: ${item.description}`;
          if (item?.description) return item.description;
          if (item?.name) return item.name;
          return String(item || '');
        })
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  };

  const firstValue = (...values: any[]) => {
    return values.find((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
  };

  const safeAiText = (value: any): string => {
    if (value === undefined || value === null || value === '') return '';

    if (typeof value === 'string') return value;

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => safeAiText(item))
        .filter(Boolean)
        .join(' · ');
    }

    if (typeof value === 'object') {
      if (value.title && value.description) {
        return `${safeAiText(value.title)}: ${safeAiText(value.description)}`;
      }

      if (value.description) return safeAiText(value.description);
      if (value.summary) return safeAiText(value.summary);
      if (value.name) return safeAiText(value.name);
      if (value.label) return safeAiText(value.label);
      if (value.value) return safeAiText(value.value);

      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }

    return String(value || '');
  };

  const getGuidedAi = (response: any) => {
    const ai = response?.ai || response || {};
    const structured =
      ai?.structured_guided ||
      ai?.guided_solution ||
      ai?.guided ||
      ai?.solution_guided ||
      {};

    const solution = structured?.solution || ai?.solution || {};
    const problem = structured?.problem || ai?.problem || {};
    const domain = structured?.domain || ai?.domain || {};
    const scenario = structured?.scenario || ai?.scenario || {};
    const contextSummary =
      structured?.context_summary ||
      ai?.context_summary ||
      ai?.context?.summary ||
      '';

    return {
      hasGuided:
        Boolean(structured && Object.keys(structured || {}).length > 0) ||
        Boolean(solution && Object.keys(solution || {}).length > 0),

      engine: safeAiText(firstValue(structured?.engine, ai?.engine)),

      scenarioCode: safeAiText(firstValue(
        scenario?.scenario_code,
        ai?.scenario_code,
        response?.scenario_code,
        structured?.knowledge_sources?.internal_scenario,
        ai?.knowledge_sources?.internal_scenario
      )),

      scenarioName: safeAiText(firstValue(
        scenario?.scenario_name,
        scenario?.name
      )),

      scenarioScore: safeAiText(firstValue(
        scenario?.score
      )),

      problemType: safeAiText(firstValue(
        problem?.problem_type_code,
        ai?.problem_type_code,
        ai?.classification?.problem_type_code
      )),
      domainCode: safeAiText(firstValue(
        domain?.domain_code,
        ai?.domain_code,
        ai?.domain_detection?.domain_code
      )),
      domainName: safeAiText(firstValue(domain?.domain_name, domain?.name)),
      contextSummary: safeAiText(contextSummary),

      solutionSummary: safeAiText(firstValue(
        solution?.solution_summary,
        structured?.solution_summary,
        ai?.solution_summary,
        ai?.summary
      )),

      nextBestAction: safeAiText(firstValue(
        solution?.next_best_action,
        structured?.next_best_action,
        ai?.next_best_action
      )),

      solutionSteps: asTextArray(
        firstValue(
          solution?.solution_steps,
          structured?.solution_steps,
          ai?.solution_steps,
          ai?.recommended_actions
        )
      ),

      expectedDeliverables: asTextArray(
        firstValue(
          solution?.expected_deliverables,
          structured?.expected_deliverables,
          ai?.expected_deliverables
        )
      ),

      minimumContent: asTextArray(
        firstValue(
          solution?.minimum_content,
          structured?.minimum_content,
          ai?.minimum_content
        )
      ),

      invalidEvidence: asTextArray(
        firstValue(
          solution?.invalid_evidence,
          structured?.invalid_evidence,
          ai?.invalid_evidence
        )
      ),

      closureConditions: asTextArray(
        firstValue(
          solution?.closure_conditions,
          structured?.closure_conditions,
          ai?.closure_conditions,
          ai?.success_criteria
        )
      ),

      healthImpact: safeAiText(firstValue(
        solution?.health_impact,
        solution?.health_impact_notes,
        structured?.health_impact,
        ai?.health_impact,
        ai?.health_impact_notes
      )),

      kpiImpact: safeAiText(firstValue(
        solution?.kpi_impact,
        solution?.kpi_impact_notes,
        structured?.kpi_impact,
        ai?.kpi_impact,
        ai?.kpi_impact_notes
      )),

      knowledgeSources: firstValue(
        structured?.knowledge_sources,
        ai?.knowledge_sources,
        response?.knowledge_sources,
        response?.structured_guided?.knowledge_sources,
        response?.ai?.structured_guided?.knowledge_sources,
        {}
      ),

      requiresExternalLookup: firstValue(
        structured?.knowledge_sources?.requires_external_lookup,
        ai?.knowledge_sources?.requires_external_lookup,
        response?.structured_guided?.knowledge_sources?.requires_external_lookup,
        response?.ai?.structured_guided?.knowledge_sources?.requires_external_lookup,
        response?.requires_external_lookup
      ),

      externalLookupReason: safeAiText(firstValue(
        structured?.knowledge_sources?.external_lookup_reason,
        ai?.knowledge_sources?.external_lookup_reason,
        response?.structured_guided?.knowledge_sources?.external_lookup_reason,
        response?.ai?.structured_guided?.knowledge_sources?.external_lookup_reason,
        response?.external_lookup_reason
      )),

      externalSourceProfile: safeAiText(firstValue(
        structured?.knowledge_sources?.external_source_profile,
        ai?.knowledge_sources?.external_source_profile,
        response?.structured_guided?.knowledge_sources?.external_source_profile,
        response?.ai?.structured_guided?.knowledge_sources?.external_source_profile,
        response?.external_source_profile
      )),
    };
  };

  const AiList = ({
    title,
    items,
    tone = 'slate',
  }: {
    title: string;
    items: string[];
    tone?: 'slate' | 'emerald' | 'blue' | 'amber' | 'rose';
  }) => {
    if (!items || items.length === 0) return null;

    const toneClass =
      tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : tone === 'rose'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-slate-200 bg-slate-50 text-slate-800';

    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
          {title}
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  const AiGuidedPanel = ({
    guided,
    rowId,
    row,
    response,
  }: {
    guided: ReturnType<typeof getGuidedAi>;
    rowId: string;
    row?: any;
    response?: any;
  }) => {
    if (!guided?.hasGuided) return null;

    const primaryActions = guided.solutionSteps.slice(0, 4);
    const primaryDeliverables = guided.expectedDeliverables.slice(0, 5);
    const primaryClosure = guided.closureConditions.slice(0, 5);

    return (
      <div className="rounded-[24px] border border-indigo-100 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-indigo-500 font-black">
              Guía IA enriquecida
            </div>
            <div className="mt-1 text-lg font-black text-slate-900">
              Resolver este hallazgo
            </div>
            <div className="mt-1 text-sm text-slate-500">
              La IA resume qué hacer, qué evidencia entregar y cuándo puede cerrarse.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {guided.problemType && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                {guided.problemType}
              </span>
            )}
            {guided.domainCode && (
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {guided.domainCode}
              </span>
            )}
          </div>
        </div>

        {guided.solutionSummary && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Solución recomendada
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-700">
              {guided.solutionSummary}
            </div>
          </div>
        )}

        {guided.nextBestAction && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">
              Siguiente mejor acción
            </div>
            <div className="mt-2 text-sm font-semibold leading-6 text-emerald-900">
              {guided.nextBestAction}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <AiList
            title="Qué hacer"
            items={primaryActions}
            tone="blue"
          />
          <AiList
            title="Qué evidencia entregar"
            items={primaryDeliverables}
            tone="emerald"
          />
          <AiList
            title="Cuándo se puede cerrar"
            items={primaryClosure}
            tone="amber"
          />
        </div>

        <AiTraceabilityPanel guided={guided} />

        <AiExternalLookupPanel
          row={row}
          guided={guided}
          response={response}
        />

        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            Ver detalle técnico IA
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AiList
              title="Todas las acciones concretas"
              items={guided.solutionSteps}
              tone="blue"
            />
            <AiList
              title="Todos los entregables esperados"
              items={guided.expectedDeliverables}
              tone="emerald"
            />
            <AiList
              title="Contenido mínimo de evidencia"
              items={guided.minimumContent}
              tone="slate"
            />
            <AiList
              title="Evidencia que NO sirve"
              items={guided.invalidEvidence}
              tone="rose"
            />
            <AiList
              title="Condiciones completas de cierre"
              items={guided.closureConditions}
              tone="amber"
            />
          </div>

          {(guided.healthImpact || guided.kpiImpact || guided.contextSummary) && (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {guided.healthImpact && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Impacto en salud
                  </div>
                  <div className="mt-2 leading-6">{guided.healthImpact}</div>
                </div>
              )}

              {guided.kpiImpact && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Impacto en KPI
                  </div>
                  <div className="mt-2 leading-6">{guided.kpiImpact}</div>
                </div>
              )}

              {guided.contextSummary && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Contexto detectado
                  </div>
                  <div className="mt-2 leading-6">{guided.contextSummary}</div>
                </div>
              )}
            </div>
          )}
        </details>
      </div>
    );
  };




  const AiExternalLookupPanel = ({
    row,
    guided,
    response,
  }: {
    row: any;
    guided: ReturnType<typeof getGuidedAi>;
    response: any;
  }) => {
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [lookupResult, setLookupResult] = useState<any | null>(null);

    const buildExternalLookupPayload = () => ({
      tenant_id: row?.tenant_id || row?.tenantId || null,
      finding_id: row?.id || null,
      standard_code:
        row?.iso_code ||
        row?.standard_code ||
        row?.iso ||
        row?.standard ||
        response?.standard_code ||
        response?.iso_code ||
        null,
      title: row?.title || response?.title || '',
      description: row?.description || response?.description || '',
      scenario_code: guided?.scenarioCode || response?.scenario_code || null,
      domain_code: guided?.domainCode || response?.domain_code || null,
      problem_type_code:
        guided?.problemType || response?.problem_type_code || null,
    });

    useEffect(() => {
      const loadCachedExternalLookup = async () => {
        try {
          if (!guided?.hasGuided || lookupResult || lookupLoading) return;

          const token =
            localStorage.getItem('token') ||
            localStorage.getItem('authToken') ||
            '';

          if (!token) return;

          const apiBase = (
            process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000'
          ).replace(/\/$/, '');

          const res = await fetch(`${apiBase}/ai-external-lookup/cache`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(buildExternalLookupPayload()),
          });

          const data = await res.json().catch(() => null);

          if (res.ok && data?.ok && data?.data?.cache_hit) {
            setLookupResult(data.data);
          }
        } catch {
          // No interrumpir la vista si no existe caché o falla la precarga.
        }
      };

      loadCachedExternalLookup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guided?.scenarioCode, row?.id]);

    if (!guided?.hasGuided) return null;

    const runExternalLookup = async (
      forceRefresh = false,
      acceptExtraCharge = false
    ) => {
      try {
        setLookupLoading(true);
        setLookupError(null);

        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('authToken') ||
          '';

        if (!token) {
          setLookupError('No hay token activo para ejecutar búsqueda externa.');
          return;
        }

        const apiBase = (
          process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000'
        ).replace(/\/$/, '');

        const payload = {
          ...buildExternalLookupPayload(),
          force_refresh: forceRefresh,
          accept_extra_charge: acceptExtraCharge,
        };

        const res = await fetch(`${apiBase}/ai-external-lookup/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (
          res.status === 409 &&
          data?.code === 'EXTERNAL_LOOKUP_EXTRA_CHARGE_REQUIRED'
        ) {
          const accept = window.confirm(
            data?.error ||
              'Se terminaron las consultas contratadas. Consulta adicional $100. ¿Acepta continuar?'
          );

          if (!accept) {
            setLookupError(
              'Consulta adicional no aceptada. No se ejecutó búsqueda externa nueva.'
            );
            return;
          }

          await runExternalLookup(forceRefresh, true);
          return;
        }

        if (!res.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              data?.detail ||
              `Error ejecutando búsqueda externa. HTTP ${res.status}`
          );
        }

        setLookupResult(data.data || data);
      } catch (error: any) {
        setLookupError(error?.message || 'Error ejecutando búsqueda externa.');
      } finally {
        setLookupLoading(false);
      }
    };

    const result = lookupResult || {};
    const trustedResults = Array.isArray(result?.trusted_results)
      ? result.trusted_results
      : [];

    const quota = result?.quota || result?.usage_guardrails?.quota || null;
    const monthlyLimit = quota?.monthly_limit ?? quota?.monthlyLimit ?? null;
    const usedCount = quota?.used_count ?? quota?.usedCount ?? null;
    const remaining = quota?.remaining ?? null;
    const quotaAllowed = quota?.allowed;

    const externalGuidance = result?.external_guidance || {};
    const commonRecommendations = asTextArray(externalGuidance?.common_recommendations);
    const howToApply = asTextArray(externalGuidance?.how_to_apply);
    const evidenceToCollect = asTextArray(externalGuidance?.evidence_to_collect);
    const cautions = asTextArray(externalGuidance?.cautions);
    const domainsUsed = asTextArray(externalGuidance?.domains_used);

    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-600">
              Respaldo externo controlado
            </div>
            <div className="mt-1 text-sm leading-6 text-amber-900">
              Consulta fuentes confiables autorizadas y guarda trazabilidad.
            </div>
          </div>

          <button
            type="button"
            onClick={() => runExternalLookup(false)}
            disabled={lookupLoading}
            className="rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {lookupLoading ? 'Buscando...' : 'Buscar respaldo externo'}
          </button>
        </div>

        {lookupError && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              Resultado: {safeAiText(result?.result_summary || 'Búsqueda ejecutada.')}
            </div>

            {result?.from_cache && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Respaldo reutilizado desde caché. No se consumió API externa.
                {result?.cached_created_at && (
                  <span> Fecha original: {safeAiText(result.cached_created_at)}</span>
                )}
              </div>
            )}

            {result?.mode === 'quota_exceeded' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Límite mensual de búsquedas externas agotado para este cliente. Puedes seguir usando respuestas en caché o aumentar la cuota del tenant.
              </div>
            )}

            {quota && result?.executed_web_search && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                Esta búsqueda consumió 1 uso de la cuota mensual de respaldo externo.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {result?.from_cache && (
                <button
                  type="button"
                  onClick={() => runExternalLookup(true)}
                  disabled={lookupLoading}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookupLoading ? 'Actualizando...' : 'Actualizar respaldo externo'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                Fuentes confiables: {safeAiText(result?.trusted_results_count || 0)}
              </span>

              {result?.quality_score && (
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  Score: {safeAiText(result.quality_score)}
                </span>
              )}

              {result?.search_log_id && (
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  Log: {safeAiText(result.search_log_id)}
                </span>
              )}

              <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                Origen: {result?.from_cache ? 'Caché interno' : 'Búsqueda externa'}
              </span>

              {quota && (
                <span
                  className={
                    quotaAllowed === false
                      ? 'rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700 ring-1 ring-rose-200'
                      : 'rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200'
                  }
                >
                  Cuota: {safeAiText(usedCount ?? 0)} / {safeAiText(monthlyLimit ?? '—')}
                </span>
              )}

              {quota && (
                <span
                  className={
                    Number(remaining ?? 0) <= 0
                      ? 'rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700 ring-1 ring-rose-200'
                      : 'rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200'
                  }
                >
                  Restantes: {safeAiText(remaining ?? '—')}
                </span>
              )}
            </div>

            {externalGuidance?.summary && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                  Respaldo técnico externo
                </div>
                <div className="mt-2 text-sm leading-6 text-blue-900">
                  {safeAiText(externalGuidance.summary)}
                </div>
              </div>
            )}

            {(commonRecommendations.length > 0 ||
              howToApply.length > 0 ||
              evidenceToCollect.length > 0 ||
              cautions.length > 0) && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <AiList
                  title="Qué recomiendan las fuentes"
                  items={commonRecommendations}
                  tone="blue"
                />

                <AiList
                  title="Cómo aplicarlo al hallazgo"
                  items={howToApply}
                  tone="emerald"
                />

                <AiList
                  title="Evidencia técnica sugerida"
                  items={evidenceToCollect}
                  tone="slate"
                />

                <AiList
                  title="Advertencias"
                  items={cautions}
                  tone="amber"
                />
              </div>
            )}

            {domainsUsed.length > 0 && (
              <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                Dominios usados: {domainsUsed.join(', ')}
              </div>
            )}

            {trustedResults.length > 0 ? (
              <div className="space-y-2">
                {trustedResults.slice(0, 5).map((item: any, index: number) => (
                  <div
                    key={`${item?.url || 'external'}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="text-sm font-bold text-slate-900">
                      {safeAiText(item?.title) || 'Fuente externa'}
                    </div>

                    {item?.description && (
                      <div className="mt-1 text-xs leading-5 text-slate-600">
                        {safeAiText(item.description)}
                      </div>
                    )}

                    {item?.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-bold text-blue-700 hover:underline"
                      >
                        Abrir fuente
                      </a>
                    )}

                    {item?.matched_trusted_domain && (
                      <div className="mt-1 text-[11px] font-semibold text-slate-400">
                        Dominio confiable: {safeAiText(item.matched_trusted_domain)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                La búsqueda se ejecutó, pero no encontró resultados dentro de los dominios confiables configurados.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const AiTraceabilityPanel = ({
    guided,
  }: {
    guided: ReturnType<typeof getGuidedAi>;
  }) => {
    if (!guided?.hasGuided) return null;

    const sources: any = guided?.knowledgeSources || {};
    const supervised = sources?.supervised_feedback || {};
    const casesFound = supervised?.cases_found ?? 0;
    const caseIds = Array.isArray(supervised?.case_ids)
      ? supervised.case_ids
      : [];

    const internalScenario =
      guided?.scenarioCode ||
      sources?.internal_scenario ||
      sources?.scenario_code ||
      null;

    const requiresExternalLookup =
      guided?.requiresExternalLookup === true ||
      guided?.requiresExternalLookup === 'true' ||
      sources?.requires_external_lookup === true ||
      sources?.requires_external_lookup === 'true';

    const externalReason =
      guided?.externalLookupReason ||
      sources?.external_lookup_reason ||
      sources?.lookup_reason ||
      '';

    const externalProfile =
      guided?.externalSourceProfile ||
      sources?.external_source_profile ||
      sources?.source_profile ||
      '';

    const guidedAny: any = guided || {};

    const centralSourceLevel = safeAiText(
      sources?.source_level ||
        sources?.sourceLevel ||
        guidedAny?.source_level ||
        guidedAny?.sourceLevel ||
        ''
    );

    const centralSourceLabel = safeAiText(
      sources?.source_label ||
        sources?.sourceLabel ||
        guidedAny?.source_label ||
        guidedAny?.sourceLabel ||
        ''
    );

    const centralConfidence = safeAiText(
      sources?.confidence ||
        sources?.confidence_hint ||
        guidedAny?.confidence ||
        guidedAny?.confidence_hint ||
        ''
    );

    const centralTraceId = safeAiText(
      sources?.trace_id ||
        sources?.traceId ||
        guidedAny?.trace_id ||
        guidedAny?.traceId ||
        ''
    );

    const sourceOrder = Array.isArray(sources?.source_order)
      ? sources.source_order
      : [];

    const sourceOrderLabels: Record<string, string> = {
      tenant_internal: 'Tenant',
      tcdx_knowledge: 'Base TCDX',
      anonymized_benchmark: 'Benchmark',
      external_web: 'Internet',
      best_effort: 'Mejor esfuerzo',
    };

    const sourceOrderText = sourceOrder.length
      ? sourceOrder.map((item: string) => sourceOrderLabels[item] || item).join(' → ')
      : '';

    const tenantHits = Number(sources?.tenant_hits ?? 0);
    const knowledgeHits = Number(sources?.knowledge_hits ?? 0);
    const benchmarkHits = Number(sources?.benchmark_hits ?? 0);
    const externalHits = Number(sources?.external_hits ?? 0);

    const hasCentralOrchestration =
      Boolean(centralSourceLevel) ||
      Boolean(centralSourceLabel) ||
      Boolean(centralConfidence) ||
      Boolean(centralTraceId) ||
      sourceOrder.length > 0 ||
      tenantHits > 0 ||
      knowledgeHits > 0 ||
      benchmarkHits > 0 ||
      externalHits > 0;

    const centralSourceName =
      centralSourceLabel ||
      sourceOrderLabels[centralSourceLevel] ||
      centralSourceLevel ||
      'Motor IA enriquecido';

    const centralSourceClass =
      centralSourceLevel === 'external_web'
        ? 'bg-cyan-50 text-cyan-800 ring-cyan-200'
        : centralSourceLevel === 'anonymized_benchmark'
          ? 'bg-purple-50 text-purple-800 ring-purple-200'
          : centralSourceLevel === 'tcdx_knowledge'
            ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
            : centralSourceLevel === 'tenant_internal'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-slate-50 text-slate-700 ring-slate-200';

    return (
      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">
          Ver trazabilidad de la respuesta IA
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
          {hasCentralOrchestration && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 xl:col-span-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                    Orquestación IA TCDX
                  </div>
                  <div className="mt-2 text-sm leading-6 text-blue-950">
                    Esta respuesta fue enriquecida por el motor central usando capas de conocimiento y trazabilidad.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 font-bold ring-1 ${centralSourceClass}`}>
                    Origen: {centralSourceName}
                  </span>

                  {centralConfidence && (
                    <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
                      Confianza: {centralConfidence}
                    </span>
                  )}

                  {centralTraceId && (
                    <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
                      Trace: {centralTraceId.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                  Ruta: {sourceOrderText || 'No informada'}
                </div>

                <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                  Tenant: {tenantHits}
                </div>

                <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                  TCDX: {knowledgeHits}
                </div>

                <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                  Benchmark: {benchmarkHits}
                </div>

                <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
                  Internet: {externalHits}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-indigo-500">
              Escenario detectado
            </div>
            <div className="mt-2 text-sm font-bold text-indigo-900">
              {safeAiText(internalScenario) || 'No detectado'}
            </div>
            {guided?.scenarioName && (
              <div className="mt-1 text-xs leading-5 text-indigo-700">
                {safeAiText(guided.scenarioName)}
              </div>
            )}
            {guided?.scenarioScore && (
              <div className="mt-2 text-xs font-semibold text-indigo-600">
                Score: {safeAiText(guided.scenarioScore)}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Clasificación IA
            </div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <div>
                <span className="font-bold">Dominio:</span>{' '}
                {safeAiText(guided?.domainCode) || 'No informado'}
              </div>
              <div>
                <span className="font-bold">Problema:</span>{' '}
                {safeAiText(guided?.problemType) || 'No informado'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">
              Aprendizaje supervisado
            </div>
            <div className="mt-2 text-sm text-emerald-900">
              Casos aceptados previos: <strong>{safeAiText(casesFound)}</strong>
            </div>
            {caseIds.length > 0 && (
              <div className="mt-2 text-xs leading-5 text-emerald-700">
                Referencias internas: {caseIds.slice(0, 3).join(', ')}
              </div>
            )}
          </div>

          <div
            className={
              requiresExternalLookup
                ? 'rounded-2xl border border-amber-200 bg-amber-50 p-4'
                : 'rounded-2xl border border-slate-200 bg-slate-50 p-4'
            }
          >
            <div
              className={
                requiresExternalLookup
                  ? 'text-xs font-black uppercase tracking-[0.14em] text-amber-600'
                  : 'text-xs font-black uppercase tracking-[0.14em] text-slate-400'
              }
            >
              Búsqueda externa
            </div>

            <div
              className={
                requiresExternalLookup
                  ? 'mt-2 text-sm font-bold text-amber-900'
                  : 'mt-2 text-sm font-bold text-slate-700'
              }
            >
              {requiresExternalLookup ? 'Sugerida' : 'No requerida por ahora'}
            </div>

            <div
              className={
                requiresExternalLookup
                  ? 'mt-2 text-xs leading-5 text-amber-800'
                  : 'mt-2 text-xs leading-5 text-slate-500'
              }
            >
              {requiresExternalLookup
                ? 'Este escenario puede enriquecerse con documentación técnica externa controlada.'
                : 'La IA respondió usando conocimiento interno, escenario detectado y casos aceptados disponibles.'}
            </div>

            {externalReason && (
              <div
                className={
                  requiresExternalLookup
                    ? 'mt-2 text-xs leading-5 text-amber-800'
                    : 'mt-2 text-xs leading-5 text-slate-500'
                }
              >
                <span className="font-bold">Motivo:</span>{' '}
                {safeAiText(externalReason)}
              </div>
            )}

            {externalProfile && (
              <div
                className={
                  requiresExternalLookup
                    ? 'mt-1 text-xs leading-5 text-amber-800'
                    : 'mt-1 text-xs leading-5 text-slate-500'
                }
              >
                <span className="font-bold">Perfil:</span>{' '}
                {safeAiText(externalProfile)}
              </div>
            )}
          </div>
        </div>
      </details>
    );
  };

  const AiFeedbackButtons = ({
    row,
    response,
    responseType,
  }: {
    row: any;
    response: any;
    responseType: 'finding_analysis' | 'action_plan_suggestion';
  }) => {
    const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const guided = getGuidedAi(response);

    const postFeedback = async (
      rating: 'util' | 'no_util' | 'aplicada' | 'corregida'
    ) => {
      try {
        setFeedbackLoading(rating);
        setFeedbackMessage(null);

        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('authToken') ||
          '';

        if (!token) {
          setFeedbackMessage('No hay token activo para guardar feedback.');
          return;
        }

        const apiBase = (
          process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000'
        ).replace(/\/$/, '');

        const payload = {
          source_entity_type: 'finding',
          source_entity_id: row?.id || null,
          standard_code:
            row?.iso_code ||
            row?.standard_code ||
            row?.iso ||
            row?.standard ||
            null,
          domain_code: guided?.domainCode || null,
          problem_type_code: guided?.problemType || null,
          scenario_code:
            response?.scenario_code ||
            response?.ai?.scenario_code ||
            response?.structured_guided?.scenario?.scenario_code ||
            response?.ai?.structured_guided?.scenario?.scenario_code ||
            null,
          user_rating: rating,
          user_comment:
            rating === 'util'
              ? 'Respuesta marcada como útil desde Hallazgos.'
              : rating === 'no_util'
                ? 'Respuesta marcada como no útil desde Hallazgos.'
                : rating === 'aplicada'
                  ? 'Respuesta marcada como aplicada desde Hallazgos.'
                  : 'Respuesta marcada para corrección posterior desde Hallazgos.',
          was_useful: rating === 'util' || rating === 'aplicada' || rating === 'corregida',
          was_applied: rating === 'aplicada',
          was_corrected: rating === 'corregida',
          ai_response: response || {},
          metadata: {
            source: 'frontend_hallazgos',
            response_type: responseType,
            saved_at: new Date().toISOString(),
          },
        };

        const res = await fetch(`${apiBase}/ai-feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              data?.detail ||
              `No se pudo guardar feedback IA. HTTP ${res.status}`
          );
        }

        setFeedbackMessage(
          rating === 'util'
            ? 'Feedback guardado: útil.'
            : rating === 'no_util'
              ? 'Feedback guardado: no útil.'
              : rating === 'aplicada'
                ? 'Feedback guardado: aplicada.'
                : 'Feedback guardado: requiere corrección.'
        );
      } catch (error: any) {
        setFeedbackMessage(error?.message || 'Error guardando feedback IA.');
      } finally {
        setFeedbackLoading(null);
      }
    };

    const buttonBase =
      'rounded-2xl border px-3 py-2 text-xs font-bold transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60';

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Feedback IA
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Esto ayuda a mejorar el motor con casos reales.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(feedbackLoading)}
              onClick={() => postFeedback('util')}
              className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
            >
              {feedbackLoading === 'util' ? 'Guardando...' : 'Útil'}
            </button>

            <button
              type="button"
              disabled={Boolean(feedbackLoading)}
              onClick={() => postFeedback('no_util')}
              className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}
            >
              {feedbackLoading === 'no_util' ? 'Guardando...' : 'No útil'}
            </button>

            <button
              type="button"
              disabled={Boolean(feedbackLoading)}
              onClick={() => postFeedback('aplicada')}
              className={`${buttonBase} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
            >
              {feedbackLoading === 'aplicada' ? 'Guardando...' : 'Aplicada'}
            </button>

            <button
              type="button"
              disabled={Boolean(feedbackLoading)}
              onClick={() => postFeedback('corregida')}
              className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
            >
              {feedbackLoading === 'corregida' ? 'Guardando...' : 'Corregir luego'}
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {feedbackMessage}
          </div>
        )}
      </div>
    );
  };

  const saveAiSuggestion = async ({
    suggestionType,
    title,
    sourceEntityType,
    sourceEntityId,
    inputPayload,
    outputPayload,
    confidence,
  }: {
    suggestionType: string;
    title: string;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    inputPayload: any;
    outputPayload: any;
    confidence?: string;
  }) => {
    try {
      setAiError('');
      setAiSaveLoadingId(`${suggestionType}-${sourceEntityId || 'manual'}`);

      await postWithAuth(`${API_URL}/api/ai-compliance/suggestions/save`, {
        suggestion_type: suggestionType,
        source_module: 'ia_module_in_page',
        source_entity_type: sourceEntityType,
        source_entity_id: sourceEntityId,
        title,
        input_payload: inputPayload || {},
        output_payload: outputPayload || {},
        confidence: confidence || null,
      });

      alert('Borrador IA guardado correctamente');
    } catch (err: any) {
      console.error('ERROR SAVE AI SUGGESTION FINDINGS:', err);
      setAiError(err.message || 'No fue posible guardar la sugerencia IA.');
    } finally {
      setAiSaveLoadingId('');
    }
  };

  const handleApplyAnalysisToFinding = async (row: any) => {
    const analysis = aiAnalysisById[row.id];
    const aiData = analysis?.ai || null;

    if (!aiData) {
      alert('Primero debes generar el análisis IA.');
      return;
    }

    try {
      setAiError('');
      setAiApplyLoadingId(`analysis-${row.id}`);

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/apply/finding-analysis-to-finding`,
        {
          finding_id: row.id,
          ai_result: analysis,
        }
      );

      if (result?.data) {
        setData((prev) => prev.map((p) => (p.id === row.id ? result.data : p)));
      }

      alert('Análisis IA aplicado correctamente al hallazgo');
    } catch (err: any) {
      console.error('ERROR APPLY AI ANALYSIS TO FINDING:', err);
      setAiError(err.message || 'No fue posible aplicar el análisis IA al hallazgo.');
    } finally {
      setAiApplyLoadingId('');
    }
  };

  const handleAnalyzeFindingWithAI = async (row: any) => {
    try {
      setAiError('');
      setAiLoadingById((prev) => ({ ...prev, [row.id]: 'analysis' }));

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/finding-analysis`,
        {
          finding_id: row.id,
        }
      );

      setAiAnalysisById((prev) => ({
        ...prev,
        [row.id]: result,
      }));
    } catch (err: any) {
      console.error('ERROR AI FINDING ANALYSIS:', err);
      setAiError(err.message || 'No fue posible analizar el hallazgo con IA.');
    } finally {
      setAiLoadingById((prev) => ({ ...prev, [row.id]: '' }));
    }
  };

  const handleSuggestPlanWithAI = async (row: any) => {
    try {
      setAiError('');
      setAiLoadingById((prev) => ({ ...prev, [row.id]: 'plan' }));

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/action-plan-suggestion`,
        {
          finding_id: row.id,
        }
      );

      setAiPlanById((prev) => ({
        ...prev,
        [row.id]: result,
      }));
    } catch (err: any) {
      console.error('ERROR AI ACTION PLAN FROM FINDING:', err);
      setAiError(err.message || 'No fue posible generar el plan sugerido con IA.');
    } finally {
      setAiLoadingById((prev) => ({ ...prev, [row.id]: '' }));
    }
  };

  const handleApplySuggestedPlanToAction = async (
    row: any,
    linkedAction: ActionPlanRow | null
  ) => {
    const suggestedPlan = aiPlanById[row.id];
    const aiData = suggestedPlan?.ai || null;

    if (!aiData) {
      alert('Primero debes generar el plan sugerido IA.');
      return;
    }

    if (!linkedAction?.id) {
      alert('Primero debes crear o disponer de un plan de acción vinculado.');
      return;
    }

    try {
      setAiError('');
      setAiApplyLoadingId(`plan-${row.id}`);

      const result = await postWithAuth(
        `${API_URL}/api/ai-compliance/apply/action-plan-suggestion-to-plan`,
        {
          action_plan_id: linkedAction.id,
          finding_id: row.id,
          ai_result: suggestedPlan,
        }
      );

      if (result?.data) {
        await refreshFindings();
      }

      alert('Plan IA aplicado correctamente al plan de acción');
    } catch (err: any) {
      console.error('ERROR APPLY AI PLAN TO ACTION:', err);
      setAiError(err.message || 'No fue posible aplicar el plan IA al plan de acción.');
    } finally {
      setAiApplyLoadingId('');
    }
  };

  const loadScope = async (resolvedTenantId: string, authToken: string) => {
    try {
      setLoadingStandards(true);

      const res = await fetch(
        `${API_URL}/api/tenant-standards/scope/${resolvedTenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD FINDINGS SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setSelectedISO('');
        return;
      }

      const nextScope: ScopeResponse = {
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      };

      const actives = nextScope.standards.filter(isOperationalStandard);

      setScope(nextScope);

      if (actives.length > 0) {
        setSelectedISO((prev) => {
          if (focusISO) {
            const focusExists = actives.some((s) => s.code === focusISO);
            if (focusExists) return focusISO;
          }

          const exists = actives.some((s) => s.code === prev);
          return exists ? prev : actives[0].code;
        });
      } else {
        setSelectedISO('');
      }
    } catch (err) {
      console.error('ERROR LOAD FINDINGS SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setSelectedISO('');
    } finally {
      setLoadingStandards(false);
    }
  };

  const loadControls = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string
  ) => {
    try {
      setLoadingControls(true);

      if (!iso || !operationalStandardCodes.has(iso)) {
        setControls([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('iso', iso);

      const res = await fetch(
        `${API_URL}/api/findings/controls/${resolvedTenantId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD FINDING CONTROLS:', json);
        setControls([]);
        return;
      }

      setControls(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error('ERROR LOAD FINDING CONTROLS:', err);
      setControls([]);
    } finally {
      setLoadingControls(false);
    }
  };

  const loadFindings = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string,
    status?: string,
    findingType?: string
  ) => {
    try {
      setLoadingData(true);

      if (!iso || !operationalStandardCodes.has(iso)) {
        setData([]);
        return;
      }

      const params = new URLSearchParams();
      params.append('iso', iso);
      if (status) params.append('status', status);
      if (findingType) params.append('finding_type', findingType);

      const res = await fetch(
        `${API_URL}/api/findings/${resolvedTenantId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD FINDINGS:', json);
        setData([]);
        return;
      }

      const safeRows = Array.isArray(json)
        ? json.filter((row: any) =>
            operationalStandardCodes.has(row.iso_code || row.control_iso)
          )
        : [];

      setData(safeRows);
    } catch (err) {
      console.error('ERROR LOAD FINDINGS:', err);
      setData([]);
    } finally {
      setLoadingData(false);
    }
  };

  const loadActions = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string
  ) => {
    try {
      setLoadingActions(true);

      if (!iso || !operationalStandardCodes.has(iso)) {
        setActions([]);
        return;
      }

      const res = await fetch(
        `${API_URL}/api/action-plans/${resolvedTenantId}?iso=${encodeURIComponent(
          iso
        )}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD ACTIONS FROM FINDINGS:', json);
        setActions([]);
        return;
      }

      const safeRows = Array.isArray(json)
        ? json.filter((row: any) =>
            operationalStandardCodes.has(row.iso_code || row.control_iso)
          )
        : [];

      setActions(safeRows);
    } catch (err) {
      console.error('ERROR LOAD ACTIONS FROM FINDINGS:', err);
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  };

  const loadFindingsDirect = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string,
    status?: string,
    findingType?: string
  ) => {
    if (!iso || !operationalStandardCodes.has(iso)) return [];

    const params = new URLSearchParams();
    params.append('iso', iso);
    if (status) params.append('status', status);
    if (findingType) params.append('finding_type', findingType);

    const res = await fetch(
      `${API_URL}/api/findings/${resolvedTenantId}?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const json = await res.json();

    if (!res.ok) {
      throw new Error('Error cargando hallazgos');
    }

    return Array.isArray(json)
      ? json.filter((row: any) =>
          operationalStandardCodes.has(row.iso_code || row.control_iso)
        )
      : [];
  };

  useEffect(() => {
    if (!token || !tenantId) return;
    void loadScope(tenantId, token);
  }, [token, tenantId]);

  useEffect(() => {
    if (!token || !tenantId || !selectedISO) {
      if (!loadingStandards) {
        setLoadingData(false);
        setLoadingControls(false);
        setLoadingActions(false);
      }
      return;
    }

    if (!loadingStandards && operationalStandardCodes.has(selectedISO)) {
      void loadFindings(tenantId, token, selectedISO, statusFilter, typeFilter);
      void loadControls(tenantId, token, selectedISO);
      void loadActions(tenantId, token, selectedISO);
    }
  }, [
    token,
    tenantId,
    selectedISO,
    statusFilter,
    typeFilter,
    loadingStandards,
    operationalStandardCodes,
  ]);

  const refreshFindings = async () => {
    if (tenantId && token && selectedISO && operationalStandardCodes.has(selectedISO)) {
      await Promise.all([
        loadFindings(tenantId, token, selectedISO, statusFilter, typeFilter),
        loadControls(tenantId, token, selectedISO),
        loadActions(tenantId, token, selectedISO),
      ]);
    }
  };

  const save = async () => {
    if (!token || !tenantId) return;
    if (creatingFinding) return;

    if (!selectedISO) {
      alert('Debes seleccionar una norma');
      return;
    }

    if (!form.title.trim()) {
      alert('El título es obligatorio');
      return;
    }

    if (!form.tenant_control_id) {
      alert('Debes asociar un control al hallazgo');
      return;
    }

    try {
      setCreatingFinding(true);

      const res = await fetch(`${API_URL}/api/findings`, {
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
          finding_type: form.finding_type,
          severity: form.severity,
          owner: form.owner,
          detected_by: form.detected_by,
          due_date: form.due_date || null,
          tenant_control_id: form.tenant_control_id,
          source_type: 'manual',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando hallazgo');
        return;
      }

      setForm({
        title: '',
        description: '',
        finding_type: 'observacion',
        severity: 'media',
        owner: '',
        detected_by: '',
        due_date: '',
        tenant_control_id: '',
      });

      await refreshFindings();

      if (json?.id) {
        setFocusedFindingId(json.id);
        setFocusResolved(true);
      }

      if (json?.duplicate_prevented) {
        setFocusMessage(
          'Se evitó un doble guardado y se reutilizó el hallazgo ya existente.'
        );
        alert(
          'Ya existía un hallazgo idéntico recién creado. No se volvió a duplicar.'
        );
      }
    } catch (err) {
      console.error('ERROR CREATE FINDING:', err);
      alert('Error creando hallazgo');
    } finally {
      setCreatingFinding(false);
    }
  };

  const updateFinding = async (row: any, patch: any) => {
    if (!token) return;

    try {
      setSavingId(row.id);

      const body: any = {
        title: patch.title ?? row.title,
        description: patch.description ?? row.description,
        finding_type: patch.finding_type ?? row.finding_type,
        severity: patch.severity ?? row.severity,
        status: patch.status ?? row.status,
        owner: patch.owner ?? row.owner,
        detected_by: patch.detected_by ?? row.detected_by,
        due_date: patch.due_date ?? row.due_date,
      };

      if (Object.prototype.hasOwnProperty.call(patch, 'tenant_control_id')) {
        body.tenant_control_id = patch.tenant_control_id;
      }

      const res = await fetch(`${API_URL}/api/findings/${row.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error actualizando hallazgo');
        return;
      }

      setData((prev) => prev.map((p) => (p.id === row.id ? json : p)));
    } catch (err) {
      console.error('ERROR UPDATE FINDING:', err);
      alert('Error actualizando hallazgo');
    } finally {
      setSavingId('');
    }
  };

  const deleteFinding = async (id: string) => {
    if (!token) return;

    const ok = confirm('¿Eliminar este hallazgo?');
    if (!ok) return;

    const res = await fetch(`${API_URL}/api/findings/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || 'Error eliminando hallazgo');
      return;
    }

    setData((prev) => prev.filter((f) => f.id !== id));
  };

  const createAction = async (row: any) => {
    if (!token) return;

    if (!row.control_description && !row.control_clause && !row.tenant_control_modern_id) {
      alert(
        'Este hallazgo no tiene un control válido asociado. Asocia un control antes de crear la acción.'
      );
      return;
    }

    try {
      setActionLoading(row.id);

      const res = await fetch(`${API_URL}/api/findings/${row.id}/create-action`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando acción');
        return;
      }

      await refreshFindings();
      alert(json.already_exists ? 'La acción ya existía' : 'Acción creada correctamente');
    } catch (err) {
      console.error('ERROR CREATE ACTION FROM FINDING:', err);
      alert('Error creando acción');
    } finally {
      setActionLoading('');
    }
  };

  const metrics = useMemo(() => {
    return {
      total: data.length,
      nc: data.filter((d) => d.finding_type === 'no conformidad').length,
      observaciones: data.filter((d) => d.finding_type === 'observacion').length,
      mejoras: data.filter((d) => d.finding_type === 'oportunidad de mejora').length,
      fortalezas: data.filter((d) => d.finding_type === 'fortaleza').length,
    };
  }, [data]);

  const actionsByFinding = useMemo(() => {
    const map: Record<string, ActionPlanRow> = {};

    const rankStatus = (status?: string | null) => {
      const normalized = String(status || '').toLowerCase();
      if (normalized === 'abierto') return 1;
      if (normalized === 'en progreso') return 2;
      if (normalized === 'bloqueado') return 3;
      if (normalized === 'completado') return 4;
      return 5;
    };

    actions.forEach((row) => {
      const findingId = row.finding_id || null;
      if (!findingId) return;

      const existing = map[findingId];
      if (!existing) {
        map[findingId] = row;
        return;
      }

      const currentRank = rankStatus(existing.status);
      const nextRank = rankStatus(row.status);

      if (nextRank < currentRank) {
        map[findingId] = row;
      }
    });

    return map;
  }, [actions]);

  const typeColor = (value: string) => {
    if (value === 'no conformidad') return 'text-red-600';
    if (value === 'observacion') return 'text-amber-600';
    if (value === 'oportunidad de mejora') return 'text-blue-600';
    return 'text-emerald-600';
  };

  const severityColor = (value: string) => {
    if (value === 'alta') return 'text-red-600';
    if (value === 'media') return 'text-amber-600';
    return 'text-emerald-600';
  };

  const actionStatusColor = (value?: string | null) => {
    const normalized = String(value || '').toLowerCase();

    if (normalized === 'abierto') return 'bg-slate-100 text-slate-700';
    if (normalized === 'en progreso') return 'bg-blue-100 text-blue-700';
    if (normalized === 'bloqueado') return 'bg-amber-100 text-amber-700';
    if (normalized === 'completado') return 'bg-emerald-100 text-emerald-700';

    return 'bg-slate-100 text-slate-700';
  };

  const getSourceLabel = (row: any) => {
    switch (row.source_type) {
      case 'audit':
        return 'Auditoría';
      case 'diagnostic':
        return 'Diagnóstico';
      case 'soa':
        return 'SoA';
      case 'risk':
        return 'Riesgo/Activo';
      case 'ia':
        return 'IA';
      case 'evidence':
        return 'Evidencia';
      default:
        return 'Manual';
    }
  };

  const getSourceDetail = (row: any) => {
    if (row.nonconformity_description) {
      return `NC: ${row.nonconformity_description}`;
    }

    if (row.control_description || row.control_clause) {
      return `${row.control_iso || row.iso_code} ${row.control_clause || ''} — ${
        row.control_description || 'Control vinculado'
      }`.trim();
    }

    if (row.asset_name) {
      return `Activo: ${row.asset_name}${row.asset_type ? ` (${row.asset_type})` : ''}`;
    }

    if (row.audit_id) {
      const auditRange =
        row.audit_start_date && row.audit_end_date
          ? `${row.audit_start_date} → ${row.audit_end_date}`
          : 'Auditoría vinculada';

      const auditAuditor = row.audit_auditor_name
        ? ` · ${row.audit_auditor_name}`
        : '';

      return `${row.audit_iso || row.iso_code} ${auditRange}${auditAuditor}`;
    }

    return 'Creación manual';
  };

  const getCardId = (row: any) => `finding-${row.id}`;

  const applyFocus = (row: any, iso: string) => {
    setFocusedFindingId(row.id);
    setFocusResolved(true);
    setFocusMessage(
      `Resultado abierto desde búsqueda: ${row.title} (${iso || row.iso_code || 'Sin norma'})`
    );

    setTimeout(() => {
      const el = document.getElementById(getCardId(row));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  useEffect(() => {
    if (!focusISO || !operationalStandards.length) return;

    const exists = operationalStandards.some((s) => s.code === focusISO);
    if (exists && selectedISO !== focusISO) {
      setSelectedISO(focusISO);
    }
  }, [focusISO, operationalStandards, selectedISO]);

  useEffect(() => {
    if (!focusId || loadingData || !selectedISO) return;

    const match = data.find((row) => row.id === focusId);
    if (match) {
      applyFocus(match, selectedISO);
    }
  }, [focusId, loadingData, data, selectedISO]);

  useEffect(() => {
    const findAcrossStandards = async () => {
      if (
        !focusId ||
        !token ||
        !tenantId ||
        !operationalStandards.length ||
        loadingStandards ||
        loadingData ||
        focusResolved ||
        autoFindingFocus
      ) {
        return;
      }

      const currentMatch = data.find((row) => row.id === focusId);
      if (currentMatch) return;

      setAutoFindingFocus(true);

      try {
        const standardsToSearch = operationalStandards
          .map((s) => s.code)
          .filter(
            (code) => code !== selectedISO && !searchedStandardsRef.current.has(code)
          );

        for (const iso of standardsToSearch) {
          searchedStandardsRef.current.add(iso);

          const rows = await loadFindingsDirect(
            tenantId,
            token,
            iso,
            statusFilter,
            typeFilter
          );

          const match = rows.find((row: any) => row.id === focusId);
          if (match) {
            setSelectedISO(iso);
            break;
          }
        }
      } catch (err) {
        console.error('ERROR AUTO FIND FOCUS FINDING:', err);
      } finally {
        setAutoFindingFocus(false);
      }
    };

    void findAcrossStandards();
  }, [
    focusId,
    token,
    tenantId,
    operationalStandards,
    selectedISO,
    loadingStandards,
    loadingData,
    focusResolved,
    autoFindingFocus,
    data,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    if (!focusId || loadingStandards || loadingData || autoFindingFocus) return;

    const hasMatch = data.some((row) => row.id === focusId);

    if (
      !hasMatch &&
      operationalStandards.length > 0 &&
      searchedStandardsRef.current.size >= Math.max(0, operationalStandards.length - 1)
    ) {
      setFocusMessage(
        'No se encontró el hallazgo solicitado en las normas operativas disponibles.'
      );
    }
  }, [
    focusId,
    loadingStandards,
    loadingData,
    autoFindingFocus,
    data,
    selectedISO,
    operationalStandards,
  ]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">{t('findings.loadingStandards')}</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && operationalStandards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">{t('findings.title')}</h1>

          <div className="rounded-[28px] border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">
              {t('findings.noOperationalStandards')}
            </h2>

            <p className="text-sm text-gray-700">
              {t('findings.noOperationalStandardsHelp')}
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
                  {t('findings.eyebrow')}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('findings.badge')}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t('findings.title')}
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                {t('findings.subtitle')}
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-3">
              <MetricCard title={t('common.all')} value={metrics.total} tone="slate" />
              <MetricCard title={t('findings.nonconformities')} value={metrics.nc} tone="red" />
              <MetricCard
                title={t('findings.opportunitiesStrengths')}
                value={metrics.mejoras + metrics.fortalezas}
                tone="emerald"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            <FilterCard label={t('dashboard.standard')}>
              <select
                value={selectedISO}
                onChange={(e) => {
                  setSelectedISO(e.target.value);
                  setForm((prev) => ({ ...prev, tenant_control_id: '' }));
                  setFocusedFindingId('');
                  setFocusResolved(false);
                  if (!focusId) setFocusMessage('');
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                {operationalStandards.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </FilterCard>

            <FilterCard label={t('findings.fields.type')}>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="">{t('findings.allTypes')}</option>
                <option value="no conformidad">{t('findings.types.nonconformity')}</option>
                <option value="observacion">{t('findings.types.observation')}</option>
                <option value="oportunidad de mejora">{t('findings.types.improvement')}</option>
                <option value="fortaleza">{t('findings.types.strength')}</option>
              </select>
            </FilterCard>

            <FilterCard label={t('common.status')}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="">{t('findings.allStatuses')}</option>
                <option value="abierto">{t('statuses.findings.abierto')}</option>
                <option value="en revision">{t('statuses.findings.en_revision')}</option>
                <option value="accion definida">{t('findings.statuses.actionDefined')}</option>
                <option value="cerrado">{t('statuses.findings.cerrado')}</option>
              </select>
            </FilterCard>

            <FilterCard label={t('findings.availableControls')}>
              <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-medium text-slate-700">
                {loadingControls ? t('common.loading') : `${controls.length} ${t('findings.controlsCount')}`}
              </div>
            </FilterCard>
          </div>
        </section>

        {focusMessage && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
            <div className="font-semibold">{t('findings.directOpen')}</div>
            <div className="mt-1 text-sm">{focusMessage}</div>
          </div>
        )}

        {aiError && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {aiError}
          </div>
        )}

        {autoFindingFocus && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">
            {t('findings.searchingAcrossStandards')}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <MetricCard title={t('findings.types.observation')} value={metrics.observaciones} tone="amber" />
          <MetricCard title={t('findings.improvements')} value={metrics.mejoras} tone="blue" />
          <MetricCard title={t('findings.types.strength')} value={metrics.fortalezas} tone="emerald" />
          <MetricCard
            title={t('findings.withLinkedAction')}
            value={Object.keys(actionsByFinding).length}
            tone="violet"
          />
          <MetricCard
            title={t('findings.readOnly')}
            value={isReadOnly ? t('common.yes') : t('common.no')}
            tone="slate"
          />
        </div>

        {!isReadOnly && (
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {t('findings.create')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('findings.createHelp')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-4">
                <FieldBlock label={t('findings.fields.title')}>
                  <input
                    placeholder={t('findings.placeholders.title')}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </FieldBlock>

                <FieldBlock label={t('findings.fields.description')}>
                  <textarea
                    placeholder={t('findings.placeholders.description')}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                  />
                </FieldBlock>

                <FieldBlock label={t('findings.fields.associatedControl')}>
                  <select
                    value={form.tenant_control_id}
                    onChange={(e) =>
                      setForm({ ...form, tenant_control_id: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    disabled={loadingControls || creatingFinding}
                  >
                    <option value="">
                      {loadingControls
                        ? t('findings.loadingControls')
                        : t('findings.selectAssociatedControl')}
                    </option>

                    {controls.map((control: any) => (
                      <option
                        key={control.tenant_control_id}
                        value={control.tenant_control_id}
                      >
                        {control.iso} · {control.clause || 'Sin cláusula'} —{' '}
                        {control.description}
                      </option>
                    ))}
                  </select>

                  {controls.length === 0 && !loadingControls && (
                    <div className="mt-2 text-xs text-red-600">
                      {t('findings.noControlsForStandard')}
                    </div>
                  )}
                </FieldBlock>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldBlock label={t('findings.fields.type')}>
                    <select
                      value={form.finding_type}
                      onChange={(e) =>
                        setForm({ ...form, finding_type: e.target.value })
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      disabled={creatingFinding}
                    >
                      <option value="no conformidad">{t('findings.types.nonconformity')}</option>
                      <option value="observacion">{t('findings.types.observation')}</option>
                      <option value="oportunidad de mejora">
                        {t('findings.types.improvement')}
                      </option>
                      <option value="fortaleza">{t('findings.types.strength')}</option>
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t('findings.fields.severity')}>
                    <select
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      disabled={creatingFinding}
                    >
                      <option value="alta">{t('statuses.findings.alto')}</option>
                      <option value="media">{t('statuses.findings.medio')}</option>
                      <option value="baja">{t('statuses.findings.bajo')}</option>
                    </select>
                  </FieldBlock>

                  <FieldBlock label={t('findings.fields.owner')}>
                    <input
                      placeholder={t('findings.placeholders.owner')}
                      value={form.owner}
                      onChange={(e) => setForm({ ...form, owner: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                      disabled={creatingFinding}
                    />
                  </FieldBlock>

                  <FieldBlock label={t('findings.fields.detectedBy')}>
                    <input
                      placeholder={t('findings.placeholders.detectedBy')}
                      value={form.detected_by}
                      onChange={(e) =>
                        setForm({ ...form, detected_by: e.target.value })
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                      disabled={creatingFinding}
                    />
                  </FieldBlock>
                </div>

                <FieldBlock label={t('findings.fields.dueDate')}>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none"
                    disabled={creatingFinding}
                  />
                </FieldBlock>

                <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700">
                  La norma seleccionada es <strong>{selectedISO || '—'}</strong>. El
                  control asociado se usará para mantener la trazabilidad con
                  diagnóstico, NC, acción y evidencia.
                </div>

                <button
                  onClick={save}
                  disabled={creatingFinding || loadingControls || !selectedISO}
                  className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creatingFinding ? 'Guardando...' : 'Guardar hallazgo'}
                </button>
              </div>
            </div>
          </section>
        )}

        {loadingData || loadingActions ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            Cargando hallazgos...
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            No hay hallazgos para esta norma.
          </div>
        ) : (
          <div className="space-y-5">
            {data.map((row: any) => {
              const hasValidControl = Boolean(
                row.control_description ||
                  row.control_clause ||
                  row.tenant_control_modern_id
              );

              const linkedAction = actionsByFinding[row.id] || null;
              const analysis = aiAnalysisById[row.id];
              const suggestedPlan = aiPlanById[row.id];
              const analysisData = analysis?.ai || null;
              const suggestedPlanData = suggestedPlan?.ai || null;
              const aiMode = aiLoadingById[row.id] || '';

              return (
                <article
                  key={row.id}
                  id={getCardId(row)}
                  className={`rounded-[30px] border bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all ${
                    focusedFindingId === row.id
                      ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/40'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone="slate">{row.iso_code}</Tag>
                        <Tag tone="blue">{getSourceLabel(row)}</Tag>
                        <Tag tone="violet">{row.status}</Tag>
                        <Tag tone="amber">{row.finding_type}</Tag>
                        <Tag tone="rose">{row.severity}</Tag>
                        {linkedAction && <Tag tone="emerald">Con acción</Tag>}
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                        {row.title}
                      </h3>

                      <div className="mt-2 text-sm text-slate-500">
                        {getSourceDetail(row)}
                      </div>

                      {!hasValidControl && (
                        <div className="mt-3 inline-block rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                          Sin control asociado válido
                        </div>
                      )}

                      {linkedAction && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            Plan vinculado: {linkedAction.title || linkedAction.id}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${actionStatusColor(
                              linkedAction.status
                            )}`}
                          >
                            Estado plan: {linkedAction.status || 'abierto'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 xl:min-w-[280px]">
                      <MiniInfoCard label="Responsable" value={row.owner || '-'} />
                      <MiniInfoCard label="Detectado por" value={row.detected_by || '-'} />
                      <MiniInfoCard
                        label="Vencimiento"
                        value={row.due_date ? String(row.due_date).slice(0, 10) : '-'}
                      />
                      <MiniInfoCard
                        label="Control"
                        value={hasValidControl ? 'Asociado' : 'Pendiente'}
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {row.description || 'Sin descripción'}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <FieldBlock label="Control asociado">
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {hasValidControl
                            ? `${row.control_iso || row.iso_code} ${row.control_clause || ''} — ${
                                row.control_description || 'Control vinculado'
                              }`
                            : 'Sin control asociado'}
                        </div>
                      ) : (
                        <select
                          value={row.tenant_control_modern_id || ''}
                          onChange={(e) =>
                            updateFinding(row, { tenant_control_id: e.target.value })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          <option value="">Selecciona el control asociado</option>
                          {controls.map((control: any) => (
                            <option
                              key={control.tenant_control_id}
                              value={control.tenant_control_id}
                            >
                              {control.iso} · {control.clause || 'Sin cláusula'} —{' '}
                              {control.description}
                            </option>
                          ))}
                        </select>
                      )}
                    </FieldBlock>

                    <FieldBlock label="Estado">
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.status}
                        </div>
                      ) : (
                        <select
                          value={row.status}
                          onChange={(e) =>
                            updateFinding(row, { status: e.target.value })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        >
                          <option value="abierto">Abierto</option>
                          <option value="en revision">En revisión</option>
                          <option value="accion definida">Acción definida</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      )}
                    </FieldBlock>

                    <FieldBlock label="Responsable">
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.owner || '-'}
                        </div>
                      ) : (
                        <input
                          value={row.owner || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setData((prev) =>
                              prev.map((p) => (p.id === row.id ? { ...p, owner: value } : p))
                            );
                          }}
                          onBlur={(e) => updateFinding(row, { owner: e.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      )}
                    </FieldBlock>

                    <FieldBlock label="Detectado por">
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.detected_by || '-'}
                        </div>
                      ) : (
                        <input
                          value={row.detected_by || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setData((prev) =>
                              prev.map((p) =>
                                p.id === row.id ? { ...p, detected_by: value } : p
                              )
                            );
                          }}
                          onBlur={(e) =>
                            updateFinding(row, { detected_by: e.target.value })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      )}
                    </FieldBlock>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <FieldBlock label="Vencimiento">
                      {isReadOnly ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {row.due_date ? String(row.due_date).slice(0, 10) : '-'}
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={row.due_date ? String(row.due_date).slice(0, 10) : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setData((prev) =>
                              prev.map((p) =>
                                p.id === row.id ? { ...p, due_date: value } : p
                              )
                            );
                          }}
                          onBlur={(e) =>
                            updateFinding(row, { due_date: e.target.value || null })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      )}
                    </FieldBlock>

                    <FieldBlock label="Acciones disponibles">
                      <div className="flex flex-wrap gap-2">
                        {!isReadOnly && row.finding_type !== 'fortaleza' && (
                          <button
                            onClick={() => createAction(row)}
                            disabled={
                              row.has_action_plan ||
                              !!linkedAction ||
                              actionLoading === row.id ||
                              !hasValidControl
                            }
                            className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {row.has_action_plan || linkedAction
                              ? 'Acción ya creada'
                              : !hasValidControl
                              ? 'Falta control asociado'
                              : actionLoading === row.id
                              ? 'Creando...'
                              : 'Crear acción'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAnalyzeFindingWithAI(row)}
                          disabled={aiMode === 'analysis'}
                          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                        >
                          {aiMode === 'analysis' ? 'IA analizando...' : 'IA análisis'}
                        </button>

                        {!isReadOnly && row.finding_type !== 'fortaleza' && (
                          <button
                            type="button"
                            onClick={() => handleSuggestPlanWithAI(row)}
                            disabled={aiMode === 'plan'}
                            className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 disabled:opacity-60"
                          >
                            {aiMode === 'plan'
                              ? 'IA generando...'
                              : 'IA plan sugerido'}
                          </button>
                        )}

                        {!isReadOnly && (
                          <button
                            onClick={() => deleteFinding(row.id)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        )}

                        {savingId === row.id && (
                          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                            Guardando...
                          </div>
                        )}
                      </div>
                    </FieldBlock>
                  </div>

                  {(analysisData || suggestedPlanData) && (
                    <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            Asistencia IA para este hallazgo
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Guía accionable para cerrar brechas, mejorar salud y respaldar KPIs.
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {analysisData?.priority && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              Prioridad análisis: {analysisData.priority}
                            </span>
                          )}

                          {suggestedPlanData?.priority && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              Prioridad plan: {suggestedPlanData.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      {analysisData && (
                        <div className="rounded-[22px] border border-slate-200 bg-white p-4 space-y-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">
                            Análisis IA
                          </div>

                          <AiGuidedPanel
                            guided={getGuidedAi(analysis)}
                            rowId={row.id}
                            row={row}
                            response={analysis}
                          />

                          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <summary className="cursor-pointer text-sm font-bold text-slate-700">
                              Ver análisis tradicional
                            </summary>

                            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                              {analysisData.summary && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                    Resumen
                                  </div>
                                  <div className="mt-2 leading-6">{safeAiText(analysisData.summary)}</div>
                                </div>
                              )}

                              {analysisData.impact && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                    Impacto
                                  </div>
                                  <div className="mt-2 leading-6">{safeAiText(analysisData.impact)}</div>
                                </div>
                              )}

                              <AiList
                                title="Posibles causas"
                                items={asTextArray(analysisData.likely_causes)}
                                tone="amber"
                              />
                              <AiList
                                title="Acciones sugeridas"
                                items={asTextArray(analysisData.recommended_actions)}
                                tone="blue"
                              />
                            </div>
                          </details>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyAnalysisToFinding(row)}
                              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              {aiApplyLoadingId === `analysis-${row.id}`
                                ? 'Aplicando...'
                                : 'Aplicar análisis IA'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                saveAiSuggestion({
                                  suggestionType: 'finding_analysis',
                                  title: `Análisis IA - ${row.title}`,
                                  sourceEntityType: 'finding',
                                  sourceEntityId: row.id,
                                  inputPayload: analysis?.context || {},
                                  outputPayload: {
                                    legacy: analysisData,
                                    guided: getGuidedAi(analysis),
                                  },
                                  confidence: analysisData.confidence,
                                })
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {aiSaveLoadingId === `finding_analysis-${row.id}`
                                ? 'Guardando...'
                                : 'Guardar borrador IA'}
                            </button>

                            <AiFeedbackButtons
                              row={row}
                              response={analysis}
                              responseType="finding_analysis"
                            />

                          </div>
                        </div>
                      )}

                      {suggestedPlanData && (
                        <div className="rounded-[22px] border border-slate-200 bg-white p-4 space-y-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">
                            Plan sugerido IA
                          </div>

                          <AiGuidedPanel
                            guided={getGuidedAi(suggestedPlan)}
                            rowId={`${row.id}-plan`}
                            row={row}
                            response={suggestedPlan}
                          />

                          {suggestedPlanData.objective && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                Objetivo
                              </div>
                              <div className="mt-2 leading-6">{safeAiText(suggestedPlanData.objective)}</div>
                            </div>
                          )}

                          <AiList
                            title="Acciones inmediatas"
                            items={asTextArray(suggestedPlanData.immediate_actions)}
                            tone="blue"
                          />

                          {(suggestedPlanData.action_plan || []).length > 0 && (
                            <div className="text-sm text-slate-700">
                              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                Plan propuesto
                              </div>
                              <div className="mt-3 space-y-2">
                                {(suggestedPlanData.action_plan || []).map(
                                  (step: any, index: number) => (
                                    <div
                                      key={`${row.id}-step-${step.step}-${index}`}
                                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                      <div className="font-semibold text-slate-800">
                                        Paso {step.step}: {safeAiText(step.title)}
                                      </div>
                                      <div className="mt-1 text-slate-600">
                                        {safeAiText(step.description)}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        Responsable sugerido: {safeAiText(step.owner_role)} · Plazo:{' '}
                                        {safeAiText(step.target_days)} días
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          <AiList
                            title="Criterios de cierre"
                            items={asTextArray(suggestedPlanData.success_criteria)}
                            tone="amber"
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            {linkedAction ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleApplySuggestedPlanToAction(row, linkedAction)
                                }
                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                {aiApplyLoadingId === `plan-${row.id}`
                                  ? 'Aplicando...'
                                  : 'Aplicar plan IA al plan'}
                              </button>
                            ) : (
                              !isReadOnly &&
                              row.finding_type !== 'fortaleza' && (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                                  Primero crea la acción oficial del sistema y luego aplica
                                  este plan IA.
                                </div>
                              )
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                saveAiSuggestion({
                                  suggestionType: 'action_plan_suggestion',
                                  title: `Plan IA - ${row.title}`,
                                  sourceEntityType: 'finding',
                                  sourceEntityId: row.id,
                                  inputPayload: suggestedPlan?.context || {},
                                  outputPayload: {
                                    legacy: suggestedPlanData,
                                    guided: getGuidedAi(suggestedPlan),
                                  },
                                  confidence: suggestedPlanData.confidence,
                                })
                              }
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {aiSaveLoadingId === `action_plan_suggestion-${row.id}`
                                ? 'Guardando...'
                                : 'Guardar borrador IA'}
                            </button>

                            <AiFeedbackButtons
                              row={row}
                              response={suggestedPlan}
                              responseType="action_plan_suggestion"
                            />

                          </div>
                        </div>
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

function MiniInfoCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
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

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: 'slate' | 'red' | 'amber' | 'blue' | 'emerald' | 'violet';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white',
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
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
