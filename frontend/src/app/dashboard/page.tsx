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

function formatDateCL(value?: string | null) {
  if (!value) return 'Sin fecha';

  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return String(value);
  }
}

function getKpiStatusLabel(color?: string | null) {
  if (color === 'green') return 'Verde';
  if (color === 'yellow') return 'Amarillo';
  if (color === 'red') return 'Rojo';
  return 'Sin dato';
}

function getKpiStatusClass(color?: string | null) {
  if (color === 'green') return 'bg-green-100 text-green-700 border-green-200';
  if (color === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (color === 'red') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function formatKpiValue(value: number | string | null | undefined, unit?: string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Sin dato';
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
        `KPIs recalculados: ${kpisRecalculated}\nKPIs Health recalculados: ${healthRecalculated}`
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
    return `Hoy, ${now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, []);

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
      { name: 'En verde', value: kpiSummary?.green || 0, fill: '#16a34a' },
      { name: 'En amarillo', value: kpiSummary?.yellow || 0, fill: '#f59e0b' },
      { name: 'En rojo', value: kpiSummary?.red || 0, fill: '#ef4444' },
      { name: 'Sin dato', value: kpiSummary?.gray || 0, fill: '#94a3b8' },
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
          <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                    Centro de mando
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Última actualización: {latestSyncText}
                  </span>
                </div>

                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                    Dashboard Ejecutivo
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                    Vista consolidada de cumplimiento, riesgos, auditorías, hallazgos,
                    acciones y KPIs para seguimiento ejecutivo y operación diaria.
                  </p>

                  {activeView === 'executive' && auditSummary?.summary && (
                    <div className="mt-5 grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Auditorías
                        </div>
                        <div className="mt-1 text-2xl font-bold text-slate-900">
                          {auditSummary.summary.total || 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          En ejecución
                        </div>
                        <div className="mt-1 text-2xl font-bold text-amber-600">
                          {auditSummary.summary.en_ejecucion || 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-red-100 bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Hallazgos
                        </div>
                        <div className="mt-1 text-2xl font-bold text-red-600">
                          {auditSummary.summary.hallazgos || 0}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Acciones
                        </div>
                        <div className="mt-1 text-2xl font-bold text-violet-600">
                          {auditSummary.summary.acciones || 0}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeView === 'executive' && auditSummary?.note && (
                    <div className="mt-3 max-w-5xl rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                      {auditSummary.note}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setActiveView('executive')}
                      className={[
                        'rounded-xl px-4 py-2 text-sm font-semibold transition',
                        activeView === 'executive'
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      Vista Ejecutiva
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveView('kpi')}
                      className={[
                        'rounded-xl px-4 py-2 text-sm font-semibold transition',
                        activeView === 'kpi'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      Vista KPI
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefreshDashboard}
                    disabled={refreshingExecutive}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <span className="flex h-5 w-5 items-center justify-center">↻</span>
                    {refreshingExecutive ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm">
                <HeroMetric
                  label="Cumplimiento"
                  value={`${complianceValue}%`}
                  tone="green"
                  hint="panorama actual"
                />
                <HeroMetric
                  label="Riesgo global"
                  value={globalRiskLabel}
                  tone={
                    globalRiskLabel === 'Alto'
                      ? 'red'
                      : globalRiskLabel === 'Medio'
                      ? 'amber'
                      : 'green'
                  }
                  hint={`${globalRiskValue}%`}
                />
                <HeroMetric
                  label="Hallazgos abiertos"
                  value={openFindingsCount}
                  tone="rose"
                  hint="seguimiento requerido"
                />
                <HeroMetric
                  label="Auditorías próximas"
                  value={nextAudits.length}
                  tone="indigo"
                  hint="agenda cercana"
                />
              </div>
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
                  Cargando datos...
                </div>
              )}

              {!loading && controls.length === 0 && !dashboardHasSummaryData && (
                <div className="rounded-[30px] border border-amber-200 bg-[linear-gradient(135deg,#fffdf5_0%,#fdf8e8_100%)] p-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <h2 className="mb-3 text-3xl font-bold text-slate-900">
                    Controles inicializados pendientes de evaluación
                  </h2>

                  <p className="mb-4 text-lg text-slate-600">
                    Esta empresa aún no tiene controles cargados o vigentes en el
                    dashboard.
                  </p>

                  <div className="text-base text-slate-500">
                    Próximo paso: evaluar controles, cargar evidencias y registrar avances para que el dashboard refleje cumplimiento real.
                  </div>
                </div>
              )}

              {!loading && (controls.length > 0 || dashboardHasSummaryData) && (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-5">
                    <TopCard
                      title="Nivel de Cumplimiento"
                      value={`${complianceValue}%`}
                      subtitle="Estado global actual"
                      accent="green"
                      change={`↑ ${Math.max(1, Math.round(complianceValue * 0.03))}%`}
                      changeHint="vs. medición previa"
                      icon={<span>✓</span>}
                    />

                    <TopCard
                      title="Hallazgos Abiertos"
                      value={openFindingsCount}
                      subtitle="Seguimiento requerido"
                      accent="red"
                      change={`${noCumple} críticos`}
                      changeHint="desde controles no conformes"
                      icon={<span>!</span>}
                    />

                    <TopCard
                      title="Planes Activos"
                      value={activeActionPlans}
                      subtitle="Acciones en seguimiento"
                      accent="amber"
                      change={`${overdueActionPlans} atrasados`}
                      changeHint="foco operativo"
                      icon={<span>□</span>}
                    />

                    <TopCard
                      title="Riesgos Críticos"
                      value={highRisks}
                      subtitle="Nivel alto registrado"
                      accent="rose"
                      change={`${mediumRisks} medios`}
                      changeHint="panorama actual"
                      icon={<span>△</span>}
                    />

                    <TopCard
                      title="Auditorías Próximas"
                      value={nextAudits.length}
                      subtitle="Calendario cercano"
                      accent="indigo"
                      change={`${upcomingAuditBars[0]?.value || 0} en 7 días`}
                      changeHint="agenda inmediata"
                      icon={<span>📅</span>}
                    />
                  </div>

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
                                  <XAxis dataKey="name" hide />
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
                            className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                          >
                            Ver calendario →
                          </a>
                        </div>

                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={upcomingAuditBars}>
                              <CartesianGrid vertical={false} stroke="#e5e7eb" />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} />
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
                          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          Ver todos →
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
                      Vista KPI
                    </h2>
                    <p className="mt-1 text-slate-500">
                      KPIs reales del sistema, snapshots calculados, semáforos, Health y
                      seguimiento por norma.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/health"
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                    >
                      Ver Health
                    </a>

                    <a
                      href="/administrar-kpis"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Administrar KPIs
                    </a>

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
                    title="Score KPI Global"
                    value={`${scoreKpiGlobal}%`}
                    subtitle="Ponderación de semáforos KPI"
                    accent="green"
                    change={`${kpiSummary?.green || 0} verdes`}
                    changeHint="estado actual"
                    icon={<span>📊</span>}
                  />

                  <TopCard
                    title="Cobertura KPI"
                    value={`${kpiCoveragePct}%`}
                    subtitle={`${measuredKpis}/${totalKpis} KPIs medidos`}
                    accent={kpiCoverageTone}
                    change={`${pendingKpis} sin dato`}
                    changeHint="madurez de datos"
                    icon={<span>📈</span>}
                  />

                  <TopCard
                    title="KPIs Críticos"
                    value={kpiSummary?.red || 0}
                    subtitle="Necesitan acción"
                    accent="red"
                    change="ALERTA"
                    changeHint="impacto alto"
                    icon={<span>⚠️</span>}
                  />

                  <TopCard
                    title="Sin Datos"
                    value={kpiSummary?.gray || 0}
                    subtitle="Pendientes de carga o cálculo"
                    accent="amber"
                    change="INPUT"
                    changeHint="carga requerida"
                    icon={<span>⏳</span>}
                  />

                  <TopCard
                    title="KPIs Habilitados"
                    value={kpiItems.filter((item) => item.is_enabled).length}
                    subtitle="Activos para el tenant"
                    accent="violet"
                    change={`${kpiItems.filter((item) => item.kpi_type === 'manual').length} manuales`}
                    changeHint="tipo de captura"
                    icon={<span>🧩</span>}
                  />

                  <TopCard
                    title="KPIs Health"
                    value={kpiSummary?.health_kpis || healthKpiItems.length}
                    subtitle="Conectados a salud de controles"
                    accent="indigo"
                    change={formatKpiValue(healthMainKpi?.latest_snapshot?.value as any, '%')}
                    changeHint="salud general"
                    icon={<span>💚</span>}
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
                          KPIs Health conectados al motor de salud
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Datos reales desde snapshots del motor Health: salud general,
                          cobertura de evidencias y deterioro de controles.
                        </p>
                      </div>

                      <a
                        href="/health"
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        Ver detalle Health
                      </a>
                    </div>

                    {healthKpiItems.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        Aún no hay KPIs Health disponibles. Ejecuta “Recalcular KPIs” para
                        generar los snapshots del período.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <HealthKpiMiniCard
                          title="Salud General"
                          item={healthMainKpi}
                          fallback="KPI-HLT-001"
                        />
                        <HealthKpiMiniCard
                          title="Cobertura de Evidencias"
                          item={healthCoverageKpi}
                          fallback="KPI-HLT-003"
                        />
                        <HealthKpiMiniCard
                          title="Controles Deteriorados"
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
                          Estado General KPI
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
                              En verde
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5">
                          <LegendRow
                            label="En Verde"
                            value={kpiSummary?.green || 0}
                            color="bg-green-600"
                            extra="Objetivo logrado"
                          />
                          <LegendRow
                            label="En Amarillo"
                            value={kpiSummary?.yellow || 0}
                            color="bg-amber-400"
                            extra="Monitoreo requerido"
                          />
                          <LegendRow
                            label="En Rojo"
                            value={kpiSummary?.red || 0}
                            color="bg-red-500"
                            extra="Acción recomendada"
                          />
                          <LegendRow
                            label="Sin Dato"
                            value={kpiSummary?.gray || 0}
                            color="bg-slate-400"
                            extra="Carga o cálculo pendiente"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          Distribución por Categoría
                        </h2>

                        <a
                          href="/administrar-kpis"
                          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                        >
                          Gestionar →
                        </a>
                      </div>

                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kpiCategoryData}>
                            <CartesianGrid vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
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
                          KPIs Críticos
                        </h2>

                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                          {topRedKpis.length} en rojo
                        </span>
                      </div>

                      {topRedKpis.length === 0 ? (
                        <div className="text-slate-500">No hay KPIs en rojo actualmente.</div>
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
                          KPIs Destacados
                        </h2>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          {topGreenKpis.length} en verde
                        </span>
                      </div>

                      {topGreenKpis.length === 0 ? (
                        <div className="text-slate-500">
                          Aún no hay KPIs calculados en verde.
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
                        Todos los KPIs
                      </h2>

                      <a
                        href="/administrar-kpis"
                        className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                      >
                        Abrir administración →
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
}: {
  title: string;
  value: string | number;
  subtitle: string;
  accent: 'green' | 'red' | 'amber' | 'rose' | 'indigo' | 'violet';
  change: string;
  changeHint: string;
  icon: ReactNode;
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
    <div className="group rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            accentMap[accent]
          }`}
        >
          {icon}
        </div>

        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
          {change}
        </div>
      </div>

      <div className="mt-5 text-[1.55rem] font-semibold leading-tight text-slate-900">
        {title}
      </div>

      <div className="mt-4 text-6xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">{subtitle}</div>
        <div className="text-xs font-medium text-slate-400">{changeHint}</div>
      </div>
    </div>
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

  const icons: Record<string, string> = {
    violet: '◧',
    amber: '▣',
    red: '△',
    indigo: '✓',
    rose: '●',
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[tone]}`}
          >
            {icons[tone]}
          </span>
          <span>{title}</span>
        </div>

        <a href={href} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          Ver →
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
      <span className="text-white/60">→</span>
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
        Período: {formatDateCL(item?.latest_snapshot?.period_start)} -{' '}
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
