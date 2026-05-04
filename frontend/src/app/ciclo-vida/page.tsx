'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import ObjectivesPanel from '@/components/objectives/ObjectivesPanel';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel } from '@/i18n/statusLabels';

type StageDef = {
  code: string;
  name: string;
  sort_order: number;
};

type LifecycleCard = {
  id: string;
  tenant_id: string;
  standard_code: string;
  operation_id: string;
  calculated_stage_code: string;
  confirmed_stage_code: string | null;
  effective_stage_code: string;
  pending_stage_code: string | null;
  pending_request_id: string | null;
  pending_requested_by: string | null;
  pending_requested_at: string | null;
  health_status: string;
  maturity_score: string | number;
  catalog_controls_count: number;
  enabled_controls_count: number;
  controls_enabled_pct: string | number;
  controls_with_evidence_count: number;
  evidence_coverage_pct: string | number;
  avg_health_score: string | number;
  open_nonconformities_count: number;
  open_findings_count: number;
  open_action_plans_count: number;
  open_audits_count: number;
  last_activity_at: string | null;
  operation_name: string;
  operation_code: string;
  operation_type: string;
  tenant_name: string;
  catalog_mode: string | null;
  display_stage_code: string;
  is_pending_confirmation: boolean;
  stage_health: string;
  pending_request_row_id: string | null;
  from_stage_code: string | null;
  to_stage_code: string | null;
  request_status: string | null;
  request_reason: string | null;
  request_source: string | null;
  requested_at: string | null;
  review_comment: string | null;
  pending_requested_by_email: string | null;
  pending_reviewed_by_email: string | null;
};

type BoardColumn = {
  stage_code: string;
  stage_name: string;
  sort_order: number;
  items: LifecycleCard[];
};

type BoardResponse = {
  ok: boolean;
  tenant_id: string;
  filters: {
    standard_code: string | null;
    operation_id: string | null;
  };
  columns: BoardColumn[];
  stages: StageDef[];
};

type MeResponse = {
  tenant_id?: string;
  tenantId?: string;
  role?: string;
  email?: string;
  full_name?: string;
};

type DragPayload = {
  standard_code: string;
  operation_id: string;
  from_stage_code: string;
};

type ScopeOperation = {
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

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean;
  active_operation_ids?: string[];
};

type ScopeResponse = {
  operations: ScopeOperation[];
  standards: ScopeStandard[];
};

type LifecycleHistoryRow = {
  id: string | null;
  tenant_id: string;
  standard_code: string | null;
  operation_id: string | null;
  operation_name: string | null;
  from_stage_code: string | null;
  from_stage_name: string | null;
  to_stage_code: string | null;
  to_stage_name: string | null;
  request_status: string | null;
  request_status_label: string | null;
  request_reason: string | null;
  request_source: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  requested_by_email: string | null;
  requested_by_name: string | null;
  reviewed_by_email: string | null;
  reviewed_by_name: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function resolveTenantIdFromToken(): string {
  const user = getUserFromToken?.();
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function resolveRoleFromToken(): string {
  const user = getUserFromToken?.();
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function formatPct(value: string | number | null | undefined) {
  return `${Number(value || 0).toFixed(0)}%`;
}

function formatScore(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sin actividad';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin actividad';
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function prettifyStage(
  code: string | null | undefined,
  stages: StageDef[],
  t?: (key: string, params?: Record<string, any>) => string
) {
  if (!code) return t ? t('lifecycle.noStage') : 'Sin etapa';

  const normalizedCode = String(code || '').trim();
  const translatedKey = `lifecycle.stages.${normalizedCode}`;

  if (t) {
    const translated = t(translatedKey);
    if (translated && translated !== translatedKey) {
      return translated;
    }
  }

  const found = stages.find((s) => s.code === normalizedCode);
  return found?.name || normalizedCode;
}

function healthClasses(health: string) {
  const h = String(health || '').toLowerCase();

  if (h === 'saludable') {
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  if (h === 'deteriorado') {
    return 'bg-rose-100 text-rose-700 border border-rose-200';
  }

  return 'bg-amber-100 text-amber-700 border border-amber-200';
}

function stageHeaderClasses(stageCode: string) {
  switch (stageCode) {
    case 'diagnostico':
      return 'bg-slate-100 text-slate-700';
    case 'diseno_planificacion':
      return 'bg-sky-100 text-sky-700';
    case 'implementacion':
      return 'bg-indigo-100 text-indigo-700';
    case 'verificacion_auditoria':
      return 'bg-violet-100 text-violet-700';
    case 'certificacion':
      return 'bg-cyan-100 text-cyan-700';
    case 'mejora_continua':
      return 'bg-emerald-100 text-emerald-700';
    case 'suspendida_fuera_alcance':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function stageAccentClasses(stageCode: string) {
  switch (stageCode) {
    case 'diagnostico':
      return 'from-slate-500 to-slate-300';
    case 'diseno_planificacion':
      return 'from-sky-500 to-sky-300';
    case 'implementacion':
      return 'from-indigo-500 to-indigo-300';
    case 'verificacion_auditoria':
      return 'from-violet-500 to-violet-300';
    case 'certificacion':
      return 'from-cyan-500 to-cyan-300';
    case 'mejora_continua':
      return 'from-emerald-500 to-emerald-300';
    case 'suspendida_fuera_alcance':
      return 'from-rose-500 to-rose-300';
    default:
      return 'from-slate-500 to-slate-300';
  }
}

function cardHealthRing(health: string) {
  const h = String(health || '').toLowerCase();
  if (h === 'saludable') return 'border-emerald-200 hover:border-emerald-300';
  if (h === 'deteriorado') return 'border-rose-200 hover:border-rose-300';
  return 'border-amber-200 hover:border-amber-300';
}

export default function CicloVidaPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [selectedStandard, setSelectedStandard] = useState<string>('ALL');
  const [selectedOperation, setSelectedOperation] = useState<string>('ALL');
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectedPendingCard, setSelectedPendingCard] = useState<LifecycleCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<LifecycleCard | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [requestReason, setRequestReason] = useState<string>('');
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [topPanelCollapsed, setTopPanelCollapsed] = useState(true);
  const [activeView, setActiveView] = useState<'lifecycle' | 'objectives' | 'history'>('lifecycle');
  const [historyRows, setHistoryRows] = useState<LifecycleHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isAuditor = userRole === 'auditor';

  const isViewer =
    userRole === 'viewer' ||
    userRole === 'cliente' ||
    userRole === 'client' ||
    userRole === 'solo_lectura' ||
    userRole === 'read_only' ||
    userRole === 'readonly' ||
    userRole === 'ejecutivo';

  const canUseObjectives = !isViewer;
  const canRequestLifecycleMove = !isViewer;

  const canReviewLifecycleMove =
    isAuditor ||
    userRole === 'admin' ||
    userRole === 'tenant_admin' ||
    userRole === 'superadmin';

  useEffect(() => {
    if (!canUseObjectives && activeView === 'objectives') {
      setActiveView('lifecycle');
    }
  }, [canUseObjectives, activeView]);

  async function fetchMe(currentToken: string): Promise<MeResponse | null> {
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loadScope(resolvedTenantId: string) {
    const token = getToken();
    if (!token || !resolvedTenantId) return;

    const res = await fetch(`${API_URL}/api/tenant-standards/scope/${resolvedTenantId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.detail || data?.error || t('lifecycle.errors.loadScope')
      );
    }

    setScope({
      operations: Array.isArray(data?.operations) ? data.operations : [],
      standards: Array.isArray(data?.standards) ? data.standards : [],
    });
  }

  async function loadBoard(
    resolvedTenantId: string,
    standardCode?: string,
    operationId?: string
  ) {
    const token = getToken();
    if (!token || !resolvedTenantId) return;

    const params = new URLSearchParams();

    if (standardCode && standardCode !== 'ALL') {
      params.set('standard_code', standardCode);
    }

    if (operationId && operationId !== 'ALL') {
      params.set('operation_id', operationId);
    }

    const url = `${API_URL}/api/lifecycle/board/${resolvedTenantId}${
      params.toString() ? `?${params.toString()}` : ''
    }`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.detail || data?.error || t('lifecycle.errors.loadBoard')
      );
    }

    setBoard(data);
  }

  async function refreshBoard() {
    if (!tenantId) return;
    await loadBoard(tenantId, selectedStandard, selectedOperation);
  }

  async function loadHistory(resolvedTenantId: string) {
    const token = getToken();
    if (!token || !resolvedTenantId) return;

    try {
      setHistoryLoading(true);

      const params = new URLSearchParams();

      if (selectedStandard && selectedStandard !== 'ALL') {
        params.set('standard_code', selectedStandard);
      }

      if (selectedOperation && selectedOperation !== 'ALL') {
        params.set('operation_id', selectedOperation);
      }

      params.set('limit', '100');

      const url = `${API_URL}/api/lifecycle/history/${resolvedTenantId}${
        params.toString() ? `?${params.toString()}` : ''
      }`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.detail || data?.error || t('lifecycle.errors.loadHistory'));
      }

      setHistoryRows(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      setError(err?.message || t('lifecycle.errors.loadHistory'));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        setSuccessMessage('');

        const token = getToken();
        if (!token) {
          throw new Error(t('lifecycle.errors.noToken'));
        }

        let resolvedTenantId = resolveTenantIdFromToken();
        const resolvedRole = resolveRoleFromToken();
        setUserRole(resolvedRole);

        if (!resolvedTenantId) {
          const me = await fetchMe(token);
          resolvedTenantId = me?.tenant_id || me?.tenantId || '';
          if (!resolvedRole && me?.role) {
            setUserRole(String(me.role).toLowerCase());
          }
        }

        if (!resolvedTenantId) {
          throw new Error(t('lifecycle.errors.tenantResolve'));
        }

        setTenantId(resolvedTenantId);
        await loadScope(resolvedTenantId);
        await loadBoard(resolvedTenantId);
      } catch (err: any) {
        setError(err?.message || t('lifecycle.errors.loadLifecycle'));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!tenantId) return;

      try {
        setLoading(true);
        setError('');
        await loadBoard(tenantId, selectedStandard, selectedOperation);
      } catch (err: any) {
        setError(err?.message || t('lifecycle.errors.loadFilters'));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [selectedStandard, selectedOperation, tenantId]);

  useEffect(() => {
    if (activeView !== 'history' || !tenantId) return;
    void loadHistory(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, tenantId, selectedStandard, selectedOperation]);

  const activeStandards = useMemo(() => {
    return (scope.standards || []).filter((item) => item?.is_active === true);
  }, [scope.standards]);

  const activeStandardCodes = useMemo(
    () => new Set(activeStandards.map((item) => item.code)),
    [activeStandards]
  );

  const filteredBoard = useMemo(() => {
    if (!board) return null;

    const filteredColumns = board.columns.map((column) => ({
      ...column,
      items: column.items.filter((item) => activeStandardCodes.has(item.standard_code)),
    }));

    return {
      ...board,
      columns: filteredColumns,
    };
  }, [board, activeStandardCodes]);

  const allCards = useMemo(() => {
    if (!filteredBoard) return [];
    return filteredBoard.columns.flatMap((c) => c.items);
  }, [filteredBoard]);

  const pendingCards = useMemo(() => {
    return allCards.filter((card) => card.is_pending_confirmation);
  }, [allCards]);

  const standards = useMemo(() => {
    const visibleCodes = new Set(
      (filteredBoard?.columns || [])
        .flatMap((column) => column.items.map((item) => item.standard_code))
        .filter(Boolean)
    );

    return activeStandards
      .map((item) => item.code)
      .filter((code) => visibleCodes.has(code))
      .sort((a, b) => a.localeCompare(b));
  }, [activeStandards, filteredBoard]);

  const operations = useMemo(() => {
    const visibleOperationIds = new Set(
      allCards
        .filter((card) => selectedStandard === 'ALL' || card.standard_code === selectedStandard)
        .map((card) => card.operation_id)
        .filter(Boolean)
    );

    const operationMap = new Map<string, { id: string; name: string; code: string }>();

    for (const op of scope.operations || []) {
      if (!op.is_active) continue;
      if (!visibleOperationIds.has(op.id)) continue;

      operationMap.set(op.id, {
        id: op.id,
        name: op.name,
        code: op.code || 'N/D',
      });
    }

    return Array.from(operationMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [scope.operations, allCards, selectedStandard]);

  useEffect(() => {
    if (selectedStandard !== 'ALL' && !standards.includes(selectedStandard)) {
      setSelectedStandard('ALL');
    }
  }, [selectedStandard, standards]);

  useEffect(() => {
    if (selectedOperation !== 'ALL' && !operations.some((op) => op.id === selectedOperation)) {
      setSelectedOperation('ALL');
    }
  }, [selectedOperation, operations]);

  const summary = useMemo(() => {
    const totalCards = allCards.length;
    const healthy = allCards.filter((c) => c.health_status === 'saludable').length;
    const pending = allCards.filter((c) => c.is_pending_confirmation).length;
    const avg = totalCards
      ? allCards.reduce((acc, item) => acc + Number(item.maturity_score || 0), 0) /
        totalCards
      : 0;

    const stageStats = (filteredBoard?.columns || []).map((column) => ({
      stage_code: column.stage_code,
      stage_name: column.stage_name,
      total: column.items.length,
    }));

    const mostLoaded = [...stageStats].sort((a, b) => b.total - a.total)[0];

    const weakestByHealth = (filteredBoard?.columns || [])
      .map((column) => {
        const items = column.items;
        const avgHealth = items.length
          ? items.reduce((acc, item) => acc + Number(item.avg_health_score || 0), 0) /
            items.length
          : 0;

        return {
          stage_code: column.stage_code,
          stage_name: column.stage_name,
          avgHealth,
          total: items.length,
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => a.avgHealth - b.avgHealth)[0];

    return {
      totalCards,
      healthy,
      pending,
      avg,
      mostLoaded: mostLoaded?.stage_code || 'N/D',
      weakestStage: weakestByHealth?.stage_code || 'N/D',
    };
  }, [allCards, filteredBoard]);

  const selectedCardDetail = useMemo(() => {
    if (!selectedCard) return null;
    return allCards.find((item) => item.id === selectedCard.id) || null;
  }, [selectedCard, allCards]);

  const selectedPendingDetail = useMemo(() => {
    if (!selectedPendingCard) return null;
    return pendingCards.find((item) => item.id === selectedPendingCard.id) || null;
  }, [selectedPendingCard, pendingCards]);

  useEffect(() => {
    if (selectedCard && !selectedCardDetail) {
      setSelectedCard(null);
    }
  }, [selectedCard, selectedCardDetail]);

  useEffect(() => {
    if (selectedPendingCard && !selectedPendingDetail) {
      setSelectedPendingCard(null);
    }
  }, [selectedPendingCard, selectedPendingDetail]);

  function handleDragStart(card: LifecycleCard) {
    if (!canRequestLifecycleMove) {
      setError(t('lifecycle.errors.readOnlyMove'));
      return;
    }

    setDragging({
      standard_code: card.standard_code,
      operation_id: card.operation_id,
      from_stage_code: card.display_stage_code,
    });
    setSuccessMessage('');
    setError('');
  }

  function handleDragEnd() {
    setDragging(null);
    setDropTarget(null);
  }

  function handleDragOver(stageCode: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropTarget(stageCode);
  }

  async function handleDrop(stageCode: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();

    if (!dragging || !tenantId) return;

    if (!canRequestLifecycleMove) {
      setError(t('lifecycle.errors.readOnlyMove'));
      setDragging(null);
      return;
    }

    setDropTarget(null);

    if (dragging.from_stage_code === stageCode) {
      setDragging(null);
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccessMessage('');

      const token = getToken();
      const res = await fetch(`${API_URL}/api/lifecycle/request-move`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          standard_code: dragging.standard_code,
          operation_id: dragging.operation_id,
          to_stage_code: stageCode,
          request_reason:
            requestReason?.trim() ||
            t('lifecycle.manualMoveDefaultReason'),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.detail || data?.error || t('lifecycle.errors.requestMove')
        );
      }

      await refreshBoard();
      setSuccessMessage(
        t('lifecycle.moveSubmitted', {
          stage: prettifyStage(stageCode, filteredBoard?.stages || [], t),
        })
      );
      setRequestReason('');
    } catch (err: any) {
      setError(err?.message || t('lifecycle.errors.requestMove'));
    } finally {
      setActionLoading(false);
      setDragging(null);
    }
  }

  async function handleReviewRequest(action: 'confirmar' | 'rechazar') {
    if (!selectedPendingCard?.pending_request_row_id) return;

    if (!canReviewLifecycleMove) {
      setError(t('lifecycle.errors.reviewDenied'));
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccessMessage('');

      const token = getToken();
      const res = await fetch(
        `${API_URL}/api/lifecycle/requests/${selectedPendingCard.pending_request_row_id}/review`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            review_action: action,
            review_comment:
              action === 'confirmar'
                ? t('lifecycle.confirmComment')
                : t('lifecycle.rejectComment'),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || t('lifecycle.errors.reviewRequest'));
      }

      await refreshBoard();
      setSuccessMessage(
        action === 'confirmar'
          ? t('lifecycle.confirmedByAuditor')
          : t('lifecycle.rejectedByAuditor')
      );
      setSelectedPendingCard(null);
    } catch (err: any) {
      setError(err?.message || t('lifecycle.errors.reviewRequest'));
    } finally {
      setActionLoading(false);
    }
  }

  function goToControls(card: LifecycleCard) {
    router.push(
      `/controles?iso=${encodeURIComponent(card.standard_code)}&operation_id=${encodeURIComponent(card.operation_id)}`
    );
  }

  function goToFindings(card: LifecycleCard) {
    router.push(
      `/hallazgos?iso=${encodeURIComponent(card.standard_code)}&operation_id=${encodeURIComponent(card.operation_id)}`
    );
  }

  function goToActionPlans(card: LifecycleCard) {
    router.push(
      `/plan-accion?iso=${encodeURIComponent(card.standard_code)}&operation_id=${encodeURIComponent(card.operation_id)}`
    );
  }

  function goToAudits(card: LifecycleCard) {
    router.push(
      `/auditorias?iso=${encodeURIComponent(card.standard_code)}&operation_id=${encodeURIComponent(card.operation_id)}`
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1900px] space-y-6">
        <div className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                    {t('lifecycle.operationalKanban')}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t('lifecycle.realScope')}
                  </span>
                </div>

                <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                  {t('lifecycle.title')}
                </h1>

                <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                  {t('lifecycle.subtitle')}
                </p>

                <div className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setActiveView('lifecycle')}
                    className={[
                      'rounded-xl px-4 py-2 text-sm font-semibold transition',
                      activeView === 'lifecycle'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {t('lifecycle.lifecycleView')}
                  </button>

                  <button
                    type="button"
                    disabled={!canUseObjectives}
                    title={!canUseObjectives ? t('lifecycle.objectivesAccessDenied') : t('lifecycle.viewObjectives')}
                    onClick={() => {
                      if (!canUseObjectives) {
                        setError(t('lifecycle.objectivesAccessDenied'));
                        return;
                      }
                      setActiveView('objectives');
                    }}
                    className={[
                      'rounded-xl px-4 py-2 text-sm font-semibold transition',
                      activeView === 'objectives'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {t('lifecycle.objectivesView')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('history')}
                    className={[
                      'rounded-xl px-4 py-2 text-sm font-semibold transition',
                      activeView === 'history'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {t('lifecycle.historyView')}
                  </button>
                </div>
              </div>

              <div className="flex items-start justify-end">
                <button
                  type="button"
                  onClick={() => setTopPanelCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  title={topPanelCollapsed ? t('lifecycle.expandTopPanel') : t('lifecycle.collapseTopPanel')}
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${topPanelCollapsed ? '' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                  {topPanelCollapsed ? t('lifecycle.showFilters') : t('lifecycle.hideFilters')}
                </button>
              </div>
            </div>

            {activeView === 'lifecycle' && !topPanelCollapsed && (
              <>
                <div className="grid min-w-[320px] grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryTopCard
                    title={t('lifecycle.activeCards')}
                    value={summary.totalCards}
                    subtitle={t('lifecycle.visibleScope')}
                    tone="slate"
                  />
                  <SummaryTopCard
                    title={t('health.healthy')}
                    value={summary.healthy}
                    subtitle={t('lifecycle.favorableStatus')}
                    tone="green"
                  />
                  <SummaryTopCard
                    title={t('lifecycle.averageMaturity')}
                    value={`${formatScore(summary.avg)}%`}
                    subtitle={t('lifecycle.currentLevel')}
                    tone="indigo"
                  />
                  <SummaryTopCard
                    title={t('lifecycle.pendingAuditor')}
                    value={summary.pending}
                    subtitle={t('lifecycle.toConfirm')}
                    tone="amber"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('lifecycle.view')}
                    </label>
                    <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-medium text-slate-700">
                      {t('lifecycle.multiStandardGeneral')}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('lifecycle.contractedStandard')}
                    </label>
                    <select
                      value={selectedStandard}
                      onChange={(e) => {
                        setSelectedStandard(e.target.value);
                        setSelectedOperation('ALL');
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="ALL">{t('common.all')}</option>
                      {standards.map((standard) => (
                        <option key={standard} value={standard}>
                          {standard}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('lifecycle.operation')}
                    </label>
                    <select
                      value={selectedOperation}
                      onChange={(e) => setSelectedOperation(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="ALL">{t('common.all')}</option>
                      {operations.map((operation) => (
                        <option key={operation.id} value={operation.id}>
                          {operation.name} ({operation.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('lifecycle.mostLoadedStage')}
                    </label>
                    <div className="rounded-2xl bg-slate-100 px-3 py-3 text-sm font-medium text-slate-700">
                      {summary.mostLoaded === 'N/D' ? 'N/D' : prettifyStage(summary.mostLoaded, filteredBoard?.stages || [], t)}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('lifecycle.moveReason')}
                    </label>
                    <input
                      disabled={!canRequestLifecycleMove}
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      placeholder={t('lifecycle.auditOptional')}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InsightCard
                    title={t('lifecycle.weakestStage')}
                    value={summary.weakestStage === 'N/D' ? 'N/D' : prettifyStage(summary.weakestStage, filteredBoard?.stages || [], t)}
                    subtitle={t('lifecycle.lowestHealthAverage')}
                  />
                  <InsightCard
                    title={t('lifecycle.contractedStandards')}
                    value={activeStandards.length}
                    subtitle={t('lifecycle.visibleOnBoard')}
                  />
                  <InsightCard
                    title={t('lifecycle.controlledFlow')}
                    value={isAuditor ? t('lifecycle.auditorMode') : t('lifecycle.userMode')}
                    subtitle={
                      isAuditor
                        ? t('lifecycle.auditorModeSubtitle')
                        : t('lifecycle.userModeSubtitle')
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {successMessage ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
            {successMessage}
          </div>
        ) : null}

        {activeView === 'history' && (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
                  {t('lifecycle.auditableTraceability')}
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {t('lifecycle.movementHistory')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('lifecycle.movementHistorySubtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadHistory(tenantId)}
                disabled={historyLoading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {historyLoading ? t('common.refreshing') : t('lifecycle.refreshHistory')}
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              {historyLoading ? (
                <div className="p-6 text-sm text-slate-500">{t('lifecycle.loadingHistory')}</div>
              ) : historyRows.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  {t('lifecycle.noMovements')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{t('common.date')}</th>
                        <th className="px-4 py-3">{t('common.standard')}</th>
                        <th className="px-4 py-3">{t('lifecycle.operation')}</th>
                        <th className="px-4 py-3">{t('lifecycle.movement')}</th>
                        <th className="px-4 py-3">{t('common.status')}</th>
                        <th className="px-4 py-3">{t('lifecycle.requestedBy')}</th>
                        <th className="px-4 py-3">{t('lifecycle.reviewedBy')}</th>
                        <th className="px-4 py-3">{t('lifecycle.reasonComment')}</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {historyRows.map((row, index) => {
                        const status = String(row.request_status || '').toLowerCase();
                        const statusClass =
                          status.includes('rechaz')
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : status.includes('confirm') || status.includes('aprobad')
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700';

                        return (
                          <tr key={row.id || `${row.standard_code}-${row.operation_id}-${index}`} className="align-top">
                            <td className="px-4 py-3 text-slate-600">
                              {formatDateTime(row.requested_at || row.reviewed_at)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {row.standard_code || t('common.noData')}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.operation_name || row.operation_id || t('common.noData')}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <div className="font-semibold">
                                {row.from_stage_name || row.from_stage_code || t('lifecycle.noStage')}
                              </div>
                              <div className="text-xs text-slate-400">{t('lifecycle.to')}</div>
                              <div className="font-semibold">
                                {row.to_stage_name || row.to_stage_code || t('lifecycle.noStage')}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass}`}>
                                {row.request_status_label || row.request_status || t('statuses.evidence.pendiente')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.requested_by_name || row.requested_by_email || t('lifecycle.notReported')}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.reviewed_by_name || row.reviewed_by_email || t('statuses.evidence.pendiente')}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>{row.request_reason || t('lifecycle.noReason')}</div>
                              {row.review_comment && (
                                <div className="mt-1 rounded-xl bg-slate-50 p-2 text-xs text-slate-500">
                                  {row.review_comment}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {activeView === 'objectives' && canUseObjectives ? (
          <ObjectivesPanel
            tenantId={tenantId}
            standards={activeStandards.map((item) => ({
              code: item.code,
              name: item.name || item.code,
            }))}
          />
        ) : null}

        {activeView === 'lifecycle' && loading ? (
          <div className="rounded-[30px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {t('lifecycle.loadingBoard')}
          </div>
        ) : null}

        {activeView === 'lifecycle' && !loading && filteredBoard ? (
          <div
            className={`grid grid-cols-1 gap-6 ${
              rightPanelCollapsed ? 'xl:grid-cols-[1fr_64px]' : 'xl:grid-cols-[1fr_430px]'
            }`}
          >
            <div className="overflow-x-auto">
              <div className="flex min-w-[1860px] gap-5">
                {filteredBoard.columns.map((column) => {
                  const healthyCount = column.items.filter(
                    (item) => item.health_status === 'saludable'
                  ).length;
                  const attentionCount = column.items.filter(
                    (item) => item.health_status === 'atencion'
                  ).length;
                  const deterioratedCount = column.items.filter(
                    (item) => item.health_status === 'deteriorado'
                  ).length;
                  const avgMaturity = column.items.length
                    ? column.items.reduce(
                        (acc, item) => acc + Number(item.maturity_score || 0),
                        0
                      ) / column.items.length
                    : 0;

                  return (
                    <div
                      key={column.stage_code}
                      onDragOver={(e) => handleDragOver(column.stage_code, e)}
                      onDrop={(e) => handleDrop(column.stage_code, e)}
                      className={`w-[395px] flex-shrink-0 rounded-[30px] border bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition ${
                        dropTarget === column.stage_code
                          ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-[0_18px_40px_rgba(79,70,229,0.16)]'
                          : 'border-slate-200'
                      }`}
                    >
                      <div
                        className={`rounded-t-[30px] px-4 py-4 ${stageHeaderClasses(
                          column.stage_code
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-bold">{prettifyStage(column.stage_code, filteredBoard?.stages || [], t)}</h2>
                            <p className="mt-1 text-xs opacity-80">
                              {t('lifecycle.cardsCount', { count: column.items.length })}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">
                            {column.items.length}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <div className="font-semibold">{t('health.healthy')}</div>
                            <div>{healthyCount}</div>
                          </div>
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <div className="font-semibold">{t('statuses.controls.atencion')}</div>
                            <div>{attentionCount}</div>
                          </div>
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <div className="font-semibold">{t('health.deteriorated')}</div>
                            <div>{deterioratedCount}</div>
                          </div>
                          <div className="rounded-xl bg-white/70 px-3 py-2">
                            <div className="font-semibold">{t('lifecycle.maturity')}</div>
                            <div>{formatScore(avgMaturity)}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-4">
                        {column.items.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-400">
                            {t('lifecycle.dropCardHere')}
                          </div>
                        ) : null}

                        {column.items.map((card) => (
                          <div
                            key={card.id}
                            draggable={!card.is_pending_confirmation && !actionLoading}
                            onDragStart={() => handleDragStart(card)}
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              if (card.is_pending_confirmation) {
                                setSelectedPendingCard(card);
                                if (rightPanelCollapsed) setRightPanelCollapsed(false);
                              } else {
                                setSelectedCard(card);
                                if (rightPanelCollapsed) setRightPanelCollapsed(false);
                              }
                            }}
                            className={`rounded-[24px] border bg-white p-4 shadow-sm transition ${
                              card.is_pending_confirmation
                                ? 'cursor-pointer'
                                : 'cursor-grab active:cursor-grabbing'
                            } ${cardHealthRing(card.health_status)} ${
                              dragging?.standard_code === card.standard_code &&
                              dragging?.operation_id === card.operation_id
                                ? 'scale-[0.99] opacity-60 shadow-xl'
                                : 'hover:shadow-md'
                            } ${card.is_pending_confirmation ? 'opacity-95' : ''}`}
                          >
                            <div
                              className={`mb-4 h-1.5 rounded-full bg-gradient-to-r ${stageAccentClasses(
                                column.stage_code
                              )}`}
                            />

                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                                    {card.standard_code}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                    {card.operation_name}
                                  </span>
                                  {card.display_stage_code === 'certificacion' ? (
                                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                                      {t('lifecycle.certification')}
                                    </span>
                                  ) : null}
                                  {card.display_stage_code === 'suspendida_fuera_alcance' ? (
                                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                      {t('lifecycle.suspendedOutOfScope')}
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-3 text-base font-bold text-slate-900">
                                  {card.standard_code} · {card.operation_name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {t('lifecycle.operationCode')}: {card.operation_code} · {t('lifecycle.catalogMode')}:{' '}
                                  {card.catalog_mode || t('common.noData')}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthClasses(
                                    card.health_status
                                  )}`}
                                >
                                  {card.health_status}
                                </span>
                                {!card.is_pending_confirmation ? (
                                  <span className="text-slate-300" title={t('lifecycle.dragCard')}>
                                    ⋮⋮
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                    {t('lifecycle.toConfirm')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {card.is_pending_confirmation ? (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                <div className="font-semibold">{t('lifecycle.pendingMovement')}</div>
                                <div className="mt-1">
                                  {t('lifecycle.from')}: {prettifyStage(card.from_stage_code, filteredBoard.stages)}
                                </div>
                                <div className="mt-1">
                                  {t('lifecycle.to')}: {prettifyStage(card.to_stage_code, filteredBoard.stages)}
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                  {t('lifecycle.maturity')}
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                  {formatScore(card.maturity_score)}%
                                </p>
                              </div>

                              <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                                  {t('lifecycle.healthScore')}
                                </p>
                                <p className="mt-1 text-lg font-bold text-slate-900">
                                  {formatScore(card.avg_health_score)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                                <span>{t('lifecycle.enabledControls')}</span>
                                <span>{formatPct(card.controls_enabled_pct)}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-slate-900"
                                  style={{
                                    width: `${Math.min(
                                      Number(card.controls_enabled_pct || 0),
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {card.enabled_controls_count} / {card.catalog_controls_count}
                              </p>
                            </div>

                            <div className="mt-4">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                                <span>{t('lifecycle.evidenceCoverage')}</span>
                                <span>{formatPct(card.evidence_coverage_pct)}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-cyan-500"
                                  style={{
                                    width: `${Math.min(
                                      Number(card.evidence_coverage_pct || 0),
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {t('lifecycle.controlsWithEvidence', { count: card.controls_with_evidence_count })}
                              </p>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                                {t('lifecycle.openNonconformities')}: <strong>{card.open_nonconformities_count}</strong>
                              </div>
                              <div className="rounded-xl bg-violet-50 px-3 py-2 text-violet-700">
                                {t('sidebar.findings')}: <strong>{card.open_findings_count}</strong>
                              </div>
                              <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
                                {t('health.plan')}: <strong>{card.open_action_plans_count}</strong>
                              </div>
                              <div className="rounded-xl bg-sky-50 px-3 py-2 text-sky-700">
                                {t('sidebar.audits')}: <strong>{card.open_audits_count}</strong>
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                              <span>{t('lifecycle.lastActivity')}</span>
                              <span>{formatDate(card.last_activity_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rightPanelCollapsed ? (
              <aside className="sticky top-0 self-start">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(false)}
                    className="flex h-full min-h-[220px] w-16 flex-col items-center justify-center gap-4 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    title={t('lifecycle.showSidePanel')}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <span className="rotate-180 text-[11px] font-semibold uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
                      {t('lifecycle.panel')}
                    </span>
                  </button>
                </div>
              </aside>
            ) : (
              <aside className="space-y-6">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    title="Colapsar panel lateral"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    {t('lifecycle.hideSidePanel')}
                  </button>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t('lifecycle.auditorValidation')}
                      </p>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {t('lifecycle.pendingRequests')}
                      </h3>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {t('kpiAdmin.pendingCount', { count: pendingCards.length })}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {pendingCards.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-400">
                        {t('lifecycle.noPendingMovements')}
                      </div>
                    ) : (
                      pendingCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setSelectedPendingCard(card)}
                          className={`w-full rounded-[22px] border p-4 text-left transition ${
                            selectedPendingDetail?.id === card.id
                              ? 'border-indigo-300 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {card.standard_code} · {card.operation_name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {prettifyStage(card.from_stage_code, filteredBoard.stages)} →{' '}
                                {prettifyStage(card.to_stage_code, filteredBoard.stages)}
                              </div>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              {t('lifecycle.toConfirm')}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {selectedPendingDetail ? (
                    <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">
                        {selectedPendingDetail.standard_code} · {selectedPendingDetail.operation_name}
                      </p>

                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        <div>
                          <span className="font-semibold">{t('lifecycle.currentStage')}:</span>{' '}
                          {prettifyStage(selectedPendingDetail.from_stage_code, filteredBoard.stages)}
                        </div>
                        <div>
                          <span className="font-semibold">{t('lifecycle.requestedStage')}:</span>{' '}
                          {prettifyStage(selectedPendingDetail.to_stage_code, filteredBoard.stages)}
                        </div>
                        <div>
                          <span className="font-semibold">{t('lifecycle.requested')}:</span>{' '}
                          {formatDateTime(selectedPendingDetail.requested_at)}
                        </div>
                        <div>
                          <span className="font-semibold">{t('lifecycle.requester')}:</span>{' '}
                          {selectedPendingDetail.pending_requested_by_email || t('lifecycle.notReported')}
                        </div>
                        <div>
                          <span className="font-semibold">{t('lifecycle.reason')}:</span>{' '}
                          {selectedPendingDetail.request_reason || t('lifecycle.noReasonShort')}
                        </div>
                        <div>
                          <span className="font-semibold">{t('health.health')}:</span>{' '}
                          {selectedPendingDetail.health_status}
                        </div>
                        <div>
                          <span className="font-semibold">{t('lifecycle.maturity')}:</span>{' '}
                          {formatScore(selectedPendingDetail.maturity_score)}%
                        </div>
                      </div>

                      {isAuditor ? (
                        <div className="mt-5 flex gap-3">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleReviewRequest('confirmar')}
                            className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t('lifecycle.confirmProgress')}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleReviewRequest('rechazar')}
                            className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t('lifecycle.reject')}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                          {t('lifecycle.auditorOnly')}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t('lifecycle.cardDetail')}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {t('lifecycle.quickAccess')}
                  </h3>

                  {!selectedCardDetail ? (
                    <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-400">
                      {t('lifecycle.selectCard')}
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-bold text-slate-900">
                          {selectedCardDetail.standard_code} · {selectedCardDetail.operation_name}
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div>
                            <span className="font-semibold">{t('lifecycle.visibleStage')}:</span>{' '}
                            {prettifyStage(selectedCardDetail.display_stage_code, filteredBoard.stages)}
                          </div>
                          <div>
                            <span className="font-semibold">{t('lifecycle.confirmedStage')}:</span>{' '}
                            {prettifyStage(selectedCardDetail.confirmed_stage_code, filteredBoard.stages)}
                          </div>
                          <div>
                            <span className="font-semibold">{t('lifecycle.calculatedStage')}:</span>{' '}
                            {prettifyStage(selectedCardDetail.calculated_stage_code, filteredBoard.stages)}
                          </div>
                          <div>
                            <span className="font-semibold">{t('statuses.evidence.pendiente')}:</span>{' '}
                            {selectedCardDetail.pending_stage_code
                              ? prettifyStage(
                                  selectedCardDetail.pending_stage_code,
                                  filteredBoard.stages
                                )
                              : t('common.no')}
                          </div>
                          <div>
                            <span className="font-semibold">{t('health.health')}:</span>{' '}
                            {selectedCardDetail.health_status}
                          </div>
                          <div>
                            <span className="font-semibold">{t('lifecycle.maturity')}:</span>{' '}
                            {formatScore(selectedCardDetail.maturity_score)}%
                          </div>
                          <div>
                            <span className="font-semibold">Health score:</span>{' '}
                            {formatScore(selectedCardDetail.avg_health_score)}
                          </div>
                          <div>
                            <span className="font-semibold">{t('lifecycle.catalogMode')}:</span>{' '}
                            {selectedCardDetail.catalog_mode || t('common.noData')}
                          </div>
                          <div>
                            <span className="font-semibold">{t('lifecycle.lastActivity')}:</span>{' '}
                            {formatDate(selectedCardDetail.last_activity_at)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            {t('lifecycle.evidenceCoverage')}
                          </div>
                          <div className="mt-2 text-lg font-bold text-slate-900">
                            {formatPct(selectedCardDetail.evidence_coverage_pct)}
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            {t('lifecycle.activeControls')}
                          </div>
                          <div className="mt-2 text-lg font-bold text-slate-900">
                            {selectedCardDetail.enabled_controls_count}/
                            {selectedCardDetail.catalog_controls_count}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => goToControls(selectedCardDetail)}
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {t('lifecycle.goToControls')}
                        </button>

                        <button
                          type="button"
                          onClick={() => goToFindings(selectedCardDetail)}
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {t('lifecycle.goToFindings')}
                        </button>

                        <button
                          type="button"
                          onClick={() => goToActionPlans(selectedCardDetail)}
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {t('lifecycle.goToActionPlan')}
                        </button>

                        <button
                          type="button"
                          onClick={() => goToAudits(selectedCardDetail)}
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {t('lifecycle.goToAudits')}
                        </button>
                      </div>

                      <div className="mt-4 rounded-[22px] border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">
                        {t('lifecycle.aiReadyNote')}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

function SummaryTopCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: 'slate' | 'green' | 'indigo' | 'amber';
}) {
  const toneMap: Record<string, string> = {
    slate: 'bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] border-slate-200',
    green: 'bg-[linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] border-emerald-200',
    indigo: 'bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] border-indigo-200',
    amber: 'bg-[linear-gradient(180deg,#ffffff_0%,#fffbeb_100%)] border-amber-200',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}
