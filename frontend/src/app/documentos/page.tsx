'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { getStoredValidToken, getTenantIdFromToken } from '@/utils/auth';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type GeneratorOption = {
  standard_code: string;
  version_code: string;
  display_name: string;
  publication_status: string;
  certifiable: boolean;
  catalog_coverage_pct: number;
  sync_status?: string;
  latest_assessment?: {
    id: string;
    readiness_score?: string | number;
    readiness_level?: string;
    created_at?: string;
  } | null;
  warnings?: string[];
};

type TemplateOption = {
  id?: string | null;
  document_type: string;
  template_code: string;
  title: string;
  objective?: string;
  template_kind?: string;
};

type GeneratedDocument = {
  id: string;
  title: string;
  standard_code: string;
  version_code: string;
  document_type: string;
  template_code?: string;
  document_status: string;
  version: number;
  created_at?: string;
  disclaimer?: string;
  content_markdown?: string;
  source_trace_json?: unknown;
};

type GenerateResponse = {
  document?: GeneratedDocument;
  markdown_preview?: string;
  source_trace?: unknown;
};

const DOCUMENT_TYPES = [
  { value: 'policy', label: 'Politica' },
  { value: 'procedure', label: 'Procedimiento' },
  { value: 'transition_guidance', label: 'Transicion ISO9001 FDIS' },
  { value: 'ai_governance_document', label: 'Gobernanza IA' },
  { value: 'security_document', label: 'Seguridad ISO27001' },
  { value: 'quality_document', label: 'Calidad ISO9001' },
];

function optionKey(option: GeneratorOption) {
  return `${option.standard_code}:${option.version_code}`;
}

function parseOptionKey(value: string) {
  const [standard_code, version_code] = String(value || '').split(':');
  return { standard_code, version_code };
}

function tokenHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function DocumentosPage() {
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseDocumentAi = !entitlementsLoading && canUseAiFeature('document_generation');
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [options, setOptions] = useState<GeneratorOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [selectedOptionKey, setSelectedOptionKey] = useState('');
  const [documentType, setDocumentType] = useState('policy');
  const [templateCode, setTemplateCode] = useState('');
  const [scope, setScope] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [detail, setDetail] = useState<GenerateResponse | null>(null);

  const selectedOption = useMemo(
    () => options.find((item) => optionKey(item) === selectedOptionKey),
    [options, selectedOptionKey]
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.template_code === templateCode),
    [templates, templateCode]
  );

  const loadDocuments = async (tenant: string, authToken: string) => {
    const res = await fetch(`${API_URL}/api/iso-document-generator/${tenant}/documents`, {
      headers: tokenHeaders(authToken),
    });
    const json = await res.json();

    if (!res.ok) {
      console.error('ERROR LOAD ISO DOCUMENTS:', json);
      setDocuments([]);
      return;
    }

    setDocuments(Array.isArray(json?.data) ? json.data : []);
  };

  const loadOptions = async (tenant: string, authToken: string) => {
    const res = await fetch(`${API_URL}/api/iso-document-generator/${tenant}/options`, {
      headers: tokenHeaders(authToken),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error || 'No fue posible cargar opciones documentales');
    }

    const loadedOptions = Array.isArray(json?.data?.options) ? json.data.options : [];
    setOptions(loadedOptions);
    setSelectedOptionKey((prev) => {
      if (loadedOptions.some((item: GeneratorOption) => optionKey(item) === prev)) return prev;
      const preferred =
        loadedOptions.find((item: GeneratorOption) => item.standard_code === 'ISO9001' && item.version_code === '2015') ||
        loadedOptions[0];
      return preferred ? optionKey(preferred) : '';
    });
  };

  const loadTemplates = async (tenant: string, authToken: string, standardCode: string, versionCode: string, type: string) => {
    if (!standardCode || !versionCode) {
      setTemplates([]);
      setTemplateCode('');
      return;
    }

    const params = new URLSearchParams({
      standard_code: standardCode,
      version_code: versionCode,
      document_type: type,
    });
    const res = await fetch(
      `${API_URL}/api/iso-document-generator/${tenant}/templates?${params.toString()}`,
      {
        headers: tokenHeaders(authToken),
      }
    );
    const json = await res.json();

    if (!res.ok) {
      console.error('ERROR LOAD ISO DOCUMENT TEMPLATES:', json);
      setTemplates([]);
      setTemplateCode('');
      return;
    }

    const loadedTemplates = Array.isArray(json?.data) ? json.data : [];
    setTemplates(loadedTemplates);
    setTemplateCode((prev) => {
      if (loadedTemplates.some((item: TemplateOption) => item.template_code === prev)) return prev;
      return loadedTemplates[0]?.template_code || '';
    });
  };

  useEffect(() => {
    const authToken = getStoredValidToken();
    const currentTenantId = getTenantIdFromToken();

    if (!authToken || !currentTenantId) {
      setLoading(false);
      setError('Sesion no disponible. Inicia sesion nuevamente.');
      return;
    }

    setToken(authToken);
    setTenantId(currentTenantId);

    Promise.all([
      loadOptions(currentTenantId, authToken),
      loadDocuments(currentTenantId, authToken),
    ])
      .catch((err: unknown) => {
        console.error('ERROR LOAD ISO DOCUMENT GENERATOR:', err);
        setError(getErrorMessage(err, 'Error cargando generador documental'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token || !tenantId || !selectedOptionKey) return;
    const selected = parseOptionKey(selectedOptionKey);

    void loadTemplates(
      tenantId,
      token,
      selected.standard_code,
      selected.version_code,
      documentType
    );
  }, [token, tenantId, selectedOptionKey, documentType]);

  useEffect(() => {
    if (!canUseDocumentAi && documentType === 'ai_governance_document') {
      setDocumentType('policy');
      return;
    }

    if (selectedOption?.version_code === '2026_FDIS') {
      setDocumentType('transition_guidance');
      return;
    }

    if (canUseDocumentAi && selectedOption?.standard_code === 'ISO42001') {
      setDocumentType('ai_governance_document');
      return;
    }
  }, [canUseDocumentAi, documentType, selectedOption?.standard_code, selectedOption?.version_code]);

  const generateDocument = async () => {
    if (!token || !tenantId || !selectedOption) return;

    try {
      setGenerating(true);
      setError('');
      setResult(null);

      const res = await fetch(`${API_URL}/api/iso-document-generator/${tenantId}/generate`, {
        method: 'POST',
        headers: {
          ...tokenHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          standard_code: selectedOption.standard_code,
          version_code: selectedOption.version_code,
          document_type: documentType,
          template_code: templateCode,
          source_assessment_id: selectedOption.latest_assessment?.id || null,
          language: 'es',
          variables: {
            scope,
            responsible_roles: ['Direccion', 'Responsable de cumplimiento', 'Dueno de proceso'],
          },
          use_ai: false,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'No fue posible generar el documento');
      }

      setResult(json?.data || null);
      await loadDocuments(tenantId, token);
    } catch (err: unknown) {
      console.error('ERROR GENERATE ISO DOCUMENT:', err);
      setError(getErrorMessage(err, 'Error generando documento'));
    } finally {
      setGenerating(false);
    }
  };

  const openDocument = async (documentId: string) => {
    if (!token || !tenantId) return;

    const res = await fetch(`${API_URL}/api/iso-document-generator/${tenantId}/documents/${documentId}`, {
      headers: tokenHeaders(token),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json?.error || 'No fue posible abrir documento');
      return;
    }

    setDetail({
      document: json?.data?.document,
      markdown_preview: json?.data?.document?.content_markdown,
      source_trace: json?.data?.source_trace,
    });
  };

  const archiveDocument = async (documentId: string) => {
    if (!token || !tenantId) return;
    const ok = window.confirm('Archivar este documento generado?');
    if (!ok) return;

    const res = await fetch(`${API_URL}/api/iso-document-generator/${tenantId}/documents/${documentId}/archive`, {
      method: 'POST',
      headers: tokenHeaders(token),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json?.error || 'No fue posible archivar documento');
      return;
    }

    await loadDocuments(tenantId, token);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-6">Cargando generador documental...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#edf4ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap justify-between gap-5 items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                <TcdxIcon name="document" className="h-4 w-4" />
                Generador ISO
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-950">Generador documental ISO</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Políticas y procedimientos desde conocimiento ISO, diagnóstico express y mapeos gobernados.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              Base documental lista para revisión y ajuste humano.
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] space-y-4">
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Norma/version</label>
              <select
                value={selectedOptionKey}
                onChange={(e) => setSelectedOptionKey(e.target.value)}
                className="w-full border rounded p-2"
              >
                {options.map((option) => (
                  <option key={optionKey(option)} value={optionKey(option)}>
                    {option.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Tipo documento</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full border rounded p-2"
              >
                {DOCUMENT_TYPES.filter((item) => canUseDocumentAi || item.value !== 'ai_governance_document').map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Template</label>
              <select
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                className="w-full border rounded p-2"
              >
                {templates.map((template) => (
                  <option key={template.template_code} value={template.template_code}>
                    {template.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Diagnostico fuente</label>
              <div className="border rounded p-2 text-sm bg-slate-50 min-h-[42px]">
                {selectedOption?.latest_assessment
                  ? `${Math.round(Number(selectedOption.latest_assessment.readiness_score || 0))}% · ${selectedOption.latest_assessment.readiness_level || '-'}`
                  : 'Sin diagnostico previo'}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Alcance opcional</label>
            <input
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Ej: Sistema de gestion corporativo"
              className="w-full border rounded p-2"
            />
          </div>

          {selectedOption?.warnings && selectedOption.warnings.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {selectedOption.warnings.map((warning, index) => (
                <span
                  key={`warning-${index}`}
                  className="px-2 py-1 rounded bg-yellow-50 text-yellow-800 border border-yellow-200"
                >
                  {warning}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={generateDocument}
              disabled={generating || !selectedOption || !templateCode}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white whitespace-nowrap shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generando...' : 'Generar documento'}
            </button>

            {selectedTemplate && (
              <span className="text-sm text-gray-500">
                {selectedTemplate.template_kind === 'virtual' ? 'Template virtual gobernado' : selectedTemplate.template_code}
              </span>
            )}
          </div>
        </div>

        {(result?.markdown_preview || detail?.markdown_preview) && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] space-y-3">
            <div className="flex justify-between gap-3">
              <h2 className="text-lg font-semibold">Preview</h2>
              {(result?.document || detail?.document) && (
                <span className="text-xs px-2 py-1 rounded bg-slate-100">
                  v{(result?.document || detail?.document)?.version}
                </span>
              )}
            </div>
            {(result?.document?.disclaimer || detail?.document?.disclaimer) && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                {result?.document?.disclaimer || detail?.document?.disclaimer}
              </div>
            )}
            <pre className="whitespace-pre-wrap text-sm bg-slate-950 text-slate-50 rounded p-4 max-h-[620px] overflow-auto">
              {result?.markdown_preview || detail?.markdown_preview}
            </pre>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold">Historial de documentos</h2>
          </div>

          {documents.length === 0 ? (
            <div className="p-5 text-sm text-gray-500">Aun no hay documentos generados.</div>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="p-4 border-b flex flex-wrap justify-between items-center gap-3"
              >
                <div>
                  <div className="font-medium">{document.title}</div>
                  <div className="text-xs text-gray-500">
                    {document.standard_code} {document.version_code} · {document.document_type} · v{document.version}
                  </div>
                </div>

                <div className="flex flex-nowrap gap-2">
                  <button
                    onClick={() => openDocument(document.id)}
                    className="inline-flex items-center justify-center rounded bg-slate-100 px-3 py-1 text-sm whitespace-nowrap"
                  >
                    Ver
                  </button>
                  {document.document_status !== 'archived' && (
                    <button
                      onClick={() => archiveDocument(document.id)}
                      className="inline-flex items-center justify-center rounded bg-red-50 px-3 py-1 text-sm text-red-700 whitespace-nowrap"
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
