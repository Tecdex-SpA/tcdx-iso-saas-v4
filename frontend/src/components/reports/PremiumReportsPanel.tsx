'use client';

import { useEffect, useMemo, useState } from 'react';

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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function readError(json: any, fallback: string) {
  return json?.error || json?.message || json?.detail || fallback;
}

function isExecutiveRole() {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    const role = String(payload.role || payload.user_role || payload.userRole || '').toLowerCase();
    return ['viewer', 'cliente', 'client', 'read_only', 'readonly', 'solo_lectura', 'ejecutivo'].includes(role);
  } catch {
    return false;
  }
}

function sourceRefList(value: any) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : '';
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
  const [executiveRole, setExecutiveRole] = useState(false);

  useEffect(() => {
    setExecutiveRole(isExecutiveRole());
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

  const generatePreview = async () => {
    try {
      setRequestState({ loading: true, error: '' });
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
      downloadBlob(blob, `${selectedTemplate || 'reporte-premium'}.${format}`);
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
            <InfoCard label="Salida" value={[...(currentTemplate.output_modes || ['preview_json']), 'pdf', 'zip'].join(' / ')} />
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
            {requestState.loading ? 'Procesando...' : 'Generar preview'}
          </button>
          <button
            type="button"
            onClick={generateNarrative}
            disabled={!selectedTemplate || requestState.loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Generar narrativa IA
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
        <PreviewPanel preview={preview} />
        <NarrativePanel narrative={narrative} />
      </div>

      <SourcesPanel preview={preview} narrative={narrative} />

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

function PreviewPanel({ preview }: { preview: any }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">Preview estructurado</h3>
      {preview ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Vista previa generada. Requiere revisión humana antes de uso formal.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard label="Estado" value={preview.status || 'preview'} />
            <InfoCard label="Plantilla" value={preview.template_code || '-'} />
            <InfoCard label="Tenant" value={preview.tenant?.name || '-'} />
          </div>
          {(preview.sections || []).slice(0, 8).map((section: any) => (
            <div key={section.code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-bold text-slate-900">{section.title || section.code}</div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                {JSON.stringify(section.data, null, 2)}
              </pre>
            </div>
          ))}
          {(preview.warnings || []).length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {(preview.warnings || []).slice(0, 5).join(' · ')}
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
                  <th className="px-4 py-3">ID interno</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Uso</th>
                  <th className="px-4 py-3">Visibilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.slice(0, 80).map((source: any, index: number) => (
                  <tr key={`${source.source_id}-${index}`} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{source.source_id || source.ref_id || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{source.source_type}</td>
                    <td className="px-4 py-3 text-slate-700">{source.title}</td>
                    <td className="px-4 py-3 text-slate-600">{source.status}</td>
                    <td className="px-4 py-3">
                      <span className={source.used_for === 'excluded_reference' ? 'rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800' : 'text-slate-600'}>
                        {source.used_for}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{source.visibility}</td>
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
