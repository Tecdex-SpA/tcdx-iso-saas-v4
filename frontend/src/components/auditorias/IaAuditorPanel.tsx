'use client';

import { useEffect, useMemo, useState } from 'react';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { translateDisplayText, translatePriorityLabel, translateSeverityLabel, translateStandardLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type SelectOption = {
  value: string;
  label: string;
};

function resolveTenantId(user: any) {
  return user?.tenant_id || user?.tenantId || user?.tenant || '';
}

function localText(locale: string) {
  const en = locale === 'en';

  return {
    title: en ? 'Senior AI Auditor' : 'IA Auditor Senior',
    subtitle: en
      ? 'Executive audit review powered by tenant evidence, ISO health, findings, actions, and ai-engine.'
      : 'Revisión auditora ejecutiva usando evidencias, salud ISO, hallazgos, acciones y ai-engine.',
    warning: en
      ? 'Advisory analysis only. AI does not approve, close, create, or modify critical records without human validation.'
      : 'Análisis consultivo. La IA no aprueba, cierra, crea ni modifica registros críticos sin validación humana.',
    advisory: en ? 'AI advisory only' : 'IA solo consultiva',
    noRecords: en ? 'No automatic records' : 'Sin registros automáticos',
    run: en ? 'Run analysis' : 'Ejecutar análisis',
    running: en ? 'Analyzing...' : 'Analizando...',
    reload: en ? 'Reload scope' : 'Recargar alcance',
    score: en ? 'Readiness score' : 'Score de preparación',
    controls: en ? 'Controls' : 'Controles',
    evidence: en ? 'Evidence' : 'Evidencias',
    findings: en ? 'Open findings' : 'Hallazgos abiertos',
    actions: en ? 'Open actions' : 'Acciones abiertas',
    overdue: en ? 'Overdue actions' : 'Acciones vencidas',
    audits: en ? 'Recent audits' : 'Auditorías recientes',
    health: en ? 'ISO health' : 'Salud ISO',
    summary: en ? 'Executive summary' : 'Resumen ejecutivo',
    opinion: en ? 'Auditor opinion' : 'Opinión auditora',
    gaps: en ? 'Main gaps' : 'Brechas principales',
    evidenceRequests: en ? 'Evidence requests' : 'Solicitudes de evidencia',
    findingSuggestions: en ? 'Finding suggestions' : 'Hallazgos sugeridos',
    actionSuggestions: en ? 'Action plan suggestions' : 'Planes de acción sugeridos',
    nextSteps: en ? 'Next steps' : 'Siguientes pasos',
    humanReview: en ? 'Human review required' : 'Revisión humana requerida',
    noData: en ? 'No data available yet.' : 'Sin datos disponibles todavía.',
    openModule: en ? 'Open module' : 'Abrir módulo',
    prepare: en ? 'Prepare' : 'Preparar',
    prepareFinding: en ? 'Prepare finding' : 'Preparar hallazgo',
    prepareEvidence: en ? 'Prepare evidence' : 'Preparar evidencia',
    prepareActionPlan: en ? 'Prepare action plan' : 'Preparar plan',
    prepareError: en ? 'Could not prepare the suggestion.' : 'No fue posible preparar la sugerencia.',
    error: en ? 'Could not run Senior AI Auditor.' : 'No fue posible ejecutar IA Auditor Senior.',
    scope: en ? 'Audit scope' : 'Alcance auditado',
    standard: en ? 'Standard' : 'Norma',
    allStandards: en ? 'All standards' : 'Todas las normas',
    auditFocus: en ? 'Audit focus' : 'Foco auditor',
    depth: en ? 'Depth' : 'Profundidad',
    engineTrace: en ? 'AI engine trace' : 'Trazabilidad motor IA',
    structuredResult: en ? 'Senior auditor structured result' : 'Resultado estructurado Auditor Senior',
    diagnosis: en ? 'Diagnosis' : 'Diagnóstico',
    detectedGaps: en ? 'Detected gaps' : 'Brechas detectadas',
    missingEvidence: en ? 'Missing evidence' : 'Evidencia faltante',
    recommendedActions: en ? 'Recommended actions' : 'Acciones recomendadas',
    auditorQuestions: en ? 'Auditor questions' : 'Preguntas de auditor',
    sourcesUsed: en ? 'Sources used' : 'Fuentes usadas',
    confidence: en ? 'Confidence' : 'Confianza',
    limitations: en ? 'Analysis limitations' : 'Limitaciones del análisis',
    engineUsed: en ? 'ai-engine used' : 'ai-engine usado',
    source: en ? 'Source' : 'Fuente',
    endpoint: en ? 'Endpoint' : 'Endpoint',
    dbWrite: en ? 'DB write' : 'Escritura BD',
    generatedAt: en ? 'Generated at' : 'Generado',
    controlSource: en ? 'Control source' : 'Fuente de controles',
    controlsByStandard: en ? 'Controls by standard' : 'Controles por norma',
    warnings: en ? 'Warnings' : 'Advertencias',
    yes: en ? 'Yes' : 'Sí',
    no: en ? 'No' : 'No',
    true: en ? 'true' : 'true',
    false: en ? 'false' : 'false',
    notAvailable: en ? 'Not available' : 'No disponible',
    focusGeneral: en ? 'General' : 'General',
    focusControls: en ? 'Controls' : 'Controles',
    focusEvidence: en ? 'Evidence' : 'Evidencias',
    focusRisks: en ? 'Risks' : 'Riesgos',
    focusActions: en ? 'Actions' : 'Acciones',
    focusCertification: en ? 'Certification-audit readiness' : 'Preparación para auditoría certificadora',
    depthExecutive: en ? 'Executive' : 'Ejecutiva',
    depthStandard: en ? 'Standard' : 'Estándar',
    depthDeep: en ? 'Deep' : 'Profunda',
    readiness: en ? 'Readiness' : 'Preparación',
    safeMode: en ? 'Safe mode' : 'Modo seguro',
    safeModeText: en
      ? 'The module only prepares advisory findings and deep links. It does not create operational records.'
      : 'El módulo solo prepara recomendaciones y enlaces. No crea registros operativos.',
    historyTitle: en ? 'Recent AI Auditor history' : 'Historial reciente IA Auditor',
    historySubtitle: en ? 'Persistent, non-destructive trace of previous analyses.' : 'Trazabilidad persistente y no destructiva de análisis anteriores.',
    refreshHistory: en ? 'Refresh history' : 'Actualizar historial',
    historyUnavailable: en ? 'History is not available yet.' : 'Historial no disponible todavía.',
    viewHistoryDetail: en ? 'View detail' : 'Ver detalle',
    closeHistoryDetail: en ? 'Close detail' : 'Cerrar detalle',
    historyRunId: en ? 'History run ID' : 'ID historial',
    generatePdf: en ? 'Generate PDF' : 'Generar PDF',
    downloadHistoricalPdf: en ? 'Download historical PDF' : 'Descargar PDF histórico',
    humanReviewTitle: en ? 'Human review' : 'Revisión humana',
    humanReviewStatus: en ? 'Review status' : 'Estado de revisión',
    humanReviewComment: en ? 'Review comment' : 'Comentario de revisión',
    saveHumanReview: en ? 'Save human review' : 'Guardar revisión humana',
    humanReviewSaved: en ? 'Human review saved.' : 'Revisión humana guardada.',
    pending: en ? 'Pending' : 'Pendiente',
    reviewed: en ? 'Reviewed' : 'Revisado',
    accepted: en ? 'Accepted' : 'Aceptado',
    rejected: en ? 'Rejected' : 'Rechazado',
    needsMoreEvidence: en ? 'Needs more evidence' : 'Requiere más evidencia',
    reviewedBy: en ? 'Reviewed by' : 'Revisado por',
    reviewedAt: en ? 'Reviewed at' : 'Revisado el',
    pdfError: en ? 'Could not generate PDF report.' : 'No fue posible generar el PDF.',
  };
}

function scoreTone(score: number) {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (score >= 65) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-800';
}

function badgeTone(value: any) {
  if (value === true || value === 'true') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (value === false || value === 'false') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-indigo-200 bg-indigo-50 text-indigo-700';
}

function severityTone(value: any) {
  const normalized = String(value || '').toLowerCase();
  if (['alta', 'high', 'critical', 'critica', 'crítica'].includes(normalized)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (['media', 'medium'].includes(normalized)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function confidenceTone(value: any) {
  const numeric = Number(value || 0);
  if (numeric >= 0.7) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (numeric >= 0.4) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function sourceTone(value: any) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'internal_db') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (normalized === 'rag') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (normalized === 'drive') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (normalized === 'web') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function Card({ title, value, helper }: { title: string; value: any; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      {helper && <div className="mt-1 text-xs text-slate-500">{helper}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TraceItem({ label, value }: { label: string; value: any }) {
  const rendered = value === undefined || value === null || value === '' ? '-' : String(value);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold text-slate-800">{rendered}</div>
    </div>
  );
}

function Pill({ children, value }: { children: React.ReactNode; value?: any }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${badgeTone(value)}`}>
      {children}
    </span>
  );
}

function ListSection({
  title,
  items,
  empty,
  render,
}: {
  title: string;
  items: any[];
  empty: string;
  render: (item: any, index: number) => React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <div className="mt-5 space-y-3">
        {items.map((item, index) => render(item, index))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function StructuredResultPanel({
  result,
  copy,
}: {
  result: any;
  copy: ReturnType<typeof localText>;
}) {
  if (!result || typeof result !== 'object') return null;

  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const actions = Array.isArray(result.recommended_actions) ? result.recommended_actions : [];
  const questions = Array.isArray(result.auditor_questions) ? result.auditor_questions : [];
  const sources = Array.isArray(result.source_trace) ? result.source_trace : [];
  const limitations = Array.isArray(result.limitations) ? result.limitations : [];
  const missingEvidence = Array.isArray(result.evidence_assessment?.missing_evidence)
    ? result.evidence_assessment.missing_evidence
    : [];

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{copy.structuredResult}</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
            {result.executive_summary || copy.noData}
          </p>
        </div>
        <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${confidenceTone(result.confidence)}`}>
          {copy.confidence}: {Math.round(Number(result.confidence || 0) * 100)}%
        </span>
      </div>

      {result.diagnosis && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{copy.diagnosis}</div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{result.diagnosis}</p>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {gaps.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900">{copy.detectedGaps}</h3>
            <div className="mt-3 space-y-3">
              {gaps.map((gap: any, index: number) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${severityTone(gap.severity)}`}>{gap.severity || '-'}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-700">
                      {gap.iso || '-'} {gap.clause || ''}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-900">{gap.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{gap.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <h3 className="text-sm font-black text-indigo-950">{copy.recommendedActions}</h3>
            <div className="mt-3 space-y-3">
              {actions.map((action: any, index: number) => (
                <div key={index} className="rounded-xl border border-indigo-100 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${severityTone(action.priority)}`}>{action.priority || '-'}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-700">
                      {action.target_module || '-'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-black text-slate-900">{action.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {missingEvidence.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-black text-amber-900">{copy.missingEvidence}</h3>
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {missingEvidence.map((item: any, index: number) => <li key={index}>{String(item)}</li>)}
            </ul>
          </div>
        )}

        {questions.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-900">{copy.auditorQuestions}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {questions.map((item: any, index: number) => <li key={index}>{String(item)}</li>)}
            </ul>
          </div>
        )}

        {limitations.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900">{copy.limitations}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {limitations.map((item: any, index: number) => <li key={index}>{String(item)}</li>)}
            </ul>
          </div>
        )}
      </div>

      {sources.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-900">{copy.sourcesUsed}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((source: any, index: number) => (
              <span key={index} className={`rounded-full border px-3 py-1 text-xs font-black ${sourceTone(source.source)}`}>
                {source.source}: {source.reference}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function IaAuditorPanel() {
  const { locale } = useTranslation();
  const copy = localText(locale);

  const [token, setToken] = useState('');
  const [scope, setScope] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [reviewStatus, setReviewStatus] = useState('reviewed');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  const [selectedStandard, setSelectedStandard] = useState('all');
  const [selectedFocus, setSelectedFocus] = useState('general');
  const [selectedDepth, setSelectedDepth] = useState('executive');

  useEffect(() => {
    const storedToken = localStorage.getItem('token') || '';
    const user = getUserFromToken();
    const resolvedTenantId = resolveTenantId(user);

    if (!storedToken || !resolvedTenantId) {
      window.location.href = '/login';
      return;
    }

    setToken(storedToken);
  }, []);

  const standardOptions = useMemo<SelectOption[]>(() => {
    const standards = Array.isArray(scope?.standards) ? scope.standards : [];
    return [
      { value: 'all', label: copy.allStandards },
      ...standards.map((standard: string) => ({
        value: standard,
        label: standard,
      })),
    ];
  }, [scope?.standards, copy.allStandards]);

  const focusOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'general', label: copy.focusGeneral },
      { value: 'controls', label: copy.focusControls },
      { value: 'evidence', label: copy.focusEvidence },
      { value: 'risks', label: copy.focusRisks },
      { value: 'actions', label: copy.focusActions },
      { value: 'certification_readiness', label: copy.focusCertification },
    ],
    [copy]
  );

  const depthOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'executive', label: copy.depthExecutive },
      { value: 'standard', label: copy.depthStandard },
      { value: 'deep', label: copy.depthDeep },
    ],
    [copy]
  );

  const loadScope = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedStandard !== 'all') {
        params.set('standard_code', selectedStandard);
      }

      const url = `${API_URL}/api/ai-auditor/scope${params.toString() ? `?${params.toString()}` : ''}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tcdx-locale': locale,
        },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.error);
      }

      setScope(json.scope || null);
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setLoading(false);
    }
  };



  const downloadBlobAsFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };


  const formatDate = (value?: string | null) => {
    if (!value) return '-';

    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const reviewLabel = (status?: string) => {
    const key = String(status || 'pending');
    if (key === 'accepted') return copy.accepted;
    if (key === 'rejected') return copy.rejected;
    if (key === 'needs_more_evidence') return copy.needsMoreEvidence;
    if (key === 'reviewed') return copy.reviewed;
    return copy.pending;
  };

  const openHistoryDetailForReview = (item: any) => {
    setSelectedHistory(item);
    setReviewStatus(item?.human_review_status || 'reviewed');
    setReviewComment(item?.human_review_comment || '');
    setReviewMessage('');
  };

  const saveHumanReview = async () => {
    if (!token || !selectedHistory?.id) return;

    try {
      setReviewLoading(true);
      setReviewMessage('');

      const res = await fetch(`${API_URL}/api/ai-auditor/history/${selectedHistory.id}/review`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify({
          review_status: reviewStatus,
          comment: reviewComment,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data?.message || data?.error?.message || copy.pdfError);
      }

      setSelectedHistory(data.item || selectedHistory);
      setReviewStatus(data.item?.human_review_status || reviewStatus);
      setReviewComment(data.item?.human_review_comment || reviewComment);
      setReviewMessage(copy.humanReviewSaved);
      await loadHistory();
    } catch (err: any) {
      setReviewMessage(err?.message || copy.pdfError);
    } finally {
      setReviewLoading(false);
    }
  };


  const downloadCurrentAnalysisPdf = async () => {
    if (!token || !analysis) return;

    try {
      setPdfLoading(true);
      setPdfError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify({
          locale,
          analysis,
          scope: analysis.scope || scope,
          standard_code: selectedStandard === 'all' ? null : selectedStandard,
          audit_focus: selectedFocus,
          depth: selectedDepth,
        }),
      });

      if (!res.ok) throw new Error(copy.pdfError);
      const blob = await res.blob();
      downloadBlobAsFile(blob, `tcdx-ai-auditor-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      setPdfError(err?.message || copy.pdfError);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadHistoryPdf = async (historyId: string) => {
    if (!token || !historyId) return;

    try {
      setPdfLoading(true);
      setPdfError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/history/${historyId}/report`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tcdx-locale': locale,
        },
      });

      if (!res.ok) throw new Error(copy.pdfError);
      const blob = await res.blob();
      downloadBlobAsFile(blob, `tcdx-ai-auditor-${historyId}.pdf`);
    } catch (err: any) {
      setPdfError(err?.message || copy.pdfError);
    } finally {
      setPdfLoading(false);
    }
  };


  const loadHistory = async () => {
    if (!token) return;

    try {
      setHistoryLoading(true);
      setHistoryError('');

      const params = new URLSearchParams();
      params.set('limit', '8');

      if (selectedStandard !== 'all') {
        params.set('standard_code', selectedStandard);
      }

      const res = await fetch(`${API_URL}/api/ai-auditor/history?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tcdx-locale': locale,
        },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.historyUnavailable);
      }

      setHistoryItems(Array.isArray(json.items) ? json.items : []);
      setHistoryError(json.warning || '');
    } catch (err: any) {
      setHistoryError(err?.message || copy.historyUnavailable);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryDetail = async (id: string) => {
    if (!token || !id) return;

    try {
      setHistoryError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/history/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tcdx-locale': locale,
        },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.historyUnavailable);
      }

      setSelectedHistory(json.item || null);
    } catch (err: any) {
      setHistoryError(err?.message || copy.historyUnavailable);
    }
  };


  const runAnalysis = async () => {
    if (!token) return;

    try {
      setAnalyzing(true);
      setError('');
      setAnalysis(null);

      const body: Record<string, any> = {
        locale,
        audit_focus: selectedFocus,
        depth: selectedDepth,
        include_internet: true,
        use_web: true,
        use_drive: true,
        use_rag: true,
      };

      if (selectedStandard !== 'all') {
        body.standard_code = selectedStandard;
      }

      const res = await fetch(`${API_URL}/api/ai-auditor/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.error);
      }

      setAnalysis(json);
      setScope(json.scope || scope);
      if (json?.trace?.history_saved === true) {
        void loadHistory();
      }
    } catch (err: any) {
      setError(err?.message || copy.error);
    } finally {
      setAnalyzing(false);
    }
  };


  const prepareSuggestion = async (type: string, suggestion: any) => {
    if (!token) return;

    try {
      setError('');

      const res = await fetch(`${API_URL}/api/ai-auditor/suggestions/${type}/prepare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-tcdx-locale': locale,
        },
        body: JSON.stringify({
          locale,
          standard_code: selectedStandard !== 'all' ? selectedStandard : suggestion?.standard_code,
          suggestion,
        }),
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || copy.prepareError);
      }

      const storageKey = json.storage_key;
      const deepLink = json.deep_link;

      if (storageKey && json.prepared_payload) {
        sessionStorage.setItem(storageKey, JSON.stringify(json.prepared_payload));
      }

      if (deepLink) {
        window.location.href = deepLink;
      }
    } catch (err: any) {
      setError(err?.message || copy.prepareError);
    }
  };


  useEffect(() => {
    if (token) void loadScope();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, locale, selectedStandard]);

  const counts = scope?.counts || {};
  const summary = analysis?.summary || {};
  const coverage = analysis?.coverage || {};
  const trace = analysis?.trace || {};
  const sources = scope?.sources || analysis?.scope?.sources || {};
  const controlsByStandard = Array.isArray(scope?.controls_by_standard)
    ? scope.controls_by_standard
    : [];
  const warnings = Array.isArray(sources?.warnings) ? sources.warnings : [];

  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-7 text-white">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill value>{copy.humanReview}</Pill>
                  <Pill value={false}>{copy.noRecords}</Pill>
                  <Pill value={trace?.ai_engine_used}>{copy.advisory}</Pill>
                </div>

                <h1 className="mt-5 text-4xl font-black tracking-tight">
                  {copy.title}
                </h1>

                <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-300">
                  {copy.subtitle}
                </p>

                <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                  {copy.warning}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur xl:min-w-[360px]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-100">
                  {copy.safeMode}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {copy.safeModeText}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Field label={copy.standard}>
              <Select
                value={selectedStandard}
                options={standardOptions}
                onChange={setSelectedStandard}
              />
            </Field>

            <Field label={copy.auditFocus}>
              <Select
                value={selectedFocus}
                options={focusOptions}
                onChange={setSelectedFocus}
              />
            </Field>

            <Field label={copy.depth}>
              <Select
                value={selectedDepth}
                options={depthOptions}
                onChange={setSelectedDepth}
              />
            </Field>

            <button
              onClick={loadScope}
              disabled={loading || analyzing}
              className="mt-7 h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 xl:mt-[27px]"
            >
              {loading ? '...' : copy.reload}
            </button>

            <button
              onClick={runAnalysis}
              disabled={loading || analyzing}
              className="mt-7 h-11 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 xl:mt-[27px]"
            >
              {analyzing ? copy.running : copy.run}
            </button>
          </div>
        </section>

        {pdfError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {pdfError}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Card title={copy.controls} value={counts.controls_total || 0} />
          <Card title={copy.evidence} value={counts.evidence_total || 0} />
          <Card title={copy.findings} value={counts.findings_open || 0} />
          <Card title={copy.actions} value={counts.action_plans_open || 0} />
          <Card title={copy.overdue} value={counts.action_plans_overdue || 0} />
          <Card title={copy.audits} value={counts.audits_recent || 0} />
          <Card title={copy.health} value={`${counts.health_average || 0}%`} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.controlSource}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TraceItem label={copy.source} value={sources?.controls_source || copy.notAvailable} />
              <TraceItem label={copy.warnings} value={warnings.length} />
            </div>

            <div className="mt-5 space-y-3">
              {controlsByStandard.map((item: any) => (
                <div key={item.standard_code} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {item.standard_code}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.source}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-indigo-700">
                      {item.controls || 0}
                    </div>
                  </div>
                </div>
              ))}

              {controlsByStandard.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  {copy.noData}
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {warnings.join(' · ')}
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.engineTrace}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <TraceItem label={copy.engineUsed} value={trace?.ai_engine_used === true ? copy.yes : trace?.ai_engine_used === false ? copy.no : '-'} />
              <TraceItem label={copy.source} value={trace?.source || '-'} />
              <TraceItem label={copy.endpoint} value={trace?.endpoint || '-'} />
              <TraceItem label={copy.dbWrite} value={String(trace?.db_write ?? false)} />
              <TraceItem label={copy.generatedAt} value={trace?.generated_at || '-'} />
              <TraceItem label={copy.scope} value={selectedStandard === 'all' ? copy.allStandards : selectedStandard} />
            </div>
          </div>
        </section>


        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">{copy.historyTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{copy.historySubtitle}</p>
            </div>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {historyLoading ? '...' : copy.refreshHistory}
            </button>
          </div>

          {historyError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {historyError}
            </div>
          )}

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {historyItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      {item.standard_code || copy.allStandards} · {item.audit_focus || '-'} · {item.depth || '-'}
                    </div>
                    <div className="mt-2 text-sm font-black text-slate-900">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : '-'}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.summary_preview || copy.noData}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill value={item.ai_engine_used}>{copy.engineUsed}: {item.ai_engine_used ? copy.yes : copy.no}</Pill>
                      <Pill value={false}>{copy.noRecords}</Pill>
                      <Pill value={item.human_review_required}>{copy.humanReview}</Pill>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 text-right">
                    <div className={`rounded-2xl border px-4 py-3 ${scoreTone(Number(item.score || 0))}`}>
                      <div className="text-2xl font-black">{item.score ?? 0}%</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em]">
                        {item.readiness_level || '-'}
                      </div>
                    </div>
                    <button
                      onClick={() => loadHistoryDetail(item.id)}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      {copy.viewHistoryDetail}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {historyItems.length === 0 && !historyError && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                {copy.historyUnavailable}
              </div>
            )}
          </div>

          {selectedHistory && (
            <div className="mt-5 rounded-[26px] border border-indigo-100 bg-indigo-50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {copy.viewHistoryDetail}
                  </h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {copy.historyRunId}: {selectedHistory.id}
                  </p>
                </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3">
                  <h4 className="text-sm font-black text-amber-900">{copy.humanReviewTitle}</h4>
                  <p className="text-xs font-semibold text-amber-800">
                    {copy.safeModeText}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-700">
                    {copy.humanReviewStatus}
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                    >
                      <option value="pending">{copy.pending}</option>
                      <option value="reviewed">{copy.reviewed}</option>
                      <option value="accepted">{copy.accepted}</option>
                      <option value="rejected">{copy.rejected}</option>
                      <option value="needs_more_evidence">{copy.needsMoreEvidence}</option>
                    </select>
                  </label>

                  <div className="rounded-xl border border-amber-100 bg-white p-3 text-xs text-slate-700">
                    <div><b>{copy.reviewedBy}:</b> {selectedHistory?.human_reviewed_by || '-'}</div>
                    <div><b>{copy.reviewedAt}:</b> {formatDate(selectedHistory?.human_reviewed_at)}</div>
                  </div>
                </div>

                <label className="mt-3 block text-xs font-bold text-slate-700">
                  {copy.humanReviewComment}
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={saveHumanReview}
                    disabled={reviewLoading}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {reviewLoading ? '...' : copy.saveHumanReview}
                  </button>
                  {reviewMessage && (
                    <span className="text-xs font-bold text-amber-900">{reviewMessage}</span>
                  )}
                </div>
              </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadHistoryPdf(selectedHistory.id)}
                    disabled={pdfLoading}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {pdfLoading ? '...' : copy.downloadHistoricalPdf}
                  </button>
                  <button
                    onClick={() => setSelectedHistory(null)}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    {copy.closeHistoryDetail}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <TraceItem label={copy.score} value={selectedHistory.score ?? '-'} />
                <TraceItem label={copy.readiness} value={selectedHistory.readiness_level || '-'} />
                <TraceItem label={copy.engineUsed} value={selectedHistory.ai_engine_used ? copy.yes : copy.no} />
                <TraceItem label={copy.dbWrite} value={String(selectedHistory.db_write ?? false)} />
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="text-sm font-black text-slate-900">{copy.summary}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedHistory.summary_json?.executive_summary || copy.noData}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <div className="text-sm font-black text-slate-900">{copy.gaps}</div>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                    {JSON.stringify(selectedHistory.summary_json?.main_gaps || [], null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <div className="text-sm font-black text-slate-900">{copy.nextSteps}</div>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                    {JSON.stringify(selectedHistory.suggestions_json?.next_steps || selectedHistory.full_result_json?.next_steps || [], null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </section>


        {analysis && (
          <div className="flex justify-end">
            <button
              onClick={downloadCurrentAnalysisPdf}
              disabled={pdfLoading}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {pdfLoading ? '...' : copy.generatePdf}
            </button>
          </div>
        )}

        {analysis && (
          <>
            <StructuredResultPanel result={analysis.structured_result} copy={copy} />

            <section className="rounded-[30px] border border-indigo-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {copy.summary}
                  </h2>

                  <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                    {summary.executive_summary || copy.noData}
                  </p>

                  <h3 className="mt-5 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                    {copy.opinion}
                  </h3>
                  <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-700">
                    {summary.auditor_opinion || copy.noData}
                  </p>
                </div>

                <div className={`rounded-3xl border px-6 py-5 text-center ${scoreTone(Number(summary.score || 0))}`}>
                  <div className="text-xs font-bold uppercase tracking-[0.14em]">
                    {copy.score}
                  </div>
                  <div className="mt-1 text-4xl font-black">{summary.score || 0}%</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em]">
                    {summary.readiness_level || '-'}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card title={copy.controls} value={coverage.controls_reviewed || 0} />
                <Card title={copy.evidence} value={coverage.evidences_reviewed || 0} />
                <Card title={copy.findings} value={coverage.findings_reviewed || 0} />
                <Card title={copy.actions} value={coverage.actions_reviewed || 0} />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ListSection
                title={copy.gaps}
                items={summary.main_gaps || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      {translateDisplayText(item.type, locale, 'audit')} · {translateSeverityLabel(item.severity, locale)}
                    </div>
                    <h3 className="mt-2 font-bold text-slate-900">{translateDisplayText(item.title, locale, 'finding')}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                )}
              />

              <ListSection
                title={copy.evidenceRequests}
                items={analysis.evidence_requests || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {translateStandardLabel(item.standard_code || '-', locale)} · {translatePriorityLabel(item.priority || '-', locale)}
                    </div>
                    <h3 className="mt-2 font-bold">{translateDisplayText(item.title, locale, 'actionPlan')}</h3>
                    <p className="mt-2 text-sm leading-6">{item.reason}</p>
                    <button
                      onClick={() => prepareSuggestion('evidence', item)}
                      className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold"
                    >
                      {copy.prepareEvidence}
                    </button>
                  </div>
                )}
              />

              <ListSection
                title={copy.findingSuggestions}
                items={analysis.findings_suggestions || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {translateSeverityLabel(item.severity || '-', locale)}
                    </div>
                    <h3 className="mt-2 font-bold">{translateDisplayText(item.title, locale, 'actionPlan')}</h3>
                    <p className="mt-2 text-sm leading-6">{item.recommended_action}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => prepareSuggestion('finding', item)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.prepareFinding}
                      </button>
                      {item.deep_link && (
                        <button
                          onClick={() => window.location.href = item.deep_link}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                        >
                          {copy.openModule}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              />

              <ListSection
                title={copy.actionSuggestions}
                items={analysis.action_plan_suggestions || []}
                empty={copy.noData}
                render={(item, index) => (
                  <div key={index} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
                    <div className="text-xs font-bold uppercase tracking-[0.12em]">
                      {translatePriorityLabel(item.priority || '-', locale)}
                    </div>
                    <h3 className="mt-2 font-bold">{translateDisplayText(item.title, locale, 'actionPlan')}</h3>
                    <p className="mt-2 text-sm leading-6">{item.recommended_action}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => prepareSuggestion('action_plan', item)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                      >
                        {copy.prepareActionPlan}
                      </button>
                      {item.deep_link && (
                        <button
                          onClick={() => window.location.href = item.deep_link}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-bold"
                        >
                          {copy.openModule}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              />
            </div>

            <ListSection
              title={copy.nextSteps}
              items={analysis.next_steps || []}
              empty={copy.noData}
              render={(item, index) => (
                <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                  {item}
                </div>
              )}
            />
          </>
        )}

        {!analysis && (
          <section className="rounded-[30px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-black text-slate-900">{copy.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>
          </section>
        )}
    </div>
  );
}
