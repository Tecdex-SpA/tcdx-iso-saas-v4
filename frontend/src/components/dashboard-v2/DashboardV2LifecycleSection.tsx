'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { getStoredValidToken, getTenantIdFromToken, getUserRoleFromToken } from '@/utils/auth';
import { chipClass, formatDateTime, formatNumber, formatPercent, scoreClass, statusLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

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
  pending_request_row_id: string | null;
  health_status: string;
  maturity_score: string | number;
  controls_enabled_pct: string | number;
  evidence_coverage_pct: string | number;
  avg_health_score: string | number;
  open_nonconformities_count: number;
  open_findings_count: number;
  open_action_plans_count: number;
  open_audits_count: number;
  last_activity_at: string | null;
  operation_name: string;
  operation_code: string;
  display_stage_code: string;
  is_pending_confirmation: boolean;
  request_reason?: string | null;
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
  columns: BoardColumn[];
  stages: StageDef[];
};

type ScopeResponse = {
  operations: Array<{ id: string; name: string; code?: string | null; is_active: boolean }>;
  standards: Array<{ code: string; name?: string; is_active?: boolean }>;
};

type HistoryRow = {
  id: string | null;
  standard_code: string | null;
  operation_name: string | null;
  from_stage_name: string | null;
  to_stage_name: string | null;
  request_status_label: string | null;
  request_reason: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
};

type DragPayload = {
  standard_code: string;
  operation_id: string;
  from_stage_code: string;
};

async function fetchJson(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.detail || json?.error || `No fue posible consultar ${path}`);
  }
  return json;
}

function nextStage(card: LifecycleCard, stages: StageDef[]) {
  const current = card.display_stage_code || card.effective_stage_code;
  const ordered = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  const index = ordered.findIndex((stage) => stage.code === current);
  return index >= 0 ? ordered[index + 1] || null : null;
}

export default function DashboardV2LifecycleSection() {
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selectedStandard, setSelectedStandard] = useState('ALL');
  const [selectedOperation, setSelectedOperation] = useState('ALL');
  const [selectedCard, setSelectedCard] = useState<LifecycleCard | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isViewer = ['viewer', 'cliente', 'client', 'solo_lectura', 'read_only', 'readonly', 'ejecutivo'].includes(role);
  const canRequestMove = !isViewer;
  const canReview = ['admin', 'tenant_admin', 'superadmin', 'auditor'].includes(role);

  const activeStandards = useMemo(
    () => scope.standards.filter((item) => item.is_active === true),
    [scope.standards]
  );

  const activeStandardCodes = useMemo(
    () => new Set(activeStandards.map((item) => item.code)),
    [activeStandards]
  );

  const filteredColumns = useMemo(() => {
    if (!board) return [];
    return board.columns.map((column) => ({
      ...column,
      items: column.items.filter((item) => activeStandardCodes.has(item.standard_code)),
    }));
  }, [activeStandardCodes, board]);

  const allCards = useMemo(
    () => filteredColumns.flatMap((column) => column.items),
    [filteredColumns]
  );

  const pendingCards = useMemo(
    () => allCards.filter((card) => card.is_pending_confirmation),
    [allCards]
  );

  const standards = useMemo(() => {
    const visible = new Set(allCards.map((card) => card.standard_code).filter(Boolean));
    return activeStandards.map((item) => item.code).filter((code) => visible.has(code)).sort();
  }, [activeStandards, allCards]);

  const operations = useMemo(() => {
    const visible = new Set(
      allCards
        .filter((card) => selectedStandard === 'ALL' || card.standard_code === selectedStandard)
        .map((card) => card.operation_id)
    );
    return scope.operations.filter((op) => op.is_active && visible.has(op.id));
  }, [allCards, scope.operations, selectedStandard]);

  const summary = useMemo(() => {
    const total = allCards.length;
    const healthy = allCards.filter((card) => card.health_status === 'saludable').length;
    const attention = allCards.filter((card) => card.health_status === 'atencion').length;
    const deteriorated = allCards.filter((card) => card.health_status === 'deteriorado').length;
    const avg = total
      ? allCards.reduce((sum, card) => sum + Number(card.maturity_score || 0), 0) / total
      : 0;

    return {
      total,
      healthy,
      attention,
      deteriorated,
      pending: pendingCards.length,
      avg,
      openIssues: allCards.reduce((sum, card) =>
        sum +
        Number(card.open_nonconformities_count || 0) +
        Number(card.open_findings_count || 0) +
        Number(card.open_action_plans_count || 0),
      0),
    };
  }, [allCards, pendingCards.length]);

  const loadScopeAndBoard = useCallback(async () => {
    if (!token || !tenantId) return;

    try {
      setLoading(true);
      setError('');

      const query = new URLSearchParams();
      if (selectedStandard !== 'ALL') query.set('standard_code', selectedStandard);
      if (selectedOperation !== 'ALL') query.set('operation_id', selectedOperation);

      const [scopeJson, boardJson, historyJson] = await Promise.all([
        fetchJson(`/api/tenant-standards/scope/${tenantId}`, token),
        fetchJson(`/api/lifecycle/board/${tenantId}${query.toString() ? `?${query.toString()}` : ''}`, token),
        fetchJson(`/api/lifecycle/history/${tenantId}?limit=60${query.toString() ? `&${query.toString()}` : ''}`, token),
      ]);

      setScope({
        operations: Array.isArray(scopeJson.operations) ? scopeJson.operations : [],
        standards: Array.isArray(scopeJson.standards) ? scopeJson.standards : [],
      });
      setBoard(boardJson);
      setHistory(Array.isArray(historyJson.data) ? historyJson.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar ciclo de vida.');
    } finally {
      setLoading(false);
    }
  }, [selectedOperation, selectedStandard, tenantId, token]);

  useEffect(() => {
    setToken(getStoredValidToken());
    setTenantId(getTenantIdFromToken());
    setRole(getUserRoleFromToken());
  }, []);

  useEffect(() => {
    if (token && tenantId) loadScopeAndBoard();
  }, [loadScopeAndBoard, tenantId, token]);

  async function requestMove(card: LifecycleCard, toStageCode: string) {
    if (!token || !tenantId) return;
    const confirmed = window.confirm(`Solicitar avance de ${card.standard_code} a ${statusLabel(toStageCode)}?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError('');
      const json = await fetchJson('/api/lifecycle/request-move', token, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          standard_code: card.standard_code,
          operation_id: card.operation_id,
          to_stage_code: toStageCode,
          request_reason: reason.trim() || 'Movimiento solicitado desde Dashboard v2.',
        }),
      });
      setMessage(json.message || 'Movimiento enviado a revision.');
      setReason('');
      await loadScopeAndBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible solicitar movimiento.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleDragStart(card: LifecycleCard) {
    if (!canRequestMove || card.is_pending_confirmation || actionLoading) {
      setError('Tu rol no permite mover esta tarjeta o existe una confirmacion pendiente.');
      return;
    }

    setDragging({
      standard_code: card.standard_code,
      operation_id: card.operation_id,
      from_stage_code: card.display_stage_code || card.effective_stage_code,
    });
    setMessage('');
    setError('');
  }

  function handleDragEnd() {
    setDragging(null);
    setDropTarget(null);
  }

  function handleDragOver(stageCode: string, event: DragEvent<HTMLDivElement>) {
    if (!dragging) return;
    event.preventDefault();
    setDropTarget(stageCode);
  }

  async function handleDrop(stageCode: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!dragging) return;

    const card = allCards.find((item) =>
      item.standard_code === dragging.standard_code &&
      item.operation_id === dragging.operation_id
    );

    setDropTarget(null);

    if (!card || dragging.from_stage_code === stageCode) {
      setDragging(null);
      return;
    }

    try {
      await requestMove(card, stageCode);
    } finally {
      setDragging(null);
    }
  }

  async function reviewRequest(card: LifecycleCard, action: 'confirmar' | 'rechazar') {
    if (!token || !card.pending_request_row_id) return;
    const confirmed = window.confirm(`${action === 'confirmar' ? 'Confirmar' : 'Rechazar'} movimiento pendiente?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError('');
      await fetchJson(`/api/lifecycle/requests/${card.pending_request_row_id}/review`, token, {
        method: 'POST',
        body: JSON.stringify({
          review_action: action,
          review_comment: action === 'confirmar'
            ? 'Confirmado desde Dashboard v2.'
            : 'Rechazado desde Dashboard v2.',
        }),
      });
      setMessage(action === 'confirmar' ? 'Movimiento confirmado.' : 'Movimiento rechazado.');
      setSelectedCard(null);
      await loadScopeAndBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible revisar movimiento.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Ciclo de vida ISO</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tablero operativo integrado con etapas, filtros, historial, solicitudes de avance y aprobaciones existentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedStandard} onChange={(event) => setSelectedStandard(event.target.value)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="ALL">Todas las normas</option>
              {standards.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
            <select value={selectedOperation} onChange={(event) => setSelectedOperation(event.target.value)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="ALL">Todas las operaciones</option>
              {operations.map((op) => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
            <button type="button" onClick={loadScopeAndBoard} disabled={loading} className="rounded bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white" />)}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <LifecycleKpi label="Tarjetas" value={summary.total} status="ready" />
            <LifecycleKpi label="Saludables" value={summary.healthy} status="saludable" />
            <LifecycleKpi label="Atencion" value={summary.attention} status="atencion" />
            <LifecycleKpi label="Deterioradas" value={summary.deteriorated} status="critico" />
            <LifecycleKpi label="Pendientes auditor" value={summary.pending} status={summary.pending > 0 ? 'attention' : 'ready'} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">Etapas completas</h3>
                <p className="mt-1 text-xs text-slate-500">Las tarjetas se filtran por normas activas/contratadas del tenant.</p>
              </div>
              <div className="text-xs text-slate-500">Madurez promedio: {formatPercent(summary.avg)}</div>
            </div>

            <div className="grid gap-4 xl:grid-cols-4 2xl:grid-cols-7">
              {filteredColumns.map((column) => (
                <div
                  key={column.stage_code}
                  onDragOver={(event) => handleDragOver(column.stage_code, event)}
                  onDrop={(event) => handleDrop(column.stage_code, event)}
                  className={[
                    'min-h-[220px] rounded-lg border bg-slate-50 p-3 transition',
                    dropTarget === column.stage_code
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : 'border-slate-200',
                  ].join(' ')}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-700">{column.stage_name}</div>
                    <span className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-600">{column.items.length}</span>
                  </div>

                  <div className="space-y-3">
                    {column.items.length === 0 && <div className="rounded bg-white p-3 text-xs text-slate-400">Sin tarjetas</div>}
                    {column.items.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        draggable={canRequestMove && !card.is_pending_confirmation && !actionLoading}
                        onDragStart={() => handleDragStart(card)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedCard(card)}
                        className={[
                          'w-full rounded border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300',
                          canRequestMove && !card.is_pending_confirmation ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                          dragging?.standard_code === card.standard_code && dragging?.operation_id === card.operation_id
                            ? 'scale-[0.99] opacity-60'
                            : '',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{card.standard_code}</div>
                            <div className="mt-1 text-xs text-slate-500">{card.operation_name}</div>
                          </div>
                          <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${chipClass(card.health_status)}`}>
                            {statusLabel(card.health_status)}
                          </span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${scoreClass(card.maturity_score)}`}
                            style={{ width: `${Math.max(4, Math.min(100, Number(card.maturity_score || 0)))}%` }}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                          <span>Evidencia {formatPercent(card.evidence_coverage_pct)}</span>
                          <span>Health {formatPercent(card.avg_health_score)}</span>
                          <span>Planes {formatNumber(card.open_action_plans_count)}</span>
                          <span>Auditorias {formatNumber(card.open_audits_count)}</span>
                        </div>
                        {card.is_pending_confirmation && (
                          <div className="mt-3 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                            Pendiente confirmacion
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Historial y trazabilidad</h3>
              <div className="mt-4 space-y-3">
                {history.length === 0 && <Empty text="Sin historial para los filtros actuales." />}
                {history.slice(0, 10).map((row, index) => (
                  <div key={`${row.id || index}`} className="rounded border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-950">
                      {row.standard_code || 'Sin norma'} · {row.operation_name || 'Operacion'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.from_stage_name || 'Sin etapa'} → {row.to_stage_name || 'Sin etapa'} · {row.request_status_label || 'Sin estado'}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{formatDateTime(row.requested_at || row.reviewed_at)}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-950">Detalle y acciones</h3>
              {!selectedCard && <Empty text="Selecciona una tarjeta para ver detalle, proximo paso y acciones disponibles." />}
              {selectedCard && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{selectedCard.standard_code} · {selectedCard.operation_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Etapa actual: {statusLabel(selectedCard.display_stage_code || selectedCard.effective_stage_code)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Mini label="Madurez" value={formatPercent(selectedCard.maturity_score)} />
                    <Mini label="Evidencia" value={formatPercent(selectedCard.evidence_coverage_pct)} />
                    <Mini label="NC" value={formatNumber(selectedCard.open_nonconformities_count)} />
                    <Mini label="Hallazgos" value={formatNumber(selectedCard.open_findings_count)} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a href={`/controles?iso=${encodeURIComponent(selectedCard.standard_code)}&operation_id=${encodeURIComponent(selectedCard.operation_id)}`} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Controles</a>
                    <a href={`/plan-accion?iso=${encodeURIComponent(selectedCard.standard_code)}&operation_id=${encodeURIComponent(selectedCard.operation_id)}`} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Planes</a>
                    <a href={`/auditorias?iso=${encodeURIComponent(selectedCard.standard_code)}&operation_id=${encodeURIComponent(selectedCard.operation_id)}`} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Auditorias</a>
                  </div>

                  {canRequestMove && nextStage(selectedCard, board?.stages || []) && (
                    <div className="rounded border border-slate-200 p-3">
                      <div className="text-xs font-semibold text-slate-700">Solicitar proximo paso</div>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Motivo opcional"
                        className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const stage = nextStage(selectedCard, board?.stages || []);
                          if (stage) requestMove(selectedCard, stage.code);
                        }}
                        disabled={actionLoading}
                        className="mt-2 rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        Solicitar avance a {nextStage(selectedCard, board?.stages || [])?.name}
                      </button>
                    </div>
                  )}

                  {selectedCard.is_pending_confirmation && canReview && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold text-amber-900">Movimiento pendiente de revision</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => reviewRequest(selectedCard, 'confirmar')} disabled={actionLoading} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirmar</button>
                        <button type="button" onClick={() => reviewRequest(selectedCard, 'rechazar')} disabled={actionLoading} className="rounded border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50">Rechazar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function LifecycleKpi({ label, value, status }: { label: string; value: number; status: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(value)}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(status)}`}>{statusLabel(status)}</span>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded bg-slate-50 px-4 py-5 text-sm text-slate-500">{text}</div>;
}
