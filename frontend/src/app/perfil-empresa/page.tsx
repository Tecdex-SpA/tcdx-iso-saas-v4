'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

type ProfileForm = {
  company_name: string;
  legal_name: string;
  tax_id: string;
  industry: string;
  subindustry: string;
  business_model: string;
  company_size: string;
  employee_count_range: string;
  countries_locations: string;
  main_products_services: string;
  main_customer_segments: string;
  critical_customers: string;
  critical_suppliers: string;
  active_standards: string;
  target_standards: string;
  certification_objective: string;
  certification_deadline: string;
  audit_scope: string;
  excluded_scope: string;
  current_maturity_level: string;
  previous_audit_results: string;
  critical_processes: string;
  critical_assets: string;
  key_systems: string;
  key_data_types: string;
  operational_dependencies: string;
  outsourced_processes: string;
  regulatory_constraints: string;
  strategic_objectives: string;
  quality_objectives: string;
  security_objectives: string;
  compliance_objectives: string;
  risk_appetite: string;
  improvement_priorities: string;
  pain_points: string;
  known_weaknesses: string;
  responsible_roles: string;
  management_review_cadence: string;
  internal_audit_cadence: string;
  evidence_owners: string;
  approval_workflows: string;
  preferred_language: string;
  executive_tone: string;
  industry_benchmark_notes: string;
};

type AiProfileSummary = {
  executive_narrative?: string;
  summary?: string;
};

type AiTrace = {
  selected_model?: string;
  used_web?: boolean;
  used_rag?: boolean;
  fallback_used?: boolean;
  duration_ms?: number | string | null;
};

const emptyForm: ProfileForm = {
  company_name: '',
  legal_name: '',
  tax_id: '',
  industry: '',
  subindustry: '',
  business_model: '',
  company_size: '',
  employee_count_range: '',
  countries_locations: '',
  main_products_services: '',
  main_customer_segments: '',
  critical_customers: '',
  critical_suppliers: '',
  active_standards: '',
  target_standards: '',
  certification_objective: '',
  certification_deadline: '',
  audit_scope: '',
  excluded_scope: '',
  current_maturity_level: '',
  previous_audit_results: '',
  critical_processes: '',
  critical_assets: '',
  key_systems: '',
  key_data_types: '',
  operational_dependencies: '',
  outsourced_processes: '',
  regulatory_constraints: '',
  strategic_objectives: '',
  quality_objectives: '',
  security_objectives: '',
  compliance_objectives: '',
  risk_appetite: '',
  improvement_priorities: '',
  pain_points: '',
  known_weaknesses: '',
  responsible_roles: '',
  management_review_cadence: '',
  internal_audit_cadence: '',
  evidence_owners: '',
  approval_workflows: '',
  preferred_language: 'es',
  executive_tone: 'ejecutivo_senior',
  industry_benchmark_notes: '',
};

const listFields = new Set([
  'countries_locations',
  'main_products_services',
  'main_customer_segments',
  'critical_customers',
  'critical_suppliers',
  'active_standards',
  'target_standards',
  'critical_processes',
  'critical_assets',
  'key_systems',
  'key_data_types',
  'operational_dependencies',
  'outsourced_processes',
  'regulatory_constraints',
  'strategic_objectives',
  'quality_objectives',
  'security_objectives',
  'compliance_objectives',
  'improvement_priorities',
  'pain_points',
  'known_weaknesses',
  'responsible_roles',
  'evidence_owners',
  'approval_workflows',
]);

async function readJsonResponse(res: Response, fallbackMessage: string) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(`${fallbackMessage}. Respuesta no JSON del servidor${preview ? `: ${preview}` : ''}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function toLines(value: unknown): string {
  if (Array.isArray(value)) return value.join('\n');
  return String(value || '');
}

function parseList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  name: keyof ProfileForm;
  value: string;
  onChange: (name: keyof ProfileForm, value: string) => void;
  textarea?: boolean;
}) {
  const className = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100';
  return (
    <label className={textarea ? 'md:col-span-2' : ''}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {textarea ? (
        <textarea className={className} rows={4} value={value} onChange={(event) => onChange(name, event.target.value)} />
      ) : (
        <input className={className} value={value} onChange={(event) => onChange(name, event.target.value)} />
      )}
    </label>
  );
}

export default function PerfilEmpresaPage() {
  const [token, setToken] = useState('');
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [allowWebResearch, setAllowWebResearch] = useState(false);
  const [allowDocumentContext, setAllowDocumentContext] = useState(true);
  const [allowAiRecommendations, setAllowAiRecommendations] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [aiSummary, setAiSummary] = useState<AiProfileSummary | null>(null);
  const [aiTrace, setAiTrace] = useState<AiTrace | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [operationMessage, setOperationMessage] = useState('');

  const aiNarrative = useMemo(() => {
    return aiSummary?.executive_narrative || aiSummary?.summary || '';
  }, [aiSummary]);

  const onChange = (name: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const hydrateForm = useCallback((profileJson: Record<string, unknown>) => {
    const next = { ...emptyForm };
    (Object.keys(next) as Array<keyof ProfileForm>).forEach((key) => {
      next[key] = listFields.has(key) ? toLines(profileJson[key]) : String(profileJson[key] || next[key] || '');
    });
    setForm(next);
  }, []);

  const buildPayload = () => {
    const profileJson: Record<string, string | string[]> = {};
    (Object.keys(form) as Array<keyof ProfileForm>).forEach((key) => {
      profileJson[key] = listFields.has(key) ? parseList(form[key]) : form[key];
    });
    return {
      profile_json: profileJson,
      industry: form.industry,
      subindustry: form.subindustry,
      company_size: form.company_size,
      maturity_level: form.current_maturity_level,
      risk_appetite: form.risk_appetite,
      allow_web_research: allowWebResearch,
      allow_document_context: allowDocumentContext,
      allow_ai_recommendations: allowAiRecommendations,
    };
  };

  const loadProfile = useCallback(async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/company-profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await readJsonResponse(res, 'No fue posible guardar perfil empresa');
      if (!res.ok || json?.ok === false) throw new Error(json?.error || 'No fue posible cargar perfil empresa');
      const data = json.data || {};
      hydrateForm(data.profile_json || {});
      setAllowWebResearch(data.allow_web_research === true);
      setAllowDocumentContext(data.allow_document_context !== false);
      setAllowAiRecommendations(data.allow_ai_recommendations !== false);
      setLastUpdated(data.updated_at || '');
      setAiSummary(data.ai_profile_summary_json || null);
      setAiTrace(data.ai_research_trace_json || null);
      setDownloadUrl(data.context_document_url ? '/api/company-profile/context-document/download' : '');
    } catch (error) {
      console.error('COMPANY PROFILE LOAD ERROR:', error);
    } finally {
      setLoading(false);
    }
  }, [hydrateForm]);

  useEffect(() => {
    const authToken = localStorage.getItem('token') || '';
    if (!authToken) {
      window.location.href = '/login';
      return;
    }
    setToken(authToken);
    loadProfile(authToken);
  }, [loadProfile]);

  const saveProfile = async (): Promise<boolean> => {
    if (!token) return false;
    setSaving(true);
    setOperationMessage('');
    try {
      const res = await fetch(`${API_URL}/api/company-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload()),
      });
      const json = await readJsonResponse(res, 'No fue posible guardar perfil empresa');
      if (!res.ok || json?.ok === false) throw new Error(json?.error || 'No fue posible guardar');
      setLastUpdated(json.data?.updated_at || '');
      setOperationMessage('Perfil empresa guardado.');
      return true;
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'No fue posible guardar perfil empresa');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const analyzeProfile = async () => {
    if (!token) return;
    const saved = await saveProfile();
    if (!saved) return;
    setAnalyzing(true);
    setOperationMessage('Análisis IA iniciado...');
    try {
      const res = await fetch(`${API_URL}/api/company-profile/analyze/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model_mode: 'balanced' }),
      });
      const json = await readJsonResponse(res, 'No fue posible iniciar análisis de Perfil Empresa');
      if (!res.ok || json?.ok === false || !json.job_id) throw new Error(json?.error || 'No fue posible iniciar análisis IA');
      setAnalysisJobId(json.job_id);
      setOperationMessage(json.reused ? 'Ya hay un análisis IA en ejecución para este tenant. Consultando estado...' : 'Análisis IA en cola. Puedes seguir usando la plataforma.');

      const maxWaitMs = 15 * 60 * 1000;
      const pollIntervalMs = 5000;
      const startedAt = Date.now();
      while (Date.now() - startedAt < maxWaitMs) {
        await sleep(pollIntervalMs);
        const jobRes = await fetch(`${API_URL}/api/company-profile/analyze/jobs/${json.job_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const jobJson = await readJsonResponse(jobRes, 'No fue posible consultar el estado del análisis IA');
        if (!jobRes.ok || jobJson?.ok === false) throw new Error(jobJson?.error || 'No fue posible consultar el análisis IA');

        const status = String(jobJson.status || '').toLowerCase();
        if (status === 'queued') {
          setOperationMessage('Análisis IA en cola. Esperando turno de ai-engine...');
          continue;
        }
        if (status === 'running') {
          setOperationMessage('Consultando ai-engine, Brave/web y Ollama. Esto puede tardar varios minutos.');
          continue;
        }
        if (status === 'completed') {
          const trace = jobJson.result_json?.ai_research_trace_json || {};
          await loadProfile(token);
          setAiTrace(trace);
          setOperationMessage(
            trace.fallback_used
              ? 'Análisis completado con fallback controlado. No se considera enriquecimiento IA real.'
              : `IA completada${trace.selected_model ? ` con modelo ${trace.selected_model}` : ''}${trace.used_web ? ' y referencias web.' : '.'}`
          );
          return;
        }
        if (status === 'failed') {
          const errorJson = jobJson.error_json || {};
          throw new Error(errorJson.error_message || errorJson.message || 'El análisis IA no pudo completarse.');
        }
      }
      throw new Error('El análisis IA sigue en ejecución. Revisa el estado del job más tarde.');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'No fue posible analizar perfil empresa');
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadContextDocument = async (rawUrl = downloadUrl) => {
    if (!token) {
      setOperationMessage('Tu sesión no está disponible. Vuelve a iniciar sesión para descargar el documento.');
      return;
    }

    const endpoint = rawUrl || '/api/company-profile/context-document/download';
    setOperationMessage('Preparando descarga del contexto de la organización...');

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.toLowerCase().includes('application/pdf')) {
        let message = 'No fue posible descargar el documento de contexto.';
        try {
          const json = await res.json();
          message = json?.error || json?.message || message;
        } catch {
          // La respuesta no fue JSON; mantenemos un mensaje seguro para el usuario.
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'contexto-de-la-organizacion.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setOperationMessage('Documento descargado correctamente.');
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'No fue posible descargar el documento de contexto.');
    }
  };

  const exportDocument = async () => {
    if (!token) return;
    setExporting(true);
    setOperationMessage('Generando contexto de la organización...');
    try {
      const res = await fetch(`${API_URL}/api/company-profile/export-context-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await readJsonResponse(res, 'No fue posible exportar el documento');
      if (!res.ok || json?.ok === false) throw new Error(json?.error || 'No fue posible exportar');
      const nextDownloadUrl = json.data?.download_url || '/api/company-profile/context-document/download';
      setDownloadUrl(nextDownloadUrl);
      await downloadContextDocument(nextDownloadUrl);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'No fue posible exportar el documento');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-3xl bg-[#071B3A] p-6 text-white shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">Usuarios / Perfil empresa</p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-black">Perfil empresa</h1>
                <p className="mt-2 max-w-3xl text-sm text-blue-100">
                  Contexto operativo del tenant para reportes, IA Auditor, riesgos, evidencias, KPIs y documentos ISO.
                </p>
              </div>
              <div className="text-xs text-blue-100">
                {lastUpdated ? `Última actualización: ${new Date(lastUpdated).toLocaleString('es-CL')}` : 'Sin actualización registrada'}
              </div>
            </div>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Cargando perfil empresa...</div>
          ) : (
            <>
              <Card title="General">
                <Field label="Nombre comercial" name="company_name" value={form.company_name} onChange={onChange} />
                <Field label="Razón social" name="legal_name" value={form.legal_name} onChange={onChange} />
                <Field label="RUT / Tax ID" name="tax_id" value={form.tax_id} onChange={onChange} />
                <Field label="Industria" name="industry" value={form.industry} onChange={onChange} />
                <Field label="Subindustria" name="subindustry" value={form.subindustry} onChange={onChange} />
                <Field label="Tamaño empresa" name="company_size" value={form.company_size} onChange={onChange} />
                <Field label="Modelo de negocio" name="business_model" value={form.business_model} onChange={onChange} textarea />
                <Field label="Productos/servicios principales" name="main_products_services" value={form.main_products_services} onChange={onChange} textarea />
              </Card>

              <Card title="Contexto ISO">
                <Field label="Normas activas" name="active_standards" value={form.active_standards} onChange={onChange} textarea />
                <Field label="Normas objetivo" name="target_standards" value={form.target_standards} onChange={onChange} textarea />
                <Field label="Objetivo de certificación" name="certification_objective" value={form.certification_objective} onChange={onChange} textarea />
                <Field label="Alcance auditoría" name="audit_scope" value={form.audit_scope} onChange={onChange} textarea />
                <Field label="Exclusiones" name="excluded_scope" value={form.excluded_scope} onChange={onChange} textarea />
                <Field label="Nivel de madurez actual" name="current_maturity_level" value={form.current_maturity_level} onChange={onChange} />
              </Card>

              <Card title="Operación y estrategia">
                <Field label="Procesos críticos" name="critical_processes" value={form.critical_processes} onChange={onChange} textarea />
                <Field label="Activos/sistemas críticos" name="critical_assets" value={form.critical_assets} onChange={onChange} textarea />
                <Field label="Dependencias operacionales" name="operational_dependencies" value={form.operational_dependencies} onChange={onChange} textarea />
                <Field label="Restricciones regulatorias" name="regulatory_constraints" value={form.regulatory_constraints} onChange={onChange} textarea />
                <Field label="Objetivos estratégicos" name="strategic_objectives" value={form.strategic_objectives} onChange={onChange} textarea />
                <Field label="Dolores / debilidades conocidas" name="known_weaknesses" value={form.known_weaknesses} onChange={onChange} textarea />
              </Card>

              <Card title="Gobernanza e IA">
                <Field label="Roles responsables" name="responsible_roles" value={form.responsible_roles} onChange={onChange} textarea />
                <Field label="Cadencia revisión gerencial" name="management_review_cadence" value={form.management_review_cadence} onChange={onChange} />
                <Field label="Cadencia auditoría interna" name="internal_audit_cadence" value={form.internal_audit_cadence} onChange={onChange} />
                <Field label="Dueños de evidencia" name="evidence_owners" value={form.evidence_owners} onChange={onChange} textarea />
                <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <input type="checkbox" checked={allowWebResearch} onChange={(event) => setAllowWebResearch(event.target.checked)} />
                    Web research controlado
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <input type="checkbox" checked={allowDocumentContext} onChange={(event) => setAllowDocumentContext(event.target.checked)} />
                    Contexto documental
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <input type="checkbox" checked={allowAiRecommendations} onChange={(event) => setAllowAiRecommendations(event.target.checked)} />
                    Recomendaciones IA
                  </label>
                </div>
              </Card>

              {aiNarrative && (
                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">Lectura IA del perfil</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-800">{aiNarrative}</p>
                  {aiTrace && (
                    <div className="mt-4 grid gap-2 text-xs font-semibold text-blue-900 md:grid-cols-4">
                      <span>Modelo: {aiTrace.fallback_used ? 'No disponible' : (aiTrace.selected_model || 'No informado')}</span>
                      <span>Web: {aiTrace.used_web ? 'Sí' : 'No'}</span>
                      <span>RAG: {aiTrace.used_rag ? 'Sí' : 'No'}</span>
                      <span>Duración: {aiTrace.duration_ms ? `${aiTrace.duration_ms} ms` : 'No informada'}</span>
                    </div>
                  )}
                </section>
              )}

              {operationMessage && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm">
                  {operationMessage}
                </section>
              )}

              <div className="sticky bottom-4 z-20 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
                <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar perfil'}
                </button>
                <button onClick={analyzeProfile} disabled={analyzing || saving} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                  {analyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
                {analysisJobId && analyzing && (
                  <span className="self-center text-xs font-semibold text-slate-500">Job: {analysisJobId.slice(0, 8)}...</span>
                )}
                <button onClick={exportDocument} disabled={exporting} className="rounded-xl border border-slate-200 bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  {exporting ? 'Exportando...' : 'Exportar contexto de la organización'}
                </button>
                {downloadUrl && (
                  <button type="button" onClick={() => downloadContextDocument(downloadUrl)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Descargar último PDF
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
