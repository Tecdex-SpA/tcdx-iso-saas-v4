'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getUserFromToken, getUserRoleFromToken } from '@/utils/auth';
import AppLayout from '@/components/AppLayout';
import GrcPhase1Panel from '@/components/grc/GrcPhase1Panel';
import GrcDecisionCenter from '@/components/math-governance/GrcDecisionCenter';
import CompanyProfileImpactPanel from '@/components/company-profile/CompanyProfileImpactPanel';
import TcdxIcon from '@/components/icons/TcdxIcon';
import {
  DataTrustIndicator,
  EnterpriseKpiCard,
  EnterprisePageHeader,
  ResponsiveChartFrame,
  UniversalStateBadge,
  UniversalStateBlock,
  type UniversalDataState,
} from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type DashboardView = 'executive' | 'kpi' | 'iso';

type KpiRecalculateNotice = {
  type: 'success' | 'error';
  message: string;
};

type EffectiveIsoHealthRow = {
  tenant_id?: string;
  iso: string;
  operation_id?: string;
  operation_name?: string;
  operation_code?: string;
  operation_type?: string;
  total_controls?: number | string | null;
  active_scope_controls?: number | string | null;
  out_of_scope_controls?: number | string | null;
  complies_controls?: number | string | null;
  partial_controls?: number | string | null;
  non_compliant_or_no_data_controls?: number | string | null;
  healthy_controls?: number | string | null;
  attention_controls?: number | string | null;
  deteriorated_controls?: number | string | null;
  controls_with_official_evidence?: number | string | null;
  controls_with_approved_non_official_evidence?: number | string | null;
  controls_without_evidence?: number | string | null;
  approved_evidence_count?: number | string | null;
  official_evidence_count?: number | string | null;
  open_findings_count?: number | string | null;
  open_nonconformities_count?: number | string | null;
  open_action_plans_count?: number | string | null;
  overdue_action_plans_count?: number | string | null;
  avg_effective_health_score?: number | string | null;
  compliance_percentage?: number | string | null;
  official_evidence_percentage?: number | string | null;
  kpi_health_status?: string | null;
};

type SystemHealthDashboard = {
  global_score?: number;
  label?: string;
  status?: string;
  color?: string;
  explanation?: string;
  standards?: Array<{
    id?: string;
    name?: string;
    score?: number;
    status?: string;
    label?: string;
  }>;
  critical_processes?: Array<{
    id?: string | null;
    process_id?: string | null;
    operation_id?: string | null;
    name?: string;
    standard_code?: string;
    score?: number;
    status?: string;
    main_issue?: string;
  }>;
  alerts?: {
    critical_gaps?: number;
    overdue_actions?: number;
    missing_evidence?: number;
  };
  data_quality_warnings?: string[];
};

type UnknownRecord = Record<string, unknown>;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type ControlDashboardRow = {
  id?: string | number | null;
  control_id?: string | number | null;
  iso?: string | null;
  iso_code?: string | null;
  status?: string | null;
  control_name?: string | null;
  name?: string | null;
  title?: string | null;
  control?: string | null;
  code?: string | null;
};

type RiskSummaryRow = {
  id?: string | number | null;
  level?: string | null;
  total?: string | number | null;
  name?: string | null;
  label?: string | null;
  iso?: string | null;
  iso_code?: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }

  return fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '')).filter(Boolean);
}

function isControlDashboardRow(value: unknown): value is ControlDashboardRow {
  return isRecord(value);
}

function isRiskSummaryRow(value: unknown): value is RiskSummaryRow {
  return isRecord(value);
}

function normalizeDashboardView(value?: string | null): DashboardView {
  return value === 'kpi' || value === 'iso' || value === 'executive'
    ? value
    : 'executive';
}

function toSafeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapEffectiveHealthLabel(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') return 'Saludable';
  if (normalized === 'atencion') return 'Atención';
  if (normalized === 'critico') return 'Crítico';
  if (normalized === 'deteriorado') return 'Deteriorado';
  if (normalized === 'sin_alcance') return 'Sin alcance';

  return 'Sin datos';
}

function getEffectiveHealthTone(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'saludable') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'atencion') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'critico') return 'border-red-200 bg-red-50 text-red-700';
  if (normalized === 'deteriorado') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'sin_alcance' || normalized === 'fuera_alcance' || normalized === 'no_aplicable') {
    return 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-secondary)]';
  }

  return 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-primary)]';
}

function getSystemHealthTone(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'high') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'acceptable') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'low') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (normalized === 'critical') return 'border-red-200 bg-red-50 text-red-700';

  return 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-primary)]';
}

function getEffectiveStatusRank(value?: string | null): number {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'critico') return 5;
  if (normalized === 'deteriorado') return 4;
  if (normalized === 'atencion') return 3;
  if (normalized === 'saludable') return 1;
  return 0;
}

function resolveGlobalEffectiveStatus(rows: EffectiveIsoHealthRow[]): string {
  if (rows.length === 0) return 'sin_datos';

  return rows.reduce((status, row) => {
    return getEffectiveStatusRank(row.kpi_health_status) > getEffectiveStatusRank(status)
      ? row.kpi_health_status || status
      : status;
  }, rows[0]?.kpi_health_status || 'sin_datos');
}

type AuditItem = {
  id?: string;
  iso?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  auditor_name?: string;
  auditor_type?: string;
};

type ActionPlanItem = {
  id: string;
  iso_code?: string;
  title?: string;
  status?: string;
  due_date?: string | null;
  owner?: string | null;
  priority?: string | null;
};

type LatestSnapshot = {
  id?: string;
  snapshot_id?: string;
  standard_code?: string | null;
  value?: number | string | null;
  numerator_value?: number | string | null;
  denominator_value?: number | string | null;
  status_color?: 'green' | 'yellow' | 'red' | 'gray' | string | null;
  state?: string | null;
  coverage?: number | string | null;
  trust?: SnapshotTrust | null;
  freshness?: string | { status?: string | null } | null;
  sufficiency?: string | { status?: string | null } | null;
  period_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  calculated_at?: string | null;
  updated_at?: string | null;
  checksum?: string | null;
  breakdown_json?: JsonValue;
};

type SnapshotTrust = {
  status?: string | null;
  score?: number | string | null;
  confidence?: number | string | null;
  coverage?: number | string | null;
  freshness?: string | null;
  source?: string | null;
  timestamp?: string | null;
  warnings?: string[] | null;
};

type OfficialActionableComponent = {
  component?: string;
  label?: string;
  reason?: string | null;
  route_to_fix?: string | null;
  action?: string | null;
  required_capability?: string | null;
};

type OfficialActionableState = {
  state?: string;
  why?: string;
  missing_components?: OfficialActionableComponent[];
  route_to_fix?: string | null;
  required_capability?: string | null;
  expected_after_resolution?: string | null;
};

type KpiDashboardItem = {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  kpi_type: string;
  unit: string;
  frequency: string;
  direction: string;
  target_value?: number | null;
  applicable_standards?: string[];
  is_enabled: boolean;
  is_health_kpi?: boolean;
  latest_snapshot?: LatestSnapshot | null;
  latest_snapshots?: LatestSnapshot[];
  has_multiple_snapshots?: boolean;
  delta?: number | null;
};

type KpiDashboardResponse = {
  summary?: {
    total_kpis: number;
    green: number;
    yellow: number;
    red: number;
    gray: number;
    measured_kpis?: number;
    data_coverage_pct?: number;
    official_score?: number | null;
    health_kpis?: number;
  };
  items?: KpiDashboardItem[];
};

type DashboardSummary = {
  total?: number;
  cumple?: number;
  parcial?: number;
  noCumple?: number;
  porcentaje?: number;
  riesgo?: number;
  nivel_riesgo?: string;
  open_findings?: number;
  closed_findings?: number;
  open_nonconformities?: number;
  closed_nonconformities?: number;
};

type DashboardAuditSummary = {
  ok?: boolean;
  summary?: {
    total?: number;
    pendientes?: number;
    en_ejecucion?: number;
    completadas?: number;
    con_informe?: number;
    sin_informe?: number;
    hallazgos?: number;
    acciones?: number;
  };
  next_audit?: AuditItem | null;
  recent_audits?: AuditItem[];
  note?: string;
};

type OperationalChartDatum = {
  name: string;
  value: number;
  fill?: string;
};

type ExecutiveAttentionItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  value: string | number;
  state: UniversalDataState;
};

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatChartNumber(value: unknown, unit = 'registros') {
  const n = numberOrNull(value);
  if (n === null) return 'Sin dato';
  const formatted = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);
  if (unit === '%' || unit === 'porcentaje') return `${formatted}%`;
  return `${formatted} ${unit}`;
}

function formatChartPeriodLabel(value: unknown) {
  if (!value) return 'Sin período';
  const text = String(value);
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
  }
  return text;
}

function formatChartTooltip(unit = 'registros') {
  return (value: unknown, name: unknown) => [formatChartNumber(value, unit), String(name || 'Valor')];
}

function getChartSummary(data: OperationalChartDatum[], unit = 'registros') {
  if (!data.length) return 'Sin datos registrados para graficar.';
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const leader = [...data].sort((a, b) => b.value - a.value)[0];
  return `${leader.name}: ${formatChartNumber(leader.value, unit)}. Total visible: ${formatChartNumber(total, unit)}.`;
}

function unwrapApiData(payload: unknown): unknown {
  const raw = asRecord(payload);
  return isRecord(raw.data) ? raw.data : payload;
}

type OfficialRecalculateSummary = {
  processed: number;
  calculated: number;
  insufficientData: number;
  dependencyPending: number;
  errors: number;
  snapshots: number;
};

function normalizeOfficialState(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function getOfficialResultState(result: unknown): string {
  const raw = asRecord(result);
  const nestedResult = asRecord(raw.result);
  const measurement = asRecord(raw.measurement ?? nestedResult.measurement);
  const breakdown = asRecord(measurement.breakdown_json);

  return normalizeOfficialState(
    measurement.official_state ??
      measurement.sufficiency_status ??
      breakdown.state ??
      raw.official_state
  );
}

function summarizeOfficialRecalculateResponse(payload: unknown): OfficialRecalculateSummary {
  const raw = asRecord(unwrapApiData(payload));
  const results = Array.isArray(raw.results) ? raw.results : [];
  const states = results.map((result) => getOfficialResultState(result));
  const hasStates = states.some(Boolean);
  const failed = numberOrZero(raw.failed);
  const recalculated = numberOrZero(raw.recalculated);

  const calculated = hasStates
    ? states.filter((state) => state === 'calculated').length
    : recalculated;

  const insufficientData = states.filter(
    (state) =>
      state === 'insufficient_data' ||
      state === 'insufficient_coverage' ||
      state === 'insufficient' ||
      state === 'source_incompatible'
  ).length;

  return {
    processed: results.length || recalculated + failed,
    calculated,
    insufficientData,
    dependencyPending: states.filter((state) => state === 'dependency_pending').length,
    errors: failed,
    snapshots: numberOrZero(raw.snapshots_created),
  };
}

function getSnapshotOfficialState(snapshot?: LatestSnapshot | null): string {
  const breakdown = asRecord(snapshot?.breakdown_json);
  return normalizeOfficialState(
    snapshot?.state ?? breakdown.state ?? breakdown.official_state ?? breakdown.sufficiency_status
  );
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function scalarOrNull(value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function getNestedStatus(value: unknown): string | null {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return stringOrNull(record.status);
}

function normalizeSnapshotTrust(raw: UnknownRecord, breakdown: UnknownRecord): SnapshotTrust | null {
  const trust = asRecord(raw.trust ?? raw.data_trust ?? breakdown.trust ?? breakdown.data_trust);
  if (!Object.keys(trust).length) return null;

  return {
    status: stringOrNull(trust.status ?? trust.trust_status ?? trust.state),
    score: scalarOrNull(trust.score ?? trust.confidence),
    confidence: scalarOrNull(trust.confidence ?? trust.score),
    coverage: scalarOrNull(trust.coverage ?? raw.coverage ?? breakdown.coverage),
    freshness: stringOrNull(trust.freshness ?? getNestedStatus(raw.freshness ?? breakdown.freshness)),
    source: stringOrNull(trust.source ?? trust.source_code ?? breakdown.source_code),
    timestamp: stringOrNull(trust.timestamp ?? raw.updated_at ?? raw.calculated_at),
    warnings: toStringList(trust.warnings ?? breakdown.warnings),
  };
}

function mapOfficialStateToUniversal(snapshot?: LatestSnapshot | null): UniversalDataState {
  if (!snapshot) return 'empty';

  const state = getSnapshotOfficialState(snapshot);
  const freshness = getNestedStatus(snapshot.freshness);
  const sufficiency = getNestedStatus(snapshot.sufficiency);

  if (snapshot.value === 0 || snapshot.value === '0') return 'zero';
  if (state === 'failed' || state === 'error') return 'error';
  if (state === 'source_unavailable' || state === 'not_available') return 'not_available';
  if (state === 'dependency_pending' || state === 'not_calculable') return 'not_calculable';
  if (state === 'partial') return 'partial';
  if (freshness === 'stale') return 'stale';
  if (sufficiency === 'insufficient_data' || state === 'insufficient_data' || state === 'insufficient') return 'insufficient';
  if (snapshot.value === null || snapshot.value === undefined || snapshot.value === '') return 'not_calculable';

  return 'measured';
}

function getSnapshotActionableState(snapshot?: LatestSnapshot | null): OfficialActionableState | null {
  const breakdown = asRecord(snapshot?.breakdown_json);
  const actionable = asRecord(breakdown.actionable_state);
  if (!Object.keys(actionable).length) return null;
  const rawMissing = Array.isArray(actionable.missing_components)
    ? actionable.missing_components
    : [];

  return {
    state: typeof actionable.state === 'string' ? actionable.state : undefined,
    why: typeof actionable.why === 'string' ? actionable.why : undefined,
    route_to_fix: typeof actionable.route_to_fix === 'string' ? actionable.route_to_fix : null,
    required_capability: typeof actionable.required_capability === 'string' ? actionable.required_capability : null,
    expected_after_resolution:
      typeof actionable.expected_after_resolution === 'string'
        ? actionable.expected_after_resolution
        : null,
    missing_components: rawMissing
      .map((item) => asRecord(item))
      .map((item) => ({
        component: typeof item.component === 'string' ? item.component : undefined,
        label: typeof item.label === 'string' ? item.label : undefined,
        reason: typeof item.reason === 'string' ? item.reason : null,
        route_to_fix: typeof item.route_to_fix === 'string' ? item.route_to_fix : null,
        action: typeof item.action === 'string' ? item.action : null,
        required_capability: typeof item.required_capability === 'string' ? item.required_capability : null,
      })),
  };
}

function buildOfficialTrend(item: KpiDashboardItem) {
  const snapshots = item.latest_snapshots || [];
  if (snapshots.length < 2) return [];
  return snapshots
    .filter((snapshot) => snapshot.value !== null && snapshot.value !== undefined)
    .map((snapshot, index) => ({
      name: formatChartPeriodLabel(
        snapshot.period_end || snapshot.period_start || snapshot.period_type || `Punto ${snapshots.length - index}`
      ),
      value: Number(snapshot.value),
      source: snapshot.snapshot_id || snapshot.checksum || item.code,
    }))
    .filter((point) => Number.isFinite(point.value));
}

function normalizeActionStatus(value?: string | null) {
  const raw = String(value || '').toLowerCase().trim();

  if (
    ['completado', 'completed', 'cerrado', 'closed', 'resuelto', 'resuelta'].includes(
      raw
    )
  ) {
    return 'completado';
  }

  if (['cancelado', 'cancelada', 'cancelled'].includes(raw)) {
    return 'cancelado';
  }

  if (['bloqueado', 'blocked'].includes(raw)) {
    return 'bloqueado';
  }

  if (['en progreso', 'in progress', 'in_progress', 'progreso'].includes(raw)) {
    return 'en progreso';
  }

  return 'abierto';
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta inválida desde ${url}`);
  }

  if (!res.ok) {
    const errorBody = asRecord(json);
    throw new Error(
      String(errorBody.error || errorBody.detail || `Error consultando ${url}`)
    );
  }

  return json;
}

function normalizeLatestSnapshot(snapshot: unknown): LatestSnapshot | null {
  if (!isRecord(snapshot)) return null;
  const raw = snapshot;
  const breakdown = asRecord(raw.breakdown_json);
  const normalizedTrust = normalizeSnapshotTrust(raw, breakdown);

  return {
    id: raw.id === undefined || raw.id === null ? undefined : String(raw.id),
    snapshot_id: raw.snapshot_id === undefined || raw.snapshot_id === null ? undefined : String(raw.snapshot_id),
    standard_code: raw.standard_code === undefined || raw.standard_code === null ? null : String(raw.standard_code),
    value: typeof raw.value === 'number' || typeof raw.value === 'string' ? raw.value : null,
    numerator_value: typeof raw.numerator_value === 'number' || typeof raw.numerator_value === 'string' ? raw.numerator_value : null,
    denominator_value: typeof raw.denominator_value === 'number' || typeof raw.denominator_value === 'string' ? raw.denominator_value : null,
    status_color: raw.status_color === undefined || raw.status_color === null ? null : String(raw.status_color),
    state: stringOrNull(raw.state ?? raw.official_state ?? breakdown.state ?? breakdown.official_state),
    coverage: scalarOrNull(raw.coverage ?? breakdown.coverage),
    trust: normalizedTrust,
    freshness: getNestedStatus(raw.freshness ?? breakdown.freshness),
    sufficiency: getNestedStatus(raw.sufficiency ?? breakdown.sufficiency),
    period_type: raw.period_type === undefined || raw.period_type === null ? null : String(raw.period_type),
    period_start: raw.period_start === undefined || raw.period_start === null ? null : String(raw.period_start),
    period_end: raw.period_end === undefined || raw.period_end === null ? null : String(raw.period_end),
    calculated_at: raw.calculated_at === undefined || raw.calculated_at === null ? null : String(raw.calculated_at),
    updated_at: stringOrNull(raw.updated_at),
    checksum: stringOrNull(raw.checksum),
    breakdown_json: raw.breakdown_json as JsonValue,
  };
}

function normalizeKpiDashboardItem(item: unknown): KpiDashboardItem {
  const raw = asRecord(item);
  const latestSnapshots: LatestSnapshot[] = Array.isArray(raw.latest_snapshots)
    ? raw.latest_snapshots
        .map((snap) => normalizeLatestSnapshot(snap))
        .filter((snap): snap is LatestSnapshot => Boolean(snap))
    : Array.isArray(raw.standard_snapshots)
    ? raw.standard_snapshots
        .map((snap) => normalizeLatestSnapshot(snap))
        .filter((snap): snap is LatestSnapshot => Boolean(snap))
    : [];

  const latestSnapshot =
    normalizeLatestSnapshot(raw.latest_snapshot) ||
    (latestSnapshots.length ? latestSnapshots[0] : null);

  return {
    id: String(raw.id || ''),
    code: String(raw.code || ''),
    name: String(raw.name || 'KPI sin nombre'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    category: String(raw.category || 'otros'),
    kpi_type: String(raw.kpi_type || 'automatico'),
    unit: String(raw.unit || ''),
    frequency: String(raw.frequency || ''),
    direction: String(raw.direction || ''),
    target_value:
      raw.target_value === null || raw.target_value === undefined
        ? null
        : Number(raw.target_value),
    applicable_standards: toStringList(raw.applicable_standards),
    is_enabled: Boolean(raw.is_enabled ?? raw.enabled ?? true),
    is_health_kpi: Boolean(
      raw.is_health_kpi || String(raw.code || '').startsWith('KPI-HLT-')
    ),
    latest_snapshot: latestSnapshot,
    latest_snapshots: latestSnapshots,
    has_multiple_snapshots: Boolean(
      raw.has_multiple_snapshots ?? latestSnapshots.length > 1
    ),
    delta:
      raw.delta === null || raw.delta === undefined
        ? null
        : Number(raw.delta),
  };
}

function normalizeKpiDashboardResponse(payload: unknown): KpiDashboardResponse {
  const rawRoot = asRecord(payload);
  const rawPayload = isRecord(rawRoot.data) ? rawRoot.data : payload;
  const raw = asRecord(rawPayload);
  const rawItems: unknown[] = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(raw.items)
    ? raw.items
    : [];

  const items: KpiDashboardItem[] = rawItems.map((item) =>
    normalizeKpiDashboardItem(item)
  );
  const summary = asRecord(raw.summary);

  const green = items.filter(
    (item: KpiDashboardItem) => item.latest_snapshot?.status_color === 'green'
  ).length;

  const yellow = items.filter(
    (item: KpiDashboardItem) => item.latest_snapshot?.status_color === 'yellow'
  ).length;

  const red = items.filter(
    (item: KpiDashboardItem) => item.latest_snapshot?.status_color === 'red'
  ).length;

  const gray = items.filter((item: KpiDashboardItem) => {
    const color = item.latest_snapshot?.status_color;
    return !color || color === 'gray';
  }).length;

  const finalGreen = Number(summary.green ?? green);
  const finalYellow = Number(summary.yellow ?? yellow);
  const finalRed = Number(summary.red ?? red);
  const finalGray = Number(summary.gray ?? gray);
  const finalTotal = Number(summary.total_kpis ?? items.length);
  const measuredKpis = Number(summary.measured_kpis ?? 0);

  return {
    summary: {
      total_kpis: finalTotal,
      green: finalGreen,
      yellow: finalYellow,
      red: finalRed,
      gray: finalGray,
      measured_kpis: measuredKpis,
      data_coverage_pct:
        summary.data_coverage_pct === null || summary.data_coverage_pct === undefined ? undefined : Number(summary.data_coverage_pct),
      official_score:
        summary.official_score === null || summary.official_score === undefined ? null : Number(summary.official_score),
      health_kpis: Number(
        summary.health_kpis ??
        items.filter((item: KpiDashboardItem) => item.is_health_kpi).length
      ),
    },
    items,
  };
}

function isHealthKpiItem(item?: KpiDashboardItem | null) {
  return Boolean(item?.is_health_kpi || item?.code?.startsWith('KPI-HLT-'));
}

function formatDateCL(value?: string | null, emptyLabel = 'Sin fecha') {
  if (!value) return emptyLabel;

  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return String(value);
  }
}

function getKpiStatusLabel(color?: string | null, labels?: Record<string, string>) {
  if (color === 'green') return labels?.green || 'Verde';
  if (color === 'yellow') return labels?.yellow || 'Amarillo';
  if (color === 'red') return labels?.red || 'Rojo';
  return labels?.gray || 'Sin dato';
}

function getKpiStatusClass(color?: string | null) {
  if (color === 'green') return 'bg-green-100 text-green-700 border-green-200';
  if (color === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (color === 'red') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-[var(--tcdx-color-surface-alt)] text-[var(--tcdx-color-text-primary)] border-[var(--tcdx-color-border)]';
}



function getRuntimePeriodLabel() {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'en') {
    return 'Period';
  }

  return 'Periodo';
}

function formatKpiValue(value: number | string | null | undefined, unit?: string, noDataLabel = 'Sin dato') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return noDataLabel;
  }

  const rounded =
    Math.abs(Number(value)) >= 100 ? Number(value).toFixed(0) : Number(value).toFixed(2);

  if (
    unit === '%' ||
    unit === 'índice' ||
    unit === 'N°' ||
    unit === 'kg' ||
    unit === 'kWh' ||
    unit === 'horas' ||
    unit === 'tasa'
  ) {
    return `${rounded} ${unit}`;
  }

  return `${rounded}${unit ? ` ${unit}` : ''}`;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageFallback() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--tcdx-color-surface)] p-6">
        <div className="mx-auto max-w-[1720px] rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-8 text-sm text-[var(--tcdx-color-text-secondary)] shadow-sm">
          Cargando dashboard...
        </div>
      </div>
    </AppLayout>
  );
}

function DashboardPageContent() {
  function getKpiCategoryLabel(category?: string | null) {
    const normalized = String(category || 'otros').toLowerCase();
    const key = `dashboardKpi.categories.${normalized}`;
    const translated = t(key);
    return translated && translated !== key ? translated : normalized;
  }

  const { locale, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    loading: entitlementsLoading,
    canShowCapability,
  } = useTenantEntitlements();
  const requestedView = normalizeDashboardView(searchParams.get('view'));
  const [activeView, setActiveView] = useState<DashboardView>(requestedView);

  useEffect(() => {
    setActiveView(requestedView);
  }, [requestedView]);

  const handleViewChange = useCallback((view: DashboardView) => {
    setActiveView(view);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (view === 'executive') {
      nextParams.delete('view');
    } else {
      nextParams.set('view', view);
    }

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const currentUser = getUserFromToken();
  const currentUserRecord = asRecord(currentUser);
  const currentRole = getUserRoleFromToken();
  const organizationName =
    stringOrNull(
      currentUserRecord.tenant_name ??
        currentUserRecord.company_name ??
        asRecord(currentUserRecord.tenant).name
    ) || 'Organización';

  const canManageKpis = [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
    'admin',
    'tenant_admin',
  ].includes(currentRole);
  const canShowIsoHealth = !entitlementsLoading && canShowCapability('iso.health');
  const canShowAdvancedMetrics =
    !entitlementsLoading &&
    (canShowCapability('metrics.catalog') || canShowCapability('metrics.indicators.read'));
  const canShowMetricsEngine =
    !entitlementsLoading &&
    (canShowCapability('metrics.engine') || canShowCapability('metrics.jobs.run'));
  const canShowDataQuality = !entitlementsLoading && canShowCapability('metrics.data_trust');
  const canShowGrcAnalysis = !entitlementsLoading && canShowCapability('data.governance');
  const canShowGrcAdvanced = !entitlementsLoading && canShowCapability('grc.phase1');

  const [controls, setControls] = useState<ControlDashboardRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [effectiveHealthRows, setEffectiveHealthRows] = useState<EffectiveIsoHealthRow[]>([]);
  const [systemHealthDashboard, setSystemHealthDashboard] = useState<SystemHealthDashboard | null>(null);
  const [nextAudits, setNextAudits] = useState<AuditItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<DashboardAuditSummary | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummaryRow[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [effectiveHealthLoading, setEffectiveHealthLoading] = useState(false);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [systemHealthError, setSystemHealthError] = useState('');
  const [recalculatingKpis, setRecalculatingKpis] = useState(false);
  const [kpiRecalculateNotice, setKpiRecalculateNotice] = useState<KpiRecalculateNotice | null>(null);
  const [refreshingExecutive, setRefreshingExecutive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [kpiData, setKpiData] = useState<KpiDashboardResponse | null>(null);
  const loadSystemHealthDashboard = useCallback(async () => {
    if (!canShowIsoHealth) {
      setSystemHealthDashboard(null);
      setSystemHealthError('');
      setSystemHealthLoading(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setSystemHealthDashboard(null);
      return;
    }

    try {
      setSystemHealthLoading(true);
      setSystemHealthError('');
      const json = asRecord(await fetchJson(`${API_URL}/api/health/dashboard`, token));
      setSystemHealthDashboard(
        isRecord(json.data) ? (json.data as SystemHealthDashboard) : null
      );
    } catch (err) {
      console.error('ERROR SYSTEM HEALTH DASHBOARD:', err);
      setSystemHealthDashboard(null);
      setSystemHealthError('No fue posible cargar salud del sistema.');
    } finally {
      setSystemHealthLoading(false);
    }
  }, [canShowIsoHealth]);

  const loadEffectiveHealthSummary = useCallback(async () => {
    if (!canShowIsoHealth) {
      setEffectiveHealthRows([]);
      setEffectiveHealthLoading(false);
      return;
    }

    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) {
      setEffectiveHealthRows([]);
      return;
    }

    try {
      setEffectiveHealthLoading(true);

      const endpoints = [
        `${API_URL}/api/kpi/effective-health-summary/${user.tenant_id}`,
        `${API_URL}/api/kpis/effective-health-summary/${user.tenant_id}`,
      ];

      let json: unknown = null;
      let lastError: unknown = null;

      for (const endpoint of endpoints) {
        try {
          json = await fetchJson(endpoint, token);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!json) {
        throw lastError || new Error('No fue posible cargar salud ISO efectiva.');
      }

      const data = asRecord(json);
      const rows = Array.isArray(data.active_summary)
        ? data.active_summary.filter(isRecord) as EffectiveIsoHealthRow[]
        : Array.isArray(data.summary)
          ? (data.summary.filter((row) => {
              return isRecord(row) && toSafeNumber(row.active_scope_controls) > 0;
            }) as EffectiveIsoHealthRow[])
          : [];

      setEffectiveHealthRows(rows);
    } catch (err) {
      console.error('ERROR EFFECTIVE ISO HEALTH SUMMARY:', err);
      setEffectiveHealthRows([]);
    } finally {
      setEffectiveHealthLoading(false);
    }
  }, [canShowIsoHealth]);






  const loadExecutiveDashboard = useCallback(async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) {
      setLoading(false);
      return;
    }

    try {
      setErrorMessage('');
      setLoading(true);

      const [
        controlsData,
        summaryData,
        auditsData,
        auditSummaryData,
        riskData,
        actionPlansData,
      ] = await Promise.all([
        fetchJson(`${API_URL}/api/dashboard-controls/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/dashboard/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/audits/next-all/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/audits/summary/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/assets/risk-summary/${user.tenant_id}`, token),
        fetchJson(`${API_URL}/api/action-plans/${user.tenant_id}`, token),
      ]);

      const auditSummaryRecord = asRecord(auditSummaryData);

      setControls(Array.isArray(controlsData) ? controlsData.filter(isControlDashboardRow) : []);
      setSummary(isRecord(summaryData) ? (summaryData as DashboardSummary) : null);
      setNextAudits(Array.isArray(auditsData) ? (auditsData.filter(isRecord) as AuditItem[]) : []);
      setAuditSummary(auditSummaryRecord.ok === false ? null : (auditSummaryRecord as DashboardAuditSummary));
      setRiskSummary(Array.isArray(riskData) ? riskData.filter(isRiskSummaryRow) : []);
      setActionPlans(Array.isArray(actionPlansData) ? (actionPlansData.filter(isRecord) as ActionPlanItem[]) : []);
    } catch (err) {
      console.error('ERROR DASHBOARD:', err);
      setErrorMessage(getErrorMessage(err, 'No fue posible cargar el dashboard.'));
      setControls([]);
      setSummary(null);
      setNextAudits([]);
      setAuditSummary(null);
      setRiskSummary([]);
      setActionPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);



  const loadKpiDashboard = useCallback(async () => {
    if (!canShowAdvancedMetrics) {
      setKpiData(null);
      setLoadingKpis(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoadingKpis(true);

      const json = await fetchJson(
        `${API_URL}/api/metrics/official/dashboard`,
        token
      );

      setKpiData(normalizeKpiDashboardResponse(json));
    } catch (err) {
      console.error('ERROR KPI DASHBOARD:', err);
      setKpiData({
        summary: {
          total_kpis: 0,
          green: 0,
          yellow: 0,
          red: 0,
          gray: 0,
          health_kpis: 0,
        },
        items: [],
      });
    } finally {
      setLoadingKpis(false);
    }
  }, [canShowAdvancedMetrics]);

  useEffect(() => {
    if (entitlementsLoading) return;
    loadSystemHealthDashboard();
    loadEffectiveHealthSummary();
    loadExecutiveDashboard();
    loadKpiDashboard();
  }, [entitlementsLoading, loadSystemHealthDashboard, loadEffectiveHealthSummary, loadExecutiveDashboard, loadKpiDashboard]);

  const handleRefreshDashboard = async () => {
    try {
      setRefreshingExecutive(true);
      await Promise.all([
        loadSystemHealthDashboard(),
        loadEffectiveHealthSummary(),
        loadExecutiveDashboard(),
        loadKpiDashboard(),
      ]);
    } finally {
      setRefreshingExecutive(false);
    }
  };

  const handleRecalculateKpis = async () => {
    setKpiRecalculateNotice(null);

    if (!canManageKpis || !canShowMetricsEngine) {
      setKpiRecalculateNotice({
        type: 'error',
        message: canManageKpis
          ? 'El motor de indicadores oficiales no está contratado para esta empresa.'
          : 'Tu rol no permite recalcular KPIs. Esta acción está reservada para administradores.',
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setRecalculatingKpis(true);

      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const res = await fetch(`${API_URL}/api/metrics/official/dashboard/recalculate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: { key: now.toISOString().slice(0, 7), start: start.toISOString(), end: now.toISOString(), timezone: 'America/Santiago' } }),
      });

      const json = await res.json();

      if (!res.ok) {
        setKpiRecalculateNotice({
          type: 'error',
          message: typeof json.error === 'string' ? json.error : t('dashboardKpi.recalculateError'),
        });
        return;
      }

      await loadKpiDashboard();

      const recalculateSummary = summarizeOfficialRecalculateResponse(json);

      setKpiRecalculateNotice({
        type: 'success',
        message: t('dashboardKpi.recalculateOfficialSuccess', {
          processed: recalculateSummary.processed,
          calculated: recalculateSummary.calculated,
          insufficient: recalculateSummary.insufficientData,
          dependencyPending: recalculateSummary.dependencyPending,
          errors: recalculateSummary.errors,
          snapshots: recalculateSummary.snapshots,
        }),
      });
    } catch (err) {
      console.error('ERROR RECALCULATE KPI:', err);
      setKpiRecalculateNotice({
        type: 'error',
        message: t('dashboardKpi.recalculateError'),
      });
    } finally {
      setRecalculatingKpis(false);
    }
  };

  const grouped = useMemo(() => {
    return controls.reduce((acc: Record<string, ControlDashboardRow[]>, c) => {
      const key = String(c.iso || 'SIN_ISO');
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    }, {});
  }, [controls]);

  const cumple = controls.filter((c) => c.status === 'cumple').length;
  const totalControls = controls.length;

  const highRisks = numberOrZero(
    riskSummary.find((r) => r.level === 'alto')?.total
  );
  const mediumRisks = numberOrZero(
    riskSummary.find((r) => r.level === 'medio')?.total
  );

  const complianceValue =
    totalControls > 0
      ? Math.round((cumple / totalControls) * 100)
      : numberOrZero(summary?.porcentaje);

  const activeActionPlans = actionPlans.filter((p) => {
    const normalized = normalizeActionStatus(p.status);
    return normalized !== 'completado' && normalized !== 'cancelado';
  }).length;

  const overdueActionPlans = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return actionPlans.filter((p) => {
      if (!p.due_date) return false;

      const normalized = normalizeActionStatus(p.status);
      if (normalized === 'completado' || normalized === 'cancelado') return false;

      const due = new Date(p.due_date);
      due.setHours(0, 0, 0, 0);

      return due < today;
    }).length;
  }, [actionPlans]);

  const isoCards = useMemo(() => {
    return Object.keys(grouped).map((iso) => {
      const list = grouped[iso];
      const ok = list.filter((c) => c.status === 'cumple').length;
      const partial = list.filter((c) => c.status === 'parcial').length;
      const critical = list.filter((c) => c.status === 'no cumple').length;
      const total = list.length;
      const percent = total > 0 ? Math.round((ok / total) * 100) : 0;

      return {
        iso,
        total,
        ok,
        partial,
        critical,
        percent,
      };
    });
  }, [grouped]);

  const latestSyncText = useMemo(() => {
    const now = new Date();
    return `${t('common.today')}, ${now.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [locale, t]);

  const openNcCount = numberOrZero(summary?.open_nonconformities);

  const kpiItems = useMemo(() => kpiData?.items || [], [kpiData?.items]);
  const kpiSummary = kpiData?.summary;

  const healthKpiItems = useMemo(() => {
    return kpiItems.filter((item) => isHealthKpiItem(item));
  }, [kpiItems]);

  const scoreKpiGlobal =
    kpiSummary?.official_score === null || kpiSummary?.official_score === undefined
      ? null
      : Number(kpiSummary.official_score);

  const scoreGlobalPendingItem = useMemo(() => {
    if (scoreKpiGlobal !== null) return null;

    return (
      healthKpiItems.find((item) => {
        const state = getSnapshotOfficialState(item.latest_snapshot);
        return Boolean(state) && state !== 'calculated';
      }) || null
    );
  }, [healthKpiItems, scoreKpiGlobal]);

  const scoreGlobalPendingState =
    scoreGlobalPendingItem === null
      ? 'sin_medicion'
      : getSnapshotOfficialState(scoreGlobalPendingItem.latest_snapshot) || 'sin_medicion';

  const scoreGlobalActionableState = getSnapshotActionableState(scoreGlobalPendingItem?.latest_snapshot);
  const scoreGlobalMissingComponent = scoreGlobalActionableState?.missing_components?.[0] || null;

  const measuredKpis = Number(
    kpiSummary?.measured_kpis ??
      ((kpiSummary?.green || 0) +
        (kpiSummary?.yellow || 0) +
        (kpiSummary?.red || 0))
  );

  const totalKpis = Number(kpiSummary?.total_kpis || kpiItems.length || 0);
  const pendingKpis = Number(kpiSummary?.gray || 0);

  const kpiCoveragePct =
    kpiSummary?.data_coverage_pct === null || kpiSummary?.data_coverage_pct === undefined
      ? null
      : Number(kpiSummary.data_coverage_pct);

  const kpiCoverageTone =
    kpiCoveragePct === null ? 'amber' : kpiCoveragePct >= 90 ? 'green' : kpiCoveragePct >= 70 ? 'amber' : 'red';


  const healthMainKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'GRC-HEALTH') || null;
  }, [healthKpiItems]);

  const healthCoverageKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'EVIDENCE-COVERAGE') || null;
  }, [healthKpiItems]);

  const healthDeterioratedKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'DATA-TRUST') || null;
  }, [healthKpiItems]);

  const kpiStatusData = useMemo(() => {
    return [
      { name: t('dashboardKpi.greenStatus'), value: kpiSummary?.green || 0, fill: 'var(--tcdx-color-success)' },
      { name: t('dashboardKpi.yellowStatus'), value: kpiSummary?.yellow || 0, fill: 'var(--tcdx-color-warning)' },
      { name: t('dashboardKpi.redStatus'), value: kpiSummary?.red || 0, fill: 'var(--tcdx-color-danger)' },
      { name: t('dashboardKpi.noDataStatus'), value: kpiSummary?.gray || 0, fill: 'var(--tcdx-color-border)' },
    ];
  }, [kpiSummary, t]);

  const kpiCategoryData = useMemo(() => {
    const acc: Record<string, number> = {};

    for (const item of kpiItems) {
      const key = item.category || 'otros';
      acc[key] = (acc[key] || 0) + 1;
    }

    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [kpiItems]);

  const topRedKpis = useMemo(() => {
    return kpiItems
      .filter((item) => item.latest_snapshot?.status_color === 'red')
      .slice(0, 6);
  }, [kpiItems]);

  const topGreenKpis = useMemo(() => {
    return kpiItems
      .filter((item) => item.latest_snapshot?.status_color === 'green')
      .slice(0, 6);
  }, [kpiItems]);

  const standardHealthRows = useMemo(() => {
    return [...isoCards]
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 4);
  }, [isoCards]);


  const effectiveActiveRows = useMemo(() => {
    return effectiveHealthRows.filter(
      (row) => toSafeNumber(row.active_scope_controls) > 0
    );
  }, [effectiveHealthRows]);

  const effectiveTotalActiveControls = useMemo(() => {
    return effectiveActiveRows.reduce(
      (acc, row) => acc + toSafeNumber(row.active_scope_controls),
      0
    );
  }, [effectiveActiveRows]);

  const effectiveCompliesControls = useMemo(() => {
    return effectiveActiveRows.reduce(
      (acc, row) => acc + toSafeNumber(row.complies_controls),
      0
    );
  }, [effectiveActiveRows]);

  const effectiveCompliancePercent =
    effectiveTotalActiveControls > 0
      ? Math.round((effectiveCompliesControls / effectiveTotalActiveControls) * 100)
      : 0;

  const effectiveGlobalStatus = useMemo(
    () => resolveGlobalEffectiveStatus(effectiveActiveRows),
    [effectiveActiveRows]
  );

  const executiveComplianceValue =
    effectiveTotalActiveControls > 0 ? effectiveCompliancePercent : complianceValue;
  const executiveHealthyControls =
    effectiveTotalActiveControls > 0 ? effectiveCompliesControls : cumple;
  const executiveTotalControls =
    effectiveTotalActiveControls > 0 ? effectiveTotalActiveControls : totalControls;
  const hasExecutiveControlBasis = executiveTotalControls > 0;
  const executiveComplianceDisplay = hasExecutiveControlBasis
    ? `${executiveComplianceValue}%`
    : 'Sin medición';
  const executiveHealthyControlsDisplay = hasExecutiveControlBasis
    ? `${executiveHealthyControls} / ${executiveTotalControls}`
    : 'Sin datos';
  const executiveControlChange = hasExecutiveControlBasis
    ? t('dashboard.ofTotal', { value: executiveComplianceValue })
    : 'Sin controles evaluados';

  const auditTimelineItems = useMemo(() => {
    const recent = Array.isArray(auditSummary?.recent_audits)
      ? auditSummary.recent_audits
      : [];

    const combined = [...recent, ...nextAudits]
      .filter((audit) => audit?.iso || audit?.status || audit?.start_date)
      .slice(0, 4);

    return combined.map((audit, index) => ({
      id: audit.id || `${audit.iso || 'audit'}-${index}`,
      title: audit.iso ? `Auditoría ${audit.iso}` : 'Auditoría programada',
      subtitle: audit.auditor_name || audit.auditor_type || 'Equipo auditor',
      date: formatDateCL(audit.start_date || audit.end_date),
      status: audit.status || (index === 0 ? 'Completada' : 'En progreso'),
    }));
  }, [auditSummary, nextAudits]);

  const activeActionPlanItems = useMemo(() => {
    return actionPlans
      .filter((item) => {
        const normalized = normalizeActionStatus(item.status);
        return normalized !== 'completado' && normalized !== 'cancelado';
      })
      .slice(0, 4);
  }, [actionPlans]);

  const priorityRiskRows = useMemo(() => {
    const fromControls = controls
      .filter((control) => control.status === 'no cumple' || control.status === 'parcial')
      .slice(0, 4)
      .map((control, index) => ({
        id: String(control.id || control.control_id || `control-${index}`),
        risk:
          control.control_name ||
          control.name ||
          control.title ||
          control.control ||
          control.code ||
          `Control ${index + 1}`,
        norm: control.iso || control.iso_code || 'ISO',
        level: control.status === 'no cumple' ? 'Crítico' : 'Medio',
      }));

    if (fromControls.length > 0) return fromControls;

    return riskSummary.slice(0, 4).map((risk, index) => ({
      id: String(risk.id || `risk-${index}`),
      risk: risk.name || risk.label || `Riesgo ${risk.level || index + 1}`,
      norm: risk.iso || risk.iso_code || 'Global',
      level: risk.level === 'alto' ? 'Crítico' : risk.level === 'medio' ? 'Alto' : 'Medio',
    }));
  }, [controls, riskSummary]);

  const executiveAttentionItems = useMemo<ExecutiveAttentionItem[]>(() => {
    const items: ExecutiveAttentionItem[] = [];

    if (overdueActionPlans > 0) {
      items.push({
        id: 'overdue-actions',
        label: 'Acciones',
        title: 'Acciones vencidas',
        detail: `${activeActionPlans} acciones activas requieren seguimiento operacional.`,
        href: '/plan-accion',
        value: overdueActionPlans,
        state: 'stale',
      });
    }

    if (highRisks > 0) {
      items.push({
        id: 'critical-risks',
        label: 'Riesgo',
        title: 'Riesgos altos o críticos',
        detail: `${mediumRisks} riesgos medios acompañan la presión actual.`,
        href: '/matriz-riesgo',
        value: highRisks,
        state: 'measured',
      });
    }

    if (openNcCount > 0) {
      items.push({
        id: 'open-nonconformities',
        label: 'Auditoría',
        title: 'No conformidades abiertas',
        detail: 'Revisar tratamiento, responsables y plazos antes del siguiente ciclo.',
        href: '/no-conformidades',
        value: openNcCount,
        state: 'measured',
      });
    }

    const openFindings = numberOrZero(summary?.open_findings);
    const auditFindings = numberOrZero(auditSummary?.summary?.hallazgos);
    const findingsTotal = Math.max(openFindings, auditFindings);
    if (findingsTotal > 0) {
      items.push({
        id: 'open-findings',
        label: 'Hallazgos',
        title: 'Hallazgos abiertos',
        detail: 'Mantener trazabilidad hacia acciones correctivas y evidencia.',
        href: '/hallazgos',
        value: findingsTotal,
        state: 'partial',
      });
    }

    if (canShowAdvancedMetrics && pendingKpis > 0) {
      items.push({
        id: 'official-kpis-without-data',
        label: 'Datos',
        title: 'Indicadores oficiales sin datos',
        detail: 'La lectura ejecutiva conserva ausencia como Sin datos, no como cero.',
        href: '/metricas',
        value: pendingKpis,
        state: 'insufficient',
      });
    }

    if (canShowDataQuality && systemHealthDashboard?.data_quality_warnings?.length) {
      items.push({
        id: 'data-quality-warnings',
        label: 'Data Trust',
        title: 'Advertencias de calidad de información',
        detail: systemHealthDashboard.data_quality_warnings[0] || 'Existen advertencias de calidad publicadas por el servicio.',
        href: '/datos/calidad',
        value: systemHealthDashboard.data_quality_warnings.length,
        state: 'partial',
      });
    }

    if (!items.length && !loading && !loadingKpis && !systemHealthLoading) {
      items.push({
        id: 'no-priority-signal',
        label: 'Estado',
        title: 'Sin prioridades críticas visibles',
        detail: 'No hay señales críticas publicadas por las fuentes ejecutivas cargadas.',
        href: '/dashboard',
        value: 0,
        state: 'zero',
      });
    }

    return items.slice(0, 6);
  }, [
    activeActionPlans,
    auditSummary,
    canShowAdvancedMetrics,
    canShowDataQuality,
    highRisks,
    loading,
    loadingKpis,
    mediumRisks,
    openNcCount,
    overdueActionPlans,
    pendingKpis,
    summary,
    systemHealthDashboard,
    systemHealthLoading,
  ]);

  const executiveTrendItem = useMemo(() => {
    return kpiItems.find((item) => buildOfficialTrend(item).length > 1) || null;
  }, [kpiItems]);

  const controlStatusChartData = useMemo<OperationalChartDatum[]>(() => {
    const counts = controls.reduce(
      (acc, control) => {
        const status = String(control.status || '').toLowerCase();
        if (status === 'cumple') acc.cumple += 1;
        else if (status === 'parcial') acc.parcial += 1;
        else if (status === 'no cumple' || status === 'no_cumple') acc.noCumple += 1;
        else acc.sinEstado += 1;
        return acc;
      },
      { cumple: 0, parcial: 0, noCumple: 0, sinEstado: 0 }
    );

    const fallback = {
      cumple: numberOrZero(summary?.cumple),
      parcial: numberOrZero(summary?.parcial),
      noCumple: numberOrZero(summary?.noCumple),
      sinEstado: 0,
    };

    const source = controls.length > 0 ? counts : fallback;

    return [
      { name: 'Cumple', value: source.cumple, fill: 'var(--tcdx-color-success)' },
      { name: 'Parcial', value: source.parcial, fill: 'var(--tcdx-color-warning)' },
      { name: 'No cumple', value: source.noCumple, fill: 'var(--tcdx-color-danger)' },
      { name: 'Sin estado', value: source.sinEstado, fill: 'var(--tcdx-color-border)' },
    ].filter((item) => item.value > 0);
  }, [controls, summary]);

  const riskLevelChartData = useMemo<OperationalChartDatum[]>(() => {
    return riskSummary
      .map((risk) => {
        const level = String(risk.level || risk.name || risk.label || 'sin nivel').toLowerCase();
        const label = level === 'alto' ? 'Alto' : level === 'medio' ? 'Medio' : level === 'bajo' ? 'Bajo' : level;
        const fill = level === 'alto'
          ? 'var(--tcdx-color-danger)'
          : level === 'medio'
          ? 'var(--tcdx-color-warning)'
          : 'var(--tcdx-color-secondary)';
        return { name: label, value: numberOrZero(risk.total), fill };
      })
      .filter((item) => item.value > 0);
  }, [riskSummary]);

  const auditStateChartData = useMemo<OperationalChartDatum[]>(() => {
    const audit = auditSummary?.summary;
    return [
      { name: 'Pendientes', value: numberOrZero(audit?.pendientes), fill: 'var(--tcdx-color-warning)' },
      { name: 'En ejecución', value: numberOrZero(audit?.en_ejecucion), fill: 'var(--tcdx-color-secondary)' },
      { name: 'Completadas', value: numberOrZero(audit?.completadas), fill: 'var(--tcdx-color-success)' },
      { name: 'Con informe', value: numberOrZero(audit?.con_informe), fill: 'var(--tcdx-color-primary)' },
      { name: 'Sin informe', value: numberOrZero(audit?.sin_informe), fill: 'var(--tcdx-color-border)' },
    ].filter((item) => item.value > 0);
  }, [auditSummary]);

  const actionPlanChartData = useMemo<OperationalChartDatum[]>(() => {
    const counts = actionPlans.reduce<Record<string, number>>((acc, item) => {
      const status = normalizeActionStatus(item.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const fillByStatus: Record<string, string> = {
      abierto: 'var(--tcdx-color-primary)',
      'en progreso': 'var(--tcdx-color-secondary)',
      bloqueado: 'var(--tcdx-color-danger)',
      completado: 'var(--tcdx-color-success)',
      cancelado: 'var(--tcdx-color-border)',
    };

    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: fillByStatus[name] || 'var(--tcdx-color-text-secondary)',
    }));
  }, [actionPlans]);

  const evidenceCoverageChartData = useMemo<OperationalChartDatum[]>(() => {
    const official = effectiveActiveRows.reduce(
      (acc, row) => acc + toSafeNumber(row.controls_with_official_evidence),
      0
    );
    const approved = effectiveActiveRows.reduce(
      (acc, row) => acc + toSafeNumber(row.controls_with_approved_non_official_evidence),
      0
    );
    const missing = effectiveActiveRows.reduce(
      (acc, row) => acc + toSafeNumber(row.controls_without_evidence),
      0
    );

    return [
      { name: 'Oficial', value: official, fill: 'var(--tcdx-color-success)' },
      { name: 'Aprobada', value: approved, fill: 'var(--tcdx-color-secondary)' },
      { name: 'Faltante', value: missing, fill: 'var(--tcdx-color-danger)' },
    ].filter((item) => item.value > 0);
  }, [effectiveActiveRows]);

  const nonconformityChartData = useMemo<OperationalChartDatum[]>(() => {
    return [
      { name: 'Abiertas', value: numberOrZero(summary?.open_nonconformities), fill: 'var(--tcdx-color-warning)' },
      { name: 'Cerradas', value: numberOrZero(summary?.closed_nonconformities), fill: 'var(--tcdx-color-success)' },
    ].filter((item) => item.value > 0);
  }, [summary]);



  const dashboardHasSummaryData =
    Number(summary?.total || 0) > 0 ||
    Number(summary?.open_findings || 0) > 0 ||
    Number(summary?.closed_findings || 0) > 0 ||
    Number(summary?.open_nonconformities || 0) > 0 ||
    Number(summary?.closed_nonconformities || 0) > 0;

  return (
    <AppLayout>
      <div className="tcdx-dashboard-refinement space-y-6">
        <div className="space-y-6">
          <EnterprisePageHeader
            eyebrow="Centro ejecutivo"
            title={t('dashboard.title')}
            subtitle={
              <span>
                {organizationName} · {t('dashboard.subtitle')}
              </span>
            }
            actions={
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                <div className="enterprise-toolbar grid w-full grid-cols-1 gap-1 p-1 sm:w-auto sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleViewChange('executive')}
                    className={[
                      'flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-[var(--tcdx-radius-tecdex-sm)] px-3 py-2 text-sm font-semibold transition focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
                      activeView === 'executive'
                        ? 'bg-[var(--tcdx-color-primary)] text-white shadow-sm'
                        : 'text-[var(--tcdx-color-text-primary)] hover:bg-[var(--tcdx-color-surface)]',
                    ].join(' ')}
                  >
                    {t('dashboard.executiveView')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleViewChange('kpi')}
                    className={[
                      'flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-[var(--tcdx-radius-tecdex-sm)] px-3 py-2 text-sm font-semibold transition focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
                      activeView === 'kpi'
                        ? 'bg-[var(--tcdx-color-primary)] text-white shadow-sm'
                        : 'text-[var(--tcdx-color-text-primary)] hover:bg-[var(--tcdx-color-surface)]',
                    ].join(' ')}
                  >
                    {t('dashboard.kpiView')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleViewChange('iso')}
                    className={[
                      'flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-[var(--tcdx-radius-tecdex-sm)] px-3 py-2 text-sm font-semibold transition focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
                      activeView === 'iso'
                        ? 'bg-[var(--tcdx-color-primary)] text-white shadow-sm'
                        : 'text-[var(--tcdx-color-text-primary)] hover:bg-[var(--tcdx-color-surface)]',
                    ].join(' ')}
                  >
                    {t('dashboard.systemHealthView')}
                  </button>
                </div>

                <div className="enterprise-button-secondary flex-1 justify-center border-[var(--tcdx-color-border)] text-[var(--tcdx-color-text-primary)] sm:flex-none">
                  <TcdxIcon name="calendar" className="h-4 w-4 text-[var(--tcdx-color-primary)]" />
                  {latestSyncText}
                </div>

                <button
                  type="button"
                  onClick={handleRefreshDashboard}
                  disabled={refreshingExecutive}
                  className="enterprise-button-secondary flex-1 justify-center border-[var(--tcdx-color-border)] text-[var(--tcdx-color-text-primary)] disabled:opacity-60 sm:flex-none"
                >
                  <TcdxIcon name="refresh" className="h-4 w-4" />
                  {refreshingExecutive ? t('common.refreshing') : t('common.refresh')}
                </button>
              </div>
            }
          />

          {errorMessage && activeView === 'executive' && (
            <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-200 bg-red-50 p-5 text-red-700 shadow-[var(--tcdx-shadow-tecdex-sm)]">
              {errorMessage}
            </div>
          )}

          {activeView === 'executive' && (
            <>
              {loading && (
                <UniversalStateBlock
                  state="loading"
                  title={t('dashboard.loadingData')}
                  description="Cargando señales ejecutivas desde fuentes existentes."
                />
              )}

              {!loading && controls.length === 0 && !dashboardHasSummaryData && effectiveActiveRows.length === 0 && !effectiveHealthLoading && (
                <UniversalStateBlock
                  state="empty"
                  title={t('dashboard.initialControlsTitle')}
                  description={
                    <>
                      {t('dashboard.initialControlsSubtitle')} {t('dashboard.initialControlsNext')}
                    </>
                  }
                />
              )}

              {!loading && (controls.length > 0 || dashboardHasSummaryData || effectiveHealthLoading || effectiveActiveRows.length > 0) && (
                <>
                  <div className="flex flex-col gap-4">
                    <div className="order-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:order-1 2xl:grid-cols-4">
                      <TopCard
                        title={t('dashboard.globalCompliance')}
                        value={executiveComplianceDisplay}
                        subtitle={t('dashboard.globalComplianceSubtitle')}
                        accent="indigo"
                        change={`ISO ${mapEffectiveHealthLabel(effectiveGlobalStatus)}`}
                        changeHint="Lectura efectiva en alcance"
                        icon={<TcdxIcon name="shield" className="h-6 w-6" />}
                        ringValue={hasExecutiveControlBasis ? executiveComplianceValue : undefined}
                      />

                      <TopCard
                        title={t('dashboard.healthyControls')}
                        value={executiveHealthyControlsDisplay}
                        subtitle={t('dashboard.healthyControlsSubtitle')}
                        accent="indigo"
                        change={executiveControlChange}
                        changeHint="Controles activos en alcance"
                        icon={<TcdxIcon name="activity" className="h-6 w-6" />}
                      />

                      <TopCard
                        title={t('dashboard.criticalRisks')}
                        value={highRisks}
                        subtitle={t('dashboard.criticalRisksSubtitle')}
                        accent="red"
                        change={t('dashboard.mediumCountPlural', { count: mediumRisks })}
                        changeHint={t('dashboard.currentOverview')}
                        icon={<TcdxIcon name="alert" className="h-6 w-6" />}
                      />

                      <TopCard
                        title={t('dashboard.actionPlans')}
                        value={activeActionPlans}
                        subtitle={t('dashboard.actionPlansSubtitle')}
                        accent="green"
                        change={t('dashboard.overdueCount', { count: overdueActionPlans })}
                        changeHint={t('dashboard.operationalFocus')}
                        icon={<TcdxIcon name="plan" className="h-6 w-6" />}
                      />
                    </div>

                    <div className="order-1 lg:order-2">
                      <ExecutiveAttentionPanel items={executiveAttentionItems} />
                    </div>
                  </div>

                  <CompanyProfileImpactPanel
                    moduleCode="dashboard"
                    title="Foco operativo según Perfil Empresa"
                    compact
                  />

                  <ExecutiveStatusOverview
                    complianceValue={executiveComplianceValue}
                    healthyControls={executiveHealthyControls}
                    totalControls={executiveTotalControls}
                    highRisks={highRisks}
                    mediumRisks={mediumRisks}
                    activeActionPlans={activeActionPlans}
                    overdueActionPlans={overdueActionPlans}
                    openNonconformities={openNcCount}
                    effectiveStatus={effectiveGlobalStatus}
                  />

                  {canShowAdvancedMetrics && totalKpis > 0 && (
                    <ExecutiveKpiPulse
                      score={scoreKpiGlobal}
                      coverage={kpiCoveragePct ?? 0}
                      red={kpiSummary?.red || 0}
                      gray={kpiSummary?.gray || 0}
                      health={kpiSummary?.health_kpis || healthKpiItems.length}
                    />
                  )}

                  {(canShowAdvancedMetrics || canShowDataQuality) && (
                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
                      {canShowAdvancedMetrics && (
                        <ExecutiveTrendPanel item={executiveTrendItem} loading={loadingKpis} />
                      )}
                      {canShowDataQuality && (
                        <ExecutiveDataTrustPanel
                          items={kpiItems}
                          healthWarnings={systemHealthDashboard?.data_quality_warnings || []}
                          loading={loadingKpis || systemHealthLoading}
                        />
                      )}
                    </div>
                  )}

                  <OperationalChartsPanel
                    controlStatus={controlStatusChartData}
                    riskLevels={riskLevelChartData}
                    auditStates={auditStateChartData}
                    actionPlans={actionPlanChartData}
                    evidenceCoverage={evidenceCoverageChartData}
                    nonconformities={nonconformityChartData}
                  />

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_1fr_1.22fr]">
                    <StandardHealthPanel rows={standardHealthRows} />
                    <AuditTimelinePanel items={auditTimelineItems} />
                    <ActionPlansPanel items={activeActionPlanItems} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <PriorityRiskPanel rows={priorityRiskRows} />
                    <ExecutiveReportPanel
                      period={latestSyncText}
                      complianceValue={executiveComplianceValue}
                    />
                  </div>

                  {canShowIsoHealth && (
                    <SystemHealthDashboardSection
                      data={systemHealthDashboard}
                      loading={systemHealthLoading}
                      error={systemHealthError}
                      compact
                    />
                  )}
                </>
              )}
            </>
          )}

          {activeView === 'kpi' && (
            <>
              <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">
                      {t('dashboard.kpiView')}
                    </h2>
                    <p className="mt-1 text-[var(--tcdx-color-text-secondary)]">
                      {t('dashboardKpi.kpiViewSubtitle')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {canShowIsoHealth && (
                      <a
                        href="/iso-health"
                        className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                      >{t('dashboardKpi.viewHealth')}</a>
                    )}

                    {canManageKpis && canShowIsoHealth && (
                      <>
                        <a
                          href="/administrar-kpis"
                          className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--tcdx-color-text-primary)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)]"
                        >{t('dashboardKpi.administerKpis')}</a>

                        {canShowMetricsEngine && (
                          <button
                            type="button"
                            onClick={handleRecalculateKpis}
                            disabled={recalculatingKpis}
                            className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--tcdx-color-primary-hover)] disabled:opacity-60"
                          >
                            {recalculatingKpis ? 'Recalculando...' : t('dashboardKpi.recalculateKpis')}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {kpiRecalculateNotice && (
                  <div
                    className={`mt-4 rounded-[var(--tcdx-radius-tecdex-sm)] border px-4 py-3 text-sm whitespace-pre-line ${
                      kpiRecalculateNotice.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                    role={kpiRecalculateNotice.type === 'error' ? 'alert' : 'status'}
                  >
                    {kpiRecalculateNotice.message}
                  </div>
                )}

                {canShowAdvancedMetrics && (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-6">
                  <TopCard
                    title={t('dashboard.kpiGlobalScore')}
                    value={scoreKpiGlobal === null ? 'Sin medición' : `${scoreKpiGlobal}%`}
                    subtitle={t('dashboard.kpiGlobalScoreSubtitle')}
                    accent="green"
                    change={t('dashboardKpi.greenPlural', { count: kpiSummary?.green || 0 })}
                    changeHint={t('dashboard.currentState')}
                    icon={<TcdxIcon name="kpi" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.kpiCoverage')}
                    value={kpiCoveragePct === null ? 'N/A' : `${kpiCoveragePct}%`}
                    subtitle={`${measuredKpis}/${totalKpis} KPIs medidos`}
                    accent={kpiCoverageTone}
                    change={t('dashboardKpi.pendingNoData', { count: pendingKpis })}
                    changeHint={t('dashboard.kpiCoverageHint')}
                    icon={<TcdxIcon name="trend" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.criticalKpis')}
                    value={kpiSummary?.red || 0}
                    subtitle={t('dashboard.criticalKpisSubtitle')}
                    accent="red"
                    change={t('dashboardKpi.alertLabel')}
                    changeHint={t('dashboard.highImpact')}
                    icon={<TcdxIcon name="alert" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.noDataKpis')}
                    value={kpiSummary?.gray || 0}
                    subtitle={t('dashboard.noDataKpisSubtitle')}
                    accent="amber"
                    change="INPUT"
                    changeHint={t('dashboard.requiredInput')}
                    icon={<TcdxIcon name="hourglass" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.enabledKpis')}
                    value={kpiItems.filter((item) => item.is_enabled).length}
                    subtitle={t('dashboard.enabledKpisSubtitle')}
                    accent="violet"
                    change={t('dashboardKpi.manualPlural', { count: kpiItems.filter((item) => item.kpi_type === 'manual').length })}
                    changeHint={t('dashboard.captureType')}
                    icon={<TcdxIcon name="puzzle" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.healthKpis')}
                    value={kpiSummary?.health_kpis || healthKpiItems.length}
                    subtitle={t('dashboard.healthKpisSubtitle')}
                    accent="indigo"
                    change={formatKpiValue(healthMainKpi?.latest_snapshot?.value, '%')}
                    changeHint={t('dashboard.generalHealth')}
                    icon={<TcdxIcon name="heart" className="h-6 w-6" />}
                  />
                </div>
                )}

                {canShowAdvancedMetrics && scoreKpiGlobal === null && (
                  <div className="mt-4 rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">{t('dashboardKpi.scoreGlobalPendingTitle')}</p>
                    <p className="mt-1 leading-6">
                      {scoreGlobalActionableState?.why ||
                        t('dashboardKpi.scoreGlobalPendingDescription', {
                          indicator:
                            scoreGlobalPendingItem?.name ||
                            t('dashboardKpi.officialDependencyFallback'),
                          state: scoreGlobalPendingState,
                        })}
                    </p>
                    {scoreGlobalMissingComponent && (
                      <div className="mt-3 rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-white px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          {t('dashboardKpi.missingOfficialComponent')}
                        </p>
                        <p className="mt-1 font-semibold">
                          {scoreGlobalMissingComponent.label || scoreGlobalMissingComponent.component}
                        </p>
                        <p className="mt-1 text-xs leading-5">
                          {scoreGlobalMissingComponent.reason ||
                            scoreGlobalActionableState?.expected_after_resolution ||
                            t('dashboardKpi.completeOfficialEvidence')}
                        </p>
                        {scoreGlobalMissingComponent.route_to_fix && (
                          <a
                            href={scoreGlobalMissingComponent.route_to_fix}
                            className="mt-2 inline-flex min-h-8 items-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-300 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                          >
                            {scoreGlobalMissingComponent.action || t('dashboardKpi.resolveOfficialOrigin')}
                          </a>
                        )}
                      </div>
                    )}
                    {scoreGlobalActionableState?.expected_after_resolution && (
                      <p className="mt-2 text-xs leading-5 text-amber-800">
                        {scoreGlobalActionableState.expected_after_resolution}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {canShowAdvancedMetrics && loadingKpis && (
                <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-8 text-[var(--tcdx-color-text-secondary)] shadow-[var(--tcdx-shadow-tecdex-sm)]">
                  Cargando vista KPI...
                </div>
              )}

              {!loadingKpis && (
                <>
                  {canShowIsoHealth && (
                  <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-emerald-200 bg-emerald-50/60 p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                          {t('dashboardKpi.healthEngineTitle')}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--tcdx-color-text-primary)]">
                          {t('dashboardKpi.healthEngineSubtitle')}
                        </p>
                      </div>

                      <a
                        href="/iso-health?tab=detalle"
                        className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >{t('dashboardKpi.viewHealthDetail')}</a>
                    </div>

                    {healthKpiItems.length === 0 ? (
                      <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        {t('dashboardKpi.noHealthKpis')}
                        generar los snapshots del período.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <HealthKpiMiniCard
                          title={t('dashboard.healthGeneral')}
                          item={healthMainKpi}
                          fallback="KPI-HLT-001"
                        />
                        <HealthKpiMiniCard
                          title={t('dashboard.evidenceCoverage')}
                          item={healthCoverageKpi}
                          fallback="KPI-HLT-003"
                        />
                        <HealthKpiMiniCard
                          title={t('dashboard.deterioratedControls')}
                          item={healthDeterioratedKpi}
                          fallback="KPI-HLT-004"
                        />
                      </div>
                    )}
                  </section>
                  )}

                  {canShowAdvancedMetrics && (
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
                    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[2rem] font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                          {t('dashboardKpi.overallKpiStatus')}
                        </h2>

                        <div className="rounded-full bg-[var(--tcdx-color-surface-alt)] px-3 py-1 text-xs font-semibold text-[var(--tcdx-color-text-primary)]">
                          {kpiSummary?.total_kpis || 0} KPI(s)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-center">
                        <div className="relative mx-auto w-full max-w-[300px]">
                          {hasChartData(kpiStatusData) ? (
                            <ResponsiveChartFrame
                              ariaDescription={`Distribución de estados KPI. ${getChartSummary(kpiStatusData, 'KPI')}`}
                              ariaLabel="Distribución de estados KPI"
                              className="bg-transparent"
                              height={260}
                            >
                              <PieChart>
                                <Pie
                                  data={kpiStatusData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={62}
                                  outerRadius={95}
                                  paddingAngle={3}
                                  stroke="#ffffff"
                                  strokeWidth={4}
                                >
                                  {kpiStatusData.map((entry, index) => (
                                    <Cell key={index} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={formatChartTooltip('KPI')} />
                              </PieChart>
                            </ResponsiveChartFrame>
                          ) : (
                            <UniversalStateBlock
                              state="insufficient"
                              title="Datos insuficientes"
                              description="No hay estados KPI publicados para graficar esta distribución."
                            />
                          )}

                          {hasChartData(kpiStatusData) ? <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-5xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">
                              {kpiSummary?.green || 0}
                            </div>
                            <div className="mt-1 text-base font-medium text-[var(--tcdx-color-text-secondary)]">
                              {t('dashboardKpi.greenStatus')}
                            </div>
                          </div> : null}
                        </div>

                        <div className="space-y-5">
                          <LegendRow
                            label={t('dashboardKpi.statusColors.green')}
                            value={kpiSummary?.green || 0}
                            color="bg-green-600"
                            extra={t('dashboardKpi.targetAchieved')}
                          />
                          <LegendRow
                            label={t('dashboardKpi.statusColors.yellow')}
                            value={kpiSummary?.yellow || 0}
                            color="bg-amber-400"
                            extra={t('dashboardKpi.monitoringRequired')}
                          />
                          <LegendRow
                            label={t('dashboardKpi.statusColors.red')}
                            value={kpiSummary?.red || 0}
                            color="bg-red-500"
                            extra={t('dashboardKpi.actionRecommended')}
                          />
                          <LegendRow
                            label={t('dashboardKpi.statusColors.gray')}
                            value={kpiSummary?.gray || 0}
                            color="bg-slate-400"
                            extra={t('dashboardKpi.loadOrCalculationPending')}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                          {t('dashboardKpi.categoryDistribution')}
                        </h2>

                        {canManageKpis && (
                          <a
                            href="/administrar-kpis"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--tcdx-color-primary)] transition hover:text-[var(--tcdx-color-primary-hover)]"
                          >
                            <span>{t('dashboardKpi.manage')}</span>
                            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                          </a>
                        )}
                      </div>

                      <div>
                        {hasChartData(kpiCategoryData) ? (
                        <ResponsiveChartFrame
                          ariaDescription={`Comparación por categoría KPI. ${getChartSummary(kpiCategoryData, 'KPI')}`}
                          ariaLabel="KPI por categoría"
                          height={300}
                        >
                          <BarChart data={kpiCategoryData} margin={{ top: 10, right: 10, left: -12, bottom: 2 }}>
                            <CartesianGrid vertical={false} stroke="var(--tcdx-color-border)" />
                            <XAxis dataKey="name" tickFormatter={(value) => getKpiCategoryLabel(String(value))} tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} tickFormatter={(value) => String(value)} tickLine={false} axisLine={false} fontSize={11} label={{ value: 'KPI', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--tcdx-color-text-secondary)' } }} />
                            <Tooltip formatter={formatChartTooltip('KPI')} labelFormatter={(label) => getKpiCategoryLabel(String(label))} />
                            <Bar
                              dataKey="value"
                              radius={[10, 10, 0, 0]}
                              fill="var(--tcdx-color-secondary)"
                            />
                          </BarChart>
                        </ResponsiveChartFrame>
                        ) : (
                          <UniversalStateBlock
                            state="insufficient"
                            title="Datos insuficientes"
                            description="No hay categorías KPI publicadas para comparar."
                          />
                        )}
                      </div>
                    </section>
                  </div>
                  )}

                  {canShowAdvancedMetrics && (
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                          {t('dashboardKpi.criticalKpisTitle')}
                        </h2>

                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                          {t('dashboardKpi.redCount', { count: topRedKpis.length })}
                        </span>
                      </div>

                      {topRedKpis.length === 0 ? (
                        <div className="text-[var(--tcdx-color-text-secondary)]">{t('dashboardKpi.noRedKpis')}</div>
                      ) : (
                        <div className="space-y-4">
                          {topRedKpis.map((item) => (
                            <KpiRow key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                          {t('dashboardKpi.featuredKpis')}
                        </h2>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          {t('dashboardKpi.greenCount', { count: topGreenKpis.length })}
                        </span>
                      </div>

                      {topGreenKpis.length === 0 ? (
                        <div className="text-[var(--tcdx-color-text-secondary)]">
                          {t('dashboardKpi.noGreenKpis')}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {topGreenKpis.map((item) => (
                            <KpiRow key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                  )}

                  {canShowAdvancedMetrics && (
                  <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
                        {t('dashboardKpi.allKpis')}
                      </h2>

                      {canManageKpis && (
                        <a
                          href="/administrar-kpis"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--tcdx-color-primary)] transition hover:text-[var(--tcdx-color-primary-hover)]"
                        >
                          <span>{t('dashboardKpi.administerKpis')}</span>
                          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                        </a>
                      )}
                    </div>

                    {kpiItems.length === 0 ? (
                      <div className="text-[var(--tcdx-color-text-secondary)]">
                        No hay indicadores oficiales disponibles para este tenant.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {kpiItems.map((item) => (
                          <KpiCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </section>
                  )}
                </>
              )}
            </>
          )}

          {activeView === 'iso' && canShowIsoHealth && (
            <SystemHealthDashboardSection
              data={systemHealthDashboard}
              loading={systemHealthLoading}
              error={systemHealthError}
              expanded
            />
          )}
        </div>
        {canShowGrcAnalysis && (
        <div className="mx-auto w-full max-w-[1720px]">
          <GrcDecisionCenter
            compact
            variant="summary"
            title={t('grcDecisionCenter.summaryTitle')}
            ctaHref="/grc"
            ctaLabel={t('grcDecisionCenter.cta')}
          />
        </div>
        )}
        {canShowGrcAdvanced && (
        <div className="mx-auto mt-6 max-w-[1720px]">
          <GrcPhase1Panel mode="dashboard" />
        </div>
        )}
      </div>
    </AppLayout>
  );
}


function hasChartData(items: OperationalChartDatum[]) {
  return items.some((item) => item.value > 0);
}

function ExecutiveAttentionPanel({ items }: { items: ExecutiveAttentionItem[] }) {
  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-primary)]">
            Requiere atención
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
            Prioridades ejecutivas publicadas por los dominios GRC
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Señales agrupadas desde riesgos, auditoría, acciones, no conformidades e indicadores oficiales existentes.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[rgba(237,111,42,0.24)] bg-[rgba(237,111,42,0.1)] px-3 py-1 text-xs font-semibold text-[var(--tcdx-color-primary)]">
          Sin ranking fabricado
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4 transition hover:border-[var(--tcdx-color-primary)] hover:bg-white focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-secondary)]">
                  {item.label}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--tcdx-color-text-ink)]">
                  {item.title}
                </h3>
              </div>
              <UniversalStateBadge state={item.state} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">{item.detail}</p>
              <span className="text-3xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">{item.value}</span>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--tcdx-color-primary)]">
              Abrir workspace
              <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ExecutiveTrendPanel({
  item,
  loading,
}: {
  item: KpiDashboardItem | null;
  loading: boolean;
}) {
  const trend = item ? buildOfficialTrend(item) : [];

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-text-muted)]">
            Tendencia
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">
            Evolución oficial comparable
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Sólo se grafica cuando existen snapshots históricos publicados.
          </p>
        </div>
        <Link href="/metricas" className="text-xs font-bold text-[var(--tcdx-color-primary)] hover:text-[var(--tcdx-color-primary-hover)]">
          Ver métricas
        </Link>
      </div>

      {loading ? (
        <UniversalStateBlock state="loading" title="Cargando tendencia" />
      ) : trend.length < 2 ? (
        <UniversalStateBlock
          state="insufficient"
          title="Datos insuficientes"
          description="No hay histórico oficial suficiente para una tendencia ejecutiva."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{item?.name}</div>
              <div className="text-xs text-[var(--tcdx-color-text-secondary)]">{item?.code}</div>
            </div>
            <UniversalStateBadge state={mapOfficialStateToUniversal(item?.latest_snapshot)} />
          </div>
          <ResponsiveChartFrame
            ariaDescription={`Tendencia de ${item?.name || 'indicador oficial'} con ${trend.length} snapshots oficiales publicados. Unidad: ${item?.unit || 'valor'}. Fuente: ${item?.code || 'snapshot oficial'}.`}
            ariaLabel="Tendencia oficial comparable"
            className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-surface)] p-2"
            height={220}
          >
            <LineChart data={trend}>
              <CartesianGrid vertical={false} stroke="var(--tcdx-color-border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                label={{ value: item?.unit || 'valor', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--tcdx-color-text-secondary)' } }}
              />
              <Tooltip formatter={formatChartTooltip(item?.unit || 'valor')} labelFormatter={(label) => `Período: ${String(label)}`} />
              <Line dataKey="value" stroke="var(--tcdx-color-secondary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveChartFrame>
        </>
      )}
    </section>
  );
}

function ExecutiveDataTrustPanel({
  items,
  healthWarnings,
  loading,
}: {
  items: KpiDashboardItem[];
  healthWarnings: string[];
  loading: boolean;
}) {
  const snapshots = items
    .map((item) => ({ item, snapshot: item.latest_snapshot }))
    .filter((entry): entry is { item: KpiDashboardItem; snapshot: LatestSnapshot } => Boolean(entry.snapshot));
  const trustedSnapshots = snapshots.filter((entry) => Boolean(entry.snapshot.trust?.status || entry.snapshot.coverage || entry.snapshot.freshness));
  const selected = trustedSnapshots[0] || null;
  const trust = selected?.snapshot.trust || null;
  const freshness = trust?.freshness || getNestedStatus(selected?.snapshot.freshness);
  const coverage = trust?.coverage ?? selected?.snapshot.coverage ?? null;
  const warnings = [...(trust?.warnings || []), ...healthWarnings].filter(Boolean);

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-text-muted)]">
            Data Trust
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">
            Calidad y confianza de la información
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Lectura visual de campos publicados por snapshots y health; no recalcula confianza.
          </p>
        </div>
        <Link href="/datos/calidad" className="text-xs font-bold text-[var(--tcdx-color-primary)] hover:text-[var(--tcdx-color-primary-hover)]">
          Ver calidad
        </Link>
      </div>

      {loading ? (
        <UniversalStateBlock state="loading" title="Cargando Data Trust" />
      ) : !selected ? (
        <UniversalStateBlock
          state="not_available"
          title="No disponible"
          description="Las fuentes ejecutivas cargadas no publican Data Trust para esta vista."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <DataTrustIndicator
            variant="panel"
            status={trust?.status || null}
            confidence={trust?.confidence ?? trust?.score ?? null}
            coverage={coverage}
            freshness={freshness}
            source={trust?.source || selected.item.code}
            timestamp={trust?.timestamp || selected.snapshot.updated_at || selected.snapshot.calculated_at || null}
            provenance={
              selected.snapshot.checksum ? (
                <span className="break-all">Checksum: {selected.snapshot.checksum}</span>
              ) : null
            }
            warnings={warnings}
            label="Data Trust ejecutivo"
          />
          <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-secondary)]">
              Snapshot fuente
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{selected.item.name}</div>
            <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{selected.item.code}</div>
            <div className="mt-4">
              <UniversalStateBadge state={mapOfficialStateToUniversal(selected.snapshot)} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function OperationalChartsPanel({
  controlStatus,
  riskLevels,
  auditStates,
  actionPlans,
  evidenceCoverage,
  nonconformities,
}: {
  controlStatus: OperationalChartDatum[];
  riskLevels: OperationalChartDatum[];
  auditStates: OperationalChartDatum[];
  actionPlans: OperationalChartDatum[];
  evidenceCoverage: OperationalChartDatum[];
  nonconformities: OperationalChartDatum[];
}) {
  const charts = [
    {
      title: 'Controles por estado',
      description: 'Distribución de controles aplicables según estado operativo.',
      data: controlStatus,
      kind: 'donut' as const,
    },
    {
      title: 'Riesgos por nivel',
      description: 'Presión de riesgo informada por el resumen del tenant.',
      data: riskLevels,
      kind: 'bar' as const,
    },
    {
      title: 'Auditorías por estado',
      description: 'Programa auditado por fase de ejecución e informe.',
      data: auditStates,
      kind: 'bar' as const,
    },
    {
      title: 'Planes de acción',
      description: 'Estado de seguimiento de acciones correctivas y operativas.',
      data: actionPlans,
      kind: 'donut' as const,
    },
    {
      title: 'Cobertura de evidencias',
      description: 'Evidencia oficial, aprobada y faltante en controles activos.',
      data: evidenceCoverage,
      kind: 'bar' as const,
    },
    {
      title: 'No conformidades',
      description: 'Balance de no conformidades abiertas y cerradas.',
      data: nonconformities,
      kind: 'donut' as const,
    },
  ];

  if (!charts.some((chart) => hasChartData(chart.data))) return null;

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-primary)]">
            Gráficos operacionales
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
            Distribución de señales ISO activas
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Visualización derivada de controles, riesgos, auditorías, evidencias, planes y no conformidades ya cargados en el tenant.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[rgba(81,171,168,0.24)] bg-[rgba(81,171,168,0.12)] px-3 py-1 text-xs font-semibold text-[var(--tcdx-color-secondary-hover)]">
          Datos existentes
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {charts.map((chart) => (
          <OperationalChartCard key={chart.title} {...chart} />
        ))}
      </div>
    </section>
  );
}

function OperationalChartCard({
  title,
  description,
  data,
  kind,
}: {
  title: string;
  description: string;
  data: OperationalChartDatum[];
  kind: 'bar' | 'donut';
}) {
  const hasData = hasChartData(data);
  const unit = 'registros';
  const summary = getChartSummary(data, unit);

  return (
    <article className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(216,216,216,0.72)] bg-[var(--tcdx-color-surface)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">{description}</p>
      </div>

      {!hasData ? (
        <UniversalStateBlock
          className="h-[220px] justify-center"
          state="empty"
          title="Sin datos"
          description="No hay registros publicados para graficar esta distribución."
        />
      ) : (
        <>
          <ResponsiveChartFrame
            ariaDescription={`${description} ${summary}`}
            ariaLabel={title}
            className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-white p-2"
            height={240}
          >
            {kind === 'donut' ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill || 'var(--tcdx-color-secondary)'} />
                  ))}
                </Pie>
                <Tooltip formatter={formatChartTooltip(unit)} />
              </PieChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke="var(--tcdx-color-border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} label={{ value: 'Registros', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--tcdx-color-text-secondary)' } }} />
                <Tooltip formatter={formatChartTooltip(unit)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill || 'var(--tcdx-color-secondary)'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveChartFrame>
          <p className="mt-3 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">{summary}</p>
        </>
      )}
    </article>
  );
}

function SystemHealthDashboardSection({
  data,
  loading,
  error,
  expanded = false,
  compact = false,
}: {
  data: SystemHealthDashboard | null;
  loading: boolean;
  error: string;
  expanded?: boolean;
  compact?: boolean;
}) {
  const alerts = data?.alerts || {};
  const topProcesses = data?.critical_processes || [];
  const standards = data?.standards || [];
  const score = Number(data?.global_score || 0);

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--tcdx-color-text-muted)]">
            Salud del sistema
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
            Lectura operacional de health ISO
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Health es un indicador calculado de gestión, no certificación ni aprobación automática.
          </p>
        </div>

        <a
          href="/iso-health"
          className="inline-flex w-fit rounded-[var(--tcdx-radius-tecdex-sm)] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Ver salud completa
        </a>
      </div>

      {loading ? (
        <div className="mt-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4 text-sm text-[var(--tcdx-color-text-secondary)]">
          Cargando salud del sistema...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !data ? (
        <div className="mt-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4 text-sm text-[var(--tcdx-color-text-secondary)]">
          No fue posible cargar salud del sistema.
        </div>
      ) : (
        <>
          <div className={compact ? 'mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]' : 'mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'}>
            <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-navy)] p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Health global
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <span className="text-5xl font-bold tracking-tight">{score.toFixed(0)}</span>
                <span className={`mb-1 rounded-full border px-3 py-1 text-xs font-semibold ${getSystemHealthTone(data.status)}`}>
                  {data.label || 'Sin salud'}
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-[var(--tcdx-color-primary)]"
                  style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/75">
                {data.explanation || 'Sin explicación disponible para el cálculo.'}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <PriorityMiniMetric label="Brechas críticas" value={String(alerts.critical_gaps || 0)} />
              <PriorityMiniMetric label="Acciones vencidas" value={String(alerts.overdue_actions || 0)} />
              <PriorityMiniMetric label="Evidencia faltante" value={String(alerts.missing_evidence || 0)} />
            </div>
          </div>

          {!compact && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Salud por norma</h3>
              {standards.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--tcdx-color-text-secondary)]">No hay normas activas evaluables.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {standards.slice(0, expanded ? 8 : 4).map((standard) => (
                    <div key={standard.id || standard.name} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{standard.name || 'Norma'}</div>
                        <div className="text-xs text-[var(--tcdx-color-text-secondary)]">{standard.label || standard.status || 'Sin estado'}</div>
                      </div>
                      <div className="text-right text-lg font-bold text-[var(--tcdx-color-text-ink)]">
                        {Number(standard.score || 0).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Top procesos críticos</h3>
              {topProcesses.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--tcdx-color-text-secondary)]">No hay procesos críticos destacados.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {topProcesses.slice(0, expanded ? 6 : 3).map((process) => (
                    <div key={`${process.standard_code}-${process.id || process.operation_id || process.name}`} className="rounded-xl bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{process.name || 'Proceso'}</div>
                          <div className="text-xs text-[var(--tcdx-color-text-secondary)]">{process.standard_code || 'ISO'} · {process.main_issue || 'sin causa principal'}</div>
                        </div>
                        <div className="text-right text-lg font-bold text-[var(--tcdx-color-text-ink)]">
                          {Number(process.score || 0).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {data.data_quality_warnings && data.data_quality_warnings.length > 0 && (
            <div className="mt-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {data.data_quality_warnings.slice(0, 3).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ExecutiveStatusOverview({
  complianceValue,
  healthyControls,
  totalControls,
  highRisks,
  mediumRisks,
  activeActionPlans,
  overdueActionPlans,
  openNonconformities,
  effectiveStatus,
}: {
  complianceValue: number;
  healthyControls: number;
  totalControls: number;
  highRisks: number;
  mediumRisks: number;
  activeActionPlans: number;
  overdueActionPlans: number;
  openNonconformities: number;
  effectiveStatus: string;
}) {
  const riskPressure = Math.min(100, highRisks * 18 + mediumRisks * 8);
  const actionPressure = Math.min(100, activeActionPlans > 0 ? Math.round((overdueActionPlans / activeActionPlans) * 100) : 0);
  const complianceSafe = Math.max(0, Math.min(100, complianceValue));
  const healthLabel = mapEffectiveHealthLabel(effectiveStatus);

  const segments = [
    {
      label: 'Cumplimiento ISO',
      value: `${complianceSafe}%`,
      helper: `${healthyControls}/${totalControls || 0} controles saludables`,
      width: complianceSafe,
      color: '#16a34a',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      label: 'Presión de riesgo',
      value: highRisks,
      helper: `${mediumRisks} riesgos medios`,
      width: riskPressure,
      color: riskPressure >= 60 ? '#dc2626' : '#f59e0b',
      bg: riskPressure >= 60 ? 'bg-red-50' : 'bg-amber-50',
      border: riskPressure >= 60 ? 'border-red-100' : 'border-amber-100',
    },
    {
      label: 'Acciones vencidas',
      value: overdueActionPlans,
      helper: `${activeActionPlans} acciones activas`,
      width: actionPressure,
      color: actionPressure >= 40 ? '#dc2626' : 'var(--tcdx-color-secondary)',
      bg: actionPressure >= 40 ? 'bg-red-50' : 'bg-blue-50',
      border: actionPressure >= 40 ? 'border-red-100' : 'border-blue-100',
    },
    {
      label: 'No conformidades',
      value: openNonconformities,
      helper: `Health ISO: ${healthLabel}`,
      width: Math.min(100, openNonconformities * 16),
      color: openNonconformities > 0 ? '#f59e0b' : '#16a34a',
      bg: openNonconformities > 0 ? 'bg-amber-50' : 'bg-emerald-50',
      border: openNonconformities > 0 ? 'border-amber-100' : 'border-emerald-100',
    },
  ];

  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-text-muted)]">
            Estado operacional
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--tcdx-color-text-ink)]">
            Estado operacional de cumplimiento, riesgos y acciones
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            Vista integrada para priorizar controles, riesgo operacional, vencimientos y no conformidades.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getEffectiveHealthTone(effectiveStatus)}`}>
          {healthLabel}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.label} className={`rounded-[var(--tcdx-radius-tecdex-sm)] border ${segment.border} ${segment.bg} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-secondary)]">
                  {segment.label}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-[var(--tcdx-color-text-ink)]">
                  {segment.value}
                </p>
              </div>
              <span className="mt-1 h-3 w-3 rounded-full" style={{ background: segment.color }} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(4, Math.min(100, segment.width))}%`, background: segment.color }}
              />
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--tcdx-color-text-primary)]">{segment.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExecutiveKpiPulse({
  score,
  coverage,
  red,
  gray,
  health,
}: {
  score: number | null;
  coverage: number;
  red: number;
  gray: number;
  health: number;
}) {
  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--tcdx-color-text-muted)]">Estado KPI</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">Indicadores operacionales de desempeño</h2>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            Resumen de indicadores oficiales, cobertura de medición y Health.
          </p>
        </div>
        <a
          href="/dashboard?view=kpi"
          className="inline-flex w-fit rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tcdx-color-primary-hover)]"
        >
          Abrir indicadores oficiales
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PriorityMiniMetric label="Score oficial" value={score === null ? 'Sin medición' : `${score}%`} />
        <PriorityMiniMetric label="Cobertura" value={`${coverage}%`} />
        <PriorityMiniMetric label="Críticos" value={String(red)} />
        <PriorityMiniMetric label="Sin datos" value={String(gray)} />
        <PriorityMiniMetric label="Health" value={String(health)} />
      </div>
    </section>
  );
}

function PriorityMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--tcdx-color-border)] bg-white px-3 py-2">
      <div className="text-[11px] text-[var(--tcdx-color-text-secondary)]">{label}</div>
      <div className="mt-1 font-semibold text-[var(--tcdx-color-text-ink)]">{value}</div>
    </div>
  );
}

function TopCard({
  title,
  value,
  subtitle,
  accent,
  change,
  changeHint,
  icon,
  ringValue,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  accent: 'green' | 'red' | 'amber' | 'rose' | 'indigo' | 'violet';
  change: string;
  changeHint: string;
  icon: ReactNode;
  ringValue?: number;
}) {
  const toneMap: Record<
    'green' | 'red' | 'amber' | 'rose' | 'indigo' | 'violet',
    'success' | 'danger' | 'warning' | 'info'
  > = {
    green: 'success',
    red: 'danger',
    amber: 'warning',
    rose: 'danger',
    indigo: 'info',
    violet: 'info',
  };

  const renderedIcon =
    typeof ringValue === 'number' ? (
      <span
        className="relative flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--tcdx-color-primary) ${Math.max(
            0,
            Math.min(100, ringValue)
          )}%, var(--tcdx-color-surface-alt) 0)`,
        }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--tcdx-color-primary)] shadow-inner">
          {icon}
        </span>
      </span>
    ) : (
      icon
    );

  return (
    <EnterpriseKpiCard
      label={title}
      value={value}
      icon={renderedIcon}
      tone={toneMap[accent]}
      delta={change}
      meta={
        <>
          <span>{changeHint}</span>
          <span className="mt-2 block">{subtitle}</span>
        </>
      }
    />
  );
}

function PanelHeader({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-[var(--tcdx-color-text-ink)]">{title}</h2>
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-[var(--tcdx-color-text-muted)]">
          i
        </span>
      </div>

      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--tcdx-color-primary)] transition hover:text-[var(--tcdx-color-primary-hover)]"
        >
          <span>{t('common.view')}</span>
          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
        </a>
      )}
    </div>
  );
}

function StandardHealthPanel({
  rows,
}: {
  rows: Array<{ iso: string; total: number; ok: number; partial: number; critical: number; percent: number }>;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.controlHealthByStandard')} href="/controles" />

      <div className="mb-5 flex flex-wrap gap-5 text-xs font-semibold text-[var(--tcdx-color-text-primary)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[var(--tcdx-color-primary)]" />
          {t('statuses.controls.saludable')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#93c5fd]" />
          {t('statuses.controls.parcial')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#f97316]" />
          {t('sidebar.nonconformities')}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
          {t('common.emptyState')}
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((item) => {
            const okPct = item.total > 0 ? Math.round((item.ok / item.total) * 100) : 0;
            const partialPct =
              item.total > 0 ? Math.round((item.partial / item.total) * 100) : 0;
            const criticalPct = Math.max(0, 100 - okPct - partialPct);

            return (
              <div key={item.iso} className="grid grid-cols-[86px_minmax(0,1fr)_42px] items-center gap-3">
                <div className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{item.iso}</div>
                <div className="h-4 overflow-hidden rounded-sm bg-[var(--tcdx-color-surface-alt)]">
                  <div className="flex h-full">
                    <div className="bg-[var(--tcdx-color-primary)]" style={{ width: `${okPct}%` }} />
                    <div className="bg-[#93c5fd]" style={{ width: `${partialPct}%` }} />
                    <div className="bg-[#f97316]" style={{ width: `${criticalPct}%` }} />
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-[var(--tcdx-color-text-ink)]">{item.percent}%</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AuditTimelinePanel({
  items,
}: {
  items: Array<{ id: string; title: string; subtitle: string; date: string; status: string }>;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.auditStatus')} href="/auditorias" />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
          {t('common.emptyState')}
        </div>
      ) : (
        <div className="relative space-y-5">
          <div className="absolute bottom-5 left-[9px] top-2 w-px bg-slate-200" />
          {items.map((item, index) => (
            <div key={item.id} className="relative flex gap-4">
              <span
                className={[
                  'relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                  index === 0
                    ? 'border-emerald-500 text-emerald-600'
                    : index === 1
                    ? 'border-[#2563eb] text-[var(--tcdx-color-primary)]'
                    : index === 2
                    ? 'border-orange-500 text-orange-500'
                    : 'border-slate-300 text-[var(--tcdx-color-text-muted)]',
                ].join(' ')}
              >
                {index === 0 && <TcdxIcon name="check" className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[var(--tcdx-color-text-ink)]">{item.title}</div>
                <div className="text-sm text-[var(--tcdx-color-text-secondary)]">{item.subtitle}</div>
              </div>
              <div className="text-right">
                <div className="rounded-full bg-[var(--tcdx-color-surface-alt)] px-3 py-1 text-xs font-bold text-[var(--tcdx-color-text-primary)]">
                  {item.status}
                </div>
                <div className="mt-2 text-xs text-[var(--tcdx-color-text-secondary)]">{item.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionPlansPanel({ items }: { items: ActionPlanItem[] }) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.actionPlans')} href="/plan-accion" />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
          {t('common.emptyState')}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => {
            const progress = [65, 40, 80, 20][index % 4];
            const normalized = normalizeActionStatus(item.status);
            const color =
              normalized === 'bloqueado'
                ? '#ef4444'
                : normalized === 'en progreso'
                ? '#2563eb'
                : '#f97316';

            return (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_48px_130px] sm:gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--tcdx-color-text-ink)]">
                    {item.title || t('dashboard.actionPlans')}
                  </div>
                  <div className="truncate text-xs text-[var(--tcdx-color-text-secondary)]">
                    {item.iso_code || 'Sin ISO'} · {item.owner || t('common.notSelected')}
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-[var(--tcdx-color-primary)]">{progress}%</div>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-200 sm:col-span-1">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PriorityRiskPanel({
  rows,
}: {
  rows: Array<{ id: string; risk: string; norm: string; level: string }>;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.priorityRisks')} href="/matriz-riesgo" />

      <div className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_78px_82px_28px] border-b border-[rgba(216,216,216,0.55)] pb-2 text-xs font-bold text-[var(--tcdx-color-text-muted)] sm:grid">
          <span>{t('dashboard.risk')}</span>
          <span>{t('dashboard.standard')}</span>
          <span>{t('dashboard.level')}</span>
          <span />
        </div>
        <div className="divide-y divide-[rgba(216,216,216,0.65)]">
          {rows.length === 0 ? (
            <div className="py-6 text-sm text-[var(--tcdx-color-text-secondary)]">{t('dashboard.noPriorityRisks')}</div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_82px_28px] items-center gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_78px_82px_28px]"
              >
                <span className="truncate font-semibold text-[var(--tcdx-color-text-ink)]">{row.risk}</span>
                <span className="hidden text-[var(--tcdx-color-text-primary)] sm:block">{row.norm}</span>
                <span
                  className={[
                    'w-fit rounded-full px-3 py-1 text-xs font-bold',
                    row.level === 'Crítico'
                      ? 'bg-red-50 text-red-600'
                      : row.level === 'Alto'
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-amber-50 text-amber-700',
                  ].join(' ')}
                >
                  {row.level}
                </span>
                <TcdxIcon name="trend" className="h-4 w-4 justify-self-end text-[#f97316]" />
                <span className="col-span-3 text-xs font-semibold text-[var(--tcdx-color-text-secondary)] sm:hidden">
                  {row.norm}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ExecutiveReportPanel({
  period,
  complianceValue,
}: {
  period: string;
  complianceValue: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.executiveReport')} href="/exportes" />

      <div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-sm border border-[var(--tcdx-color-border)] bg-white shadow-sm">
          <div className="bg-white p-4">
            <div className="text-xl font-black text-[var(--tcdx-color-primary)]">Tecdex GRC Compliance</div>
            <div className="text-[10px] font-bold uppercase text-[var(--tcdx-color-text-ink)]">{t('dashboard.reportTitle')}</div>
            <div className="mt-1 text-[8px] text-[var(--tcdx-color-text-muted)]">{t('dashboard.reportSubtitle')}</div>
          </div>
          <div className="h-24 bg-[linear-gradient(150deg,#ffffff_0%,rgba(81,171,168,0.18)_38%,var(--tcdx-color-primary)_39%,var(--tcdx-color-navy-deep)_78%)]" />
          <div className="bg-[var(--tcdx-color-navy-deep)] px-4 py-3 text-[9px] font-semibold text-white/70">
            {period}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[var(--tcdx-color-text-ink)]">
            {t('dashboard.reportTitle')} ISO
          </h3>
          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {t('dashboard.reportDescription')}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">PDF</span>
            <span className="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">PPTX</span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">XLSX</span>
          </div>

          <a
            href="/exportes"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--tcdx-color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--tcdx-color-text-ink)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)]"
          >
            <TcdxIcon name="export" className="h-4 w-4 text-[var(--tcdx-color-primary)]" />
            {t('dashboard.downloadReport')}
          </a>

          <div className="mt-4 text-xs font-semibold text-[var(--tcdx-color-text-secondary)]">
            {t('dashboard.globalCompliance')}: {complianceValue}%
          </div>
        </div>
      </div>
    </section>
  );
}

function LegendRow({
  label,
  value,
  color,
  extra,
}: {
  label: string;
  value: string | number;
  color: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[rgba(216,216,216,0.55)] pb-4">
      <div className="flex items-center gap-3">
        <span className={`h-5 w-5 rounded-md ${color}`} />
        <span className="text-2xl text-[var(--tcdx-color-text-primary)]">{label}</span>
      </div>

      <div className="text-right">
        <div className="text-3xl font-bold text-slate-800">{value}</div>
        {extra && <div className="text-sm text-[var(--tcdx-color-text-muted)]">{extra}</div>}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(216,216,216,0.55)] bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--tcdx-color-text-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function HealthKpiMiniCard({
  title,
  item,
  fallback,
}: {
  title: string;
  item?: KpiDashboardItem | null;
  fallback: string;
}) {
  const status = item?.latest_snapshot?.status_color || 'gray';
  const snapshots = item?.latest_snapshots || [];

  const tone =
    status === 'green'
      ? 'border-emerald-200 bg-white'
      : status === 'yellow'
      ? 'border-amber-200 bg-white'
      : status === 'red'
      ? 'border-red-200 bg-white'
      : 'border-[var(--tcdx-color-border)] bg-white';

  return (
    <div className={`rounded-[var(--tcdx-radius-tecdex-sm)] border p-5 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-text-muted)]">
            {item?.code || fallback}
          </div>
          <div className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(
            status
          )}`}
        >
          {getKpiStatusLabel(status)}
        </span>
      </div>

      <div className="mt-4 text-4xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">
        {formatKpiValue(item?.latest_snapshot?.value, item?.unit || '%')}
      </div>

      <div className="mt-2 text-xs text-[var(--tcdx-color-text-secondary)]">
        {getRuntimePeriodLabel()}: {formatDateCL(item?.latest_snapshot?.period_start)} -{' '}
        {formatDateCL(item?.latest_snapshot?.period_end)}
      </div>

      {snapshots.length > 1 && (
        <div className="mt-4 grid grid-cols-1 gap-2">
          {snapshots.slice(0, 4).map((snap, index) => (
            <div
              key={`${item?.id}-${snap.standard_code || 'GLOBAL'}-${index}`}
              className="flex items-center justify-between rounded-xl border border-[rgba(216,216,216,0.55)] bg-[var(--tcdx-color-surface)] px-3 py-2 text-xs"
            >
              <span className="font-semibold text-[var(--tcdx-color-text-primary)]">
                {snap.standard_code || 'Global'}
              </span>
              <span className="font-bold text-[var(--tcdx-color-text-ink)]">
                {formatKpiValue(snap.value, item?.unit || '%')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiRow({ item }: { item: KpiDashboardItem }) {
  const status = item.latest_snapshot?.status_color || 'gray';

  return (
    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(216,216,216,0.55)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--tcdx-color-navy)] px-2 py-1 text-[11px] font-semibold text-white">
              {item.code}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(
                status
              )}`}
            >
              {getKpiStatusLabel(status)}
            </span>
            {isHealthKpiItem(item) && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Health
              </span>
            )}
          </div>

          <div className="mt-3 font-semibold text-[var(--tcdx-color-text-ink)]">{item.name}</div>

          <div className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {item.category} · {item.frequency}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">
            {formatKpiValue(item.latest_snapshot?.value, item.unit)}
          </div>

          <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">
            Objetivo:{' '}
            {item.target_value !== null && item.target_value !== undefined
              ? formatKpiValue(item.target_value, item.unit)
              : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ item }: { item: KpiDashboardItem }) {
  const status = item.latest_snapshot?.status_color || 'gray';

  return (
    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)] transition duration-300 hover:shadow-[var(--tcdx-shadow-tecdex-lg)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[var(--tcdx-color-navy)] px-2 py-1 text-[11px] font-semibold text-white">
              {item.code}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(
                status
              )}`}
            >
              {getKpiStatusLabel(status)}
            </span>
            {isHealthKpiItem(item) && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Motor Health
              </span>
            )}
            <span className="rounded-full bg-[var(--tcdx-color-surface-alt)] px-2.5 py-1 text-[11px] font-semibold text-[var(--tcdx-color-text-primary)]">
              {item.kpi_type}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">{item.name}</h3>

          <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {item.description || 'Sin descripción'}
          </p>
        </div>

        <div className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-surface)] px-4 py-3 text-right">
          <div className="text-3xl font-bold tracking-tight text-[var(--tcdx-color-text-ink)]">
            {formatKpiValue(item.latest_snapshot?.value, item.unit)}
          </div>
          <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{item.frequency}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatChip label="Categoría" value={item.category} color="text-[var(--tcdx-color-text-ink)]" />
        <StatChip label="Dirección" value={item.direction} color="text-[var(--tcdx-color-text-ink)]" />
        <StatChip
          label="Objetivo"
          value={
            item.target_value !== null && item.target_value !== undefined
              ? formatKpiValue(item.target_value, item.unit)
              : 'N/A'
          }
          color="text-[var(--tcdx-color-text-ink)]"
        />
        <StatChip
          label="Delta"
          value={
            item.delta !== null && item.delta !== undefined ? item.delta.toFixed(2) : 'N/A'
          }
          color={
            item.delta !== null && item.delta !== undefined && item.delta < 0
              ? 'text-red-600'
              : 'text-green-600'
          }
        />
      </div>

      {item.applicable_standards?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {item.applicable_standards.map((standard) => (
            <span
              key={`${item.id}-${standard}`}
              className="rounded-full border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-3 py-1 text-xs font-medium text-[var(--tcdx-color-text-primary)]"
            >
              {standard}
            </span>
          ))}
        </div>
      ) : null}

      {item.latest_snapshots?.length && item.latest_snapshots.length > 1 ? (
        <div className="mt-5 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(216,216,216,0.55)] bg-[var(--tcdx-color-surface)] p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-text-muted)]">
            Medición por norma / alcance
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {item.latest_snapshots.slice(0, 6).map((snap, index) => (
              <div
                key={`${item.id}-${snap.standard_code || 'GLOBAL'}-${index}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--tcdx-color-text-primary)]">
                  {snap.standard_code || 'Global'}
                </span>
                <span className="font-bold text-[var(--tcdx-color-text-ink)]">
                  {formatKpiValue(snap.value, item.unit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {buildOfficialTrend(item).length > 1 ? (
        <ResponsiveChartFrame className="mt-4" height={80} minHeight={40} minWidth={80}>
            <LineChart data={buildOfficialTrend(item)}>
              <Line dataKey="value" stroke="var(--tcdx-color-secondary)" strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveChartFrame>
      ) : (
        <div className="mt-4 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-surface)] px-3 py-2 text-xs text-[var(--tcdx-color-text-secondary)]">
          Sin histórico oficial comparable.
        </div>
      )}
    </div>
  );
}
