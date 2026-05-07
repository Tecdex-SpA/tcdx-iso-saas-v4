'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardV2ActionItem,
  DashboardV2Alert,
  DashboardV2KpiItem,
  DashboardV2Response,
  DashboardV2RiskItem,
} from './types';
import DashboardV2HealthSection from './DashboardV2HealthSection';
import DashboardV2LifecycleSection from './DashboardV2LifecycleSection';
import {
  chipClass,
  formatDateTime,
  formatNumber,
  formatPercent,
  priorityClass,
  statusLabel,
} from './utils';
import { getStoredValidToken, getTenantIdFromToken, getUserRoleFromToken } from '@/utils/auth';
import RecommendedActionDetailModal from '@/components/acciones-recomendadas/RecommendedActionDetailModal';
import type { JsonObject, RecommendedAction } from '@/components/acciones-recomendadas/types';
import { canMutate, targetLabel } from '@/components/acciones-recomendadas/utils';

const KPI_COLORS: Record<string, string> = {
  green: '#059669',
  yellow: '#d97706',
  red: '#e11d48',
  gray: '#94a3b8',
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

type Props = {
  activeTab: string;
  data: DashboardV2Response;
};

type ApiEnvelope = {
  ok?: boolean;
  error?: string;
  data?: unknown;
};

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function toRecommendedAction(action: DashboardV2ActionItem): RecommendedAction {
  return {
    id: action.id,
    standard_code: action.standard_code,
    operation_id: action.operation_id,
    tenant_control_id: action.tenant_control_id,
    source_module: action.source_module || 'dashboard_v2',
    source_entity_type: action.source_entity_type,
    source_entity_id: action.source_entity_id,
    source_reason: action.source_reason,
    suggestion_type: action.suggestion_type || 'operational_task',
    target_record_type: action.target_record_type || 'action_plan',
    title: action.title,
    description: action.description,
    rationale: action.rationale,
    priority: action.priority || 'media',
    status: action.status || 'pending',
    suggested_owner: action.suggested_owner,
    suggested_due_date: action.suggested_due_date,
    payload_json: action.payload_json || {},
    source_trace_json: action.source_trace_json || {},
    created_record_type: action.created_record_type,
    created_record_id: action.created_record_id,
    created_at: action.created_at,
    updated_at: action.updated_at,
  };
}

export default function DashboardV2Panel({ activeTab, data }: Props) {
  if (activeTab === 'acciones') {
    return <ActionsPanel data={data} />;
  }

  if (activeTab === 'riesgos') {
    return <RisksPanel data={data} />;
  }

  if (activeTab === 'kpis') {
    return <KpisPanel data={data} />;
  }

  if (activeTab === 'alertas') {
    return <AlertsPanel data={data} />;
  }

  if (activeTab === 'salud_iso') {
    return <DashboardV2HealthSection />;
  }

  if (activeTab === 'ciclo_vida') {
    return <DashboardV2LifecycleSection />;
  }

  return (
    <Panel title="Resumen ejecutivo">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">{data.executive_readiness.headline}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{data.executive_readiness.statement}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Bloqueadores principales</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.executive_readiness.blockers.length === 0 && (
                <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass('ready')}`}>
                  Sin bloqueadores criticos
                </span>
              )}
              {data.executive_readiness.blockers.map((blocker) => (
                <span key={blocker} className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass('attention')}`}>
                  {blocker}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-950">Prioridades</h3>
          <div className="mt-3 space-y-2">
            {data.priorities.length === 0 && <Empty text="No hay prioridades activas." />}
            {data.priorities.slice(0, 5).map((priority, index) => (
              <a
                key={`${priority.title}-${index}`}
                href={priority.route || '/acciones-recomendadas'}
                className="block rounded border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{priority.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{priority.reason || 'Revision sugerida'}</div>
                  </div>
                  <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(priority.priority)}`}>
                    {priority.priority}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ActionsPanel({ data }: { data: DashboardV2Response }) {
  const [expanded, setExpanded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [localActions, setLocalActions] = useState<DashboardV2ActionItem[]>([]);
  const [selected, setSelected] = useState<RecommendedAction | null>(null);
  const [conversionPreview, setConversionPreview] = useState<JsonObject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(null);
  const panel = data.operational_panels?.actions;
  const summary = panel?.summary;
  const recent = useMemo(() => panel?.recent || [], [panel?.recent]);
  const visible = expanded ? localActions : localActions.slice(0, 5);
  const readonly = !canMutate(role);

  useEffect(() => {
    setToken(getStoredValidToken());
    setTenantId(getTenantIdFromToken());
    setRole(getUserRoleFromToken());
  }, []);

  useEffect(() => {
    setLocalActions(recent);
  }, [recent]);

  const requestJson = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!token) throw new Error('No hay sesion activa.');

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let json: ApiEnvelope | null = null;
    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error(`Respuesta invalida del backend (${response.status}).`);
    }

    if (!response.ok || json?.ok === false || !json) {
      throw new Error(json?.error || 'No fue posible procesar la solicitud.');
    }
    return json;
  }, [token]);

  const patchLocalStatus = (id: string, status: string) => {
    setLocalActions((current) => current.map((item) =>
      item.id === id
        ? { ...item, status, updated_at: new Date().toISOString() }
        : item
    ));
  };

  const handleDryRun = async (action: RecommendedAction) => {
    try {
      setBusyId(action.id);
      setFeedback(null);
      const result = await requestJson(`/api/iso-recommended-actions/${action.id}/dry-run-convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          options: {},
        }),
      });
      const resultData = asJsonObject(result.data);
      setSelected(action);
      setConversionPreview(resultData);
      const blocked = Array.isArray(resultData.blocked_reasons)
        ? resultData.blocked_reasons.filter(Boolean).join(' | ')
        : '';
      setFeedback({
        kind: resultData.can_convert === false ? 'warning' : 'info',
        message: resultData.can_convert === false
          ? `Conversion bloqueada: ${blocked || 'requiere revision manual.'}`
          : `Dry-run OK: se podria crear ${targetLabel(String(resultData.target_type || action.target_record_type))}.`,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'No fue posible simular conversion.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (action: RecommendedAction) => {
    try {
      setBusyId(action.id);
      setFeedback(null);
      const dryRun = await requestJson(`/api/iso-recommended-actions/${action.id}/dry-run-convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          options: {},
        }),
      });
      const dryRunData = asJsonObject(dryRun.data);
      setSelected(action);
      setConversionPreview(dryRunData);

      if (dryRunData.can_convert === false) {
        const blocked = Array.isArray(dryRunData.blocked_reasons)
          ? dryRunData.blocked_reasons.filter(Boolean).join(' | ')
          : '';
        setFeedback({ kind: 'warning', message: `Conversion bloqueada: ${blocked || 'requiere revision manual.'}` });
        return;
      }

      const confirmed = window.confirm(
        `El backend puede crear ${targetLabel(String(dryRunData.target_type || action.target_record_type))}. Confirmas la conversion real?`
      );
      if (!confirmed) {
        setFeedback({ kind: 'info', message: 'Conversion cancelada despues del dry-run. No se escribieron datos operativos.' });
        return;
      }

      await requestJson(`/api/iso-recommended-actions/${action.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          confirmed: true,
          options: {},
        }),
      });
      patchLocalStatus(action.id, 'applied');
      setSelected(null);
      setConversionPreview(null);
      setFeedback({ kind: 'success', message: 'Sugerencia convertida correctamente desde Dashboard.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'No fue posible convertir la sugerencia.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (action: RecommendedAction) => {
    const reason = window.prompt('Motivo opcional para descartar la sugerencia:') || '';
    const confirmed = window.confirm('Confirmas descartar esta sugerencia?');
    if (!confirmed) return;

    try {
      setBusyId(action.id);
      await requestJson(`/api/iso-operational-execution/${action.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          rejection_comment: reason || undefined,
        }),
      });
      patchLocalStatus(action.id, 'rejected');
      setSelected(null);
      setConversionPreview(null);
      setFeedback({ kind: 'success', message: 'Sugerencia descartada correctamente.' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'No fue posible descartar la sugerencia.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel title="Acciones recomendadas y trabajo pendiente" actionHref="/acciones-recomendadas">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total" value={summary?.total || 0} />
        <Metric label="Criticas" value={summary?.critical || 0} tone="danger" />
        <Metric label="Vencidas" value={summary?.overdue || 0} tone="warning" />
        <Metric label="Por aprobar" value={summary?.pending_approval || 0} />
        <Metric label="Convertidas" value={summary?.converted || 0} tone="success" />
      </div>

      {feedback && (
        <div
          className={[
            'mt-4 rounded-lg border px-4 py-3 text-sm',
            feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : '',
            feedback.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : '',
            feedback.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : '',
            feedback.kind === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800' : '',
          ].join(' ')}
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Ultimas acciones</h3>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {expanded ? 'Ver menos' : 'Expandir'}
            </button>
          </div>
          <div className="space-y-2">
            {visible.length === 0 && <Empty text="Sin acciones recomendadas para las normas contratadas." />}
            {visible.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                busy={busyId === action.id}
                readonly={readonly}
                onSelect={() => {
                  setSelected(toRecommendedAction(action));
                  setConversionPreview(null);
                }}
                onDryRun={() => handleDryRun(toRecommendedAction(action))}
                onConvert={() => handleConvert(toRecommendedAction(action))}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">Trabajo pendiente conectado</h3>
          <div className="mt-3 grid gap-2">
            <MiniMetric label="Planes abiertos" value={summary?.open_action_plans || 0} route="/plan-accion" />
            <MiniMetric label="Hallazgos abiertos" value={summary?.open_findings || 0} route="/hallazgos" />
            <MiniMetric label="No conformidades" value={summary?.open_nonconformities || 0} route="/no-conformidades" />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            La conversion usa el mismo flujo seguro: dry-run, preview y confirmacion explicita antes de escribir.
          </p>
        </div>
      </div>

      <RecommendedActionDetailModal
        action={selected}
        conversionPreview={conversionPreview}
        readonly={readonly}
        busy={Boolean(selected && busyId === selected.id)}
        onClose={() => {
          setSelected(null);
          setConversionPreview(null);
        }}
        onAccept={handleDryRun}
        onConvert={handleConvert}
        onDismiss={handleDismiss}
      />
    </Panel>
  );
}

function RisksPanel({ data }: { data: DashboardV2Response }) {
  const [showAll, setShowAll] = useState(false);
  const [standardFilter, setStandardFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const panel = data.operational_panels?.risks;
  const summary = panel?.summary;
  const standardOptions = useMemo(() => {
    const values = new Set<string>();
    (panel?.by_standard || []).forEach((row) => {
      if (row.standard_code) values.add(String(row.standard_code));
    });
    (panel?.all_risks || []).forEach((risk) => {
      if (risk.standard_code) values.add(String(risk.standard_code));
    });
    return Array.from(values).sort();
  }, [panel?.all_risks, panel?.by_standard]);
  const filteredRisks = useMemo(() => {
    return (panel?.all_risks || []).filter((risk) => {
      if (standardFilter !== 'ALL' && risk.standard_code !== standardFilter) return false;
      if (levelFilter !== 'ALL' && String(risk.residual_risk_level || '').toLowerCase() !== levelFilter) return false;
      if (statusFilter !== 'ALL' && String(risk.status || '').toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [levelFilter, panel?.all_risks, standardFilter, statusFilter]);
  const priorityRisks = useMemo(() => {
    return (panel?.priority_risks || []).filter((risk) => {
      if (standardFilter !== 'ALL' && risk.standard_code !== standardFilter) return false;
      if (levelFilter !== 'ALL' && String(risk.residual_risk_level || '').toLowerCase() !== levelFilter) return false;
      if (statusFilter !== 'ALL' && String(risk.status || '').toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [levelFilter, panel?.priority_risks, standardFilter, statusFilter]);
  const risks = showAll ? filteredRisks : priorityRisks;

  return (
    <Panel title="Riesgos ISO prioritarios" actionHref="/matriz-riesgo">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Total" value={summary?.total || 0} />
        <Metric label="Criticos" value={summary?.critical || 0} tone="danger" />
        <Metric label="Altos" value={summary?.high || 0} tone="warning" />
        <Metric label="Sin responsable" value={summary?.without_owner || 0} />
        <Metric label="Sin tratamiento" value={summary?.without_treatment || 0} />
        <Metric label="Prox. vencer" value={summary?.upcoming_due || 0} />
      </div>

      <div className="mt-5">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              {showAll ? 'Todos los riesgos ISO existentes' : 'Riesgos prioritarios'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Filtrados por normas contratadas del tenant.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="w-fit rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {showAll ? 'Ver prioritarios' : 'Ver todos los riesgos ISO'}
          </button>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <select
            value={standardFilter}
            onChange={(event) => setStandardFilter(event.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Todas las normas</option>
            {standardOptions.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Todos los niveles</option>
            <option value="critico">Critico</option>
            <option value="alto">Alto</option>
            <option value="medio">Medio</option>
            <option value="bajo">Bajo</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Todos los estados</option>
            <option value="suggested">Sugerido</option>
            <option value="accepted">Aceptado</option>
            <option value="needs_review">Requiere revision</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Riesgo</th>
                  <th className="px-3 py-2 text-left">Norma</th>
                  <th className="px-3 py-2 text-left">Activo</th>
                  <th className="px-3 py-2 text-left">Residual</th>
                  <th className="px-3 py-2 text-left">Tratamiento</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {risks.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                      Sin riesgos ISO registrados para las normas contratadas.
                    </td>
                  </tr>
                )}
                {risks.map((risk) => (
                  <RiskRow key={risk.id} risk={risk} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function KpisPanel({ data }: { data: DashboardV2Response }) {
  const panel = data.operational_panels?.kpis;
  const summary = panel?.summary;
  const items = panel?.items || [];
  const kpiDistribution = [
    { name: 'Verdes', key: 'green', value: Number(summary?.green || 0) },
    { name: 'Amarillos', key: 'yellow', value: Number(summary?.yellow || 0) },
    { name: 'Rojos', key: 'red', value: Number(summary?.red || 0) },
    { name: 'Grises', key: 'gray', value: Number(summary?.gray || 0) },
  ].filter((item) => item.value > 0);
  const kpiByStandard = (panel?.by_standard || []).map((row) => ({
    standard_code: String(row.standard_code || 'Global'),
    green: Number(row.green || 0),
    yellow: Number(row.yellow || 0),
    red: Number(row.red || 0),
  }));
  const trendItems = items
    .filter((item) => Number.isFinite(Number(item.value)))
    .slice(0, 8)
    .map((item, index) => ({
      name: item.code || `KPI ${index + 1}`,
      value: Number(item.value || 0),
    }));

  return (
    <Panel title="KPIs ejecutivos" actionHref="/dashboard-kpi">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Score KPI" value={formatPercent(summary?.executive_score || 0)} tone="success" />
        <Metric label="Medidos" value={summary?.measured_kpis || 0} />
        <Metric label="Verdes" value={summary?.green || 0} tone="success" />
        <Metric label="Amarillos" value={summary?.yellow || 0} tone="warning" />
        <Metric label="Rojos" value={summary?.red || 0} tone="danger" />
        <Metric label="Grises" value={summary?.gray || 0} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-950">Distribucion visual KPI</h3>
          <div className="mt-4 h-64">
            {kpiDistribution.length === 0 ? (
              <Empty text="Sin distribucion KPI calculada." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpiDistribution}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {kpiDistribution.map((entry) => (
                      <Cell key={entry.key} fill={KPI_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">KPIs por norma contratada</h3>
          <div className="mt-4 h-64">
            {kpiByStandard.length === 0 ? (
              <Empty text="Sin KPIs por norma con datos suficientes." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiByStandard}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="standard_code" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="green" name="Verdes" stackId="a" fill={KPI_COLORS.green} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="yellow" name="Amarillos" stackId="a" fill={KPI_COLORS.yellow} />
                  <Bar dataKey="red" name="Rojos" stackId="a" fill={KPI_COLORS.red} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {(panel?.by_standard || []).length === 0 && <Empty text="Sin KPIs por norma con datos suficientes." />}
            {(panel?.by_standard || []).map((row, index) => (
              <div key={`${row.standard_code}-${index}`} className="rounded border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">{row.standard_code || 'Global'}</span>
                  <span className="text-xs text-slate-500">{formatNumber(row.measured_kpis as number)} medidos</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">Verdes {formatNumber(row.green as number)}</span>
                  <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">Amarillos {formatNumber(row.yellow as number)}</span>
                  <span className="rounded bg-rose-50 px-2 py-1 text-rose-800">Rojos {formatNumber(row.red as number)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-950">Microtendencia KPI</h3>
          <p className="mt-1 text-xs text-slate-500">Serie compacta con los ultimos valores calculados disponibles.</p>
          <div className="mt-4 h-56">
            {trendItems.length === 0 ? (
              <Empty text="Sin valores numericos suficientes para graficar tendencia." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendItems}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={46} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950">Indicadores que requieren mirada</h3>
            <span className="text-xs text-slate-500">Ultimo calculo: {formatDateTime(summary?.last_calculated_at)}</span>
          </div>
          <div className="mt-3 space-y-2">
            {items.length === 0 && <Empty text="Sin KPIs calculados con datos actuales." />}
            {items.slice(0, 10).map((item) => (
              <KpiRow key={`${item.id}-${item.standard_code || 'global'}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AlertsPanel({ data }: { data: DashboardV2Response }) {
  const alerts = data.operational_panels?.alerts?.length
    ? data.operational_panels.alerts
    : data.alerts;
  const grouped = useMemo(() => {
    const map = new Map<string, DashboardV2Alert[]>();
    alerts.forEach((alert) => {
      const key = String(alert.level || 'info').toLowerCase();
      map.set(key, [...(map.get(key) || []), alert]);
    });
    return Array.from(map.entries());
  }, [alerts]);

  return (
    <Panel title="Alertas inteligentes">
      {alerts.length === 0 && <Empty text="Sin alertas criticas detectadas con los datos actuales." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.map(([level, items]) => (
          <div key={level} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950">{statusLabel(level)}</h3>
              <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(level)}`}>
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((alert, index) => (
                <a
                  key={`${alert.type}-${alert.title}-${index}`}
                  href={alert.route || '#'}
                  className="block rounded border border-slate-200 p-3 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{alert.title}</div>
                      {alert.message && <div className="mt-1 text-xs leading-5 text-slate-500">{alert.message}</div>}
                    </div>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {alert.standard_code || 'Global'}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActionRow({
  action,
  busy,
  readonly,
  onSelect,
  onDryRun,
  onConvert,
}: {
  action: DashboardV2ActionItem;
  busy: boolean;
  readonly: boolean;
  onSelect: () => void;
  onDryRun: () => void;
  onConvert: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${priorityClass(action.priority)}`}>
              {statusLabel(action.priority)}
            </span>
            <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${chipClass(action.status)}`}>
              {statusLabel(action.status)}
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              {action.standard_code || 'General'}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{action.title}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {action.description || action.rationale || 'Sin descripcion disponible.'}
          </p>
        </div>
        <div className="shrink-0 text-xs text-slate-500">
          {formatDateTime(action.suggested_due_date || action.updated_at || action.created_at)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Ver detalle
        </button>
        <button
          type="button"
          onClick={onDryRun}
          disabled={readonly || busy || action.status !== 'pending'}
          className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-45"
        >
          {busy ? 'Validando...' : 'Dry-run'}
        </button>
        <button
          type="button"
          onClick={onConvert}
          disabled={readonly || busy || action.status !== 'pending'}
          className="rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
        >
          Convertir
        </button>
      </div>
    </div>
  );
}

function RiskRow({ risk }: { risk: DashboardV2RiskItem }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-3">
        <div className="font-semibold text-slate-950">{risk.risk_title}</div>
        <div className="mt-1 line-clamp-1 text-xs text-slate-500">{risk.risk_category || risk.risk_description || 'Riesgo ISO'}</div>
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">{risk.standard_code} {risk.version_code}</td>
      <td className="px-3 py-3 text-xs text-slate-600">{risk.asset_name || 'Sin activo'}</td>
      <td className="px-3 py-3">
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(risk.residual_risk_level)}`}>
          {statusLabel(risk.residual_risk_level)} · {formatNumber(risk.residual_risk_score || 0)}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">{statusLabel(risk.treatment_strategy)}</td>
      <td className="px-3 py-3 text-xs text-slate-600">{statusLabel(risk.status)}</td>
    </tr>
  );
}

function KpiRow({ item }: { item: DashboardV2KpiItem }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{item.name || item.code || 'KPI'}</div>
          <div className="mt-1 text-xs text-slate-500">{item.standard_code || 'Global'} · {item.category || 'Sin categoria'}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${kpiStatusClass(item.status_color)}`}>
          {statusLabel(item.status_color)}
        </span>
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950">
        {formatNumber(item.value || 0)}{item.unit ? ` ${item.unit}` : ''}
      </div>
    </div>
  );
}

function Panel({ title, actionHref, children }: { title: string; actionHref?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {actionHref && (
          <a href={actionHref} className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
            Abrir modulo
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    neutral: 'bg-slate-50 text-slate-950',
    success: 'bg-emerald-50 text-emerald-900',
    warning: 'bg-amber-50 text-amber-900',
    danger: 'bg-rose-50 text-rose-900',
  }[tone];

  return (
    <div className={`rounded-lg p-4 ${toneClass}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, route }: { label: string; value: number | string; route: string }) {
  return (
    <a href={route} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{formatNumber(value)}</span>
    </a>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded bg-slate-50 px-4 py-5 text-sm text-slate-500">
      {text}
    </div>
  );
}

function kpiStatusClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (normalized === 'yellow') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (normalized === 'red') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}
