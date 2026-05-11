'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStoredValidToken, getTenantIdFromToken } from '@/utils/auth';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chipClass, formatDateTime, formatNumber, formatPercent, priorityClass, scoreClass, statusLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

const HEALTH_COLORS: Record<string, string> = {
  saludable: '#059669',
  atencion: '#d97706',
  deteriorado: '#f97316',
  critico: '#e11d48',
};

type HealthSummary = {
  tenant_id: string;
  tenant_name: string;
  total_controls: string | number;
  healthy_controls: string | number;
  attention_controls: string | number;
  deteriorated_controls: string | number;
  critical_controls: string | number;
  avg_health_score: string | number;
  tenant_health_status: string;
  healthy_percentage: string | number;
  controls_with_evidence_percentage: string | number;
  total_evidences: string | number;
  approved_evidences: string | number;
  pending_evidences: string | number;
  rejected_evidences: string | number;
  last_calculated_at?: string | null;
};

type StandardHealth = {
  standard_code: string;
  standard_name?: string;
  total_controls: string | number;
  healthy_controls: string | number;
  attention_controls: string | number;
  deteriorated_controls: string | number;
  critical_controls: string | number;
  avg_health_score: string | number;
  standard_health_status: string;
  controls_with_evidence_percentage: string | number;
};

type RootCause = {
  tenant_name?: string;
  standard_code?: string;
  main_cause_json?: {
    cause_key?: string;
    cause_label?: string;
    affected_controls?: string | number;
  } | null;
  executive_recommendation?: string;
  controls_with_evidence_gap?: string | number;
  controls_with_compliance_gap?: string | number;
  controls_with_findings_gap?: string | number;
  controls_with_action_gap?: string | number;
  controls_with_risk_gap?: string | number;
  controls_with_review_gap?: string | number;
};

type RiskControl = {
  tenant_control_id?: string;
  standard_code?: string;
  clause?: string;
  category?: string;
  control_description?: string;
  health_score?: string | number;
  health_status?: string;
  main_gap_key?: string;
  main_gap_label?: string;
};

type RemediationSummary = {
  total_suggested_actions?: string | number;
  urgent_actions?: string | number;
  high_actions?: string | number;
  medium_actions?: string | number;
  evidence_actions?: string | number;
  compliance_actions?: string | number;
  risk_actions?: string | number;
  review_actions?: string | number;
  nearest_due_date?: string | null;
};

type RemediationPlanItem = {
  tenant_id: string;
  tenant_control_id: string;
  standard_code: string;
  clause?: string;
  control_description?: string;
  health_score?: string | number;
  health_status?: string;
  main_gap_key?: string;
  main_gap_label?: string;
  remediation_priority?: string;
  suggested_owner_role?: string;
  suggested_action_title?: string;
  suggested_action_description?: string;
  suggested_due_date?: string | null;
};

type EvidenceQueueItem = {
  evidence_id: string;
  standard_code?: string;
  clause?: string;
  file_name?: string;
  status?: string;
  action_plan_id?: string;
  control_description?: string;
};

type AuditLogItem = {
  event_id: string;
  event_source?: string;
  event_label?: string;
  event_description?: string;
  iso_code?: string;
  changed_at?: string;
};

type HealthData = {
  summary: HealthSummary | null;
  standards: StandardHealth[];
  rootCause: RootCause | null;
  standardRootCauses: RootCause[];
  riskControls: RiskControl[];
  remediationSummary: RemediationSummary | null;
  remediationPlan: RemediationPlanItem[];
  evidenceQueue: EvidenceQueueItem[];
  auditLog: AuditLogItem[];
};

function emptyData(): HealthData {
  return {
    summary: null,
    standards: [],
    rootCause: null,
    standardRootCauses: [],
    riskControls: [],
    remediationSummary: null,
    remediationPlan: [],
    evidenceQueue: [],
    auditLog: [],
  };
}

async function fetchJson(path: string, token: string, tenantId?: string | null, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params);
  if (tenantId) query.set('tenant_id', tenantId);
  const url = `${API_BASE_URL}${path}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || `No fue posible consultar ${path}`);
  }
  return json;
}

export default function DashboardV2HealthSection() {
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [gapFilter, setGapFilter] = useState('');
  const [data, setData] = useState<HealthData>(emptyData());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingActionId, setCreatingActionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const baseParams: Record<string, string> = selectedStandard
        ? { standard_code: selectedStandard }
        : {};
      const planParams = {
        ...baseParams,
        limit: '30',
        priority: priorityFilter,
        gap: gapFilter,
      };

      const [
        dashboardJson,
        standardsJson,
        rootJson,
        standardsRootJson,
        risksJson,
        remediationJson,
        planJson,
        evidenceJson,
        auditJson,
      ] = await Promise.all([
        fetchJson('/health/dashboard', token, tenantId),
        fetchJson('/health/standards', token, tenantId, baseParams),
        fetchJson('/health/root-causes', token, tenantId),
        fetchJson('/health/root-causes/standards', token, tenantId, baseParams),
        fetchJson('/health/controls-risk', token, tenantId, { ...baseParams, limit: '30' }),
        fetchJson('/health/remediation-summary', token, tenantId),
        fetchJson('/health/remediation-plan', token, tenantId, planParams),
        fetchJson('/health/evidence-approval-queue', token, tenantId, { ...baseParams, limit: '12' }),
        fetchJson('/health/audit-log', token, tenantId, { ...baseParams, limit: '15' }),
      ]);

      setData({
        summary: Array.isArray(dashboardJson.data) ? dashboardJson.data[0] || null : null,
        standards: Array.isArray(standardsJson.data) ? standardsJson.data : [],
        rootCause: Array.isArray(rootJson.data) ? rootJson.data[0] || null : null,
        standardRootCauses: Array.isArray(standardsRootJson.data) ? standardsRootJson.data : [],
        riskControls: Array.isArray(risksJson.data) ? risksJson.data : [],
        remediationSummary: Array.isArray(remediationJson.data) ? remediationJson.data[0] || null : null,
        remediationPlan: Array.isArray(planJson.data) ? planJson.data : [],
        evidenceQueue: Array.isArray(evidenceJson.data) ? evidenceJson.data : [],
        auditLog: Array.isArray(auditJson.data) ? auditJson.data : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar Salud ISO.');
    } finally {
      setLoading(false);
    }
  }, [gapFilter, priorityFilter, selectedStandard, tenantId, token]);

  useEffect(() => {
    const activeToken = getStoredValidToken();
    setToken(activeToken);
    setTenantId(getTenantIdFromToken());
    if (!activeToken) {
      setError('No hay una sesion activa para cargar Salud ISO.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadData();
  }, [loadData, token]);

  const standardCodes = useMemo(
    () => data.standards.map((standard) => standard.standard_code).filter(Boolean).sort(),
    [data.standards]
  );
  const healthDistribution = useMemo(() => {
    if (!data.summary) return [];
    return [
      { name: 'Saludables', key: 'saludable', value: Number(data.summary.healthy_controls || 0) },
      { name: 'Atencion', key: 'atencion', value: Number(data.summary.attention_controls || 0) },
      { name: 'Deteriorados', key: 'deteriorado', value: Number(data.summary.deteriorated_controls || 0) },
      { name: 'Criticos', key: 'critico', value: Number(data.summary.critical_controls || 0) },
    ].filter((item) => item.value > 0);
  }, [data.summary]);
  const healthByStandard = useMemo(() => {
    return data.standards.map((standard) => ({
      standard_code: standard.standard_code,
      saludable: Number(standard.healthy_controls || 0),
      atencion: Number(standard.attention_controls || 0),
      deteriorado: Number(standard.deteriorated_controls || 0),
      critico: Number(standard.critical_controls || 0),
    }));
  }, [data.standards]);

  async function refreshHealth() {
    if (!token) return;

    try {
      setRefreshing(true);
      setError('');
      const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
      const response = await fetch(`${API_BASE_URL}/health/refresh${query}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : {};
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible recalcular salud.');
      }
      setMessage('Salud ISO recalculada correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible recalcular salud.');
    } finally {
      setRefreshing(false);
    }
  }

  async function createRemediationAction(item: RemediationPlanItem) {
    if (!token) return;
    const confirmed = window.confirm('Crear plan de accion desde esta recomendacion de Salud ISO?');
    if (!confirmed) return;

    try {
      setCreatingActionId(`${item.tenant_control_id}-${item.main_gap_key}`);
      setError('');
      const response = await fetch(`${API_BASE_URL}/health/remediation-plan/create-action`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: item.tenant_id || tenantId,
          tenant_control_id: item.tenant_control_id,
          iso_code: item.standard_code,
          standard_code: item.standard_code,
          title: item.suggested_action_title || `Regularizar control: ${item.control_description || item.tenant_control_id}`,
          description: item.suggested_action_description || 'Accion sugerida por Salud ISO.',
          priority: item.remediation_priority || 'media',
          due_date: item.suggested_due_date ? String(item.suggested_due_date).slice(0, 10) : undefined,
          owner: item.suggested_owner_role || null,
          main_gap_key: item.main_gap_key || null,
          main_gap_label: item.main_gap_label || null,
        }),
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : {};
      if (!response.ok || json?.ok === false) {
        throw new Error(json?.error || 'No fue posible crear plan de accion.');
      }
      setMessage(json.already_exists ? 'El plan ya existia; no se duplico.' : 'Plan de accion creado desde Salud ISO.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear plan de accion.');
    } finally {
      setCreatingActionId('');
    }
  }

  const summary = data.summary;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Salud ISO consolidada</h2>
            <p className="mt-1 text-sm text-slate-500">
              Misma base operacional de la vista Salud ISO: score global, salud por norma, causas raiz, riesgos, remediacion, evidencias y bitacora.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedStandard}
              onChange={(event) => setSelectedStandard(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas las normas</option>
              {standardCodes.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Actualizar
            </button>
            <button
              type="button"
              onClick={refreshHealth}
              disabled={refreshing || !token}
              className="rounded bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {refreshing ? 'Recalculando...' : 'Recalcular salud'}
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

      {!loading && summary && (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <HealthKpi label="Salud global" value={formatPercent(summary.avg_health_score)} status={summary.tenant_health_status} />
            <HealthKpi label="Controles saludables" value={formatNumber(summary.healthy_controls)} status="saludable" />
            <HealthKpi label="En atencion" value={formatNumber(summary.attention_controls)} status="atencion" />
            <HealthKpi label="Criticos/deteriorados" value={formatNumber(Number(summary.critical_controls || 0) + Number(summary.deteriorated_controls || 0))} status="critico" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Distribucion de salud</h3>
                  <div className="mt-4 h-64">
                    {healthDistribution.length === 0 ? (
                      <Empty text="Sin distribucion de salud calculada." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={healthDistribution}
                            dataKey="value"
                            innerRadius={56}
                            outerRadius={92}
                            paddingAngle={3}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {healthDistribution.map((entry) => (
                              <Cell key={entry.key} fill={HEALTH_COLORS[entry.key]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">Estado por norma</h3>
                  <div className="mt-4 h-64">
                    {healthByStandard.length === 0 ? (
                      <Empty text="Sin salud por norma calculada." />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={healthByStandard}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="standard_code" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="saludable" stackId="a" fill={HEALTH_COLORS.saludable} />
                          <Bar dataKey="atencion" stackId="a" fill={HEALTH_COLORS.atencion} />
                          <Bar dataKey="deteriorado" stackId="a" fill={HEALTH_COLORS.deteriorado} />
                          <Bar dataKey="critico" stackId="a" fill={HEALTH_COLORS.critico} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Salud por norma contratada</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {data.standards.map((standard) => (
                    <div key={standard.standard_code} className="rounded border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{standard.standard_code}</div>
                          <div className="text-xs text-slate-500">{standard.standard_name || 'Norma activa'}</div>
                        </div>
                        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(standard.standard_health_status)}`}>
                          {statusLabel(standard.standard_health_status)}
                        </span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${scoreClass(standard.avg_health_score)}`}
                          style={{ width: `${Math.max(4, Math.min(100, Number(standard.avg_health_score || 0)))}%` }}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <Mini label="Saludables" value={formatNumber(standard.healthy_controls)} />
                        <Mini label="Atencion" value={formatNumber(standard.attention_controls)} />
                        <Mini label="Criticos" value={formatNumber(Number(standard.critical_controls || 0) + Number(standard.deteriorated_controls || 0))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Controles en riesgo</h3>
                <div className="mt-4 space-y-3">
                  {data.riskControls.length === 0 && <Empty text="Sin controles en riesgo para el filtro actual." />}
                  {data.riskControls.slice(0, 12).map((item, index) => (
                    <a
                      key={`${item.tenant_control_id || index}`}
                      href={`/controles?iso=${encodeURIComponent(item.standard_code || '')}`}
                      className="block rounded border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{item.control_description || 'Control sin descripcion'}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.standard_code} · {item.clause || 'Sin clausula'} · {item.main_gap_label || 'Brecha principal'}</div>
                        </div>
                        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(item.health_status)}`}>
                          {formatPercent(item.health_score || 0)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">Plan de remediacion sugerido</h3>
                    <p className="mt-1 text-xs text-slate-500">Crear plan requiere accion explicita del usuario.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="">Todas prioridades</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                    <select value={gapFilter} onChange={(event) => setGapFilter(event.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="">Todas brechas</option>
                      <option value="evidence">Evidencia</option>
                      <option value="compliance">Cumplimiento</option>
                      <option value="risk">Riesgo</option>
                      <option value="review">Revision</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {data.remediationPlan.length === 0 && <Empty text="Sin acciones sugeridas para el filtro actual." />}
                  {data.remediationPlan.slice(0, 10).map((item) => {
                    const key = `${item.tenant_control_id}-${item.main_gap_key}`;
                    return (
                      <div key={key} className="rounded border border-slate-200 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-950">{item.suggested_action_title || item.control_description || 'Accion sugerida'}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.standard_code} · {item.main_gap_label || 'Brecha'} · Responsable: {item.suggested_owner_role || 'Sin sugerir'}</div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span className={`rounded border px-2 py-1 text-xs font-semibold ${priorityClass(item.remediation_priority)}`}>{item.remediation_priority || 'media'}</span>
                            <button
                              type="button"
                              onClick={() => createRemediationAction(item)}
                              disabled={creatingActionId === key}
                              className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              {creatingActionId === key ? 'Creando...' : 'Crear plan'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Causa raiz principal</h3>
                <div className="mt-4 rounded bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-950">
                    {data.rootCause?.main_cause_json?.cause_label || 'Sin causa principal calculada'}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {data.rootCause?.executive_recommendation || 'Sin recomendacion ejecutiva disponible.'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Evidencias pendientes</h3>
                <div className="mt-4 space-y-3">
                  {data.evidenceQueue.length === 0 && <Empty text="Sin evidencias pendientes de aprobacion." />}
                  {data.evidenceQueue.slice(0, 6).map((item) => (
                    <a key={item.evidence_id} href={`/evidencias?id=${encodeURIComponent(item.evidence_id)}`} className="block rounded border border-slate-200 p-3 hover:bg-slate-50">
                      <div className="text-sm font-semibold text-slate-950">{item.file_name || 'Evidencia sin archivo'}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.standard_code} · {item.status || 'pendiente'}</div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-950">Bitacora operacional</h3>
                <div className="mt-4 space-y-3">
                  {data.auditLog.length === 0 && <Empty text="Sin eventos recientes." />}
                  {data.auditLog.slice(0, 8).map((item) => (
                    <div key={`${item.event_source}-${item.event_id}`} className="rounded border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-950">{item.event_label || item.event_source || 'Evento'}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.iso_code || 'Sin norma'} · {formatDateTime(item.changed_at)}</div>
                      {item.event_description && <p className="mt-2 text-xs text-slate-600">{item.event_description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function HealthKpi({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${chipClass(status)}`}>
          {statusLabel(status)}
        </span>
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
