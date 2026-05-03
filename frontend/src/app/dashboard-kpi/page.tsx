'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getUserFromToken } from '@/utils/auth';
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

// ===== KPI HELPERS =====
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

function calculateExecutiveScore(summary?: any) {
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

function numberOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function partialOrZero(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

type AuditItem = {
  iso?: string;
  start_date?: string;
  auditor_name?: string;
};

type ActionPlanItem = {
  id: string;
  iso_code?: string;
  title?: string;
  status?: string;
  due_date?: string | null;
  owner?: string | null;
};

type ActivityItem = {
  title: string;
  description: string;
  color: string;
  icon: TcdxIconName;
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
      item?.delta === null || item?.delta === undefined ? null : Number(item.delta),
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
  };}

function getHealthRefreshCount(json: any) {
  if (Array.isArray(json?.health_kpi_refresh)) {
    return json.health_kpi_refresh.reduce((acc: number, row: any) => {
      return acc + Number(row?.snapshots_inserted || row?.inserted || 0);
    }, 0);
  }

  return Number(json?.health_kpis_recalculated || 0);
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const [activeView, setActiveView] = useState<'executive' | 'kpi'>('executive');

  const [controls, setControls] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [nextAudits, setNextAudits] = useState<AuditItem[]>([]);
  const [riskSummary, setRiskSummary] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [kpiData, setKpiData] = useState<KpiDashboardResponse | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [recalculatingKpis, setRecalculatingKpis] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetchJson(`${API_URL}/api/dashboard-controls/${user.tenant_id}`, token),
      fetchJson(`${API_URL}/api/dashboard/${user.tenant_id}`, token),
      fetchJson(`${API_URL}/api/audits/next-all/${user.tenant_id}`, token),
      fetchJson(`${API_URL}/api/assets/risk-summary/${user.tenant_id}`, token),
      fetchJson(`${API_URL}/api/action-plans/${user.tenant_id}`, token),
    ])
      .then(([controlsData, summaryData, auditsData, riskData, actionPlansData]) => {
        setControls(Array.isArray(controlsData) ? controlsData : []);
        setSummary(summaryData || null);
        setNextAudits(Array.isArray(auditsData) ? auditsData : []);
        setRiskSummary(Array.isArray(riskData) ? riskData : []);
        setActionPlans(Array.isArray(actionPlansData) ? actionPlansData : []);
      })
      .catch((err) => {
        console.error('ERROR DASHBOARD:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeView !== 'kpi') return;
    loadKpiDashboard();
  }, [activeView]);

  const loadKpiDashboard = async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    try {
      setLoadingKpis(true);

      const json = await fetchJson(
        `${API_URL}/api/kpis/dashboard/${user.tenant_id}`,
        token
      );

      setKpiData(
        normalizeKpiDashboardResponse(json || { summary: undefined, items: [] })
      );
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
  };

  const handleRecalculateKpis = async () => {
    const token = localStorage.getItem('token');
    const user = getUserFromToken();

    if (!token || !user?.tenant_id) return;

    try {
      setRecalculatingKpis(true);

      const res = await fetch(
        `${API_URL}/api/kpis/recalculate/${user.tenant_id}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || t('dashboardKpi.recalculateError'));
        return;
      }

      await loadKpiDashboard();
      alert(
        t('dashboardKpi.recalculateSuccess', {
          count: json.snapshots_created || json.recalculated || 0,
          healthCount: getHealthRefreshCount(json),
        })
      );
    } catch (err) {
      console.error('ERROR RECALCULATE KPI:', err);
      alert(t('dashboardKpi.recalculateError'));
    } finally {
      setRecalculatingKpis(false);
    }
  };

  const grouped = useMemo(() => {
    return controls.reduce((acc: any, c) => {
      if (!acc[c.iso]) acc[c.iso] = [];
      acc[c.iso].push(c);
      return acc;
    }, {});
  }, [controls]);

  const cumple = controls.filter((c) => c.status === 'cumple').length;
  const parcial = controls.filter((c) => c.status === 'parcial').length;
  const noCumple = controls.filter((c) => c.status === 'no cumple').length;
  const totalControls = controls.length;

  const contractedControls = totalControls;
  const activeNorms = Object.keys(grouped).length;

  const highRisks = Number(riskSummary.find((r) => r.level === 'alto')?.total || 0);
  const mediumRisks = Number(riskSummary.find((r) => r.level === 'medio')?.total || 0);
  const lowRisks = Number(riskSummary.find((r) => r.level === 'bajo')?.total || 0);

  const complianceValue =
    totalControls > 0 ? Math.round((cumple / totalControls) * 100) : 0;

  const donutData = [
    { name: t('dashboardKpi.compliant'), value: cumple },
    { name: t('dashboardKpi.inProgress'), value: parcial },
    { name: t('dashboardKpi.nonCompliant'), value: noCumple },
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
        name: t('dashboardKpi.next7Days'),
        value: buckets.next7.length,
        details: buckets.next7,
        fill: '#dbeafe',
      },
      {
        name: t('dashboardKpi.days8to14'),
        value: buckets.next14.length,
        details: buckets.next14,
        fill: '#fde68a',
      },
      {
        name: t('dashboardKpi.days15to30'),
        value: buckets.next30.length,
        details: buckets.next30,
        fill: '#f59e0b',
      },
      {
        name: t('dashboardKpi.after30Days'),
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
      ? Math.round((((noCumple * 1) + parcial * 0.5) / contractedControls) * 100)
      : 0;

  const globalRiskLabel =
    globalRiskValue >= 50 ? t('findings.severity.high') : globalRiskValue >= 20 ? t('findings.severity.medium') : t('findings.severity.low');

  const riesgoColor = (value: number) => {
    if (value >= 50) return 'text-red-600';
    if (value >= 20) return 'text-yellow-600';
    return 'text-green-600';
  };

  const completionPct = totalControls > 0 ? Math.round((cumple / totalControls) * 100) : 0;
  const progressPct = totalControls > 0 ? Math.round((parcial / totalControls) * 100) : 0;
  const failPct = totalControls > 0 ? Math.round((noCumple / totalControls) * 100) : 0;

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

  const activityItems: ActivityItem[] = useMemo(() => {
    return [
      {
        title: t('dashboardKpi.activity.diagnosisCompleted'),
        description: t('dashboardKpi.activity.activeStandardsDetected', { count: activeNorms }),
        color: 'green',
        icon: 'check',
      },
      {
        title: t('dashboardKpi.activity.newEvidenceUploaded'),
        description: t('dashboardKpi.activity.compliantControls', { count: cumple }),
        color: 'amber',
        icon: 'evidence',
      },
      {
        title: t('dashboardKpi.activity.actionPlanCreated'),
        description: t('dashboardKpi.activity.activePlans', { count: activeActionPlans }),
        color: 'violet',
        icon: 'plan',
      },
      {
        title: t('dashboardKpi.activity.criticalFindingRegistered'),
        description: t('dashboardKpi.activity.nonCompliantControls', { count: noCumple }),
        color: 'red',
        icon: 'alert',
      },
    ];
  }, [activeNorms, cumple, activeActionPlans, noCumple]);

  const kpiItems = kpiData?.items || [];
  const kpiSummary = kpiData?.summary;
  const healthKpiCount = kpiItems.filter(
    (item) => item.is_health_kpi || item.code.startsWith('KPI-HLT-')
  ).length;

  const kpiStatusData = useMemo(() => {
    return [
      { name: t('dashboardKpi.greenStatus'), value: kpiSummary?.green || 0, fill: '#16a34a' },
      { name: t('dashboardKpi.yellowStatus'), value: kpiSummary?.yellow || 0, fill: '#f59e0b' },
      { name: t('dashboardKpi.redStatus'), value: kpiSummary?.red || 0, fill: '#ef4444' },
      { name: t('common.noData'), value: kpiSummary?.gray || 0, fill: '#94a3b8' },
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

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f7fb] p-6">
        <div className="mx-auto max-w-[1700px] space-y-6">
          <div className="rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                  {t('dashboardKpi.executiveDashboard')}
                </h1>
                <p className="mt-2 text-lg text-slate-500">
                  {t('dashboardKpi.executiveSubtitle')}
                </p>
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
                    {t('dashboard.executiveView')}
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
                    {t('dashboard.kpiView')}
                  </button>
                </div>

                <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <span>{latestSyncText}</span>
                </div>
              </div>
            </div>
          </div>

          {activeView === 'executive' && (
            <>
              {loading && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  {t('dashboard.loadingData')}
                </div>
              )}

              {!loading && controls.length === 0 && (
                <div className="rounded-[28px] border border-amber-200 bg-[#fdf8e8] p-8 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
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

              {!loading && controls.length > 0 && (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    <TopCard
                      title={t('dashboardKpi.complianceLevel')}
                      value={`${complianceValue}%`}
                      subtitle={t('dashboard.globalComplianceSubtitle')}
                      accent="green"
                      change={`↑ ${Math.max(1, Math.round(complianceValue * 0.03))}%`}
                      changeHint={t('dashboardKpi.vsPreviousMonth')}
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="4" />
                          <path d="m8 12 3 3 5-6" />
                        </svg>
                      }
                    />

                    <TopCard
                      title={t('dashboard.openFindings')}
                      value={noCumple}
                      subtitle={t('dashboardKpi.nonCompliantControlsLabel')}
                      accent="red"
                      change={`↑ ${Math.max(1, noCumple)}%`}
                      changeHint={t('dashboardKpi.vsPreviousMonth')}
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M12 8v5" />
                          <path d="M12 17h.01" />
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                        </svg>
                      }
                    />

                    <TopCard
                      title={t('dashboard.actionPlans')}
                      value={activeActionPlans}
                      subtitle={t('dashboardKpi.systemActive')}
                      accent="amber"
                      change={t('dashboardKpi.overdueCount', { count: overdueActionPlans })}
                      changeHint={t('dashboardKpi.noChanges')}
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 11l3 3L22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                      }
                    />

                    <TopCard
                      title={t('dashboard.criticalRisks')}
                      value={highRisks}
                      subtitle={t('dashboard.criticalRisksSubtitle')}
                      accent="rose"
                      change={`↓ ${Math.max(1, Math.round((highRisks || 1) * 0.2))}%`}
                      changeHint={t('dashboardKpi.vsPreviousMonth')}
                      icon={
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
                        </svg>
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
                    <div className="grid grid-cols-1 gap-4">
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="mb-5 flex items-center justify-between">
                          <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                            {t('dashboardKpi.complianceStatus')}
                          </h2>

                          <button
                            type="button"
                            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 5.5A1.5 1.5 0 1 0 10 8.5a1.5 1.5 0 0 0 0 3Zm0 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_220px] xl:items-center">
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
                                {t('dashboardKpi.compliance')}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-5">
                            <LegendRow
                              label={t('dashboardKpi.compliant')}
                              value={`${completionPct}%`}
                              color="bg-green-600"
                              extra={t('health.controlsCount', { count: cumple })}
                            />
                            <LegendRow
                              label={t('dashboardKpi.inProgress')}
                              value={`${progressPct}%`}
                              color="bg-amber-400"
                              extra={t('health.controlsCount', { count: parcial })}
                            />
                            <LegendRow
                              label={t('dashboardKpi.nonCompliant')}
                              value={`${failPct}%`}
                              color="bg-red-500"
                              extra={t('health.controlsCount', { count: noCumple })}
                            />
                          </div>

                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <div className="mb-3 text-sm font-semibold text-slate-500">
                              {t('dashboardKpi.trend30Days')}
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
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm font-medium text-slate-700">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                            i
                          </span>
                          {t('health.lastUpdate')}: {latestSyncText}
                        </div>
                      </section>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MiniCard
                          title={t('sidebar.findings')}
                          mainValue={noCumple}
                          mainLabel={t('findings.status.open')}
                          sideValue={highRisks}
                          sideLabel={t('findings.severity.critical')}
                          tone="violet"
                          footer={t('dashboardKpi.totalFindings', { count: noCumple + partialOrZero(summary?.open_findings) || noCumple })}
                          href="/hallazgos"
                        />

                        <MiniCard
                          title={t('dashboard.actionPlans')}
                          mainValue={activeActionPlans}
                          mainLabel={t('dashboardKpi.active')}
                          sideValue={overdueActionPlans}
                          sideLabel={t('dashboardKpi.overdue')}
                          tone="amber"
                          footer={t('dashboardKpi.totalPlans', { count: actionPlans.length })}
                          href="/plan-accion"
                        />

                        <MiniCard
                          title={t('dashboard.risk')}
                          mainValue={highRisks}
                          mainLabel={t('assets.levels.highPlural')}
                          sideValue={highRisks + mediumRisks + lowRisks}
                          sideLabel={t('dashboardKpi.total')}
                          tone="red"
                          footer={t('dashboardKpi.assessmentInProgress')}
                          href="/matriz-riesgo"
                        />

                        <MiniCard
                          title={t('sidebar.audits')}
                          mainValue={nextAudits.length}
                          mainLabel={t('dashboardKpi.upcoming')}
                          sideValue={activeNorms}
                          sideLabel={t('sidebar.standards')}
                          tone="indigo"
                          footer={t('dashboardKpi.scheduledThisYear', { count: nextAudits.length })}
                          href="/auditorias"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                            {t('dashboardKpi.upcomingDeadlines')}
                          </h2>

                          <a
                            href="/auditorias"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                          >
                            <span>{t('dashboardKpi.viewCalendar')}</span>
                            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
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

                        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-slate-700">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm">
                            !
                          </span>
                          {t('dashboardKpi.deadlinesAttention', { count: upcomingAuditBars[2]?.value || 0 })}
                        </div>
                      </section>

                      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#091b49_0%,#0b1636_55%,#081226_100%)] p-6 text-white shadow-[0_16px_40px_rgba(2,8,23,0.22)]">
                        <h2 className="mb-5 text-2xl font-semibold">
                          {t('dashboardKpi.quickActions')}
                        </h2>

                        <div className="space-y-3">
                          <QuickActionButton href="/plan-accion" label={t('dashboardKpi.newActionPlan')} />
                          <QuickActionButton href="/evidencias" label={t('dashboardKpi.registerEvidence')} />
                          <QuickActionButton href="/no-conformidades" label={t('dashboardKpi.createNonconformity')} />
                          <QuickActionButton href="/auditorias" label={t('dashboardKpi.generateReport')} />
                        </div>
                      </section>

                      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                        <div className="mb-4 flex items-center justify-between">
                          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            {t('dashboard.latestActivity')}
                          </h2>

                          <a
                            href="/hallazgos"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                          >
                            <span>{t('dashboardKpi.viewAll')}</span>
                            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                          </a>
                        </div>

                        <div className="space-y-4">
                          {activityItems.map((item, index) => (
                            <ActivityRow
                              key={`${item.title}-${index}`}
                              title={item.title}
                              description={item.description}
                              color={item.color}
                              icon={item.icon}
                            />
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.standardSummary')}
                        </h2>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {t('dashboardKpi.standardsCount', { count: isoCards.length })}
                        </span>
                      </div>

                      {isoCards.length === 0 ? (
                        <div className="text-slate-500">{t('dashboardKpi.noStandardsData')}</div>
                      ) : (
                        <div className="space-y-4">
                          {isoCards.map((item) => (
                            <div
                              key={item.iso}
                              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:shadow-sm"
                            >
                              <div className="mb-3 flex items-center justify-between gap-4">
                                <div className="font-semibold text-slate-900">{item.iso}</div>
                                <div className="text-sm font-semibold text-indigo-600">
                                  {item.percent}% {t('dashboardKpi.compliance')}
                                </div>
                              </div>

                              <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <StatChip label={t('dashboardKpi.total')} value={item.total} color="text-slate-900" />
                                <StatChip label="OK" value={item.ok} color="text-green-600" />
                                <StatChip label={t('dashboardKpi.partial')} value={item.partial} color="text-amber-600" />
                                <StatChip label={t('findings.severity.critical')} value={item.critical} color="text-red-600" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.upcomingAudits')}
                        </h2>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {t('dashboardKpi.eventsCount', { count: nextAudits.length })}
                        </span>
                      </div>

                      {nextAudits.length === 0 ? (
                        <div className="text-slate-500">{t('dashboardKpi.noUpcomingAudits')}</div>
                      ) : (
                        <div className="space-y-4">
                          {nextAudits.map((a, i) => (
                            <div
                              key={i}
                              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900">{a.iso}</div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    {t('audits.auditor')}: {a.auditor_name || t('dashboardKpi.unassigned')}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right">
                                  <div className="text-xs uppercase tracking-wide text-slate-400">{t('common.date')}</div>
                                  <div className="font-semibold text-slate-900">{a.start_date}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <BottomMetric label={t('dashboardKpi.contractedControls')} value={contractedControls} />
                      <BottomMetric label={t('dashboardKpi.activeStandards')} value={activeNorms} />
                      <BottomMetric
                        label={t('dashboardKpi.globalRisk')}
                        value={globalRiskLabel}
                        className={riesgoColor(globalRiskValue)}
                      />
                      <BottomMetric label={t('dashboardKpi.riskPercent')} value={`${globalRiskValue}%`} />
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {activeView === 'kpi' && (
            <>
              <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                    {t('dashboard.kpiView')}
                  </h2>
                  <p className="mt-1 text-slate-500">
                    {t('dashboardKpi.kpiViewSubtitle')}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <TopCard
                    title={t('dashboard.kpiGlobalScore')}
                    value={`${calculateExecutiveScore(kpiSummary)}%`}
                    subtitle={t('dashboardKpi.systemHealth')}
                    accent="green"
                    change={t('dashboardKpi.greenCount', { count: kpiSummary?.green || 0 })}
                    changeHint={t('dashboard.currentState')}
                    icon={<TcdxIcon name="kpi" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.criticalKpis')}
                    value={kpiSummary?.red || 0}
                    subtitle={t('dashboardKpi.requireAction')}
                    accent="red"
                    change="ALERTA"
                    changeHint={t('dashboard.highImpact')}
                    icon={<TcdxIcon name="alert" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.noDataKpis')}
                    value={kpiSummary?.gray || 0}
                    subtitle={t('statuses.evidence.pendiente')}
                    accent="amber"
                    change="INPUT"
                    changeHint={t('dashboard.requiredInput')}
                    icon={<TcdxIcon name="hourglass" className="h-6 w-6" />}
                  />

                  <TopCard
                    title={t('dashboard.enabledKpis')}
                    value={kpiItems.filter((item) => item.is_enabled).length}
                    subtitle={t('dashboard.enabledKpisSubtitle')}
                    accent="amber"
                    change={t('dashboardKpi.manualCount', { count: kpiItems.filter((item) => item.kpi_type === 'manual').length })}
                    changeHint={t('dashboard.captureType')}
                    icon={
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    }
                  />

                  <TopCard
                    title={t('dashboard.healthKpis')}
                    value={kpiSummary?.health_kpis || healthKpiCount}
                    subtitle={t('dashboard.healthKpisSubtitle')}
                    accent="green"
                    change={`${healthKpiCount} health`}
                    changeHint={t('dashboard.controlHealth')}
                    icon={<TcdxIcon name="heart" className="h-6 w-6" />}
                  />
                </div>

                {((kpiSummary?.red || 0) > 0 || (kpiSummary?.gray || 0) > 0) && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                    {t('dashboardKpi.kpiAlert', { red: kpiSummary?.red || 0, gray: kpiSummary?.gray || 0 })}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <a
                    href="/administrar-kpis"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    {t('kpiAdmin.title')}
                  </a>

                  <a
                    href="/health"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                  >
                    {t('kpiAdmin.viewHealth')}
                  </a>

                  <button
                    type="button"
                    onClick={handleRecalculateKpis}
                    disabled={recalculatingKpis}
                    className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {recalculatingKpis ? t('dashboardKpi.recalculating') : t('dashboardKpi.recalculateKpis')}
                  </button>
                </div>
              </div>

              {loadingKpis && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  {t('dashboardKpi.loadingKpiView')}
                </div>
              )}

              {!loadingKpis && (
                <>
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-[2rem] font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.overallKpiStatus')}
                        </h2>

                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {t('dashboardKpi.kpisCount', { count: kpiSummary?.total_kpis || 0 })}
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
                            label={t('dashboardKpi.greenStatus')}
                            value={kpiSummary?.green || 0}
                            color="bg-green-600"
                            extra={t('dashboardKpi.targetAchieved')}
                          />
                          <LegendRow
                            label={t('dashboardKpi.yellowStatus')}
                            value={kpiSummary?.yellow || 0}
                            color="bg-amber-400"
                            extra={t('dashboardKpi.monitoringRequired')}
                          />
                          <LegendRow
                            label={t('dashboardKpi.redStatus')}
                            value={kpiSummary?.red || 0}
                            color="bg-red-500"
                            extra={t('dashboardKpi.actionRecommended')}
                          />
                          <LegendRow
                            label={t('common.noData')}
                            value={kpiSummary?.gray || 0}
                            color="bg-slate-400"
                            extra={t('dashboardKpi.loadOrCalculationPending')}
                          />
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
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
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#4f46e5" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboard.criticalKpis')}
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

                    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {t('dashboardKpi.featuredKpis')}
                        </h2>

                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          {t('dashboardKpi.greenCount', { count: topGreenKpis.length })}
                        </span>
                      </div>

                      {topGreenKpis.length === 0 ? (
                        <div className="text-slate-500">{t('dashboardKpi.noGreenKpis')}</div>
                      ) : (
                        <div className="space-y-4">
                          {topGreenKpis.map((item) => (
                            <KpiRow key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        {t('dashboardKpi.allKpis')}
                      </h2>

                      <a
                        href="/administrar-kpis"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
                      >
                        <span>{t('dashboardKpi.openAdministration')}</span>
                        <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
                      </a>
                    </div>

                    {kpiItems.length === 0 ? (
                      <div className="text-slate-500">
                        {t('dashboardKpi.noKpis')}
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

function getKpiStatusLabel(color: string | null | undefined, t: TFunction) {
  if (color === 'green') return t('statuses.kpis.verde');
  if (color === 'yellow') return t('statuses.kpis.amarillo');
  if (color === 'red') return t('statuses.kpis.rojo');
  return t('common.noData');
}

function getKpiStatusClass(color?: string | null) {
  if (color === 'green') return 'bg-green-100 text-green-700 border-green-200';
  if (color === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (color === 'red') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

type TFunction = (key: string, params?: Record<string, string | number>) => string;

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

function KpiRow({ item }: { item: KpiDashboardItem }) {
  const { t } = useTranslation();
  const status = item.latest_snapshot?.status_color || 'gray';

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
              {item.code}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(status)}`}>
              {getKpiStatusLabel(status, t)}
            </span>
            {(item.is_health_kpi || item.code.startsWith('KPI-HLT-')) && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {t('dashboardKpi.health')}
              </span>
            )}
          </div>

          <div className="mt-3 font-semibold text-slate-900">
            {item.name}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            {item.category} · {item.frequency}
          </div>

          {item.applicable_standards?.length ? (
            <div className="mt-2 text-xs text-slate-500">
              {t('sidebar.standards')}: {item.applicable_standards.join(', ')}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {formatKpiValue(item.latest_snapshot?.value, item.unit, t('common.noData'))}
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {t('kpiAdmin.target')}:{' '}
            {item.target_value !== null && item.target_value !== undefined
              ? formatKpiValue(item.target_value, item.unit, t('common.noData'))
              : t('common.noData')}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ item }: { item: KpiDashboardItem }) {
  const { t } = useTranslation();
  const status = item.latest_snapshot?.status_color || 'gray';

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
              {item.code}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKpiStatusClass(status)}`}>
              {getKpiStatusLabel(status, t)}
            </span>
            {(item.is_health_kpi || item.code.startsWith('KPI-HLT-')) && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {t('kpiAdmin.healthEngine')}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {item.kpi_type}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-slate-900">
            {item.name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {item.description || t('header.noDescription')}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatKpiValue(item.latest_snapshot?.value, item.unit, t('common.noData'))}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {item.frequency}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <StatChip label={t('kpiAdmin.category')} value={item.category} color="text-slate-900" />
        <StatChip label={t('kpiAdmin.direction')} value={item.direction} color="text-slate-900" />
        <StatChip
          label={t('kpiAdmin.target')}
          value={
            item.target_value !== null && item.target_value !== undefined
              ? formatKpiValue(item.target_value, item.unit, t('common.noData'))
              : t('common.noData')
          }
          color="text-slate-900"
        />
        <StatChip
          label="Delta"
          value={item.delta !== null && item.delta !== undefined ? item.delta.toFixed(2) : t('common.noData')}
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
            {t('dashboardKpi.snapshotByScope')}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {item.latest_snapshots.slice(0, 6).map((snap, index) => (
              <div
                key={`${item.id}-${snap.standard_code || 'GLOBAL'}-${index}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"
              >
                <span className="font-semibold text-slate-600">
                  {snap.standard_code || t('kpiAdmin.global')}
                </span>
                <span className="font-bold text-slate-900">
                  {formatKpiValue(snap.value as any, item.unit, t('common.noData'))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="h-[80px] mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buildTrend(numberOrZero(item.latest_snapshot?.value), item.delta)}>
            <Line dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UpcomingAuditsTooltip({ active, payload, label }: any) {
  const { t } = useTranslation();
  if (!active || !payload || !payload.length) return null;

  const barData = payload[0]?.payload;
  const details: AuditItem[] = barData?.details || [];

  return (
    <div className="max-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-2 font-semibold text-slate-900">{label}</div>
      <div className="mb-3 text-sm text-slate-600">
        {t('dashboardKpi.totalEvents')}: <b>{barData?.value || 0}</b>
      </div>

      {details.length === 0 ? (
        <div className="text-sm text-slate-500">{t('dashboardKpi.noEventsInRange')}</div>
      ) : (
        <div className="max-h-56 space-y-2 overflow-auto">
          {details.map((audit, idx) => (
            <div key={idx} className="border-t border-slate-100 pt-2 text-sm first:border-t-0 first:pt-0">
              <div className="font-medium text-slate-900">{audit.iso || t('dashboardKpi.noIso')}</div>
              <div className="text-slate-600">{t('common.date')}: {audit.start_date || '-'}</div>
              <div className="text-slate-600">{t('dashboardKpi.event')}: {t('dashboardKpi.scheduledAudit')}</div>
              <div className="text-slate-600">{t('audits.auditor')}: {audit.auditor_name || t('dashboardKpi.unassigned')}</div>
            </div>
          ))}
        </div>
      )}
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
  accent: 'green' | 'red' | 'amber' | 'rose';
  change: string;
  changeHint: string;
  icon: ReactNode;
}) {
  const accentMap: Record<string, string> = {
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 text-green-700',
    red: 'bg-gradient-to-br from-red-50 to-rose-50 text-red-700',
    amber: 'bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-700',
    rose: 'bg-gradient-to-br from-rose-50 to-red-50 text-rose-700',
  };

  return (
    <div className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accentMap[accent]}`}>
          {icon}
        </div>

        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
          {change}
        </div>
      </div>

      <div className="mt-5 text-[1.75rem] font-semibold leading-tight text-slate-900">
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
  tone: 'violet' | 'amber' | 'red' | 'indigo';
  footer: string;
  href: string;
}) {
  const toneMap: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };

  const icons: Record<string, TcdxIconName> = {
    violet: 'finding',
    amber: 'plan',
    red: 'alert',
    indigo: 'audit',
  };

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[tone]}`}>
            <TcdxIcon name={icons[tone]} className="h-5 w-5" />
          </span>
          <span>{title}</span>
        </div>

        <a href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          <span>Ver todos</span>
          <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
        </a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-5xl font-bold tracking-tight text-slate-900">{mainValue}</div>
          <div className="mt-1 text-sm text-slate-500">{mainLabel}</div>
        </div>

        <div>
          <div className="text-5xl font-bold tracking-tight text-slate-900">{sideValue}</div>
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
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
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

function ActivityRow({
  title,
  description,
  color,
  icon,
}: {
  title: string;
  description: string;
  color: string;
  icon: TcdxIconName;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    violet: 'bg-violet-100 text-violet-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold ${colorMap[color]}`}>
        <TcdxIcon name={icon} className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-sm text-slate-500">{description}</div>
      </div>
    </div>
  );
}
