'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

const AI_RECOMMENDATION_THRESHOLD = 80;

async function openAuthorizedFile(url: string, token: string | null) {
  if (!token) {
    alert('Sesión no disponible. Inicia sesión nuevamente.');
    return;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    alert('No fue posible abrir el archivo.');
    return;
  }

  const blobUrl = URL.createObjectURL(await res.blob());
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

type EvidenceRow = {
  id: string;
  tenant_id?: string;
  iso?: string;
  clause?: string;
  control_description?: string;
  description?: string;
  evidence_type?: string;
  status?: string;
  validated?: boolean;
  created_at?: string;
  reviewed_at?: string;
  expires_at?: string;
  reviewed_by?: string | null;
  reviewed_by_label?: string | null;
  rejection_reason?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  action_plan_id?: string | null;
  action_plan_title?: string | null;
  tenant_control_id?: string | null;
  linked_to_this_plan?: boolean;
  operation_name?: string | null;
  operation_code?: string | null;
  operation_type?: string | null;
  extract_id?: string | null;
  extraction_status?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  text_char_count?: number | string | null;
  ocr_used?: boolean | null;
  detected_language?: string | null;
  page_count?: number | string | null;
  sheet_count?: number | string | null;
  image_count?: number | string | null;
  assessment_id?: string | null;
  analysis_status?: string | null;
  validity_result?: string | null;
  contribution_level?: string | null;
  pertinence_score?: number | string | null;
  sufficiency_score?: number | string | null;
  freshness_score?: number | string | null;
  traceability_score?: number | string | null;
  consistency_score?: number | string | null;
  compliance_impact_score?: number | string | null;
  recommended_standard_code?: string | null;
  recommended_clause?: string | null;
  recommended_control_id?: string | null;
  ai_headline?: string | null;
  ai_narrative?: string | null;
  ai_risks?: any;
  ai_next_steps?: any;
  ai_entities?: any;
  control_fit?: string | null;
  gap_summary?: string | null;
  appears_expired?: boolean | null;
  appears_complete?: boolean | null;
  appears_authentic?: boolean | null;
  analyzed_at?: string | null;
  ai_acceptance_pct?: number | string | null;
  auto_approved_by_ai?: boolean | null;
  ai_recommended_by_ai?: boolean | null;
  ai_auto_review_reason?: string | null;
  ai_auto_approved_at?: string | null;
  ai_recommendation_reason?: string | null;
  ai_recommended_at?: string | null;

  ai_trace_id?: string | null;
  ai_source_level?: string | null;
  ai_source_label?: string | null;
  ai_confidence?: string | null;
  ai_confidence_score?: number | string | null;
  ai_orchestration_json?: any;
  ai_enhanced_answer_json?: any;
};

type ScopeStandard = {
  code: string;
  name?: string;
  is_active: boolean;
  active_operations_count?: number;
  active_operation_ids?: string[];
};

type ScopeResponse = {
  scope_rule?: {
    standard_must_be_active: boolean;
    mapping_must_be_active: boolean;
    operation_must_be_active: boolean;
  };
  operations?: any[];
  standards?: ScopeStandard[];
};


function aiTraceText(value: any, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function getEvidenceAiTrace(row: EvidenceRow) {
  const orchestration = row.ai_orchestration_json || {};
  const answer = row.ai_enhanced_answer_json || {};
  const searchTrace = orchestration?.search_trace || {};

  const sourceLevel = aiTraceText(
    row.ai_source_level ||
      orchestration?.source_level ||
      answer?.source_level ||
      ''
  );

  const sourceLabel = aiTraceText(
    row.ai_source_label ||
      orchestration?.source_label ||
      answer?.source_label ||
      ''
  );

  const confidence = aiTraceText(
    row.ai_confidence ||
      orchestration?.confidence ||
      answer?.confidence ||
      ''
  );

  const confidenceScore =
    row.ai_confidence_score ||
    orchestration?.confidence_score ||
    answer?.confidence_score ||
    null;

  const traceId = aiTraceText(
    row.ai_trace_id ||
      orchestration?.trace?.id ||
      ''
  );

  const sourceOrder = Array.isArray(searchTrace?.source_order)
    ? searchTrace.source_order
    : [];

  const tenantHits = Number(searchTrace?.tenant_hits ?? 0);
  const knowledgeHits = Number(searchTrace?.knowledge_hits ?? 0);
  const benchmarkHits = Number(searchTrace?.benchmark_hits ?? 0);
  const externalHits = Number(searchTrace?.external_hits ?? 0);

  const hasTrace =
    Boolean(traceId) ||
    Boolean(sourceLevel) ||
    Boolean(sourceLabel) ||
    Boolean(confidence) ||
    sourceOrder.length > 0 ||
    tenantHits > 0 ||
    knowledgeHits > 0 ||
    benchmarkHits > 0 ||
    externalHits > 0;

  return {
    hasTrace,
    sourceLevel,
    sourceLabel,
    confidence,
    confidenceScore,
    traceId,
    sourceOrder,
    tenantHits,
    knowledgeHits,
    benchmarkHits,
    externalHits,
    executiveSummary: aiTraceText(answer?.executive_summary || ''),
    recommendation: aiTraceText(answer?.recommendation || ''),
    suggestedEvidence: Array.isArray(answer?.suggested_evidence)
      ? answer.suggested_evidence
      : [],
    nextSteps: Array.isArray(answer?.next_steps)
      ? answer.next_steps
      : [],
  };
}

function EvidenceAiTraceCard({ evidence }: { evidence: EvidenceRow }) {
  const trace = getEvidenceAiTrace(evidence);

  if (!trace.hasTrace) return null;

  const sourceLabels: Record<string, string> = {
    tenant_internal: 'Tenant',
    tcdx_knowledge: 'Base TCDX',
    anonymized_benchmark: 'Benchmark',
    external_web: 'Internet',
    best_effort: 'Mejor esfuerzo',
  };

  const sourceName =
    trace.sourceLabel ||
    sourceLabels[trace.sourceLevel] ||
    trace.sourceLevel ||
    'Motor IA TCDX';

  const sourceOrderText = trace.sourceOrder.length
    ? trace.sourceOrder.map((item: string) => sourceLabels[item] || item).join(' → ')
    : 'No informada';

  const sourceClass =
    trace.sourceLevel === 'external_web'
      ? 'bg-cyan-50 text-cyan-800 ring-cyan-200'
      : trace.sourceLevel === 'anonymized_benchmark'
        ? 'bg-purple-50 text-purple-800 ring-purple-200'
        : trace.sourceLevel === 'tcdx_knowledge'
          ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
          : trace.sourceLevel === 'tenant_internal'
            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            : 'bg-slate-50 text-slate-700 ring-slate-200';

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
            Orquestación IA TCDX
          </div>

          <div className="mt-2 text-sm leading-6 text-blue-950">
            Esta evaluación conserva trazabilidad del motor IA central usado para validar la evidencia.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-bold ring-1 ${sourceClass}`}>
            Origen: {sourceName}
          </span>

          {trace.confidence && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              Confianza: {trace.confidence}
              {trace.confidenceScore ? ` · ${trace.confidenceScore}%` : ''}
            </span>
          )}

          {trace.traceId && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              Trace: {trace.traceId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Ruta: {sourceOrderText}
        </div>

        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Tenant: {trace.tenantHits}
        </div>

        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          TCDX: {trace.knowledgeHits}
        </div>

        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Benchmark: {trace.benchmarkHits}
        </div>

        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-blue-100">
          Internet: {trace.externalHits}
        </div>
      </div>

      {(trace.executiveSummary || trace.recommendation) && (
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {trace.executiveSummary && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <div className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Resumen IA central
              </div>
              <div className="text-sm leading-6 text-slate-700">
                {trace.executiveSummary}
              </div>
            </div>
          )}

          {trace.recommendation && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <div className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Recomendación IA central
              </div>
              <div className="text-sm leading-6 text-slate-700">
                {trace.recommendation}
              </div>
            </div>
          )}
        </div>
      )}

      {(trace.suggestedEvidence.length > 0 || trace.nextSteps.length > 0) && (
        <details className="mt-4 rounded-2xl border border-blue-100 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            Ver evidencia sugerida y próximos pasos IA central
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {trace.suggestedEvidence.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Evidencia sugerida
                </div>

                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.suggestedEvidence.slice(0, 8).map((item: string, index: number) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trace.nextSteps.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Próximos pasos
                </div>

                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.nextSteps.slice(0, 8).map((item: string, index: number) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}


function resolveTenantId(user: any): string {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

export default function EvidenciasPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando evidencias...</div>
        </AppLayout>
      }
    >
      <EvidenciasPageContent />
    </Suspense>
  );
}

function EvidenciasPageContent() {
  const searchParams = useSearchParams();

  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');
  const tenantControlIdFromUrl = searchParams.get('tenant_control_id');
  const actionPlanIdFromUrl = searchParams.get('action_plan_id');
  const clauseFromUrl = searchParams.get('clause');

  const [data, setData] = useState<EvidenceRow[]>([]);
  const [standards, setStandards] = useState<ScopeStandard[]>([]);
  const [iso, setIso] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reviewingId, setReviewingId] = useState('');
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [focusedEvidenceId, setFocusedEvidenceId] = useState('');
  const [focusMessage, setFocusMessage] = useState('');

  const [uploadForm, setUploadForm] = useState({
    description: '',
    evidence_type: 'documento',
    expires_at: '',
    file: null as File | null,
  });

  const focusAppliedRef = useRef(false);

  const role = String(user?.role || '').toLowerCase().trim();
  const isAuditor = role === 'auditor';
  const canReviewEvidence =
    isAuditor ||
    role === 'admin' ||
    role === 'tenant_admin' ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    role === 'owner';

  const isRemediationMode = Boolean(tenantControlIdFromUrl || actionPlanIdFromUrl);
  const tenantId = resolveTenantId(user);

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();
    const resolvedTenantId = resolveTenantId(u);

    setToken(authToken);
    setUser(u);

    if (!authToken || !resolvedTenantId) {
      setLoading(false);
      setLoadingStandards(false);
      return;
    }

    if (tenantControlIdFromUrl || actionPlanIdFromUrl) {
      setUploadForm((prev) => ({
        ...prev,
        description:
          prev.description || 'Evidencia de remediación cargada desde Plan de Acción',
      }));
    }

    loadStandards(resolvedTenantId, authToken);
  }, [tenantControlIdFromUrl, actionPlanIdFromUrl]);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedEvidenceId('');
    setFocusMessage('');
  }, [focusId, focusISO]);

  const normalizeEvidenceStatus = (value: string | null | undefined) => {
    const raw = String(value || '').toLowerCase();

    if (['aprobado', 'aprobada', 'approved'].includes(raw)) return 'aprobada';
    if (['rechazado', 'rechazada', 'rejected'].includes(raw)) return 'rechazada';
    return 'pendiente';
  };

  const toNumber = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toPercent = (value: any) => `${Math.round(toNumber(value))}%`;

  const parseArray = (value: any): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [value];
      } catch {
        return [value];
      }
    }
    return [];
  };

  const isOperationalStandard = (s: ScopeStandard) =>
    s?.is_active === true &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0;

  const loadStandards = async (resolvedTenantId: string, authToken: string) => {
    try {
      setLoadingStandards(true);

      const res = await fetch(`${API_URL}/api/tenant-standards/scope/${resolvedTenantId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json: ScopeResponse = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD EVIDENCE SCOPE:', json);
        setStandards([]);
        setIso('');
        return;
      }

      const operationalStandards = (json?.standards || []).filter(isOperationalStandard);

      setStandards(operationalStandards);

      if (operationalStandards.length > 0) {
        setIso((prev) => {
          if (focusISO) {
            const existsFocus = operationalStandards.some((s) => s.code === focusISO);
            if (existsFocus) return focusISO;
          }

          const exists = operationalStandards.some((s) => s.code === prev);
          return exists ? prev : operationalStandards[0].code;
        });
      } else {
        setIso('');
      }
    } catch (err) {
      console.error('ERROR LOAD EVIDENCE SCOPE:', err);
      setStandards([]);
      setIso('');
    } finally {
      setLoadingStandards(false);
    }
  };

  const load = async (resolvedTenantId: string, authToken: string, selectedIso: string) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (selectedIso) params.append('iso', selectedIso);
      if (tenantControlIdFromUrl) params.append('tenant_control_id', tenantControlIdFromUrl);
      if (actionPlanIdFromUrl) params.append('action_plan_id', actionPlanIdFromUrl);

      const res = await fetch(
        `${API_URL}/api/evidences/${resolvedTenantId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD EVIDENCES:', json);
        setData([]);
        return;
      }

      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('ERROR LOAD EVIDENCES:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !tenantId) return;

    if (!loadingStandards) {
      load(tenantId, token, iso);
    }
  }, [
    token,
    tenantId,
    iso,
    loadingStandards,
    tenantControlIdFromUrl,
    actionPlanIdFromUrl,
  ]);

  const refresh = async () => {
    if (tenantId && token) {
      await load(tenantId, token, iso);
    }
  };

  const uploadEvidence = async () => {
    if (!token || !tenantId) return;

    if (!tenantControlIdFromUrl && !actionPlanIdFromUrl) {
      alert(
        'No se recibió tenant_control_id ni action_plan_id. Entra desde un Plan de Acción o desde un control específico.'
      );
      return;
    }

    if (!uploadForm.file) {
      alert('Debes seleccionar un archivo PDF o imagen.');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(uploadForm.file.type)) {
      alert('Solo se permiten archivos PDF, JPG, PNG o WEBP.');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('tenant_id', tenantId);
      formData.append(
        'description',
        uploadForm.description || 'Evidencia de remediación'
      );
      formData.append('evidence_type', uploadForm.evidence_type || 'documento');

      if (tenantControlIdFromUrl) {
        formData.append('tenant_control_id', tenantControlIdFromUrl);
      }

      if (actionPlanIdFromUrl) {
        formData.append('action_plan_id', actionPlanIdFromUrl);
      }

      if (uploadForm.expires_at) {
        formData.append('expires_at', uploadForm.expires_at);
      }

      formData.append('file', uploadForm.file);

      const res = await fetch(`${API_URL}/api/evidences/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error subiendo evidencia');
        return;
      }

      setUploadForm({
        description: 'Evidencia de remediación cargada desde Plan de Acción',
        evidence_type: 'documento',
        expires_at: '',
        file: null,
      });

      const fileInput = document.getElementById(
        'evidence-file-input'
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      alert(
        'Evidencia subida correctamente. La IA la evaluará y, si supera el 80% con evidencia completa, la dejará recomendada para aprobación humana.'
      );
      await refresh();
    } catch (err) {
      console.error('ERROR UPLOAD EVIDENCE:', err);
      alert('Error subiendo evidencia');
    } finally {
      setUploading(false);
    }
  };

  const aprobar = async (id: string) => {
    const authToken = localStorage.getItem('token');

    try {
      setReviewingId(id);

      const res = await fetch(`${API_URL}/api/evidences/approve/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: 'aprobada' }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error aprobando evidencia');
        return;
      }

      alert(
        actionPlanIdFromUrl
          ? 'Evidencia aprobada manualmente. El plan asociado fue actualizado y la salud ISO fue recalculada.'
          : 'Evidencia aprobada manualmente. La salud ISO fue recalculada.'
      );

      await refresh();
    } catch (err) {
      console.error('ERROR APPROVE EVIDENCE:', err);
      alert('Error aprobando evidencia');
    } finally {
      setReviewingId('');
    }
  };

  const rechazar = async (id: string) => {
    const authToken = localStorage.getItem('token');
    const reason = window.prompt('Motivo del rechazo', '') || '';

    try {
      setReviewingId(id);

      const res = await fetch(`${API_URL}/api/evidences/approve/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          status: 'rechazada',
          rejection_reason: reason,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error rechazando evidencia');
        return;
      }

      alert('Evidencia rechazada manualmente.');
      await refresh();
    } catch (err) {
      console.error('ERROR REJECT EVIDENCE:', err);
      alert('Error rechazando evidencia');
    } finally {
      setReviewingId('');
    }
  };

  const refreshHealth = async () => {
    if (!token || !tenantId) return;

    try {
      setHealthRefreshing(true);

      const res = await fetch(`${API_URL}/health/refresh?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();

      if (!res.ok || json.ok === false) {
        alert(json.error || 'Error recalculando salud');
        return;
      }

      alert('Salud ISO recalculada correctamente');
      await refresh();
    } catch (err) {
      console.error('ERROR REFRESH HEALTH:', err);
      alert('Error recalculando salud');
    } finally {
      setHealthRefreshing(false);
    }
  };

  const getColor = (status: string) => {
    const value = normalizeEvidenceStatus(status);

    if (value === 'aprobada') {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (value === 'rechazada') {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  const getAcceptanceClass = (pct: number) => {
    if (pct >= AI_RECOMMENDATION_THRESHOLD) {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (pct >= 60) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }

    return 'bg-red-100 text-red-700 border-red-200';
  };

  const applyFocus = (evidence: EvidenceRow) => {
    setFocusedEvidenceId(evidence.id);
    setFocusMessage(
      `Resultado abierto desde búsqueda: evidencia ${evidence.iso || iso || 'Sin norma'} — cláusula ${evidence.clause || 'N/A'}`
    );
    focusAppliedRef.current = true;

    setTimeout(() => {
      const el = document.getElementById(`evidence-${evidence.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 250);
  };

  useEffect(() => {
    if (loadingStandards || !standards.length) return;

    if (focusISO) {
      const exists = standards.some((s) => s.code === focusISO);
      if (exists && iso !== focusISO) {
        setIso(focusISO);
      }
    }
  }, [focusISO, standards, loadingStandards, iso]);

  useEffect(() => {
    if (!focusId || loading || !data.length || focusAppliedRef.current) return;

    const match = data.find((e: EvidenceRow) => e.id === focusId);

    if (match) {
      if (match.iso && iso !== match.iso) {
        const exists = standards.some((s) => s.code === match.iso);
        if (exists) {
          setIso(match.iso);
        }
      }
      applyFocus(match);
    }
  }, [focusId, data, loading, iso, standards]);

  const metrics = useMemo(() => {
    const normalized = data.map((row) => normalizeEvidenceStatus(row.status));

    return {
      total: data.length,
      pendientes: normalized.filter((s) => s === 'pendiente').length,
      aprobadas: normalized.filter((s) => s === 'aprobada').length,
      rechazadas: normalized.filter((s) => s === 'rechazada').length,
      vinculadasPlan: data.filter((row) => Boolean(row.action_plan_id)).length,
      recomendadasIa: data.filter(
        (row) => row.ai_recommended_by_ai === true || row.auto_approved_by_ai === true
      ).length,
    };
  }, [data]);

  const filteredData = useMemo(() => {
    if (!statusFilter) return data;

    return data.filter(
      (row) => normalizeEvidenceStatus(row.status) === statusFilter
    );
  }, [data, statusFilter]);

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas disponibles...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && standards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Auditoría de Evidencias</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              No hay normas operativas para esta empresa
            </h2>

            <p className="text-sm text-gray-700">
              Primero debes tener una norma activa con al menos una operación activa asociada.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Cargando evidencias...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f7fb] p-6 space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Auditoría de Evidencias
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Carga, revisión manual y evaluación inteligente de evidencias ISO.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={iso}
              onChange={(e) => {
                setIso(e.target.value);
                setFocusedEvidenceId('');
                if (!focusId) {
                  setFocusMessage('');
                }
              }}
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl shadow-sm"
            >
              {standards.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 bg-white px-3 py-2 rounded-xl shadow-sm"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>

            <button
              type="button"
              onClick={refresh}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refrescar
            </button>

            <button
              type="button"
              onClick={refreshHealth}
              disabled={healthRefreshing}
              className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#24384a] disabled:opacity-60"
            >
              {healthRefreshing ? 'Recalculando...' : 'Recalcular salud'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <MetricCard title="Total" value={metrics.total} />
          <MetricCard title="Pendientes" value={metrics.pendientes} />
          <MetricCard title="Aprobadas" value={metrics.aprobadas} />
          <MetricCard title="Rechazadas" value={metrics.rechazadas} />
          <MetricCard title="Ligadas a plan" value={metrics.vinculadasPlan} />
          <MetricCard title="Recomendadas IA" value={metrics.recomendadasIa} />
        </div>

        {isRemediationMode && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-indigo-950">
                  Remediación desde Plan de Acción
                </h2>

                <p className="mt-1 text-sm text-indigo-800">
                  Esta evidencia será asociada al control y al plan de acción correspondiente.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {focusISO && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      Norma: {focusISO}
                    </span>
                  )}

                  {clauseFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      Cláusula: {clauseFromUrl}
                    </span>
                  )}

                  {tenantControlIdFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      Control asociado
                    </span>
                  )}

                  {actionPlanIdFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      Plan asociado
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (actionPlanIdFromUrl) {
                    window.location.href = `/plan-accion?id=${actionPlanIdFromUrl}${
                      focusISO ? `&iso=${encodeURIComponent(focusISO)}` : ''
                    }`;
                  } else {
                    window.location.href = '/plan-accion';
                  }
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm border border-indigo-200 hover:bg-indigo-100"
              >
                Volver al plan
              </button>
            </div>
          </div>
        )}

        {!isAuditor && isRemediationMode && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Subir evidencia de corrección
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                La IA revisará el archivo. Si supera el {AI_RECOMMENDATION_THRESHOLD}% de aceptación y la evidencia está completa, quedará recomendada para aprobación humana.
              </p>
            </div>

            <textarea
              value={uploadForm.description}
              onChange={(e) =>
                setUploadForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Descripción de la evidencia"
              className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <select
                value={uploadForm.evidence_type}
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    evidence_type: e.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="documento">Documento</option>
                <option value="foto">Foto</option>
                <option value="captura">Captura</option>
                <option value="registro">Registro</option>
                <option value="otro">Otro</option>
              </select>

              <input
                type="date"
                value={uploadForm.expires_at}
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    expires_at: e.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                title="Fecha de expiración opcional"
              />

              <input
                id="evidence-file-input"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  setUploadForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] || null,
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              />
            </div>

            <button
              type="button"
              onClick={uploadEvidence}
              disabled={uploading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? 'Subiendo...' : 'Subir evidencia'}
            </button>
          </div>
        )}

        {!isAuditor && !isRemediationMode && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              Carga de evidencia directa
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Para subir evidencia desde esta vista, entra desde un Plan de Acción o desde un control específico.
            </div>
          </div>
        )}

        {focusMessage && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl px-5 py-4 shadow-sm">
            <div className="font-semibold">Apertura directa desde búsqueda</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        {filteredData.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-gray-500">
            {statusFilter
              ? 'No hay evidencias para el filtro seleccionado.'
              : 'No hay evidencias registradas para esta norma o plan de acción.'}
          </div>
        ) : (
          filteredData.map((e: EvidenceRow) => {
            const normalizedStatus = normalizeEvidenceStatus(e.status);
            const acceptancePct = toNumber(e.ai_acceptance_pct);
            const aiRisks = parseArray(e.ai_risks);
            const aiNextSteps = parseArray(e.ai_next_steps);
            const aiEntities = parseArray(e.ai_entities);

            const canApproveManually = canReviewEvidence && normalizedStatus !== 'aprobada';
            const canRejectManually = canReviewEvidence && normalizedStatus !== 'rechazada';

            return (
              <div
                key={e.id}
                id={`evidence-${e.id}`}
                className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 transition-all ${
                  focusedEvidenceId === e.id
                    ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50'
                    : normalizedStatus === 'aprobada'
                    ? 'border-green-200'
                    : normalizedStatus === 'rechazada'
                    ? 'border-red-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">
                      {e.iso || iso || 'Sin norma'} — Cláusula {e.clause || 'N/A'}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {e.control_description || 'Control asociado'}
                    </div>

                    {e.action_plan_title && (
                      <div className="mt-2 text-sm text-indigo-700">
                        Plan asociado: {e.action_plan_title}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getColor(
                        e.status || 'pendiente'
                      )}`}
                    >
                      Estado: {normalizedStatus}
                    </div>

                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getAcceptanceClass(
                        acceptancePct
                      )}`}
                    >
                      Aceptación IA: {toPercent(acceptancePct)}
                    </div>
                  </div>
                </div>

                <EvidenceAiTraceCard evidence={e} />

                {e.ai_headline && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Resumen IA
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {e.ai_headline}
                    </div>
                  </div>
                )}

                {e.auto_approved_by_ai && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                    <div className="font-semibold">Aprobación IA histórica</div>
                    <div className="mt-1 text-sm">
                      {e.ai_auto_review_reason ||
                        `La evidencia superó el ${AI_RECOMMENDATION_THRESHOLD}% de aceptación.`}
                    </div>
                    <div className="mt-2 text-xs">
                      % aceptación: <b>{toPercent(acceptancePct)}</b>
                      {e.ai_auto_approved_at ? (
                        <>
                          {' '}
                          · Fecha: <b>{formatDateTime(e.ai_auto_approved_at)}</b>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}

                {e.ai_recommended_by_ai &&
                  normalizedStatus === 'pendiente' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                      <div className="font-semibold">IA recomienda aprobación humana</div>
                      <div className="mt-1 text-sm">
                        {e.ai_recommendation_reason ||
                          `La evidencia superó el ${AI_RECOMMENDATION_THRESHOLD}% de aceptación y requiere revisión humana.`}
                      </div>
                      <div className="mt-2 text-xs">
                        % aceptación: <b>{toPercent(acceptancePct)}</b>
                        {e.ai_recommended_at ? (
                          <>
                            {' '}
                            · Fecha: <b>{formatDateTime(e.ai_recommended_at)}</b>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}

                {!e.auto_approved_by_ai &&
                  !e.ai_recommended_by_ai &&
                  normalizedStatus === 'pendiente' &&
                  e.analysis_status === 'completed' && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                      <div className="font-semibold">Revisión IA completada</div>
                      <div className="mt-1 text-sm">
                        La evidencia fue evaluada por IA con <b>{toPercent(acceptancePct)}</b> de aceptación.
                        {acceptancePct >= AI_RECOMMENDATION_THRESHOLD
                          ? ' Está lista para revisión y aprobación humana.'
                          : ` No alcanza el umbral de recomendación de ${AI_RECOMMENDATION_THRESHOLD}%.`}
                      </div>
                    </div>
                  )}

                {e.description && (
                  <div className="text-sm text-gray-600">{e.description}</div>
                )}

                {e.ai_narrative && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Narrativa IA
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{e.ai_narrative}</div>
                  </div>
                )}

                {e.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Motivo de rechazo: {e.rejection_reason}
                  </div>
                )}

                {e.action_plan_id && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                    Esta evidencia está vinculada a un plan de acción y puede impactar su flujo de aprobación y cierre.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <InfoBox label="Tipo" value={e.evidence_type || 'documento'} />
                  <InfoBox label="Validada" value={e.validated ? 'Sí' : 'No'} />
                  <InfoBox label="Creada" value={formatDate(e.created_at)} />
                  <InfoBox label="Revisada" value={formatDate(e.reviewed_at)} />
                  <InfoBox
                    label="Revisor"
                    value={e.reviewed_by_label || '-'}
                  />
                  <InfoBox
                    label="Expira"
                    value={e.expires_at ? formatDate(e.expires_at) : 'No definida'}
                  />
                  <InfoBox
                    label="% aceptación IA"
                    value={toPercent(acceptancePct)}
                  />
                  <InfoBox
                    label="Validez IA"
                    value={e.validity_result || '-'}
                  />
                  <InfoBox
                    label="Aporte IA"
                    value={e.contribution_level || '-'}
                  />
                  <InfoBox
                    label="Páginas"
                    value={e.page_count || '-'}
                  />
                  <InfoBox
                    label="Texto extraído"
                    value={e.text_char_count ? `${e.text_char_count} chars` : '-'}
                  />
                  <InfoBox
                    label="Análisis IA"
                    value={e.analysis_status || '-'}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Señales de cumplimiento
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <MiniKpi label="Pertinencia" value={toPercent(e.pertinence_score)} />
                      <MiniKpi label="Suficiencia" value={toPercent(e.sufficiency_score)} />
                      <MiniKpi label="Vigencia" value={toPercent(e.freshness_score)} />
                      <MiniKpi label="Trazabilidad" value={toPercent(e.traceability_score)} />
                      <MiniKpi label="Consistencia" value={toPercent(e.consistency_score)} />
                      <MiniKpi label="Impacto" value={toPercent(e.compliance_impact_score)} />
                    </div>

                    {e.control_fit && (
                      <div className="text-sm text-slate-700">
                        <b>Ajuste al control:</b> {e.control_fit}
                      </div>
                    )}

                    {e.gap_summary && (
                      <div className="text-sm text-slate-700">
                        <b>Brecha:</b> {e.gap_summary}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Extracción documental
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <MiniKpi label="Archivo" value={e.file_type || '-'} />
                      <MiniKpi label="OCR" value={e.ocr_used ? 'Sí' : 'No'} />
                      <MiniKpi label="Idioma" value={e.detected_language || '-'} />
                      <MiniKpi label="Hojas" value={e.sheet_count || '-'} />
                      <MiniKpi label="Imágenes" value={e.image_count || '-'} />
                      <MiniKpi label="Completa" value={e.appears_complete ? 'Sí' : 'No'} />
                    </div>

                    <div className="text-sm text-slate-700">
                      <b>Operación:</b> {e.operation_name || 'Sin operación'}
                    </div>

                    <div className="text-sm text-slate-700">
                      <b>Analizada:</b> {formatDateTime(e.analyzed_at)}
                    </div>
                  </div>
                </div>

                {(aiRisks.length > 0 || aiNextSteps.length > 0 || aiEntities.length > 0) && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <ListCard
                      title="Riesgos detectados"
                      items={aiRisks}
                      emptyText="Sin riesgos relevantes."
                    />
                    <ListCard
                      title="Siguientes pasos sugeridos"
                      items={aiNextSteps}
                      emptyText="Sin acciones sugeridas."
                    />
                    <ListCard
                      title="Entidades detectadas"
                      items={aiEntities}
                      emptyText="Sin entidades detectadas."
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {e.file_path && (
                    <button
                      type="button"
                      onClick={() =>
                        openAuthorizedFile(`${API_URL}/api/evidences/file/${e.id}`, token)
                      }
                      className="inline-flex rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Ver archivo
                    </button>
                  )}

                  {e.action_plan_id && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = `/plan-accion?id=${e.action_plan_id}${
                          e.iso ? `&iso=${encodeURIComponent(e.iso)}` : ''
                        }`;
                      }}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Abrir plan
                    </button>
                  )}
                </div>

                {canReviewEvidence && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => aprobar(e.id)}
                      disabled={!canApproveManually || reviewingId === e.id}
                      className="bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      {reviewingId === e.id && canApproveManually
                        ? 'Procesando...'
                        : normalizedStatus === 'aprobada'
                        ? 'Ya aprobada'
                        : 'Aprobar manualmente'}
                    </button>

                    <button
                      onClick={() => rechazar(e.id)}
                      disabled={!canRejectManually || reviewingId === e.id}
                      className="bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {reviewingId === e.id && canRejectManually
                        ? 'Procesando...'
                        : normalizedStatus === 'rechazada'
                        ? 'Ya rechazada'
                        : 'Rechazar manualmente'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value || '-'}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value ?? '-'}
      </div>
    </div>
  );
}

function ListCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>

      {items.length === 0 ? (
        <div className="mt-2 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="text-sm text-slate-700 flex gap-2">
              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(value: any) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value: any) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
