'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserRoleFromToken } from '@/utils/auth';
import TcdxIcon, { type TcdxIconName } from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';
import { getStatusLabel as getCatalogStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel as getCatalogCategoryLabel } from '@/i18n/statusLabels';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type ReportType = {
  code: string;
  name: string;
  description: string;
  category: string;
  default_format: string;
  template_key: string;
  can_generate: boolean;
  can_schedule: boolean;
};

type Client = {
  id: string;
  name: string;
  logo_url?: string | null;
};

type ReportExport = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_email: string;
  report_type_code: string;
  report_type_name: string;
  report_title: string;
  report_format: string;
  status: string;
  file_url: string;
  generated_at: string;
};

function getDefaultPeriod(locale = 'es') {
  const now = new Date();

  const month = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CL', {
    month: 'long',
  }).format(now);

  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${now.getFullYear()}`;
}

function buildLocaleHeaders(token: string, locale: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-tcdx-locale': locale,
  };
}

function appendLocaleParam(params: URLSearchParams, locale: string) {
  params.set('locale', locale);
  return params;
}

function getAbsoluteFileUrl(fileUrl: string) {
  if (!fileUrl) return '#';

  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  return `${API_URL}${fileUrl}`;
}

function formatDate(value?: string, locale = 'es') {
  if (!value) return '-';

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}



function getExportHistoryReportName(item: ReportExport, t: (key: string) => string) {
  const key = `exports.reportTypes.${item.report_type_code}.name`;
  const translated = t(key);
  return translated !== key ? translated : item.report_type_name || item.report_title || item.report_type_code;
}

function getExportHistoryReportTitle(item: ReportExport, t: (key: string) => string) {
  const key = `exports.reportTypes.${item.report_type_code}.name`;
  const translated = t(key);
  return translated !== key ? translated : item.report_title || item.report_type_name || item.report_type_code;
}

function getReportTypeName(report: ReportType, t: (key: string) => string) {
  const key = `exports.reportTypes.${report.code}.name`;
  const translated = t(key);
  return translated !== key ? translated : report.name;
}

function getReportTypeDescription(report: ReportType, t: (key: string) => string) {
  const key = `exports.reportTypes.${report.code}.description`;
  const translated = t(key);
  return translated !== key ? translated : report.description;
}

function getReportIcon(code: string): TcdxIconName {
  if (code === 'executive_summary') return 'kpi';
  if (code === 'audit_report') return 'audit';
  if (code === 'control_status') return 'check';
  if (code === 'platform_client_monthly') return 'building';

  return 'document';
}

function getCategoryLabel(category: string, t: (key: string) => string) {
  return t(`exports.categories.${category}`) !== `exports.categories.${category}`
    ? t(`exports.categories.${category}`)
    : category || t('exports.categories.default');
}

function getCategoryDescription(category: string, t: (key: string) => string) {
  const key = `exports.categoryDescriptions.${category}`;
  const value = t(key);
  return value !== key ? value : t('exports.categoryDescriptions.default');
}

function getCategoryBadgeClass(category: string) {
  const styles: Record<string, string> = {
    executive: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    audit: 'bg-amber-50 text-amber-700 border-amber-200',
    operational: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    platform: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  return styles[category] || 'bg-slate-100 text-slate-600 border-slate-200';
}


function localizeReportType(report: ReportType, t: (key: string) => string): ReportType {
  return {
    ...report,
    name: getReportTypeName(report, t),
    description: getReportTypeDescription(report, t),
  };
}

function localizeExportHistoryItem(item: ReportExport, t: (key: string) => string): ReportExport {
  const key = `exports.reportTypes.${item.report_type_code}.name`;
  const translated = t(key);
  const label = translated !== key
    ? translated
    : item.report_type_name || item.report_title || item.report_type_code;

  return {
    ...item,
    report_type_name: label,
    report_title: label,
  };
}

function getStatusLabel(status: string | undefined, t: (key: string) => string) {
  const raw = String(status || '').toLowerCase();

  if (['completed', 'completado', 'generado', 'generated', 'success', 'ok'].includes(raw)) {
    return t('statuses.reports.completed');
  }

  if (['processing', 'running', 'pending', 'pendiente'].includes(raw)) {
    return t('statuses.reports.processing');
  }

  if (['error', 'failed', 'fallido'].includes(raw)) {
    return t('statuses.reports.error');
  }

  return status || t('statuses.reports.completed');
}

function getStatusClass(status?: string) {
  const raw = String(status || '').toLowerCase();

  if (['completed', 'completado', 'generado', 'generated', 'success', 'ok'].includes(raw)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (['processing', 'running', 'pending', 'pendiente'].includes(raw)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (['error', 'failed', 'fallido'].includes(raw)) {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function isToday(dateStr?: string) {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isLast7Days(dateStr?: string) {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function EmptyLogo() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white/80">
      CL
    </div>
  );
}

const CATEGORY_ORDER = ['executive', 'operational', 'audit', 'platform'];

const REPORT_ORDER = [
  'executive_summary',
  'control_status',
  'audit_report',
  'platform_client_monthly',
];

export default function ExportesPage() {
  const { locale, t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedReportCode, setSelectedReportCode] = useState('');
  const [period, setPeriod] = useState(() => getDefaultPeriod(locale));
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  const currentRole = getUserRoleFromToken();

  const isReadOnlyReports =
    currentRole === 'viewer' ||
    currentRole === 'operativo' ||
    currentRole === 'cliente' ||
    currentRole === 'client' ||
    currentRole === 'solo_lectura' ||
    currentRole === 'read_only' ||
    currentRole === 'readonly' ||
    currentRole === 'ejecutivo';

  const [exportsHistory, setExportsHistory] = useState<ReportExport[]>([]);

  const [filterType, setFilterType] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === selectedTenantId) || null;
  }, [clients, selectedTenantId]);

  const historyStats = useMemo(() => {
    const total = exportsHistory.length;
    const today = exportsHistory.filter((item) => isToday(item.generated_at)).length;
    const last7Days = exportsHistory.filter((item) => isLast7Days(item.generated_at)).length;
    const uniqueClients = new Set(
      exportsHistory.map((item) => item.tenant_id).filter(Boolean)
    ).size;

    return {
      total,
      today,
      last7Days,
      uniqueClients,
    };
  }, [exportsHistory]);

  const orderedReportTypes = useMemo(() => {
    return [...reportTypes].sort((a, b) => {
      const aCategoryIndex = CATEGORY_ORDER.indexOf(a.category);
      const bCategoryIndex = CATEGORY_ORDER.indexOf(b.category);

      if (aCategoryIndex !== bCategoryIndex) {
        return (aCategoryIndex === -1 ? 999 : aCategoryIndex) - (bCategoryIndex === -1 ? 999 : bCategoryIndex);
      }

      const aReportIndex = REPORT_ORDER.indexOf(a.code);
      const bReportIndex = REPORT_ORDER.indexOf(b.code);

      if (aReportIndex !== bReportIndex) {
        return (aReportIndex === -1 ? 999 : aReportIndex) - (bReportIndex === -1 ? 999 : bReportIndex);
      }

      return a.name.localeCompare(b.name, locale === 'en' ? 'en' : 'es');
    });
  }, [reportTypes, locale]);

  const selectedReport = useMemo(() => {
    return orderedReportTypes.find((report) => report.code === selectedReportCode) || null;
  }, [orderedReportTypes, selectedReportCode]);

  const categorySummary = useMemo(() => {
    const acc: Record<string, number> = {};

    for (const item of reportTypes) {
      acc[item.category] = (acc[item.category] || 0) + 1;
    }

    return CATEGORY_ORDER.filter((category) => acc[category]).map((category) => ({
      category,
      count: acc[category],
    }));
  }, [reportTypes]);

  const typeCount = reportTypes.length;

  const recentByType = useMemo(() => {
    const acc: Record<string, number> = {};

    for (const item of exportsHistory) {
      acc[item.report_type_code] = (acc[item.report_type_code] || 0) + 1;
    }

    return orderedReportTypes
      .map((type) => ({
        code: type.code,
        name: type.name,
        total: acc[type.code] || 0,
      }))
      .filter((item) => item.total > 0)
      .slice(0, 4);
  }, [exportsHistory, orderedReportTypes]);

  const latestExports = useMemo(() => {
    return exportsHistory.slice(0, 5);
  }, [exportsHistory]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      setError('');

      const token = localStorage.getItem('token');

      if (!token) {
        window.location.href = '/login';
        return;
      }

      const params = appendLocaleParam(new URLSearchParams(), locale);

      if (filterType) params.set('report_type_code', filterType);
      if (filterTenant) params.set('tenant_id', filterTenant);
      if (filterText) params.set('q', filterText);
      if (filterDateFrom) params.set('date_from', filterDateFrom);
      if (filterDateTo) params.set('date_to', filterDateTo);

      params.set('limit', '100');

      const res = await fetch(`${API_URL}/api/reports/exports?${params.toString()}`, {
        headers: buildLocaleHeaders(token, locale),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || t('exports.loadHistoryError'));
      }

      setExportsHistory((json?.data || []).map((item: ReportExport) => localizeExportHistoryItem(item, t)));
    } catch (err: any) {
      console.error('ERROR LOAD REPORT HISTORY:', err);
      setError(err.message || t('exports.loadHistoryError'));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');

        if (!token) {
          window.location.href = '/login';
          return;
        }

        const [typesRes, clientsRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/types?locale=${encodeURIComponent(locale)}`, {
            headers: buildLocaleHeaders(token, locale),
          }),
          fetch(`${API_URL}/api/reports/clients?locale=${encodeURIComponent(locale)}`, {
            headers: buildLocaleHeaders(token, locale),
          }),
        ]);

        const typesJson = await typesRes.json();
        const clientsJson = await clientsRes.json();

        if (!typesRes.ok || typesJson?.ok === false) {
          throw new Error(
            typesJson?.error || t('exports.loadTypesError')
          );
        }

        if (!clientsRes.ok || clientsJson?.ok === false) {
          throw new Error(
            clientsJson?.error || t('exports.loadClientsError')
          );
        }

        const loadedReports = typesJson?.data || [];
        const loadedClients = clientsJson?.data || [];

        setReportTypes(loadedReports.map((report: ReportType) => localizeReportType(report, t)));
        setClients(loadedClients);

        if (loadedClients.length > 0) {
          setSelectedTenantId(loadedClients[0].id);
        }

        if (loadedReports.length > 0) {
          setSelectedReportCode(loadedReports[0].code);
        }

        if (
          isReadOnlyReports ||
          !loadedReports.some((report: ReportType) => report.can_generate)
        ) {
          setActiveTab('history');
        }
      } catch (err: any) {
        console.error('ERROR LOAD EXPORTES:', err);
        setError(err.message || t('exports.loadExportsError'));
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [locale]);

  useEffect(() => {
    if (!loading) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!selectedReportCode && orderedReportTypes.length > 0) {
      setSelectedReportCode(orderedReportTypes[0].code);
    }
  }, [orderedReportTypes, selectedReportCode]);

  const generateReport = async (reportTypeCode: string) => {
    if (isReadOnlyReports) {
      setError(t('exports.readonlyError'));
      setActiveTab('history');
      return;
    }

    try {
      setGeneratingCode(reportTypeCode);
      setError('');
      setSuccessMessage('');

      const token = localStorage.getItem('token');

      if (!token) {
        window.location.href = '/login';
        return;
      }

      const payload: any = {
        report_type_code: reportTypeCode,
        locale,
        period,
        metadata: {
          source: 'frontend_exportes',
          generated_from: '/exportes',
          locale,
        },
      };

      if (selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }

      const res = await fetch(`${API_URL}/api/reports/generate`, {
        method: 'POST',
        headers: {
          ...buildLocaleHeaders(token, locale),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.detail || t('exports.generateError'));
      }

      setSuccessMessage(t('exports.generatedSuccessfully'));
      setActiveTab('history');
      await loadHistory();

      const fileUrl = json?.data?.file_url;

      if (fileUrl) {
        window.open(getAbsoluteFileUrl(fileUrl), '_blank');
      }
    } catch (err: any) {
      console.error('ERROR GENERATE REPORT:', err);
      setError(err.message || t('exports.generateError'));
    } finally {
      setGeneratingCode(null);
    }
  };

  const clearFilters = async () => {
    setFilterType('');
    setFilterTenant('');
    setFilterText('');
    setFilterDateFrom('');
    setFilterDateTo('');

    setTimeout(() => {
      loadHistory();
    }, 0);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-[linear-gradient(135deg,#0B2F4F_0%,#103a61_48%,#0b2740_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                {t('exports.brand')}
              </p>

              <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                {t('exports.title')}
              </h1>

              <p className="mt-3 text-sm leading-7 text-white/75 md:text-base">
                {t('exports.subtitle')}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  {t('exports.badges.branding')}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  {t('exports.badges.history')}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  {t('exports.badges.pdf')}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  {t('exports.badges.commercial')}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px] xl:max-w-[480px]">
              <HeroMiniStat
                label={t('exports.reportTypes')}
                value={typeCount}
                helper={t('exports.availableByProfile')}
              />
              <HeroMiniStat
                label={t('exports.reportsToday')}
                value={historyStats.today}
                helper={t('exports.generatedToday')}
              />
              <HeroMiniStat
                label={t('common.last7Days')}
                value={historyStats.last7Days}
                helper={t('exports.recentActivity')}
              />
              <HeroMiniStat
                label={t('exports.clientsWithHistory')}
                value={historyStats.uniqueClients}
                helper={t('exports.accumulatedTraceability')}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {t('exports.periodLabel')}
            </label>

            <input
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0B2F4F] focus:ring-2 focus:ring-[#0B2F4F]/10"
              placeholder={t('exports.periodPlaceholder')}
            />

            <p className="mt-3 text-xs text-slate-500">
              {t('exports.periodHelp')}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {t('exports.clientLabel')}
            </label>

            <select
              value={selectedTenantId}
              onChange={(event) => setSelectedTenantId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0B2F4F] focus:ring-2 focus:ring-[#0B2F4F]/10"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <p className="mt-3 text-xs text-slate-500">
              {t('exports.clientHelp')}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#0B2F4F] p-5 text-white shadow-sm">
            <div className="flex items-start gap-4">
              {selectedClient?.logo_url ? (
                <img
                  src={getAbsoluteFileUrl(selectedClient.logo_url)}
                  alt={selectedClient.name}
                  className="h-14 w-14 rounded-2xl border border-white/10 bg-white/10 object-cover"
                />
              ) : (
                <EmptyLogo />
              )}

              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                  {t('exports.currentContext')}
                </div>

                <div className="mt-2 truncate text-lg font-bold">
                  {selectedClient?.name || t('exports.clientNotSelected')}
                </div>

                <div className="mt-1 text-sm text-white/65">
                  {t('exports.premiumDocument')}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/75">
                  {t('common.period')}: <span className="font-semibold text-white">{period}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isReadOnlyReports && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
            {t('exports.readOnlyMode')}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { if (!isReadOnlyReports) setActiveTab('generate'); }}
              className={[
                'rounded-2xl px-4 py-3 text-sm font-bold transition',
                activeTab === 'generate'
                  ? 'bg-[#0B2F4F] text-white'
                  : isReadOnlyReports
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {t('exports.generateTab')}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={[
                'rounded-2xl px-4 py-3 text-sm font-bold transition',
                activeTab === 'history'
                  ? 'bg-[#0B2F4F] text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {t('exports.history')}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        {activeTab === 'generate' && (
          <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {t('exports.availableReports')}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {t('exports.availableReportsHelp')}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('exports.typesAvailable', { count: reportTypes.length })}
                </div>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  {t('exports.loadingReports')}
                </div>
              ) : reportTypes.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  {t('exports.noReports')}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {categorySummary.map((item) => (
                      <span
                        key={item.category}
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getCategoryBadgeClass(
                          item.category
                        )}`}
                      >
                        {getCategoryLabel(item.category, t)} · {item.count}
                      </span>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {orderedReportTypes.map((report) => {
                      const isGenerating = generatingCode === report.code;
                      const isSelected = selectedReportCode === report.code;

                      return (
                        <article
                          key={report.code}
                          className={[
                            'flex flex-col rounded-3xl border bg-white p-5 shadow-sm transition',
                            isSelected
                              ? 'border-[#0B2F4F] ring-2 ring-[#0B2F4F]/10'
                              : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#2563eb]">
                              <TcdxIcon name={getReportIcon(report.code)} className="h-6 w-6" />
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getCategoryBadgeClass(
                                  report.category
                                )}`}
                              >
                                {getCategoryLabel(report.category, t)}
                              </span>

                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                {report.default_format || 'pdf'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-5">
                            <h3 className="text-base font-bold text-slate-900">
                              {getReportTypeName(report, t)}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {getReportTypeDescription(report, t)}
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                              {t('common.template')}: {report.template_key}
                            </span>

                            {report.can_schedule && (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                {t('common.status')}
                              </span>
                            )}
                          </div>

                          <div className="mt-auto space-y-3 pt-5">
                            <button
                              type="button"
                              onClick={() => setSelectedReportCode(report.code)}
                              className={[
                                'w-full rounded-xl border px-4 py-2.5 text-sm font-bold transition',
                                isSelected
                                  ? 'border-[#0B2F4F] bg-[#0B2F4F]/5 text-[#0B2F4F]'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              {isSelected ? t('common.selected') : t('common.viewDetails')}
                            </button>

                            <button
                              type="button"
                              disabled={!report.can_generate || isGenerating}
                              onClick={() => generateReport(report.code)}
                              className={[
                                'w-full rounded-xl px-4 py-2.5 text-sm font-bold transition',
                                report.can_generate && !isGenerating
                                  ? 'bg-[#0B2F4F] text-white hover:bg-[#123d63]'
                                  : 'cursor-not-allowed bg-slate-200 text-slate-400',
                              ].join(' ')}
                            >
                              {isGenerating ? t('exports.generating') : t('exports.generateReport')}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {t('exports.selectedReport')}
                </div>

                {selectedReport ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#2563eb]">
                        <TcdxIcon name={getReportIcon(selectedReport.code)} className="h-7 w-7" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getCategoryBadgeClass(
                              selectedReport.category
                            )}`}
                          >
                            {getCategoryLabel(selectedReport.category, t)}
                          </span>

                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            {selectedReport.default_format || 'pdf'}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-slate-900">
                          {getReportTypeName(selectedReport, t)}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-slate-500">
                      {getReportTypeDescription(selectedReport, t)}
                    </p>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {t('exports.focus')}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">
                        {getCategoryDescription(selectedReport.category, t)}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailCard
                        label={t('common.template')}
                        value={selectedReport.template_key}
                      />
                      <DetailCard
                        label={t('common.format')}
                        value={(selectedReport.default_format || 'pdf').toUpperCase()}
                      />
                      <DetailCard
                        label={t('common.client')}
                        value={selectedClient?.name || t('common.notSelected')}
                      />
                      <DetailCard
                        label={t('common.period')}
                        value={period || '-'}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!selectedReport.can_generate || generatingCode === selectedReport.code}
                      onClick={() => generateReport(selectedReport.code)}
                      className={[
                        'w-full rounded-xl px-4 py-3 text-sm font-bold transition',
                        selectedReport.can_generate && generatingCode !== selectedReport.code
                          ? 'bg-[#0B2F4F] text-white hover:bg-[#123d63]'
                          : 'cursor-not-allowed bg-slate-200 text-slate-400',
                      ].join(' ')}
                    >
                      {generatingCode === selectedReport.code
                        ? t('exports.generating')
                        : t('exports.generateNow')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    {t('exports.selectReportHint')}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {t('exports.recentActivity')}
                </div>

                <div className="mt-4 space-y-3">
                  {latestExports.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {t('exports.noRecentReports')}
                    </div>
                  ) : (
                    latestExports.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {item.report_type_name || item.report_title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.tenant_name || '-'}
                            </div>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status, t)}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          {formatDate(item.generated_at, locale)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {t('exports.recentDistribution')}
                </div>

                <div className="mt-4 space-y-3">
                  {recentByType.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {t('exports.notEnoughData')}
                    </div>
                  ) : (
                    recentByType.map((item) => (
                      <div key={item.code} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-sm font-medium text-slate-700">
                          {getReportTypeName({ code: item.code, name: item.name, description: '', category: '', default_format: 'pdf', template_key: '', can_generate: false, can_schedule: false }, t)}
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {item.total}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t('exports.historyTitle')}
                </h2>
                <p className="text-sm text-slate-500">
                  {t('exports.historySubtitle')}
                </p>
              </div>

              <button
                type="button"
                onClick={loadHistory}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                {t('common.refresh')}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HistoryStatCard
                label={t('exports.totalHistory')}
                value={historyStats.total}
                helper={t('exports.visibleWithFilters')}
              />
              <HistoryStatCard
                label={t('exports.generatedTodayShort')}
                value={historyStats.today}
                helper={t('exports.dayActivity')}
              />
              <HistoryStatCard
                label={t('common.last7Days')}
                value={historyStats.last7Days}
                helper={t('exports.recentPace')}
              />
              <HistoryStatCard
                label={t('exports.distinctClients')}
                value={historyStats.uniqueClients}
                helper={t('exports.historicalCoverage')}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
                <input
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder={t('exports.searchPlaceholder')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B2F4F]"
                />

                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B2F4F]"
                >
                  <option value="">{t('exports.allTypes')}</option>
                  {reportTypes.map((report) => (
                    <option key={report.code} value={report.code}>
                      {getReportTypeName(report, t)}
                    </option>
                  ))}
                </select>

                <select
                  value={filterTenant}
                  onChange={(event) => setFilterTenant(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B2F4F]"
                >
                  <option value="">{t('exports.allClients')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(event) => setFilterDateFrom(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B2F4F]"
                />

                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => setFilterDateTo(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0B2F4F]"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadHistory}
                  className="rounded-xl bg-[#0B2F4F] px-4 py-2 text-sm font-bold text-white hover:bg-[#123d63]"
                >
                  {t('exports.applyFilters')}
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  {t('exports.clear')}
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              {historyLoading ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {t('exports.loadingHistory')}
                </div>
              ) : exportsHistory.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {t('exports.noHistory')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{t('exports.report')}</th>
                        <th className="px-4 py-3">{t('common.client')}</th>
                        <th className="px-4 py-3">{t('exports.date')}</th>
                        <th className="px-4 py-3">{t('common.generatedBy')}</th>
                        <th className="px-4 py-3">{t('common.status')}</th>
                        <th className="px-4 py-3">{t('common.file')}</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {exportsHistory.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#2563eb]">
                                <TcdxIcon name={getReportIcon(report.report_type_code)} className="h-5 w-5" />
                              </div>

                              <div>
                                <div className="font-bold text-slate-800">
                                  {report.report_type_name || report.report_title}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {report.report_type_code}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {t('exports.format')}: {(report.report_format || 'pdf').toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top text-slate-600">
                            <div className="font-medium text-slate-700">
                              {report.tenant_name || '-'}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top text-slate-600">
                            {formatDate(report.generated_at, locale)}
                          </td>

                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-slate-700">
                              {report.requested_by_name || '-'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {report.requested_by_email || ''}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                                report.status
                              )}`}
                            >
                              {getStatusLabel(report.status, t)}
                            </span>
                          </td>

                          <td className="px-4 py-3 align-top">
                            <a
                              href={getAbsoluteFileUrl(report.file_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-[#0B2F4F] hover:underline"
                            >
                              {t('exports.viewPdf')}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function HeroMiniStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/65">{helper}</div>
    </div>
  );
}

function HistoryStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
