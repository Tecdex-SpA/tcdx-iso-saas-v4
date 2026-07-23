'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import GrcPhase1Panel from '@/components/grc/GrcPhase1Panel';
import { getUserFromToken } from '@/utils/auth';
import GoogleDriveSourcesPanel from '@/components/evidences/GoogleDriveSourcesPanel';
import IntegratedEvidenceApprovalPanel from '@/components/evidences/IntegratedEvidenceApprovalPanel';
import UnifiedEvidenceLibrary from '@/components/evidences/UnifiedEvidenceLibrary';
import { EnterpriseScrollPanel } from '@/components/ui/enterprise';
import { clearAiAuditorDraft, formatAiAuditorDraftEvidenceDescription, readAiAuditorDraftFromSession, type AiAuditorDraftPayload } from '@/utils/aiAuditorDraft';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import { translateDisplayText, translateClauseLabel, translateControlLabel, translateStatusLabel, translateStandardLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

const AI_RECOMMENDATION_THRESHOLD = 80;

type UnknownRecord = { [key: string]: unknown };

type AuthUser = {
  tenant_id?: string | null;
  tenantId?: string | null;
  tenant?: string | null;
  company_id?: string | null;
  companyId?: string | null;
  role?: string | null;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

async function openAuthorizedFile(url: string, token: string | null) {
  if (!token) {
    alert('Session unavailable. Sign in again.');
    return;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    alert('Unable to open the file.');
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
  ai_risks?: unknown;
  ai_next_steps?: unknown;
  ai_entities?: unknown;
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
  ai_orchestration_json?: unknown;
  ai_enhanced_answer_json?: unknown;
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
  operations?: OperationOption[];
  standards?: ScopeStandard[];
};

type ProcessOption = {
  id: string;
  name: string;
  code?: string | null;
  is_active?: boolean;
};

type OperationOption = {
  id: string;
  process_id?: string | null;
  name: string;
  code?: string | null;
  is_active?: boolean;
};

type EvidenceAssociationForm = {
  process_id: string;
  operation_id: string;
  notes: string;
};

type EvidenceCandidate = {
  id: string;
  label: string;
  filename?: string | null;
  title?: string | null;
  subtitle?: string | null;
  source_table?: string | null;
  source_type?: string | null;
  evidence_date?: string | null;
};


function aiTraceText(value: unknown, fallback = '') {
  return String(value ?? fallback ?? '').trim();
}

function getEvidenceAiTrace(row: EvidenceRow) {
  const orchestration = asRecord(row.ai_orchestration_json);
  const answer = asRecord(row.ai_enhanced_answer_json);
  const traceRecord = asRecord(orchestration.trace);
  const searchTrace = asRecord(orchestration.search_trace);

  const sourceLevel = aiTraceText(
    row.ai_source_level ||
      orchestration.source_level ||
      answer.source_level ||
      ''
  );

  const sourceLabel = aiTraceText(
    row.ai_source_label ||
      orchestration.source_label ||
      answer.source_label ||
      ''
  );

  const confidence = aiTraceText(
    row.ai_confidence ||
      orchestration.confidence ||
      answer.confidence ||
      ''
  );

  const confidenceScore =
    row.ai_confidence_score ||
    orchestration.confidence_score ||
    answer.confidence_score ||
    null;

  const traceId = aiTraceText(
    row.ai_trace_id ||
      traceRecord.id ||
      ''
  );

  const sourceOrder = Array.isArray(searchTrace.source_order)
    ? searchTrace.source_order.map((item) => aiTraceText(item)).filter(Boolean)
    : [];

  const tenantHits = Number(searchTrace.tenant_hits ?? 0);
  const knowledgeHits = Number(searchTrace.knowledge_hits ?? 0);
  const benchmarkHits = Number(searchTrace.benchmark_hits ?? 0);
  const externalHits = Number(searchTrace.external_hits ?? 0);

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
    executiveSummary: aiTraceText(answer.executive_summary || ''),
    recommendation: aiTraceText(answer.recommendation || ''),
    suggestedEvidence: Array.isArray(answer.suggested_evidence)
      ? answer.suggested_evidence.map((item) => aiTraceText(item)).filter(Boolean)
      : [],
    nextSteps: Array.isArray(answer.next_steps)
      ? answer.next_steps.map((item) => aiTraceText(item)).filter(Boolean)
      : [],
  };
}

function EvidenceAiTraceCard({ evidence }: { evidence: EvidenceRow }) {
  const { t } = useTranslation();
  const trace = getEvidenceAiTrace(evidence);

  if (!trace.hasTrace) return null;

  const sourceLabels: Record<string, string> = {
    tenant_internal: 'Tenant',
    tcdx_knowledge: 'Base TCDX',
    anonymized_benchmark: 'Benchmark',
    external_web: 'Internet',
    best_effort: t('evidence.ai.bestEffort'),
  };

  const sourceName =
    trace.sourceLabel ||
    sourceLabels[trace.sourceLevel] ||
    trace.sourceLevel ||
    t('evidence.ai.engine');

  const sourceOrderText = trace.sourceOrder.length
    ? trace.sourceOrder.map((item) => sourceLabels[item] || item).join(' → ')
    : t('evidence.ai.notReported');

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
            {t('evidence.ai.orchestration')}
          </div>

          <div className="mt-2 text-sm leading-6 text-blue-950">
            {t('evidence.ai.traceability')}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-bold ring-1 ${sourceClass}`}>
            {t('evidence.ai.source')}: {sourceName}
          </span>

          {trace.confidence && (
            <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700 ring-1 ring-slate-200">
              {t('evidence.ai.confidence')}: {trace.confidence}
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
          {t('evidence.ai.route')}: {sourceOrderText}
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
                {t('evidence.ai.centralSummary')}
              </div>
              <div className="text-sm leading-6 text-slate-700">
                {trace.executiveSummary}
              </div>
            </div>
          )}

          {trace.recommendation && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4">
              <div className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                {t('evidence.ai.centralRecommendation')}
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
            {t('evidence.ai.viewSuggested')}
          </summary>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {trace.suggestedEvidence.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {t('evidence.ai.suggestedEvidence')}
                </div>

                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.suggestedEvidence.slice(0, 8).map((item, index: number) => (
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
                  {t('evidence.ai.nextSteps')}
                </div>

                <ul className="space-y-2 text-sm text-slate-700">
                  {trace.nextSteps.slice(0, 8).map((item, index: number) => (
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


function resolveTenantId(user: AuthUser | null): string {
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
  const { t } = useTranslation();

  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">{t('evidence.loading')}</div>
        </AppLayout>
      }
    >
      <EvidenciasPageContent />
    </Suspense>
  );
}

function EvidenciasPageContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const { loading: entitlementsLoading, canUseAiFeature } = useTenantEntitlements();
  const canUseEvidenceAi = !entitlementsLoading && (canUseAiFeature('auditor') || canUseAiFeature('suggestions'));

  const focusId = searchParams.get('id');
  const focusISO = searchParams.get('iso');
  const tenantControlIdFromUrl = searchParams.get('tenant_control_id');
  const actionPlanIdFromUrl = searchParams.get('action_plan_id');
  const clauseFromUrl = searchParams.get('clause');
  const aiAuditorDraftKey = searchParams.get('draft_key');
  const aiAuditorDraftSource = searchParams.get('source');
  const aiAuditorDraftMode = searchParams.get('draft');
  const showLegacyUpload = searchParams.get('legacy_upload') === '1';

  const [data, setData] = useState<EvidenceRow[]>([]);
  const [standards, setStandards] = useState<ScopeStandard[]>([]);
  const [iso, setIso] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reviewingId, setReviewingId] = useState('');
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [focusedEvidenceId, setFocusedEvidenceId] = useState('');
  const [aiAuditorDraft, setAiAuditorDraft] = useState<AiAuditorDraftPayload | null>(null);
  const [aiAuditorDraftMessage, setAiAuditorDraftMessage] = useState('');
  const [focusMessage, setFocusMessage] = useState('');
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([]);
  const [operationOptionsByProcess, setOperationOptionsByProcess] = useState<Record<string, OperationOption[]>>({});
  const [evidenceAssociationForms, setEvidenceAssociationForms] = useState<Record<string, EvidenceAssociationForm>>({});
  const [associatingEvidenceId, setAssociatingEvidenceId] = useState('');
  const [associationMessage, setAssociationMessage] = useState('');
  const [evidenceCandidates, setEvidenceCandidates] = useState<EvidenceCandidate[]>([]);
  const [evidenceCandidateSearch, setEvidenceCandidateSearch] = useState('');
  const [evidenceCandidatesLoading, setEvidenceCandidatesLoading] = useState(false);
  const [libraryAssociationForm, setLibraryAssociationForm] = useState<EvidenceAssociationForm & { target_id: string }>({
    process_id: '',
    operation_id: '',
    notes: '',
    target_id: '',
  });
  const [libraryAssociating, setLibraryAssociating] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    description: '',
    evidence_type: 'documento',
    expires_at: '',
    file: null as File | null,
  });

  const uploadAccept =
    uploadForm.evidence_type === 'foto' || uploadForm.evidence_type === 'captura'
      ? 'image/*'
      : undefined;

  const focusAppliedRef = useRef(false);

  const role = String(user?.role || '').toLowerCase().trim();
  const isAuditor = role === 'auditor';
  const canManageEvidenceAssociations =
    role === 'admin' ||
    role === 'tenant_admin' ||
    role === 'admin_cumplimiento' ||
    role === 'compliance_admin';
  const canReviewEvidence =
    isAuditor ||
    role === 'admin' ||
    role === 'tenant_admin' ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    role === 'owner';

  const isRemediationMode = Boolean(tenantControlIdFromUrl || actionPlanIdFromUrl);
  const tenantId = resolveTenantId(user);
  const libraryOperationOptions = libraryAssociationForm.process_id
    ? operationOptionsByProcess[libraryAssociationForm.process_id] || []
    : [];
  const selectedLibraryProcess = processOptions.find((item) => item.id === libraryAssociationForm.process_id);
  const selectedEvidenceCandidate = evidenceCandidates.find((item) => item.id === libraryAssociationForm.target_id);

  const updateEvidenceAssociationForm = (
    evidenceId: string,
    patch: Partial<EvidenceAssociationForm>
  ) => {
    setEvidenceAssociationForms((prev) => ({
      ...prev,
      [evidenceId]: {
        process_id: prev[evidenceId]?.process_id || '',
        operation_id: prev[evidenceId]?.operation_id || '',
        notes: prev[evidenceId]?.notes || '',
        ...patch,
      },
    }));
  };

  const loadProcessOptions = async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tenant-processes?is_active=true`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setProcessOptions([]);
        return;
      }

      setProcessOptions(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error('ERROR LOAD PROCESS OPTIONS:', err);
      setProcessOptions([]);
    }
  };

  const loadOperationOptions = async (processId: string, authToken: string) => {
    if (!processId || operationOptionsByProcess[processId]) return;

    try {
      const res = await fetch(
        `${API_URL}/api/tenant-processes/${processId}/operations?is_active=true`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const json = await res.json();

      setOperationOptionsByProcess((prev) => ({
        ...prev,
        [processId]: res.ok && Array.isArray(json?.data) ? json.data : [],
      }));
    } catch (err) {
      console.error('ERROR LOAD OPERATION OPTIONS:', err);
      setOperationOptionsByProcess((prev) => ({ ...prev, [processId]: [] }));
    }
  };

  const associateEvidenceToProcess = async (evidence: EvidenceRow) => {
    if (!token || !canManageEvidenceAssociations) return;

    const form = evidenceAssociationForms[evidence.id];
    if (!form?.process_id) {
      alert('Selecciona un proceso antes de asociar la evidencia.');
      return;
    }

    try {
      setAssociatingEvidenceId(evidence.id);
      const res = await fetch(`${API_URL}/api/tenant-process-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          process_id: form.process_id,
          operation_id: form.operation_id || null,
          target_type: 'evidence',
          target_id: evidence.id,
          relation_type: 'associated',
          source: 'manual',
          notes: form.notes || null,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'No fue posible asociar la evidencia.');
        return;
      }

      setAssociationMessage('Evidencia asociada al proceso/operación correctamente.');
      setEvidenceAssociationForms((prev) => ({
        ...prev,
        [evidence.id]: {
          process_id: form.process_id,
          operation_id: form.operation_id || '',
          notes: '',
        },
      }));
    } catch (err) {
      console.error('ERROR ASSOCIATE EVIDENCE:', err);
      alert('No fue posible asociar la evidencia.');
    } finally {
      setAssociatingEvidenceId('');
    }
  };

  const formatEvidenceCandidateSource = (candidate: EvidenceCandidate) => {
    const rawSource = candidate.source_type || candidate.source_table || candidate.subtitle || 'Documento';
    const sourceLabels: Record<string, string> = {
      formal_evidence: 'Evidencia registrada',
      evidences: 'Evidencia registrada',
      document_index: 'Documento indexado',
      google_drive: 'Google Drive',
      zoho: 'Zoho',
      mounted_share: 'Repositorio documental',
      manual: 'Carga manual',
    };
    const source = sourceLabels[rawSource] || rawSource;
    const date = formatDate(candidate.evidence_date);
    return date === '-' ? source : `${source} · ${date}`;
  };

  const loadEvidenceCandidates = async (authToken: string, search = '') => {
    try {
      setEvidenceCandidatesLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(
        `${API_URL}/api/tenant-process-links/candidates/evidence?${params.toString()}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const json = await res.json();

      if (!res.ok) {
        setEvidenceCandidates([]);
        return;
      }

      setEvidenceCandidates(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error('ERROR LOAD EVIDENCE CANDIDATES:', err);
      setEvidenceCandidates([]);
    } finally {
      setEvidenceCandidatesLoading(false);
    }
  };

  const associateLibraryEvidence = async () => {
    if (!token || !canManageEvidenceAssociations) return;

    if (!libraryAssociationForm.target_id || !libraryAssociationForm.process_id) {
      alert('Selecciona un documento/evidencia y un proceso antes de asociar.');
      return;
    }

    try {
      setLibraryAssociating(true);
      const res = await fetch(`${API_URL}/api/tenant-process-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          process_id: libraryAssociationForm.process_id,
          operation_id: libraryAssociationForm.operation_id || null,
          target_type: 'evidence',
          target_id: libraryAssociationForm.target_id,
          relation_type: 'associated',
          source: 'manual',
          notes: libraryAssociationForm.notes || null,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'No fue posible asociar el documento/evidencia.');
        return;
      }

      setAssociationMessage('Documento/evidencia asociado al proceso/operación correctamente.');
      setLibraryAssociationForm((prev) => ({ ...prev, notes: '' }));
    } catch (err) {
      console.error('ERROR ASSOCIATE LIBRARY EVIDENCE:', err);
      alert('No fue posible asociar el documento/evidencia.');
    } finally {
      setLibraryAssociating(false);
    }
  };


  useEffect(() => {
    if (entitlementsLoading || !canUseEvidenceAi) return;
    if (aiAuditorDraftSource !== 'ai-auditor' || aiAuditorDraftMode !== '1') return;
    if (!aiAuditorDraftKey) return;

    const draft = readAiAuditorDraftFromSession(aiAuditorDraftKey);

    if (!draft) {
      setAiAuditorDraftMessage('No fue posible leer el borrador preparado por IA Auditor Senior.');
      return;
    }

    setAiAuditorDraft(draft);
    setAiAuditorDraftMessage('Borrador preparado por IA Auditor Senior. Revísalo antes de guardar.');

    setUploadForm((prev) => ({
      ...prev,
      description: formatAiAuditorDraftEvidenceDescription(draft) || prev.description,
      evidence_type: prev.evidence_type || 'documento',
    }));

    const draftISO = draft.standard_code || draft.iso_code;
    if (draftISO) {
      setIso(draftISO);
    }
  }, [aiAuditorDraftSource, aiAuditorDraftMode, aiAuditorDraftKey, canUseEvidenceAi, entitlementsLoading]);

  const discardAiAuditorDraft = () => {
    clearAiAuditorDraft(aiAuditorDraftKey);
    setAiAuditorDraft(null);
    setAiAuditorDraftMessage('');
    setUploadForm((prev) => ({
      ...prev,
      description: '',
    }));
  };


  useEffect(() => {
    if (!token || !canManageEvidenceAssociations) return;
    loadProcessOptions(token);
    loadEvidenceCandidates(token);
  }, [token, canManageEvidenceAssociations]);

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

  const toNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const toPercent = (value: unknown) => `${Math.round(toNumber(value))}%`;

  const parseArray = (value: unknown): string[] => {
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

  const isOperationalStandard = useCallback((s: ScopeStandard) =>
    s?.is_active === true &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0, []);

  const loadStandards = useCallback(async (resolvedTenantId: string, authToken: string) => {
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
  }, [focusISO, isOperationalStandard]);

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken() as AuthUser | null;
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
          prev.description || t('evidence.remediationDefaultDescription'),
      }));
    }

    loadStandards(resolvedTenantId, authToken);
  }, [actionPlanIdFromUrl, loadStandards, tenantControlIdFromUrl, t]);

  const load = useCallback(async (resolvedTenantId: string, authToken: string, selectedIso: string) => {
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
  }, [actionPlanIdFromUrl, tenantControlIdFromUrl]);

  useEffect(() => {
    if (!token || !tenantId) return;

    if (!loadingStandards) {
      load(tenantId, token, iso);
    }
  }, [
    load,
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
      alert('Debes seleccionar un archivo.');
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
          ? t('evidence.manualApprovalSuccessWithPlan')
          : t('evidence.manualApprovalSuccess')
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
    const reason = window.prompt(t('evidence.rejectionPrompt'), '') || '';

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

      alert(t('evidence.manualRejectionSuccess'));
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

  const applyFocus = useCallback((evidence: EvidenceRow) => {
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
  }, [iso]);

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
  }, [applyFocus, focusId, data, loading, iso, standards]);

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
    const search = evidenceSearch.trim().toLowerCase();

    return data.filter((row) => {
      if (statusFilter && normalizeEvidenceStatus(row.status) !== statusFilter) return false;
      if (!search) return true;

      return [
        row.description,
        row.file_name,
        row.iso,
        row.clause,
        row.control_description,
        row.operation_name,
        row.operation_code,
        row.action_plan_title,
        row.evidence_type,
        row.status,
      ]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(search));
    });
  }, [data, evidenceSearch, statusFilter]);

  if (!token) {
    return (
      <AppLayout>
        <div className="p-6">{t('evidence.loading')}</div>
      </AppLayout>
    );
  }

  if (!showLegacyUpload) {
    return (
      <AppLayout>
        <div className="tcdx-evidence-refinement">
          <UnifiedEvidenceLibrary token={token} canManage={canManageEvidenceAssociations} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="tcdx-evidence-refinement min-h-screen bg-[var(--tcdx-color-surface)] p-6 space-y-5">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {t('evidence.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('evidence.subtitle')}
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
              <option value="">{t('evidence.allStatuses')}</option>
              <option value="pendiente">{t('statuses.evidence.pendiente')}</option>
              <option value="aprobada">{t('statuses.evidence.aprobada')}</option>
              <option value="rechazada">{t('statuses.evidence.rechazada')}</option>
            </select>

            <input
              type="search"
              value={evidenceSearch}
              onChange={(e) => setEvidenceSearch(e.target.value)}
              placeholder="Buscar evidencia, archivo, control..."
              className="min-w-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            />

            <button
              type="button"
              onClick={refresh}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {t('common.refresh')}
            </button>

            <button
              type="button"
              onClick={refreshHealth}
              disabled={healthRefreshing}
              className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#24384a] disabled:opacity-60"
            >
              {healthRefreshing ? t('evidence.recalculating') : t('evidence.recalculateHealth')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <MetricCard title={t('common.all')} value={metrics.total} />
          <MetricCard title={t('statuses.evidence.pendiente')} value={metrics.pendientes} />
          <MetricCard title={t('statuses.evidence.aprobada')} value={metrics.aprobadas} />
          <MetricCard title={t('statuses.evidence.rechazada')} value={metrics.rechazadas} />
          <MetricCard title={t('evidence.linkedToPlan')} value={metrics.vinculadasPlan} />
          {canUseEvidenceAi && <MetricCard title={t('evidence.aiRecommended')} value={metrics.recomendadasIa} />}
        </div>

        {tenantId && (
          <>
            <GoogleDriveSourcesPanel tenantId={tenantId} />
            <IntegratedEvidenceApprovalPanel tenantId={tenantId} />
          </>
        )}

        {isRemediationMode && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-indigo-950">
                  {t('evidence.remediationTitle')}
                </h2>

                <p className="mt-1 text-sm text-indigo-800">
                  {t('evidence.remediationHelp')}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {focusISO && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      {t('dashboard.standard')}: {focusISO}
                    </span>
                  )}

                  {clauseFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      {t('evidence.clause')}: {clauseFromUrl}
                    </span>
                  )}

                  {tenantControlIdFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      {t('findings.fields.associatedControl')}
                    </span>
                  )}

                  {actionPlanIdFromUrl && (
                    <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-indigo-700">
                      {t('evidence.linkedPlan')}
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
                {t('evidence.backToPlan')}
              </button>
            </div>
          </div>
        )}

        {!isAuditor && isRemediationMode && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {t('evidence.uploadCorrectiveEvidence')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {canUseEvidenceAi
                  ? t('evidence.correctiveEvidenceHelp', { threshold: AI_RECOMMENDATION_THRESHOLD })
                  : t('evidence.directUploadHelp')}
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
              placeholder={t('evidence.descriptionPlaceholder')}
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
                <option value="documento">{t('evidence.types.document')}</option>
                <option value="foto">{t('evidence.types.photo')}</option>
                <option value="captura">{t('evidence.types.screenshot')}</option>
                <option value="registro">{t('evidence.types.record')}</option>
                <option value="otro">{t('evidence.types.other')}</option>
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
                title={t('evidence.optionalExpiration')}
              />

              <input
                id="evidence-file-input"
                type="file"
                accept={uploadAccept}
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
              {uploading ? t('common.upload') + '...' : t('controls.uploadEvidence')}
            </button>
          </div>
        )}

        {!isAuditor && !isRemediationMode && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              {t('evidence.directUploadTitle')}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {t('evidence.directUploadHelp')}
            </div>
          </div>
        )}

        {associationMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {associationMessage}
          </div>
        )}

        {canManageEvidenceAssociations && (
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  Asociar biblioteca documental a proceso u operación
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Selecciona una evidencia registrada o documento indexado del tenant autenticado. No se envía tenant_id desde el navegador.
                </p>
                {selectedLibraryProcess && (
                  <div className="mt-2 text-xs font-semibold text-blue-900">
                    Proceso seleccionado: {selectedLibraryProcess?.name}
                    {libraryAssociationForm.operation_id && (
                      <>
                        {' '}
                        · Operación seleccionada:{' '}
                        {libraryOperationOptions.find((item) => item.id === libraryAssociationForm.operation_id)?.name || 'Operación'}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={evidenceCandidateSearch}
                    onChange={(event) => setEvidenceCandidateSearch(event.target.value)}
                    placeholder="Buscar evidencia o documento"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => token && loadEvidenceCandidates(token, evidenceCandidateSearch)}
                    disabled={evidenceCandidatesLoading}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    Buscar
                  </button>
                </div>

                <select
                  value={libraryAssociationForm.target_id}
                  onChange={(event) =>
                    setLibraryAssociationForm((prev) => ({
                      ...prev,
                      target_id: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    {evidenceCandidatesLoading
                      ? 'Cargando evidencias/documentos...'
                      : 'Seleccionar evidencia/documento'}
                  </option>
                  {evidenceCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.filename || candidate.title || candidate.label} - {formatEvidenceCandidateSource(candidate)}
                    </option>
                  ))}
                </select>

                {!evidenceCandidatesLoading && evidenceCandidates.length === 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    No hay evidencias/documentos disponibles para asociar.
                  </div>
                )}

                {selectedEvidenceCandidate && (
                  <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {selectedEvidenceCandidate?.filename || selectedEvidenceCandidate?.title || selectedEvidenceCandidate?.label}
                    <span className="ml-2 text-slate-400">
                      {selectedEvidenceCandidate ? formatEvidenceCandidateSource(selectedEvidenceCandidate!) : ''}
                    </span>
                  </div>
                )}
              </div>

              <select
                value={libraryAssociationForm.process_id}
                onChange={(event) => {
                  const processId = event.target.value;
                  setLibraryAssociationForm((prev) => ({
                    ...prev,
                    process_id: processId,
                    operation_id: '',
                  }));
                  if (processId && token) {
                    loadOperationOptions(processId, token);
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Seleccionar proceso</option>
                {processOptions.map((processItem) => (
                  <option key={processItem.id} value={processItem.id}>
                    {processItem.code ? `${processItem.code} - ${processItem.name}` : processItem.name}
                  </option>
                ))}
              </select>

              <select
                value={libraryAssociationForm.operation_id}
                onChange={(event) =>
                  setLibraryAssociationForm((prev) => ({
                    ...prev,
                    operation_id: event.target.value,
                  }))
                }
                disabled={!libraryAssociationForm.process_id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Operación opcional</option>
                {libraryOperationOptions.map((operation) => (
                  <option key={operation.id} value={operation.id}>
                    {operation.code ? `${operation.code} - ${operation.name}` : operation.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={libraryAssociationForm.notes}
                onChange={(event) =>
                  setLibraryAssociationForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder="Nota opcional"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={associateLibraryEvidence}
                disabled={
                  !libraryAssociationForm.target_id ||
                  !libraryAssociationForm.process_id ||
                  libraryAssociating
                }
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {libraryAssociating ? 'Asociando...' : 'Asociar documento/evidencia'}
              </button>
            </div>
          </div>
        )}


        {canUseEvidenceAi && aiAuditorDraft && (
          <div className="mb-5 rounded-[26px] border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-indigo-600">
                  IA Auditor Senior
                </div>
                <div className="mt-1 text-sm font-bold">
                  {aiAuditorDraftMessage || 'Borrador preparado por IA Auditor Senior'}
                </div>
                <div className="mt-1 text-sm leading-6 text-indigo-800">
                  Debe ser revisado y confirmado por un humano antes de guardar. No se creó ninguna evidencia automáticamente.
                </div>
                <div className="mt-2 text-sm font-semibold text-indigo-900">
                  Debe adjuntar archivo o evidencia antes de guardar.
                </div>
              </div>
              <button
                type="button"
                onClick={discardAiAuditorDraft}
                className="rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Descartar borrador
              </button>
            </div>
          </div>
        )}

        {focusMessage && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl px-5 py-4 shadow-sm">
            <div className="font-semibold">{t('controls.directOpen')}</div>
            <div className="text-sm mt-1">{focusMessage}</div>
          </div>
        )}

        {!loading && filteredData.length > 0 && (
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {filteredData.length} evidencia{filteredData.length === 1 ? '' : 's'} en la vista actual
          </div>
        )}

        {filteredData.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-gray-500">
            {statusFilter || evidenceSearch
              ? t('evidence.noEvidenceForFilter')
              : t('evidence.noEvidenceForScope')}
          </div>
        ) : (
          <EnterpriseScrollPanel maxHeight="560px" className="space-y-4 pr-2">
          {filteredData.map((e: EvidenceRow) => {
            const normalizedStatus = normalizeEvidenceStatus(e.status);
            const acceptancePct = toNumber(e.ai_acceptance_pct);
            const aiRisks = parseArray(e.ai_risks);
            const aiNextSteps = parseArray(e.ai_next_steps);
            const aiEntities = parseArray(e.ai_entities);

            const canApproveManually = canReviewEvidence && normalizedStatus !== 'aprobada';
            const canRejectManually = canReviewEvidence && normalizedStatus !== 'rechazada';
            const associationForm = evidenceAssociationForms[e.id] || {
              process_id: '',
              operation_id: '',
              notes: '',
            };
            const selectedProcess = processOptions.find((item) => item.id === associationForm.process_id);
            const operationOptions = associationForm.process_id
              ? operationOptionsByProcess[associationForm.process_id] || []
              : [];

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
                      {translateStandardLabel(e.iso || iso || t('evidence.noStandard'), locale)} — {translateClauseLabel(e.clause || 'N/A', locale)}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {translateControlLabel(e.control_description, locale) || t('findings.fields.associatedControl')}
                    </div>

                    {e.action_plan_title && (
                      <div className="mt-2 text-sm text-indigo-700">
                        {t('evidence.linkedPlan')}: {translateDisplayText(e.action_plan_title, locale, 'actionPlan')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getColor(
                        e.status || 'pendiente'
                      )}`}
                    >
                      {t('common.status')}: {translateStatusLabel(normalizedStatus, locale)}
                    </div>

                    {canUseEvidenceAi && (
                      <div
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getAcceptanceClass(
                          acceptancePct
                        )}`}
                      >
                        {t('evidence.aiAcceptance')}: {toPercent(acceptancePct)}
                      </div>
                    )}
                  </div>
                </div>

                {canUseEvidenceAi && <EvidenceAiTraceCard evidence={e} />}

                {canUseEvidenceAi && e.ai_headline && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {t('evidence.aiSummary')}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {e.ai_headline}
                    </div>
                  </div>
                )}

                {canUseEvidenceAi && e.auto_approved_by_ai && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                    <div className="font-semibold">{t('evidence.historicalAiApproval')}</div>
                    <div className="mt-1 text-sm">
                      {e.ai_auto_review_reason ||
                        t('evidence.aiHistoricalApprovalReason', {
                          threshold: AI_RECOMMENDATION_THRESHOLD,
                        })}
                    </div>
                    <div className="mt-2 text-xs">
                      {t('evidence.acceptancePercentLabel')}: <b>{toPercent(acceptancePct)}</b>
                      {e.ai_auto_approved_at ? (
                        <>
                          {' '}
                          · {t('evidence.dateLabel')}: <b>{formatDateTime(e.ai_auto_approved_at)}</b>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}

                {canUseEvidenceAi && e.ai_recommended_by_ai &&
                  normalizedStatus === 'pendiente' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                      <div className="font-semibold">{t('evidence.aiRecommendsHumanApproval')}</div>
                      <div className="mt-1 text-sm">
                        {e.ai_recommendation_reason ||
                          t('evidence.aiHumanReviewReason', {
                            threshold: AI_RECOMMENDATION_THRESHOLD,
                          })}
                      </div>
                      <div className="mt-2 text-xs">
                        {t('evidence.acceptancePercentLabel')}: <b>{toPercent(acceptancePct)}</b>
                        {e.ai_recommended_at ? (
                          <>
                            {' '}
                            · {t('evidence.dateLabel')}: <b>{formatDateTime(e.ai_recommended_at)}</b>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}

                {canUseEvidenceAi &&
                  !e.auto_approved_by_ai &&
                  !e.ai_recommended_by_ai &&
                  normalizedStatus === 'pendiente' &&
                  e.analysis_status === 'completed' && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
                      <div className="font-semibold">{t('evidence.aiReviewCompleted')}</div>
                      <div className="mt-1 text-sm">
                        {t('evidence.aiReviewedWithAcceptancePrefix')} <b>{toPercent(acceptancePct)}</b>{' '}
                        {t('evidence.aiReviewedWithAcceptanceSuffix')}
                        {acceptancePct >= AI_RECOMMENDATION_THRESHOLD
                          ? t('evidence.readyForHumanReview')
                          : t('evidence.aiBelowThreshold', {
                              threshold: AI_RECOMMENDATION_THRESHOLD,
                            })}
                      </div>
                    </div>
                  )}

                {e.description && (
                  <div className="text-sm text-gray-600">{translateDisplayText(e.description, locale, 'evidence')}</div>
                )}

                {canUseEvidenceAi && e.ai_narrative && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {t('evidence.aiNarrative')}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{e.ai_narrative}</div>
                  </div>
                )}

                {e.rejection_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {t('evidence.rejectionReason')}: {translateDisplayText(e.rejection_reason, locale, 'evidence')}
                  </div>
                )}

                {e.action_plan_id && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                    {t('evidence.linkedPlanImpact')}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <InfoBox label={t('evidence.type')} value={translateDisplayText(e.evidence_type || t('evidence.types.document'), locale, 'evidence')} />
                  <InfoBox label={t('evidence.validated')} value={e.validated ? t('common.yes') : t('common.no')} />
                  <InfoBox label={t('evidence.created')} value={formatDate(e.created_at)} />
                  <InfoBox label={t('evidence.reviewed')} value={formatDate(e.reviewed_at)} />
                  <InfoBox
                    label={t('evidence.reviewer')}
                    value={e.reviewed_by_label || '-'}
                  />
                  <InfoBox
                    label={t('evidence.expires')}
                    value={e.expires_at ? formatDate(e.expires_at) : t('evidence.notDefined')}
                  />
                  {canUseEvidenceAi && (
                    <>
                      <InfoBox
                        label={t('evidence.aiAcceptancePercent')}
                        value={toPercent(acceptancePct)}
                      />
                      <InfoBox
                        label={t('evidence.aiValidity')}
                        value={e.validity_result || '-'}
                      />
                      <InfoBox
                        label={t('evidence.aiContribution')}
                        value={e.contribution_level || '-'}
                      />
                    </>
                  )}
                  <InfoBox
                    label={t('evidence.pages')}
                    value={e.page_count || '-'}
                  />
                  <InfoBox
                    label={t('evidence.extractedText')}
                    value={e.text_char_count ? `${e.text_char_count} ${t('evidence.characters')}` : '-'}
                  />
                  {canUseEvidenceAi && (
                    <InfoBox
                      label={t('evidence.aiAnalysis')}
                      value={e.analysis_status || '-'}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {t('evidence.complianceSignals')}
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <MiniKpi label={t('evidence.metrics.pertinence')} value={toPercent(e.pertinence_score)} />
                      <MiniKpi label={t('evidence.metrics.sufficiency')} value={toPercent(e.sufficiency_score)} />
                      <MiniKpi label={t('evidence.metrics.freshness')} value={toPercent(e.freshness_score)} />
                      <MiniKpi label={t('evidence.metrics.traceability')} value={toPercent(e.traceability_score)} />
                      <MiniKpi label={t('evidence.metrics.consistency')} value={toPercent(e.consistency_score)} />
                      <MiniKpi label={t('evidence.metrics.impact')} value={toPercent(e.compliance_impact_score)} />
                    </div>

                    {e.control_fit && (
                      <div className="text-sm text-slate-700">
                        <b>{t('evidence.controlFit')}:</b> {e.control_fit}
                      </div>
                    )}

                    {e.gap_summary && (
                      <div className="text-sm text-slate-700">
                        <b>{t('evidence.gap')}:</b> {e.gap_summary}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {t('evidence.documentExtraction')}
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      <MiniKpi label={t('evidence.file')} value={e.file_type || '-'} />
                      <MiniKpi label={t('evidence.ocr')} value={e.ocr_used ? t('common.yes') : t('common.no')} />
                      <MiniKpi label={t('evidence.language')} value={e.detected_language || '-'} />
                      <MiniKpi label={t('evidence.sheets')} value={e.sheet_count || '-'} />
                      <MiniKpi label={t('evidence.images')} value={e.image_count || '-'} />
                      <MiniKpi label={t('evidence.complete')} value={e.appears_complete ? t('common.yes') : t('common.no')} />
                    </div>

                    <div className="text-sm text-slate-700">
                      <b>{t('controls.operation')}:</b> {e.operation_name || t('evidence.noOperation')}
                    </div>

                    <div className="text-sm text-slate-700">
                      <b>{t('evidence.analyzed')}:</b> {formatDateTime(e.analyzed_at)}
                    </div>
                  </div>
                </div>

                {canUseEvidenceAi && (aiRisks.length > 0 || aiNextSteps.length > 0 || aiEntities.length > 0) && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <ListCard
                      title={t('evidence.detectedRisks')}
                      items={aiRisks}
                      emptyText={t('evidence.empty.detectedRisks')}
                    />
                    <ListCard
                      title={t('evidence.suggestedNextSteps')}
                      items={aiNextSteps}
                      emptyText={t('evidence.empty.nextSteps')}
                    />
                    <ListCard
                      title={t('evidence.detectedEntities')}
                      items={aiEntities}
                      emptyText={t('evidence.empty.entities')}
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
                      {t('controls.viewFile')}
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
                      {t('evidence.openPlan')}
                    </button>
                  )}
                </div>

                {canManageEvidenceAssociations && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-bold text-blue-950">
                          Asociar evidencia a proceso u operación
                        </div>
                        <div className="mt-1 text-xs text-blue-800">
                          La asociación usa el tenant autenticado y no envía tenant_id desde el navegador.
                        </div>
                        {selectedProcess && (
                          <div className="mt-2 text-xs font-semibold text-blue-900">
                            Proceso seleccionado: {selectedProcess.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
                      <select
                        value={associationForm.process_id}
                        onChange={(event) => {
                          const processId = event.target.value;
                          updateEvidenceAssociationForm(e.id, {
                            process_id: processId,
                            operation_id: '',
                          });
                          if (processId && token) {
                            loadOperationOptions(processId, token);
                          }
                        }}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar proceso</option>
                        {processOptions.map((process) => (
                          <option key={process.id} value={process.id}>
                            {process.code ? `${process.code} - ${process.name}` : process.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={associationForm.operation_id}
                        onChange={(event) =>
                          updateEvidenceAssociationForm(e.id, {
                            operation_id: event.target.value,
                          })
                        }
                        disabled={!associationForm.process_id}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Operación opcional</option>
                        {operationOptions.map((operation) => (
                          <option key={operation.id} value={operation.id}>
                            {operation.code ? `${operation.code} - ${operation.name}` : operation.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={associationForm.notes}
                        onChange={(event) =>
                          updateEvidenceAssociationForm(e.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Nota opcional"
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                      />

                      <button
                        type="button"
                        onClick={() => associateEvidenceToProcess(e)}
                        disabled={!associationForm.process_id || associatingEvidenceId === e.id}
                        className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                      >
                        {associatingEvidenceId === e.id ? 'Asociando...' : 'Asociar'}
                      </button>
                    </div>

                    {associationForm.process_id && operationOptions.length === 0 && (
                      <div className="mt-2 text-xs text-blue-700">
                        El proceso seleccionado no tiene operaciones activas disponibles o la operación es opcional.
                      </div>
                    )}
                  </div>
                )}

                {canReviewEvidence && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => aprobar(e.id)}
                      disabled={!canApproveManually || reviewingId === e.id}
                      className="bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
                    >
                      {reviewingId === e.id && canApproveManually
                        ? t('common.processing')
                        : normalizedStatus === 'aprobada'
                        ? t('evidence.alreadyApproved')
                        : t('evidence.manuallyApprove')}
                    </button>

                    <button
                      onClick={() => rechazar(e.id)}
                      disabled={!canRejectManually || reviewingId === e.id}
                      className="bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                    >
                      {reviewingId === e.id && canRejectManually
                        ? t('common.processing')
                        : normalizedStatus === 'rechazada'
                        ? t('evidence.alreadyRejected')
                        : t('evidence.manuallyReject')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          </EnterpriseScrollPanel>
        )}
        <GrcPhase1Panel mode="evidence" />
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

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
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

function formatDate(value: unknown) {
  if (!value) return '-';

  const dateValue =
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : String(value);
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value: unknown) {
  if (!value) return '-';

  const dateValue =
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : String(value);
  const date = new Date(dateValue);

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
