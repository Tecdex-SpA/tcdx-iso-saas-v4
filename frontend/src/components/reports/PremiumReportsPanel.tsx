'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type PremiumTemplate = {
  code: string;
  name: string;
  description: string;
  allowed_roles?: string[];
  supports_standard_filter?: boolean;
  supports_process_filter?: boolean;
  supports_period_filter?: boolean;
  requires_human_review?: boolean;
  output_modes?: string[];
  planned_output_modes?: string[];
};

type StandardOption = {
  standard_code: string;
  version_code?: string;
  label?: string;
  display_name?: string;
};

type PremiumReportsPanelProps = {
  locale: string;
  selectedStandard?: StandardOption | null;
};

type RequestState = {
  loading: boolean;
  error: string;
};

type ExportHistoryEntry = {
  id: string;
  generatedAt: string;
  templateCode: string;
  templateName: string;
  format: 'pdf' | 'zip';
  status: 'generado';
  userLabel: string;
  periodFrom: string;
  periodTo: string;
  standardLabel: string;
  processId: string;
  includeNarrative: boolean;
  includeSources: boolean;
  fallbackUsed: boolean;
  fileName: string;
  reviewConfirmed: boolean;
  objectUrl?: string;
};

const DEFAULT_SECTIONS = [
  'summary',
  'health',
  'kpis',
  'gaps',
  'actions',
  'risks',
  'evidence',
  'audit',
  'lifecycle',
];

const SENSITIVE_KEY_RE = /(provider_file_id|prompt|trace|chunk|raw_text|full_text|content_text|token|secret|password|authorization|download_url|internal_url)/i;

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function createDownloadUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function filenameFromDisposition(disposition: string | null, fallback: string) {
  const match = String(disposition || '').match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
}

function readError(json: any, fallback: string) {
  return json?.error || json?.message || json?.detail || fallback;
}

function parseJwtPayload() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1] || ''));
  } catch {
    return null;
  }
}

function getUserRole() {
  const payload = parseJwtPayload();
  return String(payload?.role || payload?.user_role || payload?.userRole || '').toLowerCase();
}

function getSessionIdentity() {
  const payload = parseJwtPayload() || {};
  const tenant = String(payload.tenant_id || payload.tenantId || payload.company_id || 'tenant');
  const user = String(payload.user_id || payload.userId || payload.sub || payload.email || 'user');
  const userLabel = String(payload.email || payload.name || payload.user_name || user);
  return {
    key: `tcdx:premium-report-history:${tenant}:${user}`,
    userLabel,
  };
}

function isExecutiveRole(role: string) {
  return ['viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo'].includes(role);
}

function canViewTechnicalDetail(role: string) {
  return ['admin', 'admin_cumplimiento', 'compliance_admin', 'auditor', 'auditor_iso', 'superadmin'].includes(role);
}

function toArray(value: any) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function asText(value: any, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') return fallback;
  return String(value);
}

function sourceRefList(value: any) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
}

function humanizeKey(key: string) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonForStorage(entry: ExportHistoryEntry) {
  const safe = { ...entry };
  delete safe.objectUrl;
  return safe;
}

function sanitizeTechnicalData(value: any, depth = 0): any {
  if (depth > 3) return '[detalle omitido]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeTechnicalData(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value).reduce((acc: Record<string, any>, [key, item]) => {
    if (SENSITIVE_KEY_RE.test(key)) return acc;
    acc[key] = sanitizeTechnicalData(item, depth + 1);
    return acc;
  }, {});
}

function visibleEntries(value: any, max = 8) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter(([key, item]) => !SENSITIVE_KEY_RE.test(key) && item !== null && item !== undefined && item !== '')
    .slice(0, max);
}

function sectionData(preview: any, code: string) {
  return toArray(preview?.sections).find((section: any) => section?.code === code)?.data || null;
}

function findList(data: any, keys: string[]) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function statusBadgeClass(status: any) {
  const value = String(status || '').toLowerCase();
  if (/(high|critical|critico|crítico|overdue|vencid|missing|abiert|open|red|alto)/.test(value)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (/(medium|medio|warning|partial|parcial|amber|pending|pendiente)/.test(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (/(low|bajo|green|covered|cerrad|closed|ok|complete|completo|active|activo)/.test(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function loadLocalHistory(key: string) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(key: string, entries: ExportHistoryEntry[]) {
  if (!key || typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(entries.slice(0, 20).map(safeJsonForStorage)));
}

export default function PremiumReportsPanel({ locale, selectedStandard }: PremiumReportsPanelProps) {
  const [templates, setTemplates] = useState<PremiumTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateLoading, setTemplateLoading] = useState(true);
  const [requestState, setRequestState] = useState<RequestState>({ loading: false, error: '' });
  const [preview, setPreview] = useState<any>(null);
  const [narrative, setNarrative] = useState<any>(null);
  const [scopeRecommendation, setScopeRecommendation] = useState<any>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [processId, setProcessId] = useState('');
  const [includeSources, setIncludeSources] = useState(true);
  const [includeSensitiveEvidence, setIncludeSensitiveEvidence] = useState(false);
  const [narrativeStyle, setNarrativeStyle] = useState('executive');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [scopeStandard, setScopeStandard] = useState('ISO9001');
  const [scopeLoading, setScopeLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'zip' | ''>('');
  const [userRole, setUserRole] = useState('');
  const [historyKey, setHistoryKey] = useState('');
  const [userLabel, setUserLabel] = useState('-');
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [exportSuccess, setExportSuccess] = useState('');
  const exportHistoryRef = useRef<ExportHistoryEntry[]>([]);

  const executiveRole = isExecutiveRole(userRole);

  useEffect(() => {
    setUserRole(getUserRole());
    const identity = getSessionIdentity();
    setHistoryKey(identity.key);
    setUserLabel(identity.userLabel);
    setExportHistory(loadLocalHistory(identity.key));
  }, []);

  useEffect(() => {
    exportHistoryRef.current = exportHistory;
  }, [exportHistory]);

  useEffect(() => () => {
    exportHistoryRef.current.forEach((entry) => {
      if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    });
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setTemplateLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/login';
          return;
        }
        const res = await fetch(`${API_URL}/api/reports/templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(readError(json, 'No fue posible cargar plantillas premium.'));
        }
        const loaded = Array.isArray(json.data) ? json.data : [];
        setTemplates(loaded);
        setSelectedTemplate((current) => current || loaded[0]?.code || '');
      } catch (error: any) {
        setRequestState({ loading: false, error: error.message || 'No fue posible cargar plantillas premium.' });
      } finally {
        setTemplateLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const currentTemplate = useMemo(
    () => templates.find((item) => item.code === selectedTemplate) || null,
    [templates, selectedTemplate]
  );

  const basePayload = () => ({
    template_code: selectedTemplate,
    standard_code: selectedStandard?.standard_code || undefined,
    process_id: processId.trim() || undefined,
    period_from: periodFrom || undefined,
    period_to: periodTo || undefined,
    include_sources: includeSources,
    include_sensitive_evidence: !executiveRole && includeSensitiveEvidence,
    sections: DEFAULT_SECTIONS,
    narrative_style: narrativeStyle,
    language: locale === 'en' ? 'en' : 'es',
    max_source_items: 30,
  });

  const updateHistory = (nextEntries: ExportHistoryEntry[]) => {
    setExportHistory(nextEntries);
    saveLocalHistory(historyKey, nextEntries);
  };

  const generatePreview = async () => {
    try {
      setRequestState({ loading: true, error: '' });
      setExportSuccess('');
      setPreview(null);
      setNarrative(null);
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`${API_URL}/api/reports/preview`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(basePayload()),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(readError(json, 'No fue posible generar preview.'));
      }
      setPreview(json.data);
    } catch (error: any) {
      setRequestState({ loading: false, error: error.message || 'No fue posible generar preview.' });
      return;
    }
    setRequestState({ loading: false, error: '' });
  };

  const generateNarrative = async () => {
    try {
      setRequestState({ loading: true, error: '' });
      setExportSuccess('');
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`${API_URL}/api/reports/narrative`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(basePayload()),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(readError(json, 'No fue posible generar narrativa.'));
      }
      setNarrative(json.data);
      setPreview((current: any) => current || {
        template_code: json.data.template_code,
        tenant: json.data.tenant,
        filters: json.data.filters,
        sources: json.data.sources,
        warnings: json.data.warnings,
        sections: [],
      });
    } catch (error: any) {
      setRequestState({ loading: false, error: error.message || 'No fue posible generar narrativa.' });
      return;
    }
    setRequestState({ loading: false, error: '' });
  };

  const exportReport = async (format: 'pdf' | 'zip') => {
    try {
      setExporting(format);
      setRequestState({ loading: false, error: '' });
      setExportSuccess('');
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`${API_URL}/api/reports/export/${format}`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          ...basePayload(),
          include_narrative: Boolean(narrative),
          review_confirmed: reviewConfirmed,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('application/json')) {
        const json = contentType.includes('application/json') ? await res.json() : {};
        throw new Error(readError(json, 'No fue posible exportar el reporte.'));
      }
      const blob = await res.blob();
      const fileName = filenameFromDisposition(
        res.headers.get('content-disposition'),
        `${selectedTemplate || 'reporte-premium'}.${format}`
      );
      const objectUrl = createDownloadUrl(blob);
      triggerDownload(objectUrl, fileName);
      const entry: ExportHistoryEntry = {
        id: safeId(),
        generatedAt: new Date().toISOString(),
        templateCode: selectedTemplate,
        templateName: currentTemplate?.name || preview?.template_code || selectedTemplate,
        format,
        status: 'generado',
        userLabel,
        periodFrom,
        periodTo,
        standardLabel: selectedStandard?.label || selectedStandard?.display_name || selectedStandard?.standard_code || '-',
        processId: processId.trim(),
        includeNarrative: Boolean(narrative),
        includeSources,
        fallbackUsed: Boolean(narrative?.fallback_used),
        fileName,
        reviewConfirmed: true,
        objectUrl,
      };
      updateHistory([entry, ...exportHistory].slice(0, 20));
      setExportSuccess(`${format.toUpperCase()} generado y agregado al historial premium.`);
    } catch (error: any) {
      setRequestState({ loading: false, error: error.message || 'No fue posible exportar el reporte.' });
    } finally {
      setExporting('');
    }
  };

  const generateScopeRecommendation = async () => {
    try {
      setScopeLoading(true);
      setRequestState({ loading: false, error: '' });
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`${API_URL}/api/iso-scope/recommendations`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          standard_code: scopeStandard,
          process_id: processId.trim() || undefined,
          include_ai: true,
          include_sources: true,
          mode: 'scope_recommendation',
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(readError(json, 'No fue posible generar recomendación de alcance.'));
      }
      setScopeRecommendation(json.data);
    } catch (error: any) {
      setRequestState({ loading: false, error: error.message || 'No fue posible generar recomendación de alcance.' });
    } finally {
      setScopeLoading(false);
    }
  };

  const clearHistory = () => {
    exportHistory.forEach((entry) => {
      if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    });
    updateHistory([]);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Reportes Premium
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              Preview, narrativa, fuentes y export PDF/ZIP
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Flujo revisable basado en Sprint 6.1, 6.2 y 6.2A. Todo export requiere confirmación humana y no constituye certificación ni aprobación automática.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Revisión humana obligatoria antes de exportar.
          </div>
        </div>

        {requestState.error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {requestState.error}
          </div>
        )}
        {exportSuccess && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {exportSuccess}
          </div>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Plantilla
            </label>
            <select
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
              disabled={templateLoading}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0B2F4F]"
            >
              {templates.map((template) => (
                <option key={template.code} value={template.code}>
                  {template.name}
                </option>
              ))}
            </select>
            {templateLoading && (
              <div className="mt-2 text-xs font-semibold text-slate-400">Cargando plantillas...</div>
            )}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Desde
            </label>
            <input
              type="date"
              value={periodFrom}
              onChange={(event) => setPeriodFrom(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-[#0B2F4F]"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Hasta
            </label>
            <input
              type="date"
              value={periodTo}
              onChange={(event) => setPeriodTo(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-[#0B2F4F]"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Proceso UUID
            </label>
            <input
              value={processId}
              onChange={(event) => setProcessId(event.target.value)}
              placeholder="Opcional"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-[#0B2F4F]"
            />
          </div>
        </div>

        {currentTemplate && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoCard label="Descripción" value={currentTemplate.description} />
            <InfoCard label="Roles permitidos" value={(currentTemplate.allowed_roles || []).join(', ') || 'Según backend'} />
            <InfoCard label="Salida" value={[...(currentTemplate.output_modes || ['preview']), 'pdf', 'zip'].join(' / ')} />
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={includeSources} onChange={(event) => setIncludeSources(event.target.checked)} />
            Incluir fuentes
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={!executiveRole && includeSensitiveEvidence}
              disabled={executiveRole}
              onChange={(event) => setIncludeSensitiveEvidence(event.target.checked)}
            />
            Evidencia sensible
          </label>
          <select
            value={narrativeStyle}
            onChange={(event) => setNarrativeStyle(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="executive">Narrativa ejecutiva</option>
            <option value="audit">Narrativa auditoría</option>
            <option value="operational">Narrativa operacional</option>
          </select>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Idioma: {locale === 'en' ? 'English' : 'Español'}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={generatePreview}
            disabled={!selectedTemplate || requestState.loading}
            className="rounded-xl bg-[#0B2F4F] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {requestState.loading ? 'Generando preview...' : 'Generar preview'}
          </button>
          <button
            type="button"
            onClick={generateNarrative}
            disabled={!selectedTemplate || requestState.loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {requestState.loading ? 'Generando narrativa...' : 'Generar narrativa IA'}
          </button>
          <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => setReviewConfirmed(event.target.checked)}
            />
            Confirmo revisión humana
          </label>
          <button
            type="button"
            onClick={() => exportReport('pdf')}
            disabled={!reviewConfirmed || exporting !== ''}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {exporting === 'pdf' ? 'Exportando PDF...' : 'Exportar PDF'}
          </button>
          <button
            type="button"
            onClick={() => exportReport('zip')}
            disabled={!reviewConfirmed || exporting !== ''}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {exporting === 'zip' ? 'Exportando ZIP...' : 'Exportar ZIP'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <PreviewPanel preview={preview} userRole={userRole} />
        <NarrativePanel narrative={narrative} />
      </div>

      <SourcesPanel preview={preview} narrative={narrative} />

      <ScopeRecommendationPanel
        scopeStandard={scopeStandard}
        setScopeStandard={setScopeStandard}
        scopeLoading={scopeLoading}
        scopeRecommendation={scopeRecommendation}
        generateScopeRecommendation={generateScopeRecommendation}
      />

      <PremiumHistoryPanel
        history={exportHistory}
        onDownload={(entry) => {
          if (entry.objectUrl) triggerDownload(entry.objectUrl, entry.fileName);
        }}
        onClear={clearHistory}
      />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold leading-5 text-slate-800">{value || '-'}</div>
    </div>
  );
}

function Badge({ value }: { value: any }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(value)}`}>
      {asText(value)}
    </span>
  );
}

function PreviewPanel({ preview, userRole }: { preview: any; userRole: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Preview estructurado</h3>
      {preview ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Vista previa generada. Requiere revisión humana antes de uso formal.
          </div>
          <PreviewSummary preview={preview} />
          <MetricCards preview={preview} />
          {toArray(preview.sections).slice(0, 12).map((section: any) => (
            <ReportPreviewSection
              key={section.code || section.title}
              section={section}
              userRole={userRole}
            />
          ))}
          {(preview.warnings || []).length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="mb-2 font-bold">Warnings principales</div>
              <ul className="list-disc space-y-1 pl-5">
                {(preview.warnings || []).slice(0, 6).map((warning: string, index: number) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Genera preview para ver secciones, health, brechas, controles, evidencias, riesgos y warnings.
        </div>
      )}
    </div>
  );
}

function PreviewSummary({ preview }: { preview: any }) {
  const filters = preview.filters || {};
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <InfoCard label="Estado" value={preview.status || 'preview'} />
      <InfoCard label="Plantilla" value={preview.template_code || '-'} />
      <InfoCard label="Tenant" value={preview.tenant?.name || '-'} />
      <InfoCard label="Periodo" value={`${filters.period_from || '-'} a ${filters.period_to || '-'}`} />
      <InfoCard label="Generado" value={preview.generated_at || '-'} />
      <InfoCard label="Revisión humana" value={preview.requires_human_review ? 'Requerida' : 'No informada'} />
    </div>
  );
}

function MetricCards({ preview }: { preview: any }) {
  const health = sectionData(preview, 'health');
  const gaps = sectionData(preview, 'gaps');
  const risks = sectionData(preview, 'risks');
  const evidence = sectionData(preview, 'evidence');
  const controls = sectionData(preview, 'controls');
  const metrics = [
    { label: 'Health global', value: health?.summary?.global_score ?? health?.summary?.score ?? '-' },
    { label: 'Estado health', value: health?.summary?.label || health?.summary?.status || '-' },
    { label: 'Controles aplicables', value: controls?.totals?.applicable ?? '-' },
    { label: 'Brechas abiertas', value: gaps?.totals?.open ?? '-' },
    { label: 'Riesgos altos', value: risks?.totals?.high_or_critical ?? '-' },
    { label: 'Evidencias activas', value: evidence?.totals?.active ?? '-' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{metric.label}</div>
          <div className="mt-2 text-2xl font-black text-slate-900">{asText(metric.value)}</div>
        </div>
      ))}
    </div>
  );
}

function ReportPreviewSection({ section, userRole }: { section: any; userRole: string }) {
  const code = String(section?.code || '').toLowerCase();
  const title = section?.title || humanizeKey(code);
  const data = section?.data;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-slate-900">{title}</div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{code || 'seccion'}</span>
      </div>
      {code === 'summary' && <SummarySection data={data} />}
      {code === 'health' && <HealthSection data={data} />}
      {code === 'kpis' && <KpiTable data={data} />}
      {code === 'gaps' && <GapsSection data={data} />}
      {code === 'actions' && <ActionsSection data={data} />}
      {code === 'risks' && <RisksSection data={data} />}
      {code === 'evidence' && <EvidenceSection data={data} />}
      {code === 'controls' && <ControlsSection data={data} />}
      {code === 'audit' && <SimpleListSection data={data} keys={['audits', 'findings', 'nonconformities']} titleKey="title" />}
      {code === 'lifecycle' && <SimpleListSection data={data} keys={['transitions', 'stages', 'items']} titleKey="standard_code" />}
      {!['summary', 'health', 'kpis', 'gaps', 'actions', 'risks', 'evidence', 'controls', 'audit', 'lifecycle'].includes(code) && (
        <GenericKeyValuePanel data={data} />
      )}
      {canViewTechnicalDetail(userRole) && (
        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">
            Ver detalle técnico sanitizado
          </summary>
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {JSON.stringify(sanitizeTechnicalData(data), null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function SummarySection({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-slate-600">
        {asText(data?.recommendation_management || data?.executive_summary || data?.summary || data?.disclaimer, 'Resumen estructurado generado desde datos internos del reporte.')}
      </p>
      <GenericKeyValuePanel data={data} />
    </div>
  );
}

function HealthSection({ data }: { data: any }) {
  const summary = data?.summary || {};
  const dimensions = findList(data, ['dimensions', 'by_dimension', 'health_by_dimension', 'by_standard', 'by_process']);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard label="Score global" value={asText(summary.global_score ?? summary.score)} />
        <InfoCard label="Estado" value={asText(summary.label || summary.status)} />
        <InfoCard label="Cobertura" value={asText(summary.coverage || summary.coverage_percentage)} />
      </div>
      {toArray(summary.drivers).length > 0 && (
        <ListBlock title="Drivers" items={toArray(summary.drivers)} />
      )}
      {dimensions.length > 0 && (
        <SimpleTable
          columns={[
            ['name', 'Dimensión'],
            ['standard_code', 'Norma'],
            ['process_name', 'Proceso'],
            ['score', 'Score'],
            ['status', 'Estado'],
          ]}
          rows={dimensions}
        />
      )}
      <GenericKeyValuePanel data={data} />
    </div>
  );
}

function KpiTable({ data }: { data: any }) {
  const rows = findList(data, ['kpis', 'items', 'rows', 'metrics']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['code', 'Código'],
        ['name', 'Nombre'],
        ['value', 'Valor'],
        ['unit', 'Unidad'],
        ['status', 'Estado'],
        ['description', 'Descripción'],
      ]}
      rows={rows}
    />
  );
}

function GapsSection({ data }: { data: any }) {
  const rows = findList(data, ['gaps', 'items', 'findings', 'rows']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['title', 'Brecha'],
        ['severity', 'Severidad'],
        ['status', 'Estado'],
        ['process_name', 'Proceso'],
        ['control_code', 'Control'],
        ['missing_evidence', 'Evidencia faltante'],
        ['recommended_action', 'Acción sugerida'],
      ]}
      rows={rows}
    />
  );
}

function ActionsSection({ data }: { data: any }) {
  const rows = findList(data, ['actions', 'items', 'action_plans', 'rows']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['title', 'Acción'],
        ['status', 'Estado'],
        ['priority', 'Prioridad'],
        ['due_date', 'Vencimiento'],
        ['owner_name', 'Responsable'],
      ]}
      rows={rows}
    />
  );
}

function RisksSection({ data }: { data: any }) {
  const rows = findList(data, ['risks', 'items', 'rows']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['title', 'Riesgo'],
        ['risk_level', 'Nivel'],
        ['residual_risk_level', 'Residual'],
        ['treatment_status', 'Tratamiento'],
        ['process_name', 'Proceso'],
        ['source_ref', 'Fuente'],
      ]}
      rows={rows}
    />
  );
}

function EvidenceSection({ data }: { data: any }) {
  const rows = findList(data, ['evidence', 'active', 'missing', 'items', 'rows']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['title', 'Evidencia'],
        ['document_type', 'Tipo'],
        ['status', 'Estado'],
        ['source_type', 'Source type'],
        ['used_for', 'Uso'],
        ['visibility', 'Visibilidad'],
      ]}
      rows={rows}
    />
  );
}

function ControlsSection({ data }: { data: any }) {
  const rows = findList(data, ['controls', 'items', 'rows']);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <SimpleTable
      columns={[
        ['code', 'Control'],
        ['name', 'Nombre'],
        ['status', 'Estado'],
        ['evidence_status', 'Evidencia'],
        ['process_name', 'Proceso'],
      ]}
      rows={rows}
    />
  );
}

function SimpleListSection({ data, keys, titleKey }: { data: any; keys: string[]; titleKey: string }) {
  const rows = findList(data, keys);
  if (!rows.length) return <GenericKeyValuePanel data={data} />;
  return (
    <div className="space-y-3">
      {rows.slice(0, 10).map((item: any, index: number) => (
        <div key={`${asText(item?.[titleKey])}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-bold text-slate-900">{asText(item?.[titleKey] || item?.name || item?.title, 'Registro')}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {visibleEntries(item, 6).map(([key, value]) => (
              <div key={key} className="text-sm text-slate-600">
                <span className="font-semibold text-slate-400">{humanizeKey(key)}:</span> {asText(value)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ columns, rows }: { columns: string[][]; rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map(([key, label]) => (
                <th key={key} className="px-3 py-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 12).map((row, index) => (
              <tr key={row?.id || row?.code || row?.title || index} className="align-top">
                {columns.map(([key]) => (
                  <td key={key} className="max-w-[260px] px-3 py-3 text-slate-700">
                    {/(status|severity|priority|level|residual)/i.test(key)
                      ? <Badge value={row?.[key]} />
                      : <span className="line-clamp-3">{asText(row?.[key])}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 12 && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          Mostrando 12 de {rows.length} registros.
        </div>
      )}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
        {items.slice(0, 8).map((item, index) => (
          <li key={`${asText(item)}-${index}`}>{asText(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function GenericKeyValuePanel({ data }: { data: any }) {
  const entries = visibleEntries(data, 8);
  if (!entries.length) {
    return <div className="text-sm text-slate-500">Sin datos estructurados para esta sección.</div>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{humanizeKey(key)}</div>
          <div className="mt-1 font-semibold text-slate-700">
            {typeof value === 'object' ? `${toArray(value).length || Object.keys(value || {}).length} registros` : asText(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function NarrativePanel({ narrative }: { narrative: any }) {
  const data = narrative?.narrative;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Narrativa IA / fallback</h3>
      {data ? (
        <div className="mt-4 space-y-4">
          {narrative.fallback_used && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              No fue posible generar narrativa IA. Se muestra narrativa determinística basada en datos del reporte.
            </div>
          )}
          <p className="text-sm leading-6 text-slate-600">{data.executive_summary}</p>
          <div className="space-y-3">
            {(data.key_findings || []).slice(0, 6).map((item: any, index: number) => (
              <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-bold text-slate-900">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="mt-2 text-xs font-semibold text-slate-400">{item.severity} · {sourceRefList(item.source_refs)}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <strong>Limitaciones:</strong> {(data.limitations || []).join(' · ')}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
            {data.disclaimer}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Genera narrativa para ver resumen ejecutivo, hallazgos, acciones, limitaciones y disclaimer.
        </div>
      )}
    </div>
  );
}

function SourcesPanel({ preview, narrative }: { preview: any; narrative: any }) {
  const sources = preview?.sources || narrative?.sources || [];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Fuentes del reporte</h3>
      {sources.length ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Source ref</th>
                  <th className="px-4 py-3">ID interno</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Uso</th>
                  <th className="px-4 py-3">Visibilidad</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.slice(0, 80).map((source: any, index: number) => (
                  <tr key={`${source.source_id}-${index}`} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{source.ref_id || `source_${index + 1}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{source.source_id || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{source.source_type}</td>
                    <td className="px-4 py-3 text-slate-700">{source.title}</td>
                    <td className="px-4 py-3 text-slate-600">{source.status}</td>
                    <td className="px-4 py-3">
                      <span className={source.used_for === 'excluded_reference' ? 'rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800' : 'text-slate-600'}>
                        {source.used_for}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{source.visibility}</td>
                    <td className="px-4 py-3 text-slate-600">{source.provider || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{source.reference_table || source.reference_type || source.internal_reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Sin fuentes cargadas todavía. Activa incluir fuentes y genera preview o narrativa.
        </div>
      )}
    </div>
  );
}

function ScopeRecommendationPanel({
  scopeStandard,
  setScopeStandard,
  scopeLoading,
  scopeRecommendation,
  generateScopeRecommendation,
}: {
  scopeStandard: string;
  setScopeStandard: (value: string) => void;
  scopeLoading: boolean;
  scopeRecommendation: any;
  generateScopeRecommendation: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Recomendación de alcance ISO
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            La certificación aplica al sistema de gestión definido en un alcance. Esta recomendación orienta qué procesos, áreas u operaciones evaluar para incluir en el alcance.
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={scopeStandard}
            onChange={(event) => setScopeStandard(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="ISO9001">ISO 9001</option>
            <option value="ISO27001">ISO 27001</option>
          </select>
          <button
            type="button"
            onClick={generateScopeRecommendation}
            disabled={scopeLoading}
            className="rounded-xl bg-[#0B2F4F] px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
          >
            {scopeLoading ? 'Generando...' : 'Generar alcance'}
          </button>
        </div>
      </div>

      {scopeRecommendation ? (
        <div className="mt-5 space-y-3">
          {(scopeRecommendation.recommendations || []).slice(0, 8).map((item: any, index: number) => (
            <div key={`${item.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">{item.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{item.scope_item_type}</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  {item.priority} · {item.confidence}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>
              <div className="mt-3 text-sm text-slate-700">
                <strong>Riesgo de exclusión:</strong> {item.risk_if_excluded}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.evidence_needed || []).slice(0, 5).map((evidence: string) => (
                  <span key={evidence} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {evidence}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Genera una recomendación para ver procesos, áreas u operaciones sugeridas con evidencia y riesgo de exclusión.
        </div>
      )}
    </div>
  );
}

function PremiumHistoryPanel({
  history,
  onDownload,
  onClear,
}: {
  history: ExportHistoryEntry[];
  onDownload: (entry: ExportHistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Historial de Reportes Premium
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">Últimas exportaciones</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Historial local por tenant/usuario. Guarda solo metadata mínima, sin tokens, contenido del reporte ni fuentes completas.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!history.length}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Limpiar historial
        </button>
      </div>

      {history.length ? (
        <div className="mt-5 space-y-3">
          {history.slice(0, 10).map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#0B2F4F] px-2.5 py-1 text-xs font-bold text-white">
                      {entry.format.toUpperCase()}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      Revisión humana confirmada
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                      {entry.includeNarrative ? (entry.fallbackUsed ? 'Narrativa fallback' : 'Narrativa IA') : 'Sin narrativa'}
                    </span>
                  </div>
                  <div className="mt-3 font-bold text-slate-900">{entry.templateName}</div>
                  <div className="mt-1 text-xs font-mono text-slate-500">{entry.templateCode}</div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                    <div><strong>Fecha:</strong> {new Date(entry.generatedAt).toLocaleString('es-CL')}</div>
                    <div><strong>Usuario:</strong> {entry.userLabel || '-'}</div>
                    <div><strong>Archivo:</strong> {entry.fileName}</div>
                    <div><strong>Periodo:</strong> {entry.periodFrom || '-'} a {entry.periodTo || '-'}</div>
                    <div><strong>Norma:</strong> {entry.standardLabel || '-'}</div>
                    <div><strong>Proceso:</strong> {entry.processId || '-'}</div>
                    <div><strong>Fuentes:</strong> {entry.includeSources ? 'Incluidas' : 'No incluidas'}</div>
                    <div><strong>Estado:</strong> generado</div>
                  </div>
                  {!entry.objectUrl && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Disponible solo durante la sesión actual. Vuelva a exportar para descargar nuevamente.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDownload(entry)}
                  disabled={!entry.objectUrl}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Descargar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Aún no hay exportaciones premium en el historial local. Exporta un PDF o ZIP para agregar la primera entrada.
        </div>
      )}
    </div>
  );
}
