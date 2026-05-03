'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getUserFromToken, getUserRoleFromToken } from '@/utils/auth';
import AppLayout from '@/components/AppLayout';
import TcdxIcon, { type TcdxIconName } from '@/components/icons/TcdxIcon';
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
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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
  breakdown_json?: any;
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

function numberOrZero(value: any) {
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

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta inválida desde ${url}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.detail || `Error consultando ${url}`);
  }

  return json;
}

function normalizeLatestSnapshot(snapshot: any): LatestSnapshot | null {
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    standard_code: snapshot.standard_code ?? null,
    value: snapshot.value ?? null,
    numerator_value: snapshot.numerator_value ?? null,
    denominator_value: snapshot.denominator_value ?? null,
    status_color: snapshot.status_color ?? null,
    period_type: snapshot.period_type ?? null,
    period_start: snapshot.period_start ?? null,
    period_end: snapshot.period_end ?? null,
    calculated_at: snapshot.calculated_at ?? null,
    breakdown_json: snapshot.breakdown_json ?? null,
  };
}

function normalizeKpiDashboardItem(item: any): KpiDashboardItem {
  const latestSnapshots: LatestSnapshot[] = Array.isArray(item?.latest_snapshots)
    ? item.latest_snapshots
        .map((snap: any) => normalizeLatestSnapshot(snap))
        .filter(Boolean) as LatestSnapshot[]
    : Array.isArray(item?.standard_snapshots)
    ? item.standard_snapshots
        .map((snap: any) => normalizeLatestSnapshot(snap))
        .filter(Boolean) as LatestSnapshot[]
    : [];

  const latestSnapshot =
    normalizeLatestSnapshot(item?.latest_snapshot) ||
    (latestSnapshots.length ? latestSnapshots[0] : null);

  return {
    id: String(item?.id || ''),
    code: String(item?.code || ''),
    name: String(item?.name || 'KPI sin nombre'),
    description: item?.description || undefined,
    category: item?.category || 'otros',
    kpi_type: item?.kpi_type || 'automatico',
    unit: item?.unit || '',
    frequency: item?.frequency || '',
    direction: item?.direction || '',
    target_value:
      item?.target_value === null || item?.target_value === undefined
        ? null
        : Number(item.target_value),
    applicable_standards: Array.isArray(item?.applicable_standards)
      ? item.applicable_standards
      : [],
    is_enabled: Boolean(item?.is_enabled ?? item?.enabled ?? true),
    is_health_kpi: Boolean(
      item?.is_health_kpi || String(item?.code || '').startsWith('KPI-HLT-')
    ),
    latest_snapshot: latestSnapshot,
    latest_snapshots: latestSnapshots,
    has_multiple_snapshots: Boolean(
      item?.has_multiple_snapshots ?? latestSnapshots.length > 1
    ),
    delta:
      item?.delta === null || item?.delta === undefined
        ? null
        : Number(item.delta),
  };
}

function normalizeKpiDashboardResponse(payload: any): KpiDashboardResponse {
  const rawItems: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : [];

  const items: KpiDashboardItem[] = rawItems.map((raw: any) =>
    normalizeKpiDashboardItem(raw)
  );

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

  const finalGreen = Number(payload?.summary?.green ?? green);
  const finalYellow = Number(payload?.summary?.yellow ?? yellow);
  const finalRed = Number(payload?.summary?.red ?? red);
  const finalGray = Number(payload?.summary?.gray ?? gray);
  const finalTotal = Number(payload?.summary?.total_kpis ?? items.length);
  const measuredKpis = finalGreen + finalYellow + finalRed;

  return {
    summary: {
      ...(payload?.summary || {}),
      total_kpis: finalTotal,
      green: finalGreen,
      yellow: finalYellow,
      red: finalRed,
      gray: finalGray,
      measured_kpis: measuredKpis,
      data_coverage_pct:
        finalTotal > 0 ? Math.round((measuredKpis / finalTotal) * 100) : 0,
      health_kpis:
        payload?.summary?.health_kpis ??
        items.filter((item: KpiDashboardItem) => item.is_health_kpi).length,
    },
    items,
  };
}

function getHealthRefreshCount(json: any) {
  if (Array.isArray(json?.health_kpi_refresh)) {
    return json.health_kpi_refresh.reduce((acc: number, row: any) => {
      return acc + Number(row?.snapshots_inserted || row?.inserted || 0);
    }, 0);
  }

  return Number(json?.health_recalculated || 0);
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
  function getKpiCategoryLabel(category?: string | null) {
    const normalized = String(category || 'otros').toLowerCase();
    const key = `dashboardKpi.categories.${normalized}`;
    const translated = t(key);
    return translated && translated !== key ? translated : normalized;
  }

  function getKpiStatusBadgeLabel(color?: string | null) {
    const normalized = String(color || 'gray').toLowerCase();
    const key = `dashboardKpi.statusBadge.${normalized}`;
    const translated = t(key);
    return translated && translated !== key ? translated : normalized;
  }

  const { locale, t } = useTranslation();
  const [activeView, setActiveView] = useState<'executive' | 'kpi'>('executive');

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

  const [controls, setControls] = useState<any[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [nextAudits, setNextAudits] = useState<AuditItem[]>([]);
  const [auditSummary, setAuditSummary] = useState<DashboardAuditSummary | null>(null);
  const [riskSummary, setRiskSummary] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [recalculatingKpis, setRecalculatingKpis] = useState(false);
  const [refreshingExecutive, setRefreshingExecutive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [kpiData, setKpiData] = useState<KpiDashboardResponse | null>(null);

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

      setControls(Array.isArray(controlsData) ? controlsData : []);
      setSummary(summaryData || null);
      setNextAudits(Array.isArray(auditsData) ? auditsData : []);
      setAuditSummary(auditSummaryData?.ok === false ? null : auditSummaryData);
      setRiskSummary(Array.isArray(riskData) ? riskData : []);
      setActionPlans(Array.isArray(actionPlansData) ? actionPlansData : []);
    } catch (err: any) {
      console.error('ERROR DASHBOARD:', err);
      setErrorMessage(err.message || 'No fue posible cargar el dashboard.');
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
    loadExecutiveDashboard();
  }, [loadExecutiveDashboard]);

  useEffect(() => {
    if (activeView !== 'kpi') return;
    loadKpiDashboard();
  }, [activeView, loadKpiDashboard]);

  const handleRefreshDashboard = async () => {
    try {
      setRefreshingExecutive(true);
      await loadExecutiveDashboard();

      if (activeView === 'kpi') {
        await loadKpiDashboard();
      }
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
    return controls.reduce((acc: Record<string, any[]>, c) => {
      const key = String(c.iso || 'SIN_ISO');
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    }, {});
  }, [controls]);

  const cumple = controls.filter((c) => c.status === 'cumple').length;
  const parcial = controls.filter((c) => c.status === 'parcial').length;
  const noCumple = controls.filter((c) => c.status === 'no cumple').length;
  const totalControls = controls.length;

  const contractedControls = totalControls;
  const activeNorms = Object.keys(grouped).length;

  const highRisks = numberOrZero(
    riskSummary.find((r) => r.level === 'alto')?.total
  );
  const mediumRisks = numberOrZero(
    riskSummary.find((r) => r.level === 'medio')?.total
  );
  const lowRisks = numberOrZero(
    riskSummary.find((r) => r.level === 'bajo')?.total
  );

  const complianceValue =
    totalControls > 0
      ? Math.round((cumple / totalControls) * 100)
      : numberOrZero(summary?.porcentaje);

  const donutData = [
    { name: 'Cumplido', value: cumple },
    { name: 'En proceso', value: parcial },
    { name: 'No cumplido', value: noCumple },
  ];

  const donutColors = ['#16a34a', '#f59e0b', '#ef4444'];

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

  const upcomingAuditBars = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = {
      next7: [] as AuditItem[],
      next14: [] as AuditItem[],
      next30: [] as AuditItem[],
      after30: [] as AuditItem[],
    };

    nextAudits.forEach((audit) => {
      if (!audit?.start_date) return;

      const auditDate = new Date(audit.start_date);
      auditDate.setHours(0, 0, 0, 0);

      const diffMs = auditDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return;

      if (diffDays <= 7) {
        buckets.next7.push(audit);
      } else if (diffDays <= 14) {
        buckets.next14.push(audit);
      } else if (diffDays <= 30) {
        buckets.next30.push(audit);
      } else {
        buckets.after30.push(audit);
      }
    });

    return [
      {
        name: 'Próx. 7 días',
        value: buckets.next7.length,
        details: buckets.next7,
        fill: '#dbeafe',
      },
      {
        name: '8 a 14 días',
        value: buckets.next14.length,
        details: buckets.next14,
        fill: '#fde68a',
      },
      {
        name: '15 a 30 días',
        value: buckets.next30.length,
        details: buckets.next30,
        fill: '#f59e0b',
      },
      {
        name: '> 30 días',
        value: buckets.after30.length,
        details: buckets.after30,
        fill: '#cbd5e1',
      },
    ];
  }, [nextAudits]);

  const isoCards = useMemo(() => {
    return Object.keys(grouped).map((iso) => {
      const list = grouped[iso];
      const ok = list.filter((c: any) => c.status === 'cumple').length;
      const partial = list.filter((c: any) => c.status === 'parcial').length;
      const critical = list.filter((c: any) => c.status === 'no cumple').length;
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

  const globalRiskValue =
    contractedControls > 0
      ? Math.round(((noCumple * 1 + parcial * 0.5) / contractedControls) * 100)
      : numberOrZero(summary?.riesgo);

  const globalRiskLabel =
    summary?.nivel_riesgo ||
    (globalRiskValue >= 50 ? 'Alto' : globalRiskValue >= 20 ? 'Medio' : 'Bajo');

  const riesgoColor = (nivel: string) => {
    if (nivel === 'Alto') return 'text-red-600';
    if (nivel === 'Medio') return 'text-amber-600';
    return 'text-emerald-600';
  };

  const completionPct =
    totalControls > 0 ? Math.round((cumple / totalControls) * 100) : 0;
  const progressPct =
    totalControls > 0 ? Math.round((parcial / totalControls) * 100) : 0;
  const failPct =
    totalControls > 0 ? Math.round((noCumple / totalControls) * 100) : 0;

  const latestSyncText = useMemo(() => {
    const now = new Date();
    return `${t('common.today')}, ${now.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [locale, t]);

  const complianceTrend = useMemo(() => {
    const start = Math.max(40, complianceValue - 12);
    const mid1 = Math.max(42, complianceValue - 8);
    const mid2 = Math.max(44, complianceValue - 6);
    const mid3 = Math.max(46, complianceValue - 4);
    const mid4 = Math.max(48, complianceValue - 2);

    return [
      { name: 'S1', value: start },
      { name: 'S2', value: mid1 },
      { name: 'S3', value: mid2 },
      { name: 'S4', value: mid3 },
      { name: 'S5', value: mid4 },
      { name: 'S6', value: complianceValue },
    ];
  }, [complianceValue]);

  const openFindingsCount = Math.max(
    noCumple,
    numberOrZero(summary?.open_findings)
  );

  const openNcCount = numberOrZero(summary?.open_nonconformities);
  const closedNcCount = numberOrZero(summary?.closed_nonconformities);

  const kpiItems = kpiData?.items || [];
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
  }, [kpiSummary]);

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
        id: control.id || control.control_id || `control-${index}`,
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
      id: risk.id || `risk-${index}`,
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f5f7fb_42%,#edf2f7_100%)]">
        <div className="mx-auto max-w-[1720px] space-y-6">
          <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-[2rem] font-bold tracking-tight text-[#06173a]">
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {t('dashboard.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveView('executive')}
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
                  onClick={() => setActiveView('kpi')}
                  className={[
                    'rounded-md px-4 py-2 text-sm font-semibold transition',
                    activeView === 'kpi'
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {t('dashboard.kpiView')}
                </button>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">
                <TcdxIcon name="calendar" className="h-4 w-4 text-[#2563eb]" />
                {latestSyncText}
              </div>

              <button
                type="button"
                onClick={handleRefreshDashboard}
                disabled={refreshingExecutive}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <TcdxIcon name="refresh" className="h-4 w-4" />
                {refreshingExecutive ? t('common.refreshing') : t('common.refresh')}
              </button>
            </div>
          </section>

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

              {!loading && controls.length === 0 && !dashboardHasSummaryData && (
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

              {!loading && (controls.length > 0 || dashboardHasSummaryData) && (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    <TopCard
                      title={t('dashboard.globalCompliance')}
                      value={`${complianceValue}%`}
                      subtitle={t('dashboard.globalComplianceSubtitle')}
                      accent="indigo"
                      change={`↑ ${Math.max(1, Math.round(complianceValue * 0.03))}%`}
                      changeHint={t('dashboard.previousMeasurement')}
                      icon={<TcdxIcon name="shield" className="h-6 w-6" />}
                      ringValue={complianceValue}
                    />

                    <TopCard
                      title={t('dashboard.healthyControls')}
                      value={`${cumple} / ${totalControls || 0}`}
                      subtitle={t('dashboard.healthyControlsSubtitle')}
                      accent="indigo"
                      change={`${completionPct}% del total`}
                      changeHint={t('dashboard.currentAssessment')}
                      icon={<TcdxIcon name="activity" className="h-6 w-6" />}
                    />

                    <TopCard
                      title={t('dashboard.criticalRisks')}
                      value={highRisks}
                      subtitle={t('dashboard.criticalRisksSubtitle')}
                      accent="red"
                      change={`${mediumRisks} medios`}
                      changeHint={t('dashboard.currentOverview')}
                      icon={<TcdxIcon name="alert" className="h-6 w-6" />}
                    />

                    <TopCard
                      title={t('dashboard.actionPlans')}
                      value={activeActionPlans}
                      subtitle={t('dashboard.actionPlansSubtitle')}
                      accent="green"
                      change={`${overdueActionPlans} atrasados`}
                      changeHint={t('dashboard.operationalFocus')}
                      icon={<TcdxIcon name="plan" className="h-6 w-6" />}
                    />

                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_1fr_1.22fr]">
                    <StandardHealthPanel rows={standardHealthRows} />
                    <AuditTimelinePanel items={auditTimelineItems} />
                    <ActionPlansPanel items={activeActionPlanItems} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.05fr_1fr_1.18fr]">
                    <PriorityRiskPanel rows={priorityRiskRows} />
                    <AiAuditorPanel
                      weakControls={noCumple}
                      raisedRisks={highRisks}
                      upcomingEvidence={nextAudits.length + activeActionPlans}
                    />
                    <ExecutiveReportPanel
                      period={latestSyncText}
                      complianceValue={complianceValue}
                    />
                  </div>

                  <div className="hidden">
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
                    <div className="grid grid-cols-1 gap-4">
                      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                              Estado de Cumplimiento
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                              Fuente principal: controles inicializados y evaluaciones del tenant.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_250px] xl:items-center">
                          <div className="relative mx-auto h-[260px] w-full max-w-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={donutData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={62}
                                  outerRadius={95}
                                  paddingAngle={3}
                                  stroke="#ffffff"
                                  strokeWidth={4}
                                >
                                  {donutData.map((_, index) => (
                                    <Cell key={index} fill={donutColors[index]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: any, name: any) => [value, name]} />
                              </PieChart>
                            </ResponsiveContainer>

                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <div className="text-5xl font-bold tracking-tight text-slate-900">
                                {complianceValue}%
                              </div>
                              <div className="mt-1 text-base font-medium text-slate-500">
                                Cumplimiento
                              </div>
                            </div>
                          </div>

                          <div className="space-y-5">
                            <LegendRow
                              label="Cumplido"
                              value={`${completionPct}%`}
                              color="bg-green-600"
                              extra={`${cumple} controles`}
                            />
                            <LegendRow
                              label="En Proceso"
                              value={`${progressPct}%`}
                              color="bg-amber-400"
                              extra={`${parcial} controles`}
                            />
                            <LegendRow
                              label="No Cumplido"
                              value={`${failPct}%`}
                              color="bg-red-500"
                              extra={`${noCumple} controles`}
                            />
                          </div>

                          <div className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4">
                            <div className="mb-3 text-sm font-semibold text-slate-500">
                              Tendencia estimada
                            </div>
                            <div className="h-[170px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={complianceTrend}>
                                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                                  <XAxis dataKey="name" tickFormatter={(value) => getKpiCategoryLabel(String(value))} hide />
                                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                                  <Tooltip />
                                  <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#16a34a' }}
                                    activeDot={{ r: 6 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>

                            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600">
                              Riesgo global:{' '}
                              <span className={riesgoColor(globalRiskLabel)}>
                                {globalRiskLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <MiniCard
                          title="Hallazgos"
                          mainValue={openFindingsCount}
                          mainLabel="Abiertos"
                          sideValue={noCumple}
                          sideLabel="Críticos"
                          tone="violet"
                          footer={`Fuente visible: ${noCumple} controles no conformes`}
                          href="/hallazgos"
                        />

                        <MiniCard
                          title="Planes"
                          mainValue={activeActionPlans}
                          mainLabel="Activos"
                          sideValue={overdueActionPlans}
                          sideLabel="Atrasados"
                          tone="amber"
                          footer={`Total: ${actionPlans.length} planes`}
                          href="/plan-accion"
                        />

                        <MiniCard
                          title="Riesgos"
                          mainValue={highRisks}
                          mainLabel="Altos"
                          sideValue={highRisks + mediumRisks + lowRisks}
                          sideLabel="Totales"
                          tone="red"
                          footer="Evaluación consolidada"
                          href="/matriz-riesgo"
                        />

                        <MiniCard
                          title="Auditorías"
                          mainValue={nextAudits.length}
                          mainLabel="Próximas"
                          sideValue={upcomingAuditBars[0]?.value || 0}
                          sideLabel="En 7 días"
                          tone="indigo"
                          footer="Agenda del período"
                          href="/auditorias"
                        />

                        <MiniCard
                          title="NC"
                          mainValue={openNcCount}
                          mainLabel="Abiertas"
                          sideValue={closedNcCount}
                          sideLabel="Resueltas"
                          tone="rose"
                          footer="Seguimiento de no conformidades"
                          href="/no-conformidades"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                            Vencimientos Próximos
                          </h2>

                          <a
                            href="/auditorias"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                          >
                            <span>Ver calendario</span>
                            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                          </a>
                        </div>

                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={upcomingAuditBars}>
                              <CartesianGrid vertical={false} stroke="#e5e7eb" />
                              <XAxis dataKey="name" tickFormatter={(value) => getKpiCategoryLabel(String(value))} tickLine={false} axisLine={false} />
                              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                              <Tooltip content={<UpcomingAuditsTooltip />} />
                              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                                {upcomingAuditBars.map((entry, index) => (
                                  <Cell key={index} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </section>

                      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#0b1b46_0%,#0b1636_55%,#081226_100%)] p-6 text-white shadow-[0_16px_40px_rgba(2,8,23,0.22)]">
                        <h2 className="mb-5 text-2xl font-semibold">Acciones rápidas</h2>

                        <div className="space-y-3">
                          <QuickActionButton href="/plan-accion" label="Nuevo Plan de Acción" />
                          <QuickActionButton href="/evidencias" label="Registrar Evidencia" />
                          <QuickActionButton href="/no-conformidades" label="Crear No Conformidad" />
                          <QuickActionButton href="/auditorias" label="Gestionar Auditoría" />
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          Resumen por Norma
                        </h2>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {isoCards.length} norma(s)
                        </span>
                      </div>

                      {isoCards.length === 0 ? (
                        <div className="text-slate-500">No hay normas con datos aún.</div>
                      ) : (
                        <div className="space-y-4">
                          {isoCards.map((item) => (
                            <div
                              key={item.iso}
                              className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 transition hover:shadow-sm"
                            >
                              <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="font-semibold text-slate-900">{item.iso}</div>
                                <div className="text-sm font-semibold text-indigo-600">
                                  {item.percent}% cumplimiento
                                </div>
                              </div>

                              <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <StatChip label="Total" value={item.total} color="text-slate-900" />
                                <StatChip label="OK" value={item.ok} color="text-emerald-600" />
                                <StatChip label="Parcial" value={item.partial} color="text-amber-600" />
                                <StatChip label="Crítico" value={item.critical} color="text-rose-600" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          Planes de Acción Activos
                        </h2>

                        <a
                          href="/plan-accion"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          <span>Ver todos</span>
                          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                        </a>
                      </div>

                      {actionPlans.length === 0 ? (
                        <div className="text-slate-500">No hay planes registrados.</div>
                      ) : (
                        <div className="space-y-3">
                          {actionPlans
                            .filter((item) => {
                              const normalized = normalizeActionStatus(item.status);
                              return normalized !== 'completado' && normalized !== 'cancelado';
                            })
                            .slice(0, 6)
                            .map((item) => (
                              <ActionPlanRowCard key={item.id} item={item} />
                            ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <BottomMetric label="Controles contratados" value={contractedControls} />
                      <BottomMetric label="Normas activas" value={activeNorms} />
                      <BottomMetric
                        label="Riesgo global"
                        value={globalRiskLabel}
                        className={riesgoColor(globalRiskLabel)}
                      />
                      <BottomMetric label="% Riesgo" value={`${globalRiskValue}%`} />
                    </div>
                  </section>
                  </div>
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
                      href="/health"
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                    >{t('dashboardKpi.viewHealth')}</a>

                    <a
                      href="/administrar-kpis"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >{t('dashboardKpi.administerKpis')}</a>

                    <button
                      type="button"
                      onClick={handleRecalculateKpis}
                      disabled={recalculatingKpis || !canManageKpis}
                      className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {recalculatingKpis ? 'Recalculando...' : 'Recalcular KPIs'}
                    </button>
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
                    change={formatKpiValue(healthMainKpi?.latest_snapshot?.value as any, '%')}
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
                        href="/health"
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
                              <Tooltip formatter={(value: any, name: any) => [value, name]} />
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

                        <a
                          href="/administrar-kpis"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          <span>{t('dashboardKpi.manage')}</span>
                          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                        </a>
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

                      <a
                        href="/administrar-kpis"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                      >
                        <span>Abrir administración</span>
                        <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                      </a>
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
        </div>
      </div>
    </AppLayout>
  );
}

function UpcomingAuditsTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const barData = payload[0]?.payload;
  const details: AuditItem[] = barData?.details || [];

  return (
    <div className="max-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-2 font-semibold text-slate-900">{label}</div>
      <div className="mb-3 text-sm text-slate-600">
        Total eventos: <b>{barData?.value || 0}</b>
      </div>

      {details.length === 0 ? (
        <div className="text-sm text-slate-500">Sin eventos en este rango.</div>
      ) : (
        <div className="max-h-56 space-y-2 overflow-auto">
          {details.map((audit, idx) => (
            <div
              key={idx}
              className="border-t border-slate-100 pt-2 text-sm first:border-t-0 first:pt-0"
            >
              <div className="font-medium text-slate-900">
                {audit.iso || 'Sin ISO'}
              </div>
              <div className="text-slate-600">Fecha: {audit.start_date || '-'}</div>
              <div className="text-slate-600">Auditor: {audit.auditor_name || 'Sin asignar'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone: 'green' | 'amber' | 'red' | 'rose' | 'indigo';
  hint: string;
}) {
  const toneMap: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <div className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-medium opacity-80">{hint}</div>
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
  const accentMap: Record<string, string> = {
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 text-green-700',
    red: 'bg-gradient-to-br from-red-50 to-rose-50 text-red-700',
    amber: 'bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-700',
    rose: 'bg-gradient-to-br from-rose-50 to-red-50 text-rose-700',
    indigo: 'bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700',
    violet: 'bg-gradient-to-br from-violet-50 to-purple-50 text-violet-700',
  };

  return (
    <div className="group relative min-h-[132px] overflow-hidden rounded-lg border border-[#dce4ef] bg-white p-5 shadow-[0_8px_22px_rgba(8,25,58,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(8,25,58,0.10)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[#06173a]">
            <span>{title}</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-400">
              i
            </span>
          </div>
          <div className="mt-4 text-4xl font-bold tracking-tight text-[#06173a]">
            {value}
          </div>
          <div className="mt-2 text-sm font-semibold text-[#2563eb]">{change}</div>
          <div className="mt-0.5 text-xs text-slate-500">{changeHint}</div>
        </div>

        {typeof ringValue === 'number' ? (
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#2563eb ${Math.max(
                0,
                Math.min(100, ringValue)
              )}%, #e8eef8 0)`,
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#2563eb] shadow-inner">
              {icon}
            </div>
          </div>
        ) : (
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${
              accentMap[accent]
            }`}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 text-xs text-slate-500">{subtitle}</div>
    </div>
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

function AiAuditorPanel({
  weakControls,
  raisedRisks,
  upcomingEvidence,
}: {
  weakControls: number;
  raisedRisks: number;
  upcomingEvidence: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[#0f2d5c] bg-[radial-gradient(circle_at_78%_30%,rgba(37,99,235,0.35),transparent_28%),linear-gradient(135deg,#06173a_0%,#071f4a_54%,#020917_100%)] p-5 text-white shadow-[0_16px_36px_rgba(2,8,23,0.24)]">
      <div className="relative z-10 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563eb] text-white">
          <TcdxIcon name="ai" className="h-6 w-6" />
        </span>
        <div className="text-xl font-bold">IA Auditor</div>
        <span className="rounded-md bg-white/12 px-2 py-1 text-xs font-bold text-blue-100">Beta</span>
      </div>

      <div className="relative z-10 mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_150px]">
        <div>
          <p className="text-sm leading-6 text-white/80">
            Tu asistente inteligente analizó los datos y detectó focos para fortalecer tu sistema de gestión.
          </p>
          <div className="mt-4 space-y-2 text-sm text-white/86">
            <div className="flex items-center gap-2">
              <TcdxIcon name="check" className="h-4 w-4 text-blue-200" />
              Detecté {weakControls} controles con baja efectividad.
            </div>
            <div className="flex items-center gap-2">
              <TcdxIcon name="check" className="h-4 w-4 text-blue-200" />
              {raisedRisks} riesgos se mantienen en nivel crítico.
            </div>
            <div className="flex items-center gap-2">
              <TcdxIcon name="check" className="h-4 w-4 text-blue-200" />
              Hay {upcomingEvidence} acciones o evidencias próximas.
            </div>
          </div>

          <a
            href="/ia-compliance/sugerencias"
            className="mt-5 inline-flex items-center gap-3 rounded-lg bg-[#f97316] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(249,115,22,0.35)] transition hover:bg-[#ea580c]"
          >
            Revisar sugerencias
            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
          </a>
        </div>

        <div className="hidden items-center justify-center md:flex">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-[26px] border border-blue-300/25 bg-blue-400/10 shadow-[0_0_34px_rgba(59,130,246,0.45)]">
            <div className="absolute inset-5 rounded-2xl border border-blue-300/25" />
            <TcdxIcon name="ai" className="relative z-10 h-16 w-16 text-sky-200" />
          </div>
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

function MiniCard({
  title,
  mainValue,
  mainLabel,
  sideValue,
  sideLabel,
  tone,
  footer,
  href,
}: {
  title: string;
  mainValue: string | number;
  mainLabel: string;
  sideValue: string | number;
  sideLabel: string;
  tone: 'violet' | 'amber' | 'red' | 'indigo' | 'rose';
  footer: string;
  href: string;
}) {
  const toneMap: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    rose: 'bg-rose-100 text-rose-700',
  };

  const icons: Record<string, TcdxIconName> = {
    violet: 'finding',
    amber: 'plan',
    red: 'alert',
    indigo: 'audit',
    rose: 'heart',
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[tone]}`}
          >
            <TcdxIcon name={icons[tone]} className="h-5 w-5" />
          </span>
          <span>{title}</span>
        </div>

        <a href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          <span>Ver</span>
          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-5xl font-bold tracking-tight text-slate-900">
            {mainValue}
          </div>
          <div className="mt-1 text-sm text-slate-500">{mainLabel}</div>
        </div>

        <div>
          <div className="text-5xl font-bold tracking-tight text-slate-900">
            {sideValue}
          </div>
          <div className="mt-1 text-sm text-slate-500">{sideLabel}</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        {footer}
      </div>
    </div>
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

function BottomMetric({
  label,
  value,
  className = 'text-slate-900',
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-4xl font-bold tracking-tight ${className}`}>
        {value}
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-4 py-4 text-base font-medium text-white transition hover:bg-white/12"
    >
      <span>{label}</span>
      <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90 text-white/60" />
    </a>
  );
}

function ActionPlanRowCard({ item }: { item: ActionPlanItem }) {
  const normalized = normalizeActionStatus(item.status);

  const tone =
    normalized === 'bloqueado'
      ? 'border-red-200 bg-red-50'
      : normalized === 'en progreso'
      ? 'border-blue-200 bg-blue-50'
      : 'border-amber-200 bg-amber-50';

  return (
    <div className={`rounded-[22px] border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-900">{item.title || 'Sin título'}</div>
          <div className="mt-1 text-sm text-slate-600">
            {item.iso_code || 'Sin ISO'} · {item.owner || 'Sin responsable'}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-slate-800">{item.status || 'abierto'}</div>
          <div className="mt-1 text-xs text-slate-500">
            Vence: {formatDateCL(item.due_date)}
          </div>
        </div>
      </div>
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
        {formatKpiValue(item?.latest_snapshot?.value as any, item?.unit || '%')}
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
                {formatKpiValue(snap.value as any, item?.unit || '%')}
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
                  {formatKpiValue(snap.value as any, item.unit)}
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
