'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getUserFromToken, getUserRoleFromToken } from '@/utils/auth';
import AppLayout from '@/components/AppLayout';
import CompanyProfileImpactPanel from '@/components/company-profile/CompanyProfileImpactPanel';
import TcdxIcon from '@/components/icons/TcdxIcon';
import {
  EnterpriseKpiCard,
  EnterprisePageHeader,
} from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
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
    return 'border-slate-200 bg-slate-50 text-slate-500';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function getSystemHealthTone(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'high') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'acceptable') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'low') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (normalized === 'critical') return 'border-red-200 bg-red-50 text-red-700';

  return 'border-slate-200 bg-slate-50 text-slate-600';
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
  standard_code?: string | null;
  value?: number | string | null;
  numerator_value?: number | string | null;
  denominator_value?: number | string | null;
  status_color?: 'green' | 'yellow' | 'red' | 'gray' | string | null;
  period_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  calculated_at?: string | null;
  breakdown_json?: JsonValue;
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

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildTrend(value?: number | null, delta?: number | null) {
  if (value === null || value === undefined) return [];

  const d = delta || 0;

  return [
    { name: 't-3', value: value - d * 3 },
    { name: 't-2', value: value - d * 2 },
    { name: 't-1', value: value - d },
    { name: 't', value },
  ];
}

function calculateExecutiveScore(summary?: KpiDashboardResponse['summary']) {
  if (!summary) return 0;

  const green = Number(summary.green || 0);
  const yellow = Number(summary.yellow || 0);
  const red = Number(summary.red || 0);

  const measuredTotal = green + yellow + red;

  if (measuredTotal <= 0) return 0;

  return Math.round(
    (((green * 1) + (yellow * 0.6) + (red * 0.2)) / measuredTotal) * 100
  );
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

  return {
    id: raw.id === undefined || raw.id === null ? undefined : String(raw.id),
    standard_code: raw.standard_code === undefined || raw.standard_code === null ? null : String(raw.standard_code),
    value: typeof raw.value === 'number' || typeof raw.value === 'string' ? raw.value : null,
    numerator_value: typeof raw.numerator_value === 'number' || typeof raw.numerator_value === 'string' ? raw.numerator_value : null,
    denominator_value: typeof raw.denominator_value === 'number' || typeof raw.denominator_value === 'string' ? raw.denominator_value : null,
    status_color: raw.status_color === undefined || raw.status_color === null ? null : String(raw.status_color),
    period_type: raw.period_type === undefined || raw.period_type === null ? null : String(raw.period_type),
    period_start: raw.period_start === undefined || raw.period_start === null ? null : String(raw.period_start),
    period_end: raw.period_end === undefined || raw.period_end === null ? null : String(raw.period_end),
    calculated_at: raw.calculated_at === undefined || raw.calculated_at === null ? null : String(raw.calculated_at),
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
  const raw = asRecord(payload);
  const rawItems: unknown[] = Array.isArray(payload)
    ? payload
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
  const measuredKpis = finalGreen + finalYellow + finalRed;

  return {
    summary: {
      total_kpis: finalTotal,
      green: finalGreen,
      yellow: finalYellow,
      red: finalRed,
      gray: finalGray,
      measured_kpis: measuredKpis,
      data_coverage_pct:
        finalTotal > 0 ? Math.round((measuredKpis / finalTotal) * 100) : 0,
      health_kpis: Number(
        summary.health_kpis ??
        items.filter((item: KpiDashboardItem) => item.is_health_kpi).length
      ),
    },
    items,
  };
}

function getHealthRefreshCount(json: unknown) {
  const data = asRecord(json);
  if (Array.isArray(data.health_kpi_refresh)) {
    return data.health_kpi_refresh.reduce((acc: number, row) => {
      const item = asRecord(row);
      return acc + Number(item.snapshots_inserted || item.inserted || 0);
    }, 0);
  }

  return Number(data.health_recalculated || 0);
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
  return 'bg-slate-100 text-slate-600 border-slate-200';
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
      <div className="min-h-screen bg-[#f5f7fb] p-6">
        <div className="mx-auto max-w-[1720px] rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
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

  const currentRole = getUserRoleFromToken();

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
  const [refreshingExecutive, setRefreshingExecutive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [kpiData, setKpiData] = useState<KpiDashboardResponse | null>(null);
  const loadSystemHealthDashboard = useCallback(async () => {
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
  }, []);

  const loadEffectiveHealthSummary = useCallback(async () => {
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
  }, []);






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
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    try {
      setLoadingKpis(true);

      const json = await fetchJson(
        `${API_URL}/api/kpis/dashboard/${user.tenant_id}`,
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
  }, []);

  useEffect(() => {
    loadSystemHealthDashboard();
    loadEffectiveHealthSummary();
    loadExecutiveDashboard();
    loadKpiDashboard();
  }, [loadSystemHealthDashboard, loadEffectiveHealthSummary, loadExecutiveDashboard, loadKpiDashboard]);

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
    if (!canManageKpis) {
      alert('Tu rol no permite recalcular KPIs. Esta acción está reservada para administradores.');
      return;
    }

    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    try {
      setRecalculatingKpis(true);

      const res = await fetch(`${API_URL}/api/kpis/recalculate/${user.tenant_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error recalculando KPIs');
        return;
      }

      await loadKpiDashboard();

      const kpisRecalculated = Number(
        json?.snapshots_created ?? json?.recalculated ?? 0
      );

      const healthRecalculated = getHealthRefreshCount(json);

      alert(
        t('dashboardKpi.recalculateSuccess', { count: kpisRecalculated, healthCount: healthRecalculated })
      );
    } catch (err) {
      console.error('ERROR RECALCULATE KPI:', err);
      alert('Error recalculando KPIs');
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

  const scoreKpiGlobal = calculateExecutiveScore(kpiSummary);

  const measuredKpis = Number(
    kpiSummary?.measured_kpis ??
      ((kpiSummary?.green || 0) +
        (kpiSummary?.yellow || 0) +
        (kpiSummary?.red || 0))
  );

  const totalKpis = Number(kpiSummary?.total_kpis || kpiItems.length || 0);
  const pendingKpis = Number(kpiSummary?.gray || 0);

  const kpiCoveragePct =
    Number(kpiSummary?.data_coverage_pct) ||
    (totalKpis > 0 ? Math.round((measuredKpis / totalKpis) * 100) : 0);

  const kpiCoverageTone =
    kpiCoveragePct >= 90 ? 'green' : kpiCoveragePct >= 70 ? 'amber' : 'red';


  const healthMainKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'KPI-HLT-001') || null;
  }, [healthKpiItems]);

  const healthCoverageKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'KPI-HLT-003') || null;
  }, [healthKpiItems]);

  const healthDeterioratedKpi = useMemo(() => {
    return healthKpiItems.find((item) => item.code === 'KPI-HLT-004') || null;
  }, [healthKpiItems]);

  const kpiStatusData = useMemo(() => {
    return [
      { name: t('dashboardKpi.greenStatus'), value: kpiSummary?.green || 0, fill: '#16a34a' },
      { name: t('dashboardKpi.yellowStatus'), value: kpiSummary?.yellow || 0, fill: '#f59e0b' },
      { name: t('dashboardKpi.redStatus'), value: kpiSummary?.red || 0, fill: '#ef4444' },
      { name: t('dashboardKpi.noDataStatus'), value: kpiSummary?.gray || 0, fill: '#94a3b8' },
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


  const dashboardHasSummaryData =
    Number(summary?.total || 0) > 0 ||
    Number(summary?.open_findings || 0) > 0 ||
    Number(summary?.closed_findings || 0) > 0 ||
    Number(summary?.open_nonconformities || 0) > 0 ||
    Number(summary?.closed_nonconformities || 0) > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-6">
          <EnterprisePageHeader
            title={t('dashboard.title')}
            subtitle={t('dashboard.subtitle')}
            actions={
              <>
              <div className="enterprise-toolbar inline-flex p-1">
                <button
                  type="button"
                  onClick={() => handleViewChange('executive')}
                  className={[
                    'rounded-md px-4 py-2 text-sm font-semibold transition',
                    activeView === 'executive'
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {t('dashboard.executiveView')}
                </button>

                <button
                  type="button"
                  onClick={() => handleViewChange('kpi')}
                  className={[
                    'rounded-md px-4 py-2 text-sm font-semibold transition',
                    activeView === 'kpi'
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {t('dashboard.kpiView')}
                </button>

                <button
                  type="button"
                  onClick={() => handleViewChange('iso')}
                  className={[
                    'rounded-md px-4 py-2 text-sm font-semibold transition',
                    activeView === 'iso'
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  Salud del sistema
                </button>
              </div>

              <div className="enterprise-button-secondary">
                <TcdxIcon name="calendar" className="h-4 w-4 text-[#2563eb]" />
                {latestSyncText}
              </div>

              <button
                type="button"
                onClick={handleRefreshDashboard}
                disabled={refreshingExecutive}
                className="enterprise-button-secondary disabled:opacity-60"
              >
                <TcdxIcon name="refresh" className="h-4 w-4" />
                {refreshingExecutive ? t('common.refreshing') : t('common.refresh')}
              </button>
              </>
            }
          />

          {errorMessage && activeView === 'executive' && (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-red-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              {errorMessage}
            </div>
          )}

          {activeView === 'executive' && (
            <>
              {loading && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  {t('dashboard.loadingData')}
                </div>
              )}

              {!loading && controls.length === 0 && !dashboardHasSummaryData && effectiveActiveRows.length === 0 && !effectiveHealthLoading && (
                <div className="rounded-[30px] border border-amber-200 bg-[linear-gradient(135deg,#fffdf5_0%,#fdf8e8_100%)] p-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <h2 className="mb-3 text-3xl font-bold text-slate-900">
                    {t('dashboard.initialControlsTitle')}
                  </h2>

                  <p className="mb-4 text-lg text-slate-600">
                    {t('dashboard.initialControlsSubtitle')}
                  </p>

                  <div className="text-base text-slate-500">
                    {t('dashboard.initialControlsNext')}
                  </div>
                </div>
              )}

              {!loading && (controls.length > 0 || dashboardHasSummaryData || effectiveHealthLoading || effectiveActiveRows.length > 0) && (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    <TopCard
                      title={t('dashboard.globalCompliance')}
                      value={`${executiveComplianceValue}%`}
                      subtitle={t('dashboard.globalComplianceSubtitle')}
                      accent="indigo"
                      change={`ISO ${mapEffectiveHealthLabel(effectiveGlobalStatus)}`}
                      changeHint="Lectura efectiva en alcance"
                      icon={<TcdxIcon name="shield" className="h-6 w-6" />}
                      ringValue={executiveComplianceValue}
                    />

                    <TopCard
                      title={t('dashboard.healthyControls')}
                      value={`${executiveHealthyControls} / ${executiveTotalControls || 0}`}
                      subtitle={t('dashboard.healthyControlsSubtitle')}
                      accent="indigo"
                      change={t('dashboard.ofTotal', { value: executiveComplianceValue })}
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

                  {totalKpis > 0 && (
                    <ExecutiveKpiPulse
                      score={scoreKpiGlobal}
                      coverage={kpiCoveragePct}
                      red={kpiSummary?.red || 0}
                      gray={kpiSummary?.gray || 0}
                      health={kpiSummary?.health_kpis || healthKpiItems.length}
                    />
                  )}

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

                  <SystemHealthDashboardSection
                    data={systemHealthDashboard}
                    loading={systemHealthLoading}
                    error={systemHealthError}
                    compact
                  />
                </>
              )}
            </>
          )}

          {activeView === 'kpi' && (
            <>
              <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                      {t('dashboard.kpiView')}
                    </h2>
                    <p className="mt-1 text-slate-500">
                      {t('dashboardKpi.kpiViewSubtitle')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/iso-health"
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                    >{t('dashboardKpi.viewHealth')}</a>

                    {canManageKpis && (
                      <>
                        <a
                          href="/administrar-kpis"
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >{t('dashboardKpi.administerKpis')}</a>

                        <button
                          type="button"
                          onClick={handleRecalculateKpis}
                          disabled={recalculatingKpis}
                          className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {recalculatingKpis ? 'Recalculando...' : 'Recalcular KPIs'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-6">
                  <TopCard
                    title={t('dashboard.kpiGlobalScore')}
                    value={`${scoreKpiGlobal}%`}
                    subtitle={t('dashboard.kpiGlobalScoreSubtitle')}
                    accent="green"
                    change={t('dashboardKpi.greenPlural', { count: kpiSummary?.green || 0 })}
                    changeHint={t('dashboard.currentState')}
                    icon={<TcdxIcon name="kpi" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.kpiCoverage')}
                    value={`${kpiCoveragePct}%`}
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
              </div>

              {loadingKpis && (
                <div className="rounded-[30px] border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  Cargando vista KPI...
                </div>
              )}

              {!loadingKpis && (
                <>
                  <section className="rounded-[30px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.healthEngineTitle')}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {t('dashboardKpi.healthEngineSubtitle')}
                        </p>
                      </div>

                      <a
                        href="/iso-health?tab=detalle"
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >{t('dashboardKpi.viewHealthDetail')}</a>
                    </div>

                    {healthKpiItems.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
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

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.overallKpiStatus')}
                        </h2>

                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {kpiSummary?.total_kpis || 0} KPI(s)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-center">
                        <div className="relative mx-auto h-[260px] w-full max-w-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
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
                              <Tooltip formatter={(value: unknown, name: unknown) => [String(value), String(name)]} />
                            </PieChart>
                          </ResponsiveContainer>

                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-5xl font-bold tracking-tight text-slate-900">
                              {kpiSummary?.green || 0}
                            </div>
                            <div className="mt-1 text-base font-medium text-slate-500">
                              {t('dashboardKpi.greenStatus')}
                            </div>
                          </div>
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

                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.categoryDistribution')}
                        </h2>

                        {canManageKpis && (
                          <a
                            href="/administrar-kpis"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                          >
                            <span>{t('dashboardKpi.manage')}</span>
                            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                          </a>
                        )}
                      </div>

                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kpiCategoryData}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" tickFormatter={(value) => getKpiCategoryLabel(String(value))} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Bar
                              dataKey="value"
                              radius={[10, 10, 0, 0]}
                              fill="#4f46e5"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.criticalKpisTitle')}
                        </h2>

                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                          {t('dashboardKpi.redCount', { count: topRedKpis.length })}
                        </span>
                      </div>

                      {topRedKpis.length === 0 ? (
                        <div className="text-slate-500">{t('dashboardKpi.noRedKpis')}</div>
                      ) : (
                        <div className="space-y-4">
                          {topRedKpis.map((item) => (
                            <KpiRow key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.featuredKpis')}
                        </h2>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          {t('dashboardKpi.greenCount', { count: topGreenKpis.length })}
                        </span>
                      </div>

                      {topGreenKpis.length === 0 ? (
                        <div className="text-slate-500">
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

                  <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        {t('dashboardKpi.allKpis')}
                      </h2>

                      {canManageKpis && (
                        <a
                          href="/administrar-kpis"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          <span>Abrir administración</span>
                          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                        </a>
                      )}
                    </div>

                    {kpiItems.length === 0 ? (
                      <div className="text-slate-500">
                        No hay KPIs disponibles para este tenant.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {kpiItems.map((item) => (
                          <KpiCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          {activeView === 'iso' && (
            <SystemHealthDashboardSection
              data={systemHealthDashboard}
              loading={systemHealthLoading}
              error={systemHealthError}
              expanded
            />
          )}
        </div>
      </div>
    </AppLayout>
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
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Salud del sistema
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Lectura ejecutiva de health ISO
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Health es un indicador calculado de gestión, no certificación ni aprobación automática.
          </p>
        </div>

        <a
          href="/iso-health"
          className="inline-flex w-fit rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Ver salud completa
        </a>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Cargando salud del sistema...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !data ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No fue posible cargar salud del sistema.
        </div>
      ) : (
        <>
          <div className={compact ? 'mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]' : 'mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'}>
            <div className="rounded-[26px] border border-slate-200 bg-slate-950 p-5 text-white">
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
                  className="h-full rounded-full bg-blue-400"
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Salud por norma</h3>
              {standards.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No hay normas activas evaluables.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {standards.slice(0, expanded ? 8 : 4).map((standard) => (
                    <div key={standard.id || standard.name} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{standard.name || 'Norma'}</div>
                        <div className="text-xs text-slate-500">{standard.label || standard.status || 'Sin estado'}</div>
                      </div>
                      <div className="text-right text-lg font-bold text-slate-950">
                        {Number(standard.score || 0).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Top procesos críticos</h3>
              {topProcesses.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No hay procesos críticos destacados.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {topProcesses.slice(0, expanded ? 6 : 3).map((process) => (
                    <div key={`${process.standard_code}-${process.id || process.operation_id || process.name}`} className="rounded-xl bg-white px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{process.name || 'Proceso'}</div>
                          <div className="text-xs text-slate-500">{process.standard_code || 'ISO'} · {process.main_issue || 'sin causa principal'}</div>
                        </div>
                        <div className="text-right text-lg font-bold text-slate-950">
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
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
      color: actionPressure >= 40 ? '#dc2626' : '#2563eb',
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
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Estado operacional
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Semáforo ejecutivo de cumplimiento, riesgos y acciones
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Vista global para decidir dónde priorizar: controles, riesgo operacional, vencimientos y no conformidades.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getEffectiveHealthTone(effectiveStatus)}`}>
          {healthLabel}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {segments.map((segment) => (
          <div key={segment.label} className={`rounded-2xl border ${segment.border} ${segment.bg} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {segment.label}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
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
            <p className="mt-3 text-sm font-medium text-slate-600">{segment.helper}</p>
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
  score: number;
  coverage: number;
  red: number;
  gray: number;
  health: number;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pulso KPI</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Señales ejecutivas de desempeño</h2>
          <p className="mt-1 text-sm text-slate-500">
            Snapshot resumido de KPIs calculados, cobertura de medición y KPIs Health.
          </p>
        </div>
        <a
          href="/dashboard?view=kpi"
          className="inline-flex w-fit rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Abrir Vista KPI
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <PriorityMiniMetric label="Score KPI" value={`${score}%`} />
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
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
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
          background: `conic-gradient(#2563eb ${Math.max(
            0,
            Math.min(100, ringValue)
          )}%, #e8eef8 0)`,
        }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#2563eb] shadow-inner">
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
        <h2 className="text-sm font-bold text-[#06173a]">{title}</h2>
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
          i
        </span>
      </div>

      {href && (
        <a
          href={href}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#2563eb] transition hover:text-[#1d4ed8]"
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
    <section className="rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.controlHealthByStandard')} href="/controles" />

      <div className="mb-5 flex flex-wrap gap-5 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#2563eb]" />
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
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
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
                <div className="text-sm font-semibold text-[#06173a]">{item.iso}</div>
                <div className="h-4 overflow-hidden rounded-sm bg-slate-100">
                  <div className="flex h-full">
                    <div className="bg-[#2563eb]" style={{ width: `${okPct}%` }} />
                    <div className="bg-[#93c5fd]" style={{ width: `${partialPct}%` }} />
                    <div className="bg-[#f97316]" style={{ width: `${criticalPct}%` }} />
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-[#06173a]">{item.percent}%</div>
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
    <section className="rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.auditStatus')} href="/auditorias" />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
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
                    ? 'border-[#2563eb] text-[#2563eb]'
                    : index === 2
                    ? 'border-orange-500 text-orange-500'
                    : 'border-slate-300 text-slate-400',
                ].join(' ')}
              >
                {index === 0 && <TcdxIcon name="check" className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#06173a]">{item.title}</div>
                <div className="text-sm text-slate-500">{item.subtitle}</div>
              </div>
              <div className="text-right">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {item.status}
                </div>
                <div className="mt-2 text-xs text-slate-500">{item.date}</div>
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
    <section className="rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.actionPlans')} href="/plan-accion" />

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
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
                  <div className="truncate text-sm font-semibold text-[#06173a]">
                    {item.title || t('dashboard.actionPlans')}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {item.iso_code || 'Sin ISO'} · {item.owner || t('common.notSelected')}
                  </div>
                </div>
                <div className="text-right text-sm font-bold text-[#2563eb]">{progress}%</div>
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
    <section className="rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.priorityRisks')} href="/matriz-riesgo" />

      <div className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_78px_82px_28px] border-b border-slate-100 pb-2 text-xs font-bold text-slate-400 sm:grid">
          <span>{t('dashboard.risk')}</span>
          <span>{t('dashboard.standard')}</span>
          <span>{t('dashboard.level')}</span>
          <span />
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="py-6 text-sm text-slate-500">{t('dashboard.noPriorityRisks')}</div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_82px_28px] items-center gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_78px_82px_28px]"
              >
                <span className="truncate font-semibold text-[#06173a]">{row.risk}</span>
                <span className="hidden text-slate-600 sm:block">{row.norm}</span>
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
                <span className="col-span-3 text-xs font-semibold text-slate-500 sm:hidden">
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
    <section className="rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.06)]">
      <PanelHeader title={t('dashboard.executiveReport')} href="/exportes" />

      <div className="grid gap-5 md:grid-cols-[150px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
          <div className="bg-white p-4">
            <div className="text-xl font-black text-[#2563eb]">TCDX</div>
            <div className="text-[10px] font-bold uppercase text-[#06173a]">{t('dashboard.reportTitle')}</div>
            <div className="mt-1 text-[8px] text-slate-400">{t('dashboard.reportSubtitle')}</div>
          </div>
          <div className="h-24 bg-[linear-gradient(150deg,#ffffff_0%,#dbeafe_38%,#2563eb_39%,#06173a_78%)]" />
          <div className="bg-[#06173a] px-4 py-3 text-[9px] font-semibold text-white/70">
            {period}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#06173a]">
            {t('dashboard.reportTitle')} ISO
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('exports.categoryDescriptions.executive')}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">PDF</span>
            <span className="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">PPTX</span>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">XLSX</span>
          </div>

          <a
            href="/exportes"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#dce4ef] bg-white px-4 py-3 text-sm font-bold text-[#06173a] shadow-sm transition hover:bg-slate-50"
          >
            <TcdxIcon name="export" className="h-4 w-4 text-[#2563eb]" />
            {t('dashboard.downloadReport')}
          </a>

          <div className="mt-4 text-xs font-semibold text-slate-500">
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
    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
      <div className="flex items-center gap-3">
        <span className={`h-5 w-5 rounded-md ${color}`} />
        <span className="text-2xl text-slate-700">{label}</span>
      </div>

      <div className="text-right">
        <div className="text-3xl font-bold text-slate-800">{value}</div>
        {extra && <div className="text-sm text-slate-400">{extra}</div>}
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
    <div className="rounded-2xl border border-slate-100 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
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
      : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {item?.code || fallback}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{title}</div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(
            status
          )}`}
        >
          {getKpiStatusLabel(status)}
        </span>
      </div>

      <div className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
        {formatKpiValue(item?.latest_snapshot?.value, item?.unit || '%')}
      </div>

      <div className="mt-2 text-xs text-slate-500">
        {getRuntimePeriodLabel()}: {formatDateCL(item?.latest_snapshot?.period_start)} -{' '}
        {formatDateCL(item?.latest_snapshot?.period_end)}
      </div>

      {snapshots.length > 1 && (
        <div className="mt-4 grid grid-cols-1 gap-2">
          {snapshots.slice(0, 4).map((snap, index) => (
            <div
              key={`${item?.id}-${snap.standard_code || 'GLOBAL'}-${index}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
            >
              <span className="font-semibold text-slate-600">
                {snap.standard_code || 'Global'}
              </span>
              <span className="font-bold text-slate-900">
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
    <div className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
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

          <div className="mt-3 font-semibold text-slate-900">{item.name}</div>

          <div className="mt-1 text-sm text-slate-500">
            {item.category} · {item.frequency}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatKpiValue(item.latest_snapshot?.value, item.unit)}
          </div>

          <div className="mt-1 text-xs text-slate-500">
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
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
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {item.kpi_type}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.name}</h3>

          <p className="mt-1 text-sm text-slate-500">
            {item.description || 'Sin descripción'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatKpiValue(item.latest_snapshot?.value, item.unit)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{item.frequency}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatChip label="Categoría" value={item.category} color="text-slate-900" />
        <StatChip label="Dirección" value={item.direction} color="text-slate-900" />
        <StatChip
          label="Objetivo"
          value={
            item.target_value !== null && item.target_value !== undefined
              ? formatKpiValue(item.target_value, item.unit)
              : 'N/A'
          }
          color="text-slate-900"
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
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {standard}
            </span>
          ))}
        </div>
      ) : null}

      {item.latest_snapshots?.length && item.latest_snapshots.length > 1 ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Snapshot por norma / alcance
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {item.latest_snapshots.slice(0, 6).map((snap, index) => (
              <div
                key={`${item.id}-${snap.standard_code || 'GLOBAL'}-${index}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"
              >
                <span className="font-semibold text-slate-600">
                  {snap.standard_code || 'Global'}
                </span>
                <span className="font-bold text-slate-900">
                  {formatKpiValue(snap.value, item.unit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buildTrend(numberOrZero(item.latest_snapshot?.value), item.delta)}>
            <Line dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
