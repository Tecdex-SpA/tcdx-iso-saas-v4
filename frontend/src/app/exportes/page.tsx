'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import AppLayout from '@/components/AppLayout';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { getUserRoleFromToken } from '@/utils/auth';
import TcdxIcon, { type TcdxIconName } from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import { translateDisplayText } from '@/i18n/displayText';
import PremiumReportsPanel from '@/components/reports/PremiumReportsPanel';
import { fetchReportCatalogBootstrap } from '@/utils/reportCatalogBootstrap';
import {
  EnterpriseFilterBar,
  EnterpriseRowActions,
  EnterpriseTableShell,
  UniversalStateBlock,
} from '@/components/ui/enterprise';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

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

type StandardMetrics = {
  catalog_coverage_pct?: number;
  tenant_control_coverage_pct?: number;
  operational_coverage_pct?: number;
  evidence_coverage_pct?: number;
  health_coverage_pct?: number;
  tenant_controls_count?: number;
  evidence_count?: number;
  expected_evidence_count?: number;
  health_records_count?: number;
  avg_health_score?: number;
  assessments_count?: number;
  risk_runs_count?: number;
  [key: string]: number | string | boolean | null | undefined;
};

type StandardOption = {
  tenant_id: string;
  standard_code: string;
  version_code: string;
  label: string;
  display_name: string;
  coverage_status: 'complete' | 'partial' | 'insufficient' | 'not_active' | 'unknown' | string;
  coverage_label: string;
  coverage_severity: 'green' | 'yellow' | 'red' | 'gray' | string;
  can_generate_executive: boolean;
  can_generate_operational: boolean;
  can_generate_audit: boolean;
  profile_key?: string | null;
  is_default_profile?: boolean;
  management_system?: string | null;
  executive_focus?: string | null;
  risk_language?: string | null;
  evidence_focus?: string | null;
  report_title?: string | null;
  chart_priority?: string[];
  metrics?: StandardMetrics;
  warnings?: string[];
};

type ReportGenerationPayload = {
  report_type_code: string;
  locale: string;
  period: string;
  model_mode: 'balanced' | 'fast';
  depth: 'balanced' | 'standard';
  quality: 'premium' | 'standard';
  use_llm: boolean;
  use_rag: boolean;
  use_web: boolean;
  use_drive: boolean;
  tenant_id?: string;
  standard_code?: string;
  version_code?: string;
  metadata: {
    source: 'frontend_exportes';
    generated_from: '/exportes';
    locale: string;
    ai_visibility_allowed: boolean;
    standard_code?: string;
    version_code?: string;
    standard_label?: string;
    coverage_status?: string;
    coverage_label?: string;
  };
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return getUserSafeReportError(error.message, fallback);

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return getUserSafeReportError(message, fallback);
  }

  return fallback;
}

function getUserSafeReportError(message: string, fallback: string) {
  if (/jwt|bearer|token|decode|payload|authorization/i.test(message)) {
    return 'Tu sesión expiró. Ingresa nuevamente.';
  }

  return message || fallback;
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

function buildLocaleHeadersForReport(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function readDownloadError(res: Response, fallback: string) {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const json = await res.json();
      return json?.error || json?.message || json?.detail || fallback;
    } catch {
      return fallback;
    }
  }

  if (contentType.includes('text/html')) {
    return 'El servidor devolvió HTML en vez del archivo esperado. Revisa sesión, permisos o proxy.';
  }

  return fallback;
}

function getDownloadFileName(res: Response, fallback: string) {
  const contentDisposition = res.headers.get('content-disposition') || '';
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const quotedMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const rawName = utf8Match?.[1] || quotedMatch?.[1] || fallback;

  try {
    return decodeURIComponent(rawName).replace(/[\\/]/g, '-');
  } catch {
    return fallback;
  }
}

async function openAuthenticatedReport(fileUrl: string, token: string) {
  const res = await fetch(getAbsoluteFileUrl(fileUrl), {
    headers: buildLocaleHeadersForReport(token),
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
    throw new Error(await readDownloadError(res, 'No fue posible descargar el reporte.'));
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = getDownloadFileName(res, 'tcdx-reporte-premium.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
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



function getReportTypeName(report: ReportType, t: (key: string) => string, locale: string = 'es') {
  const key = `exports.reportTypes.${report.code}.name`;
  const translated = t(key);
  return translated !== key ? translated : translateDisplayText(report.name, locale, 'billing');
}

function getReportTypeDescription(report: ReportType, t: (key: string) => string, locale: string = 'es') {
  const key = `exports.reportTypes.${report.code}.description`;
  const translated = t(key);
  return translated !== key ? translated : translateDisplayText(report.description, locale, 'billing');
}

function getReportIcon(code: string): TcdxIconName {
  if (code === 'executive_summary' || code === 'executive_iso_status') return 'kpi';
  if (code === 'audit_report' || code === 'internal_audit_report') return 'audit';
  if (code === 'control_status' || code === 'control_health_report') return 'check';
  if (code === 'platform_client_monthly') return 'building';
  if (code === 'maturity_gap_diagnostic') return 'document';
  if (code === 'iso_risk_report') return 'document';
  if (code === 'action_plan_report') return 'document';

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


function localizeReportType(report: ReportType, t: (key: string) => string, locale: string = 'es'): ReportType {
  return {
    ...report,
    name: getReportTypeName(report, t, locale),
    description: getReportTypeDescription(report, t, locale),
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

function getCoverageBadgeClass(severity?: string) {
  const raw = String(severity || '').toLowerCase();

  if (raw === 'green' || raw === 'complete') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (raw === 'yellow' || raw === 'partial') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (raw === 'red' || raw === 'insufficient') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function formatCoveragePct(value?: number) {
  if (value === null || value === undefined) return 'Sin datos';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'No disponible';
  return `${Math.round(n * 10) / 10}%`;
}

function getStandardFullLabel(standard?: StandardOption | null) {
  if (!standard) return 'Norma no seleccionada';

  return (
    standard.display_name ||
    standard.label ||
    `${standard.standard_code || 'ISO'}:${standard.version_code || ''}`
  );
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
  'executive_iso_status',
  'executive_summary',
  'maturity_gap_diagnostic',
  'control_health_report',
  'control_status',
  'iso_risk_report',
  'action_plan_report',
  'internal_audit_report',
  'audit_report',
  'platform_client_monthly',
];

export default function ExportesPage() {
  const { locale, t } = useTranslation();
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseReportAi = !entitlementsLoading && canUseAiFeature('report_enrichment');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reportJobMessage, setReportJobMessage] = useState('');

  const [reportTypes, setReportTypes] = useState<ReportType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [standards, setStandards] = useState<StandardOption[]>([]);
  const [standardsLoading, setStandardsLoading] = useState(false);

  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedReportCode, setSelectedReportCode] = useState('');
  const [selectedStandardKey, setSelectedStandardKey] = useState('');
  const [period, setPeriod] = useState(() => getDefaultPeriod(locale));
  const [activeTab, setActiveTab] = useState<'premium' | 'generate' | 'history'>('premium');

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

  const selectedStandard = useMemo(() => {
    return (
      standards.find(
        (standard) =>
          `${standard.standard_code}:${standard.version_code}` === selectedStandardKey
      ) || null
    );
  }, [standards, selectedStandardKey]);

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

  const loadStandards = useCallback(async (tenantId: string, reportCode?: string) => {
    if (!tenantId) {
      setStandards([]);
      setSelectedStandardKey('');
      return;
    }

    try {
      setStandardsLoading(true);

      const token = localStorage.getItem('token');

      if (!token) {
        window.location.href = '/login';
        return;
      }

      const params = appendLocaleParam(new URLSearchParams(), locale);
      params.set('tenant_id', tenantId);

      if (reportCode) {
        params.set('report_type_code', reportCode);
      }

      const res = await fetch(`${API_URL}/api/reports/standards?${params.toString()}`, {
        headers: buildLocaleHeaders(token, locale),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || 'Error obteniendo normas ISO disponibles');
      }

      const loadedStandards: StandardOption[] = json?.data || [];

      setStandards(loadedStandards);

      if (loadedStandards.length > 0) {
        setSelectedStandardKey((current) => {
          const stillExists = loadedStandards.some(
            (standard) =>
              `${standard.standard_code}:${standard.version_code}` === current
          );

          if (stillExists) return current;

          const preferred =
            loadedStandards.find(
              (standard) =>
                standard.standard_code === 'ISO27001' &&
                standard.version_code === '2022'
            ) ||
            loadedStandards.find(
              (standard) =>
                standard.standard_code === 'ISO9001' &&
                standard.version_code === '2015'
            ) ||
            loadedStandards[0];

          return `${preferred.standard_code}:${preferred.version_code}`;
        });
      } else {
        setSelectedStandardKey('');
      }
    } catch (err) {
      console.error('ERROR LOAD REPORT STANDARDS:', err);
      setStandards([]);
      setSelectedStandardKey('');
      setError(getErrorMessage(err, 'Error obteniendo normas ISO disponibles'));
    } finally {
      setStandardsLoading(false);
    }
  }, [locale]);

  const loadHistory = useCallback(async () => {
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
    } catch (err) {
      console.error('ERROR LOAD REPORT HISTORY:', err);
      setError(getErrorMessage(err, t('exports.loadHistoryError')));
    } finally {
      setHistoryLoading(false);
    }
  }, [filterDateFrom, filterDateTo, filterTenant, filterText, filterType, locale, t]);

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

        const { typesJson, clientsJson, typesStatus, clientsStatus } =
          await fetchReportCatalogBootstrap({
            apiUrl: API_URL,
            token,
            locale,
          });

        if (typesStatus < 200 || typesStatus >= 300 || (typesJson as { ok?: boolean; error?: string })?.ok === false) {
          throw new Error(
            (typesJson as { error?: string })?.error || t('exports.loadTypesError')
          );
        }

        if (clientsStatus < 200 || clientsStatus >= 300 || (clientsJson as { ok?: boolean; error?: string })?.ok === false) {
          throw new Error(
            (clientsJson as { error?: string })?.error || t('exports.loadClientsError')
          );
        }

        const loadedReports = typesJson?.data || [];
        const loadedClients = clientsJson?.data || [];

        setReportTypes(loadedReports.map((report: ReportType) => localizeReportType(report, t, locale)));
        setClients(loadedClients);

        if (loadedClients.length > 0) {
          setSelectedTenantId(loadedClients[0].id);
        }

        if (loadedReports.length > 0) {
          setSelectedReportCode(loadedReports[0].code);
        }

        if (!loadedReports.some((report: ReportType) => report.can_generate)) {
          setActiveTab('premium');
        }
      } catch (err) {
        console.error('ERROR LOAD EXPORTES:', err);
        setError(getErrorMessage(err, t('exports.loadExportsError')));
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [locale, t]);

  useEffect(() => {
    if (!loading) {
      loadHistory();
    }
  }, [loadHistory, loading]);

  useEffect(() => {
    if (!loading && selectedTenantId) {
      loadStandards(selectedTenantId, selectedReportCode || undefined);
    }
  }, [loadStandards, loading, selectedTenantId, selectedReportCode]);

  useEffect(() => {
    if (!selectedReportCode && orderedReportTypes.length > 0) {
      setSelectedReportCode(orderedReportTypes[0].code);
    }
  }, [orderedReportTypes, selectedReportCode]);

  const pollReportJob = async (jobId: string, token: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 2500 : 6000));
      const statusRes = await fetch(`${API_URL}/api/reports/jobs/${encodeURIComponent(jobId)}`, {
        headers: buildLocaleHeaders(token, locale),
      });
      const statusJson = await statusRes.json();
      if (!statusRes.ok || statusJson?.ok === false) {
        throw new Error(statusJson?.error || 'No fue posible consultar el estado del reporte.');
      }

      if (statusJson.status === 'completed') {
        const resultRes = await fetch(`${API_URL}/api/reports/jobs/${encodeURIComponent(jobId)}/result`, {
          headers: buildLocaleHeaders(token, locale),
        });
        const resultJson = await resultRes.json();
        if (!resultRes.ok || resultJson?.ok === false) {
          throw new Error(resultJson?.error || 'No fue posible obtener el reporte generado.');
        }
        return resultJson;
      }

      if (statusJson.status === 'failed') {
        throw new Error(statusJson?.error?.message || statusJson?.error || 'La generación del reporte falló.');
      }

      setReportJobMessage(`Reporte en generación (${statusJson.status}). Puedes seguir usando la plataforma.`);
    }

    throw new Error('El reporte sigue en generación. Revisa el historial de exportes en unos minutos.');
  };

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
      setReportJobMessage(t('exports.preparingDownload'));

      const token = localStorage.getItem('token');

      if (!token) {
        window.location.href = '/login';
        return;
      }

      const payload: ReportGenerationPayload = {
        report_type_code: reportTypeCode,
        locale,
        period,
        model_mode: canUseReportAi ? 'balanced' : 'fast',
        depth: canUseReportAi ? 'balanced' : 'standard',
        quality: canUseReportAi ? 'premium' : 'standard',
        use_llm: canUseReportAi,
        use_rag: canUseReportAi,
        use_web: false,
        use_drive: false,
        metadata: {
          source: 'frontend_exportes',
          generated_from: '/exportes',
          locale,
          ai_visibility_allowed: canUseReportAi,
        },
      };

      if (selectedTenantId) {
        payload.tenant_id = selectedTenantId;
      }

      if (selectedStandard) {
        payload.standard_code = selectedStandard.standard_code;
        payload.version_code = selectedStandard.version_code;
        payload.metadata = {
          ...payload.metadata,
          standard_code: selectedStandard.standard_code,
          version_code: selectedStandard.version_code,
          standard_label: getStandardFullLabel(selectedStandard),
          coverage_status: selectedStandard.coverage_status,
          coverage_label: selectedStandard.coverage_label,
        };
      }

      let res = await fetch(`${API_URL}/api/reports/generate/start`, {
        method: 'POST',
        headers: {
          ...buildLocaleHeaders(token, locale),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let json = await res.json();

      if (res.status === 404) {
        res = await fetch(`${API_URL}/api/reports/generate`, {
          method: 'POST',
          headers: {
            ...buildLocaleHeaders(token, locale),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        json = await res.json();
      }

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.detail || t('exports.generateError'));
      }

      if (res.status === 202 && json?.job_id) {
        setReportJobMessage(json?.message || t('exports.preparingDownload'));
        json = await pollReportJob(json.job_id, token);
      }

      setReportJobMessage('');
      setActiveTab('history');
      await loadHistory();

      const fileUrl = json?.data?.file_url;

      if (fileUrl) {
        await openAuthenticatedReport(fileUrl, token);
        setSuccessMessage(t('exports.downloadStarted'));
      } else {
        setSuccessMessage(t('exports.generatedSuccessfully'));
      }
    } catch (err) {
      console.error('ERROR GENERATE REPORT:', err);
      setReportJobMessage('');
      setError(getErrorMessage(err, t('exports.generateError')));
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
      <EnterpriseDomainWorkspaceShell
        domain="reports"
        eyebrow={t('exports.brand')}
        title={t('exports.title')}
        description="Los reportes ejecutivos se basan en salud ISO efectiva: controles activos en alcance, evidencia oficial, hallazgos, no conformidades y planes vencidos."
        actions={
          <a
            href="/dashboard?view=iso"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-focus)]"
          >
            Ver Centro Control ISO
            <TcdxIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
          </a>
        }
      >
      <div className="tcdx-reports-refresh space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMiniStat
                label={t('exports.reportTypesLabel')}
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
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_1.1fr_0.95fr]">
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

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Norma ISO
            </label>

            <select
              value={selectedStandardKey}
              onChange={(event) => setSelectedStandardKey(event.target.value)}
              disabled={standardsLoading || standards.length === 0}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0B2F4F] focus:ring-2 focus:ring-[#0B2F4F]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              {standards.length === 0 ? (
                <option value="">
                  {standardsLoading ? 'Cargando normas...' : 'Sin normas disponibles'}
                </option>
              ) : (
                standards.map((standard) => (
                  <option
                    key={`${standard.standard_code}:${standard.version_code}`}
                    value={`${standard.standard_code}:${standard.version_code}`}
                  >
                    {getStandardFullLabel(standard)}
                  </option>
                ))
              )}
            </select>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selectedStandard ? (
                <>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getCoverageBadgeClass(selectedStandard.coverage_severity)}`}>
                    {selectedStandard.coverage_label}
                  </span>

                  {selectedStandard.is_default_profile && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Perfil genérico
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Norma no seleccionada
                </span>
              )}
            </div>

            {selectedStandard?.metrics && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Catálogo {formatCoveragePct(selectedStandard.metrics.catalog_coverage_pct)} · Operacional {formatCoveragePct(selectedStandard.metrics.operational_coverage_pct)} · Evidencias {formatCoveragePct(selectedStandard.metrics.evidence_coverage_pct)}
              </p>
            )}

            {selectedStandard?.warnings && selectedStandard.warnings.length > 0 && (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                {selectedStandard.warnings[0]}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[#0B2F4F] p-5 text-white shadow-sm">
            <div className="flex items-start gap-4">
              {selectedClient?.logo_url ? (
                <Image
                  src={getAbsoluteFileUrl(selectedClient.logo_url)}
                  alt={selectedClient.name}
                  width={56}
                  height={56}
                  unoptimized
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

                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/75">
                    {t('common.period')}: <span className="font-semibold text-white">{period}</span>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/75">
                    Norma: <span className="font-semibold text-white">{getStandardFullLabel(selectedStandard)}</span>
                  </div>

                  {selectedStandard && (
                    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/75">
                      Cobertura: <span className="font-semibold text-white">{selectedStandard.coverage_label}</span>
                    </div>
                  )}
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
              onClick={() => setActiveTab('premium')}
              className={[
                'rounded-2xl px-4 py-3 text-sm font-bold transition',
                activeTab === 'premium'
                  ? 'bg-[#0B2F4F] text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              Reportes Premium
            </button>

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

        {reportJobMessage && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border border-indigo-200 bg-white px-5 py-4 text-sm font-semibold text-slate-800 shadow-2xl">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">
              Reportes TCDX
            </div>
            <div className="mt-1">{reportJobMessage}</div>
          </div>
        )}

        {activeTab === 'premium' && (
          <PremiumReportsPanel
            locale={locale}
            selectedStandard={selectedStandard}
          />
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
                              {getReportTypeName(report, t, locale)}
                            </h3>

                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {getReportTypeDescription(report, t, locale)}
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
                          {getReportTypeName(selectedReport, t, locale)}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-slate-500">
                      {getReportTypeDescription(selectedReport, t, locale)}
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

            <EnterpriseFilterBar
              className="mt-6"
              count={`${exportsHistory.length} exportes visibles`}
              actions={
                <>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[#0B2F4F] px-4 text-sm font-bold text-white hover:bg-[#123d63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                >
                  {t('exports.applyFilters')}
                </button>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                >
                  {t('exports.clear')}
                </button>
                </>
              }
            >
              <label className="sm:col-span-2 xl:col-span-1">
                <span className="text-xs font-bold text-slate-500">{t('common.search')}</span>
                <input
                  type="search"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder={t('exports.searchPlaceholder')}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B2F4F] focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                />
              </label>

              <label>
                <span className="text-xs font-bold text-slate-500">{t('exports.report')}</span>
                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B2F4F] focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                >
                  <option value="">{t('exports.allTypes')}</option>
                  {reportTypes.map((report) => (
                    <option key={report.code} value={report.code}>
                      {getReportTypeName(report, t, locale)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-bold text-slate-500">{t('common.client')}</span>
                <select
                  value={filterTenant}
                  onChange={(event) => setFilterTenant(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B2F4F] focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                >
                  <option value="">{t('exports.allClients')}</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-bold text-slate-500">Desde</span>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(event) => setFilterDateFrom(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B2F4F] focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                />
              </label>

              <label>
                <span className="text-xs font-bold text-slate-500">Hasta</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(event) => setFilterDateTo(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0B2F4F] focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                />
              </label>
            </EnterpriseFilterBar>

            <EnterpriseTableShell className="mt-5" density="compact" maxHeight="620px">
              {historyLoading ? (
                <UniversalStateBlock state="loading" title={t('exports.loadingHistory')} />
              ) : exportsHistory.length === 0 ? (
                <UniversalStateBlock
                  state="empty"
                  title={t('exports.noHistory')}
                  description="No hay exportes para los filtros actuales."
                />
              ) : (
                  <table className="min-w-[980px] w-full table-fixed text-left text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className="w-[28%] px-3 py-3">{t('exports.report')}</th>
                        <th scope="col" className="px-3 py-3">{t('common.client')}</th>
                        <th scope="col" className="w-[130px] px-3 py-3">{t('exports.date')}</th>
                        <th scope="col" className="px-3 py-3">{t('common.generatedBy')}</th>
                        <th scope="col" className="w-[130px] px-3 py-3">{t('common.status')}</th>
                        <th scope="col" className="w-[120px] px-3 py-3 text-right">{t('common.file')}</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {exportsHistory.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-3 align-top">
                            <div className="flex items-start gap-3">
                              <div className="hidden h-9 w-9 flex-none items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-slate-100 text-[#2563eb] sm:flex">
                                <TcdxIcon name={getReportIcon(report.report_type_code)} className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="line-clamp-2 font-bold text-slate-800">
                                  {translateDisplayText(report.report_type_name || report.report_title, locale, 'billing')}
                                </div>
                                <div className="truncate text-xs text-slate-400" title={report.report_type_code}>
                                  {report.report_type_code}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {t('exports.format')}: {(report.report_format || 'pdf').toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 align-top text-slate-600">
                            <div className="line-clamp-2 font-medium text-slate-700">
                              {translateDisplayText(report.tenant_name || '-', locale, 'adminSaas')}
                            </div>
                          </td>

                          <td className="px-3 py-3 align-top text-slate-600">
                            {formatDate(report.generated_at, locale)}
                          </td>

                          <td className="px-3 py-3 align-top">
                            <div className="line-clamp-1 font-medium text-slate-700">
                              {report.requested_by_name || '-'}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {report.requested_by_email || ''}
                            </div>
                          </td>

                          <td className="px-3 py-3 align-top">
                            <span
                              className={`rounded-[var(--tcdx-radius-tecdex-sm)] border px-2 py-1 text-xs font-bold ${getStatusClass(
                                report.status
                              )}`}
                            >
                              {getStatusLabel(report.status, t)}
                            </span>
                          </td>

                          <td className="px-3 py-3 align-top">
                            <EnterpriseRowActions>
                            <button
                              type="button"
                              onClick={() => {
                                const reportToken = localStorage.getItem('token');
                                if (!reportToken) return;
                                openAuthenticatedReport(report.file_url, reportToken).catch((err) => {
                                  setError(err.message || t('exports.loadExportsError'));
                                });
                              }}
                              className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-[#0B2F4F] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                            >
                              {t('exports.viewPdf')}
                            </button>
                            </EnterpriseRowActions>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              )}
            </EnterpriseTableShell>
          </section>
        )}
      </div>
      </EnterpriseDomainWorkspaceShell>
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
    <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
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
