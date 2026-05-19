'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { translateDisplayText, translateClauseLabel, translateControlLabel, translateStatusLabel } from '@/i18n/displayText';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

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

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type OperationItem = {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  operation_type: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

type ScopeResponse = {
  operations: OperationItem[];
  standards: ScopeStandard[];
};

type CatalogControl = {
  id: string;
  iso: string;
  operation_id?: string;
  operation_name?: string;
  primary_standard_code?: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  source_type?: string;
  tenant_id?: string | null;
  base_control_id?: string | null;
  is_active?: boolean;
  tenant_control_id?: string | null;
  status?: string | null;
  base_description?: string | null;
  valid_for_standards?: string[];
  also_valid_for?: string[];
};

type CatalogResponse = {
  operation?: {
    id: string;
    name: string;
    code?: string;
    operation_type?: string;
    is_default?: boolean;
  };
  catalog_mode: string;
  generic_controls: CatalogControl[];
  personalized_controls: CatalogControl[];
  effective_controls: CatalogControl[];
};

type WorkbenchItem = {
  tenant_control_id: string;
  tenant_id: string;
  operation_id: string;
  operation_name?: string;
  operation_code?: string;
  operation_type?: string;
  catalog_control_id: string;
  iso: string;
  primary_standard_code?: string;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  source_type?: string;
  catalog_mode?: string;
  valid_for_standards?: string[];
  also_valid_for?: string[];
  declared_status?: string | null;
  declared_score?: number | null;
  priority?: string | null;
  due_date?: string | null;
  applicability?: string | null;
  responsible_user_email?: string | null;
  responsible_user_name?: string | null;
  health_score?: number;
  derived_health_status?: string | null;
  effective_health_score?: number | string | null;
  effective_health_status?: string | null;
  evidence_quality_status?: string | null;
  approved_evidence_count?: number | string | null;
  official_evidence_count?: number | string | null;
  open_action_plans_count?: number | string | null;
  overdue_action_plans_count?: number | string | null;
  is_in_active_operational_scope?: boolean | null;
  health_trace_json?: Record<string, unknown> | null;
  evidence_count?: number;
  pending_evidence_count?: number;
  open_findings_count?: number;
  open_nonconformities_count?: number;
  compliance_bucket?: string;
};

type WorkbenchResponse = {
  ok: boolean;
  tenant_id: string;
  iso: string;
  operation?: {
    id: string;
    name: string;
    code?: string;
    operation_type?: string;
    is_default?: boolean;
  };
  catalog_mode: string;
  summary: {
    total_controls: number;
    healthy_controls: number;
    attention_controls: number;
    deteriorated_controls: number;
    controls_without_evidence: number;
    controls_with_open_nc: number;
    average_health_score: number;
    catalog_mode: string;
  };
  items: WorkbenchItem[];
};

type DraftItem = {
  status: string;
  score: string;
  priority: string;
  due_date: string;
  applicability: string;
  responsible_user_id: string;
};

type EvidenceItem = {
  id: string;
  tenant_id: string;
  control_id?: string | null;
  tenant_control_id?: string | null;
  description?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  web_view_url?: string | null;
  metadata?: Record<string, any> | null;
  status?: string | null;
  validated?: boolean;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reviewed_by_label?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
  iso?: string | null;
  clause?: string | null;
  category?: string | null;
  control_description?: string | null;
  ai_acceptance_pct?: number | string | null;
  validity_result?: string | null;
  contribution_level?: string | null;
  action_plan_id?: string | null;
  action_plan_title?: string | null;
  linked_to_this_plan?: boolean;
};

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

function emptyDraft(item: WorkbenchItem): DraftItem {
  return {
    status: String(item.declared_status || 'pendiente'),
    score:
      item.declared_score === null || item.declared_score === undefined
        ? ''
        : String(item.declared_score),
    priority: String(item.priority || 'media'),
    due_date: item.due_date ? String(item.due_date).slice(0, 10) : '',
    applicability: String(item.applicability || 'aplica'),
    responsible_user_id: String(item.responsible_user_email || ''),
  };
}


function getEvidenceMetadataForDisplay(evidence: any): Record<string, any> {
  const metadata = evidence?.metadata;

  if (!metadata) return {};

  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function getIntegratedEvidenceUrl(evidence: any): string {
  const metadata = getEvidenceMetadataForDisplay(evidence);

  return String(
    metadata.web_view_url ||
      evidence?.web_view_url ||
      evidence?.file_url ||
      ''
  ).trim();
}

function isIntegratedEvidence(evidence: any): boolean {
  const metadata = getEvidenceMetadataForDisplay(evidence);

  return (
    String(evidence?.evidence_type || '').toLowerCase() === 'documento_integrado' ||
    String(metadata.source || '').toLowerCase() === 'document_integration' ||
    Boolean(metadata.source_document_id) ||
    Boolean(metadata.source_suggestion_id)
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CL');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CL');
}

function evidenceStatusClass(status?: string | null) {
  const value = String(status || '').toLowerCase();
  if (value === 'aprobada') return 'bg-green-100 text-green-700 border border-green-200';
  if (value === 'rechazada') return 'bg-red-100 text-red-700 border border-red-200';
  return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
}

function normalizeHealthStatus(status?: string | null) {
  const value = String(status || '').toLowerCase().trim();
  if (value === 'saludable') return 'saludable';
  if (value === 'atencion' || value === 'atención') return 'atencion';
  return 'deteriorado';
}

function isOperationalStandard(s: ScopeStandard) {
  return (
    s?.is_active === true &&
    Number(s?.active_operations_count || 0) > 0 &&
    Array.isArray(s?.active_operation_ids) &&
    s.active_operation_ids.length > 0
  );
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function healthBadgeClass(status?: string | null) {
  const value = normalizeHealthStatus(status);
  if (value === 'saludable') return 'bg-green-100 text-green-700 border border-green-200';
  if (value === 'atencion') return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  return 'bg-red-100 text-red-700 border border-red-200';
}

function healthCardClass(status?: string | null) {
  const value = normalizeHealthStatus(status);
  if (value === 'saludable') {
    return 'border-green-200 bg-green-50/40';
  }
  if (value === 'atencion') {
    return 'border-yellow-200 bg-yellow-50/40';
  }
  return 'border-red-200 bg-red-50/40';
}



function isOfficialIntegratedEvidence(evidence: any): boolean {
  const metadata = evidence?.metadata || {};
  return (
    isIntegratedEvidence(evidence) &&
    (
      metadata.official_evidence === true ||
      metadata.official_evidence === 'true' ||
      Boolean(metadata.officialized_at)
    )
  );
}

function getIntegratedEvidenceCompliancePct(evidence: any): number | null {
  const direct = Number(evidence?.ai_acceptance_pct)
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct)

  const confidence = Number(
    evidence?.suggestion_confidence_score ||
    evidence?.metadata?.suggestion_confidence_score ||
    evidence?.metadata?.confidence_score
  )

  if (Number.isFinite(confidence) && confidence > 0) {
    return Math.round(confidence <= 1 ? confidence * 100 : confidence)
  }

  return null
}


function getEffectiveHealthStatus(item: WorkbenchItem): string | null {
  return item.effective_health_status || item.derived_health_status || null;
}

function getEffectiveHealthScore(item: WorkbenchItem): number {
  const raw = item.effective_health_score ?? item.health_score ?? 0;
  return toNumber(raw);
}

function mapEvidenceQualityLabel(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'oficial') return 'Evidencia oficial';
  if (normalized === 'aprobada_no_oficial') return 'Aprobada no oficial';
  if (normalized === 'pendiente_revision') return 'Pendiente de revisión';
  if (normalized === 'rechazada') return 'Evidencia rechazada';
  if (normalized === 'sin_evidencia') return 'Sin evidencia';

  return 'Sin evidencia';
}

function getEvidenceQualityClass(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'oficial') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized === 'aprobada_no_oficial') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (normalized === 'pendiente_revision') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalized === 'rechazada') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function getEffectiveComplianceBucket(item: WorkbenchItem): string {
  return String(item.compliance_bucket || '').toLowerCase();
}


export default function ControlesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6">Cargando controles...</div>
        </AppLayout>
      }
    >
      <ControlesPageContent />
    </Suspense>
  );
}

function ControlesPageContent() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const mapHealthLabel = (value?: string | null) => {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'saludable') return t('statuses.controls.saludable');
    if (raw === 'atencion') return t('statuses.controls.atencion');
    if (raw === 'deteriorado') return t('statuses.controls.deteriorado');
    return value || t('common.noData');
  };

  const focusId = searchParams.get('id') || '';
  const focusISO = searchParams.get('iso') || '';
  const focusOperationId = searchParams.get('operation_id') || '';

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [scope, setScope] = useState<ScopeResponse>({ operations: [], standards: [] });

  const [selectedISO, setSelectedISO] = useState('');
  const [selectedOperationId, setSelectedOperationId] = useState('');
  const [healthFilter, setHealthFilter] = useState<
    'todos' | 'saludable' | 'atencion' | 'deteriorado'
  >('todos');
  const [searchText, setSearchText] = useState('');

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [workbench, setWorkbench] = useState<WorkbenchResponse | null>(null);

  const [loadingScope, setLoadingScope] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingWorkbench, setLoadingWorkbench] = useState(true);

  const [actionLoading, setActionLoading] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({});
  const [collapsedAvailableClauses, setCollapsedAvailableClauses] = useState<
    Record<string, boolean>
  >({});
  const [collapsedEnabledClauses, setCollapsedEnabledClauses] = useState<
    Record<string, boolean>
  >({});
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>(
    {}
  );
  const [evidencesByControl, setEvidencesByControl] = useState<
    Record<string, EvidenceItem[]>
  >({});
  const [uploadDescriptions, setUploadDescriptions] = useState<
    Record<string, string>
  >({});
  const [uploadFiles, setUploadFiles] = useState<Record<string, File | null>>({});
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [focusMessage, setFocusMessage] = useState('');
  const [focusedControlId, setFocusedControlId] = useState('');

  const focusAppliedRef = useRef(false);

  const tenantId = resolveTenantId(user);
  const role = String(user?.role || '').toLowerCase().trim();
  const isReadOnly = role === 'auditor';
  const canReviewEvidence =
    role === 'auditor' ||
    role === 'superadmin' ||
    role === 'super_admin' ||
    role === 'owner' ||
    role === 'tenant_admin' ||
    role === 'admin';

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (!authToken || !resolveTenantId(u)) {
      setLoadingScope(false);
      setLoadingCatalog(false);
      setLoadingWorkbench(false);
    }
  }, []);

  useEffect(() => {
    focusAppliedRef.current = false;
    setFocusedControlId('');
    setFocusMessage('');
  }, [focusId, focusISO, focusOperationId]);

  const loadScope = async (resolvedTenantId: string, authToken: string) => {
    try {
      setLoadingScope(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/tenant-standards/scope/${resolvedTenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD CONTROLS SCOPE:', json);
        setScope({ operations: [], standards: [] });
        setErrorMessage(json?.detail || json?.error || 'Error cargando alcance');
        return;
      }

      setScope({
        operations: Array.isArray(json?.operations) ? json.operations : [],
        standards: Array.isArray(json?.standards) ? json.standards : [],
      });
    } catch (err: any) {
      console.error('ERROR LOAD CONTROLS SCOPE:', err);
      setScope({ operations: [], standards: [] });
      setErrorMessage(err?.message || 'Error cargando alcance');
    } finally {
      setLoadingScope(false);
    }
  };

  const availableStandards = useMemo(() => {
    return (scope.standards || []).filter(isOperationalStandard);
  }, [scope.standards]);

  const availableOperations = useMemo(() => {
    const scopeStandard = availableStandards.find(
      (s: ScopeStandard) => s.code === selectedISO
    );

    const operationIds = new Set(scopeStandard?.active_operation_ids || []);

    return scope.operations
      .filter((op: OperationItem) => op.is_active && operationIds.has(op.id))
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
  }, [scope.operations, availableStandards, selectedISO]);

  useEffect(() => {
    if (availableStandards.length === 0) {
      setSelectedISO('');
      return;
    }

    setSelectedISO((prev: string) => {
      if (focusISO) {
        const existsFocus = availableStandards.some(
          (s: ScopeStandard) => s.code === focusISO
        );
        if (existsFocus) return focusISO;
      }

      const exists = availableStandards.some((s: ScopeStandard) => s.code === prev);
      return exists ? prev : availableStandards[0].code;
    });
  }, [availableStandards, focusISO]);

  useEffect(() => {
    if (!selectedISO) {
      setSelectedOperationId('');
      return;
    }

    if (availableOperations.length === 0) {
      setSelectedOperationId('');
      return;
    }

    setSelectedOperationId((prev: string) => {
      if (focusOperationId) {
        const existsFocus = availableOperations.some(
          (op: OperationItem) => op.id === focusOperationId
        );
        if (existsFocus) return focusOperationId;
      }

      const exists = availableOperations.some((op: OperationItem) => op.id === prev);
      return exists ? prev : availableOperations[0].id;
    });
  }, [selectedISO, availableOperations, focusOperationId]);

  const loadCatalog = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string,
    operationId: string
  ) => {
    try {
      setLoadingCatalog(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/controls/catalog/${resolvedTenantId}/${encodeURIComponent(
          iso
        )}?operation_id=${encodeURIComponent(operationId)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD CONTROL CATALOG:', json);
        setCatalog(null);
        setErrorMessage(json?.detail || json?.error || 'Error cargando catálogo');
        return;
      }

      setCatalog(json);
    } catch (err: any) {
      console.error('ERROR LOAD CONTROL CATALOG:', err);
      setCatalog(null);
      setErrorMessage(err?.message || 'Error cargando catálogo');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadWorkbench = async (
    resolvedTenantId: string,
    authToken: string,
    iso: string,
    operationId: string
  ) => {
    try {
      setLoadingWorkbench(true);
      setErrorMessage('');

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${resolvedTenantId}/${encodeURIComponent(
          iso
        )}?operation_id=${encodeURIComponent(operationId)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD CONTROL WORKBENCH:', json);
        setWorkbench(null);
        setErrorMessage(json?.detail || json?.error || 'Error cargando workbench');
        return;
      }

      setWorkbench(json);
    } catch (err: any) {
      console.error('ERROR LOAD CONTROL WORKBENCH:', err);
      setWorkbench(null);
      setErrorMessage(err?.message || 'Error cargando workbench');
    } finally {
      setLoadingWorkbench(false);
    }
  };


  const refreshTenantHealth = async () => {
    if (!token || !tenantId) return;

    try {
      await fetch(`${API_URL}/health/refresh?tenant_id=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.warn('WARN REFRESH TENANT HEALTH:', err);
    }
  };

  const loadEvidencesForControl = async (tenantControlId: string) => {
    if (!token || !tenantId) return;

    try {
      const res = await fetch(
        `${API_URL}/api/evidences/${tenantId}?tenant_control_id=${encodeURIComponent(
          tenantControlId
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error cargando evidencias');
        return;
      }

      setEvidencesByControl((prev) => ({
        ...prev,
        [tenantControlId]: Array.isArray(json) ? json : [],
      }));
    } catch (err) {
      console.error('ERROR LOAD EVIDENCES BY CONTROL:', err);
      alert('Error cargando evidencias');
    }
  };

  useEffect(() => {
    if (!token || !tenantId) return;
    void loadScope(tenantId, token);
  }, [token, tenantId]);

  useEffect(() => {
    if (!token || !tenantId || !selectedISO || !selectedOperationId) {
      if (!loadingScope) {
        setLoadingCatalog(false);
        setLoadingWorkbench(false);
      }
      return;
    }

    void Promise.all([
      loadCatalog(tenantId, token, selectedISO, selectedOperationId),
      loadWorkbench(tenantId, token, selectedISO, selectedOperationId),
    ]);
  }, [token, tenantId, selectedISO, selectedOperationId, loadingScope]);

  useEffect(() => {
    const nextDrafts: Record<string, DraftItem> = {};

    for (const item of workbench?.items || []) {
      nextDrafts[item.tenant_control_id] =
        drafts[item.tenant_control_id] || emptyDraft(item);
    }

    setDrafts(nextDrafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workbench?.items]);

  useEffect(() => {
    if (!focusId || !workbench?.items?.length || focusAppliedRef.current) return;

    const match = workbench.items.find(
      (item) => item.tenant_control_id === focusId || item.catalog_control_id === focusId
    );

    if (!match) return;

    setFocusedControlId(match.tenant_control_id);
    setFocusMessage(
      `Resultado abierto desde búsqueda: control ${match.clause || 'sin cláusula'} · ${match.description || 'sin descripción'}`
    );
    focusAppliedRef.current = true;

    setTimeout(() => {
      const el = document.getElementById(`control-${match.tenant_control_id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 240);
  }, [focusId, workbench]);

  const availableControls = useMemo(() => {
    return (catalog?.effective_controls || []).filter(
      (item: CatalogControl) => !item.tenant_control_id
    );
  }, [catalog]);

  const searchNormalized = searchText.trim().toLowerCase();

  const filteredAvailableControls = useMemo(() => {
    if (!searchNormalized) return availableControls;

    return availableControls.filter((item) => {
      const haystack = [
        item.clause,
        item.category,
        item.description,
        ...(item.valid_for_standards || []),
        ...(item.also_valid_for || []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchNormalized);
    });
  }, [availableControls, searchNormalized]);

  const groupedAvailable = useMemo(() => {
    const groups: Record<string, CatalogControl[]> = {};

    for (const item of filteredAvailableControls) {
      const key = String(item.clause || 'Sin cláusula');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    return groups;
  }, [filteredAvailableControls]);

  const filteredEnabledControls = useMemo(() => {
    let base = workbench?.items || [];

    if (healthFilter !== 'todos') {
      base = base.filter(
        (item) => normalizeHealthStatus(getEffectiveHealthStatus(item)) === healthFilter
      );
    }

    if (searchNormalized) {
      base = base.filter((item) => {
        const haystack = [
          item.clause,
          item.category,
          item.description,
          item.operation_name,
          item.responsible_user_name,
          item.responsible_user_email,
          ...(item.valid_for_standards || []),
          ...(item.also_valid_for || []),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchNormalized);
      });
    }

    return base;
  }, [workbench?.items, healthFilter, searchNormalized]);

  const groupedEnabled = useMemo(() => {
    const groups: Record<string, WorkbenchItem[]> = {};

    for (const item of filteredEnabledControls) {
      const key = String(item.clause || 'Sin cláusula');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    return groups;
  }, [filteredEnabledControls]);

  const saveControl = async (item: WorkbenchItem) => {
    if (!token || !tenantId) return;

    const draft = drafts[item.tenant_control_id];
    if (!draft) return;

    const loadingKey = `save-${item.tenant_control_id}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${item.tenant_control_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            status: draft.status || null,
            score: draft.score === '' ? null : Number(draft.score),
            priority: draft.priority || null,
            due_date: draft.due_date || null,
            applicability: draft.applicability || null,
            responsible_user_id: draft.responsible_user_id || null,
            mark_reviewed_now: true,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error guardando control');
        return;
      }

      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
      await loadCatalog(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR SAVE CONTROL:', err);
      alert('Error guardando control');
    } finally {
      setActionLoading('');
    }
  };

  const enableControl = async (controlId: string) => {
    if (!token || !tenantId || !selectedOperationId || !selectedISO) return;

    const loadingKey = `enable-${controlId}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(`${API_URL}/api/controls/catalog/${controlId}/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          operation_id: selectedOperationId,
          iso: selectedISO,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error habilitando control');
        return;
      }

      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
      await loadCatalog(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR ENABLE CONTROL:', err);
      alert('Error habilitando control');
    } finally {
      setActionLoading('');
    }
  };

  const disableControl = async (controlId: string) => {
    if (!token || !tenantId || !selectedOperationId) return;

    const loadingKey = `disable-${controlId}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(`${API_URL}/api/controls/catalog/${controlId}/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          operation_id: selectedOperationId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const dep = json?.dependencies;
        if (dep) {
          alert(
            `${json?.error || 'No se puede deshabilitar'}\n\nEvidencias: ${dep.evidences}\nHallazgos: ${dep.findings}\nNo conformidades: ${dep.nonconformities}\nPlanes: ${dep.action_plans}`
          );
        } else {
          alert(json?.detail || json?.error || 'Error deshabilitando control');
        }
        return;
      }

      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
      await loadCatalog(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR DISABLE CONTROL:', err);
      alert('Error deshabilitando control');
    } finally {
      setActionLoading('');
    }
  };

  const uploadEvidence = async (item: WorkbenchItem) => {
    if (!token || !tenantId) return;

    const file = uploadFiles[item.tenant_control_id];
    if (!file) {
      alert('Debes seleccionar un archivo');
      return;
    }

    const loadingKey = `upload-evidence-${item.tenant_control_id}`;

    try {
      setActionLoading(loadingKey);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenant_id', String(tenantId));
      formData.append('tenant_control_id', item.tenant_control_id);
      formData.append('control_id', item.catalog_control_id);
      formData.append(
        'description',
        uploadDescriptions[item.tenant_control_id] ||
          `Evidencia para control ${item.clause || ''} ${item.description || ''}`.trim()
      );
      formData.append('evidence_type', 'documento');

      const res = await fetch(`${API_URL}/api/evidences/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error subiendo evidencia');
        return;
      }

      setUploadDescriptions((prev) => ({ ...prev, [item.tenant_control_id]: '' }));
      setUploadFiles((prev) => ({ ...prev, [item.tenant_control_id]: null }));

      await loadEvidencesForControl(item.tenant_control_id);
      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR UPLOAD EVIDENCE:', err);
      alert('Error subiendo evidencia');
    } finally {
      setActionLoading('');
    }
  };


  const markIntegratedEvidenceAsOfficial = async (
    item: WorkbenchItem,
    evidence: any
  ) => {
    const pct = getIntegratedEvidenceCompliancePct(evidence) || 100

    const officialDraft = {
      ...(drafts[item.tenant_control_id] || emptyDraft(item)),
      status: 'cumple',
      score: String(Math.min(100, Math.max(0, pct))),
    }

    setDrafts((prev) => ({
      ...prev,
      [item.tenant_control_id]: officialDraft,
    }))

    try {
      setActionLoading(`official-${evidence.id}`)
      setErrorMessage('')

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${item.tenant_control_id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...officialDraft,
            status: 'cumple',
            score: Math.min(100, Math.max(0, pct)),
            official_evidence_id: evidence.id,
            official_evidence_source: 'documento_integrado',
          }),
        }
      )

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json?.error || json?.detail || 'No fue posible establecer la evidencia como oficial')
      }

      await refreshTenantHealth();
      await loadWorkbench(tenantId, token || '', selectedISO, selectedOperationId);
      await loadEvidencesForControl(item.tenant_control_id);

    } catch (err: any) {
      console.error('ERROR MARK INTEGRATED EVIDENCE OFFICIAL:', err)
      setErrorMessage(err?.message || 'Error estableciendo evidencia oficial')
    } finally {
      setActionLoading('')
    }
  };

  const reviewEvidence = async (
    item: WorkbenchItem,
    evidence: EvidenceItem,
    decision: 'aprobada' | 'rechazada'
  ) => {
    if (!token || !tenantId) return;

    const loadingKey = `${decision}-${evidence.id}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(`${API_URL}/api/evidences/approve/${evidence.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: decision,
          rejection_reason:
            decision === 'rechazada'
              ? approvalNotes[evidence.id] || 'Evidencia rechazada desde Controles'
              : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error revisando evidencia');
        return;
      }

      setApprovalNotes((prev) => ({ ...prev, [evidence.id]: '' }));
      await loadEvidencesForControl(item.tenant_control_id);
      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR REVIEW EVIDENCE:', err);
      alert('Error revisando evidencia');
    } finally {
      setActionLoading('');
    }
  };

  const openQuickNonconformity = async (item: WorkbenchItem) => {
    if (!token || !tenantId) return;

    const loadingKey = `nc-${item.tenant_control_id}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${item.tenant_control_id}/quick-nonconformity`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error creando no conformidad');
        return;
      }

      router.push(`/no-conformidades?iso=${encodeURIComponent(selectedISO)}`);
    } catch (err) {
      console.error('ERROR QUICK NC:', err);
      alert('Error creando no conformidad');
    } finally {
      setActionLoading('');
    }
  };

  const openQuickFinding = async (item: WorkbenchItem) => {
    if (!token || !tenantId) return;

    const loadingKey = `finding-${item.tenant_control_id}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${item.tenant_control_id}/quick-finding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            iso_code: selectedISO,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error creando hallazgo');
        return;
      }

      router.push(`/hallazgos?iso=${encodeURIComponent(selectedISO)}`);
    } catch (err) {
      console.error('ERROR QUICK FINDING:', err);
      alert('Error creando hallazgo');
    } finally {
      setActionLoading('');
    }
  };

  const openQuickActionPlan = async (item: WorkbenchItem) => {
    if (!token || !tenantId) return;

    const loadingKey = `plan-${item.tenant_control_id}`;

    try {
      setActionLoading(loadingKey);

      const res = await fetch(
        `${API_URL}/api/controls/workbench/${item.tenant_control_id}/quick-action-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            iso_code: selectedISO,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error abriendo plan de acción');
        return;
      }

      const actionPlan = json?.action_plan;
      if (actionPlan?.id) {
        router.push(
          `/plan-accion?id=${encodeURIComponent(actionPlan.id)}&iso=${encodeURIComponent(
            selectedISO
          )}&tenant_control_id=${encodeURIComponent(
            item.tenant_control_id
          )}&operation_id=${encodeURIComponent(selectedOperationId)}`
        );
        return;
      }

      router.push(`/plan-accion?iso=${encodeURIComponent(selectedISO)}`);
    } catch (err) {
      console.error('ERROR QUICK ACTION PLAN:', err);
      alert('Error abriendo plan de acción');
    } finally {
      setActionLoading('');
    }
  };

  const updateCatalogMode = async (nextMode: string) => {
    if (!token || !tenantId || !selectedISO) return;

    try {
      setActionLoading(`mode-${nextMode}`);

      const res = await fetch(
        `${API_URL}/api/controls/catalog-mode/${tenantId}/${encodeURIComponent(
          selectedISO
        )}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            catalog_mode: nextMode,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json?.detail || json?.error || 'Error cambiando modo catálogo');
        return;
      }

      await loadWorkbench(tenantId, token, selectedISO, selectedOperationId);
      await loadCatalog(tenantId, token, selectedISO, selectedOperationId);
    } catch (err) {
      console.error('ERROR UPDATE CATALOG MODE:', err);
      alert('Error cambiando modo catálogo');
    } finally {
      setActionLoading('');
    }
  };

  const toggleAvailableClause = (clause: string) => {
    setCollapsedAvailableClauses((prev) => ({
      ...prev,
      [clause]: !prev[clause],
    }));
  };

  const toggleEnabledClause = (clause: string) => {
    setCollapsedEnabledClauses((prev) => ({
      ...prev,
      [clause]: !prev[clause],
    }));
  };

  const toggleEvidencePanel = async (tenantControlId: string) => {
    const nextValue = !expandedEvidence[tenantControlId];

    setExpandedEvidence((prev) => ({
      ...prev,
      [tenantControlId]: nextValue,
    }));

    if (nextValue) {
      await loadEvidencesForControl(tenantControlId);
    }
  };

  const summary = workbench?.summary;
  const mode = catalog?.catalog_mode || workbench?.catalog_mode || 'generic';

  if (loadingScope) {
    return (
      <AppLayout>
        <div className="p-6">{t('controls.loading')}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1850px] space-y-6 p-6">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700">
                  {t('controls.eyebrow')}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t('controls.badge')}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {t('controls.title')}
              </h1>

              <p className="mt-3 text-base leading-7 text-slate-600 md:text-lg">
                {t('controls.subtitle')}
              </p>
            </div>

            <div className="grid min-w-[320px] grid-cols-1 gap-3 md:grid-cols-2">
              <MetricCard title={t('controls.catalogMode')} value={mode} tone="blue" />
              <MetricCard
                title={t('controls.activeOperation')}
                value={
                  availableOperations.find((o) => o.id === selectedOperationId)?.name || '—'
                }
                tone="slate"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
            <FilterCard label={t('controls.standard')}>
              <select
                value={selectedISO}
                onChange={(e) => setSelectedISO(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none"
              >
                {availableStandards.length === 0 ? (
                  <option value="">{t('controls.noOperationalStandards')}</option>
                ) : (
                  availableStandards.map((s: ScopeStandard) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))
                )}
              </select>
            </FilterCard>

            <FilterCard label={t('controls.operation')}>
              <select
                value={selectedOperationId}
                onChange={(e) => setSelectedOperationId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none"
                disabled={availableOperations.length === 0}
              >
                {availableOperations.length === 0 ? (
                  <option value="">{t('controls.noActiveOperation')}</option>
                ) : (
                  availableOperations.map((op: OperationItem) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))
                )}
              </select>
            </FilterCard>

            <FilterCard label={t('controls.catalogMode')}>
              <select
                value={mode}
                onChange={(e) => void updateCatalogMode(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none"
                disabled={!selectedISO}
              >
                <option value="generic">{t('controls.catalog.generic')}</option>
                <option value="personalized">{t('controls.catalog.personalized')}</option>
                <option value="mixed">{t('controls.catalog.mixed')}</option>
              </select>
            </FilterCard>

            <FilterCard label={t('controls.health')}>
              <select
                value={healthFilter}
                onChange={(e) =>
                  setHealthFilter(
                    e.target.value as 'todos' | 'saludable' | 'atencion' | 'deteriorado'
                  )
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none"
              >
                <option value="todos">{t('controls.allStatuses')}</option>
                <option value="saludable">{t('statuses.controls.saludable')}</option>
                <option value="atencion">{t('statuses.controls.atencion')}</option>
                <option value="deteriorado">{t('statuses.controls.deteriorado')}</option>
              </select>
            </FilterCard>

            <FilterCard label={t('common.search')}>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('controls.searchPlaceholder')}
                className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none"
              />
            </FilterCard>
          </div>

          {summary && (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <MetricCard title={t('common.all')} value={summary.total_controls} tone="slate" />
              <MetricCard title={t('statuses.controls.saludable')} value={summary.healthy_controls} tone="green" />
              <MetricCard title={t('statuses.controls.atencion')} value={summary.attention_controls} tone="amber" />
              <MetricCard
                title={t('statuses.controls.deteriorado')}
                value={summary.deteriorated_controls}
                tone="red"
              />
              <MetricCard
                title={t('controls.withoutEvidence')}
                value={summary.controls_without_evidence}
                tone="violet"
              />
              <MetricCard
                title={t('controls.averageHealth')}
                value={summary.average_health_score}
                tone="blue"
              />
            </div>
          )}
        </section>

        {focusMessage && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-indigo-900 shadow-sm">
            <div className="font-semibold">{t('controls.directOpen')}</div>
            <div className="mt-1 text-sm">{focusMessage}</div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {!selectedISO && (
          <div className="rounded-[24px] border border-yellow-200 bg-yellow-50 p-5 text-yellow-800 shadow-sm">
            {t('controls.noOperationalStandardsAvailable')}
          </div>
        )}

        {selectedISO && availableOperations.length === 0 && (
          <div className="rounded-[24px] border border-yellow-200 bg-yellow-50 p-5 text-yellow-800 shadow-sm">
            {t('controls.noAssignedOperations')} <b>Empresas</b>.
          </div>
        )}

        {selectedISO && selectedOperationId && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] items-start">
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {t('controls.availableControls')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('controls.availableControlsHelp')}
                  </p>
                </div>
                {loadingCatalog && <div className="text-sm text-slate-500">{t('common.loading')}</div>}
              </div>

              {!loadingCatalog && filteredAvailableControls.length === 0 && (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  {t('controls.noAvailableControls')}
                </div>
              )}

              <div className="space-y-4">
                {Object.entries(groupedAvailable).map(([clause, items]) => {
                  const collapsed = collapsedAvailableClauses[clause] === true;

                  return (
                    <div key={clause} className="overflow-hidden rounded-[24px] border border-slate-200">
                      <button
                        onClick={() => toggleAvailableClause(clause)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-4 text-left"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{translateClauseLabel(clause, locale)}</div>
                          <div className="text-xs text-slate-500">{items.length} {translateDisplayText('controles', locale, 'control')}</div>
                        </div>
                        <div className="text-sm text-slate-500">
                          {collapsed ? t('controls.expand') : t('controls.collapse')}
                        </div>
                      </button>

                      {!collapsed && (
                        <div className="divide-y">
                          {items.map((item: CatalogControl) => (
                            <div key={item.id} className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="font-medium text-slate-900">
                                    {translateControlLabel(item.description, locale) || t('controls.noDescription')}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {translateDisplayText(item.category, locale, 'category') || t('controls.noCategory')}
                                  </div>

                                  {(item.also_valid_for || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {(item.also_valid_for || []).map((code: string) => (
                                        <span
                                          key={code}
                                          className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700"
                                        >
                                          {t('controls.alsoValidFor')} {code}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {!isReadOnly && (
                                  <button
                                    onClick={() => void enableControl(item.id)}
                                    disabled={actionLoading === `enable-${item.id}`}
                                    className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                  >
                                    {actionLoading === `enable-${item.id}`
                                      ? t('controls.enabling')
                                      : t('controls.enable')}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {t('controls.workbench')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('controls.workbenchHelp')}
                  </p>
                </div>
                {loadingWorkbench && (
                  <div className="text-sm text-slate-500">{t('common.loading')}</div>
                )}
              </div>

              {!loadingWorkbench && filteredEnabledControls.length === 0 && (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  {t('controls.noEnabledControls')}
                </div>
              )}

              <div className="space-y-5">
                {Object.entries(groupedEnabled).map(([clause, items]) => {
                  const collapsed = collapsedEnabledClauses[clause] === true;

                  return (
                    <div key={clause} className="overflow-hidden rounded-[24px] border border-slate-200">
                      <button
                        onClick={() => toggleEnabledClause(clause)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-4 text-left"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{translateClauseLabel(clause, locale)}</div>
                          <div className="text-xs text-slate-500">{items.length} {translateDisplayText('controles', locale, 'control')}</div>
                        </div>
                        <div className="text-sm text-slate-500">
                          {collapsed ? t('controls.expand') : t('controls.collapse')}
                        </div>
                      </button>

                      {!collapsed && (
                        <div className="space-y-4 p-4">
                          {items.map((item: WorkbenchItem) => {
                            const draft = drafts[item.tenant_control_id] || emptyDraft(item);
                            const saving = actionLoading === `save-${item.tenant_control_id}`;
                            const evidenceExpanded =
                              expandedEvidence[item.tenant_control_id] === true;
                            const evidenceItems =
                              evidencesByControl[item.tenant_control_id] || [];
                            const needsEvidenceAttention =
                              normalizeHealthStatus(getEffectiveHealthStatus(item)) !==
                              'saludable';

                            return (
                              <article
                                key={item.tenant_control_id}
                                id={`control-${item.tenant_control_id}`}
                                className={`rounded-[24px] border p-4 shadow-sm ${healthCardClass(
                                  getEffectiveHealthStatus(item)
                                )} ${
                                  focusedControlId === item.tenant_control_id
                                    ? 'ring-2 ring-indigo-200'
                                    : ''
                                }`}
                              >
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                  <div className="min-w-0 flex-1 space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${healthBadgeClass(
                                          getEffectiveHealthStatus(item)
                                        )}`}
                                      >
                                        {mapHealthLabel(getEffectiveHealthStatus(item))}
                                      </span>
                                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                        Health {getEffectiveHealthScore(item)}
                                      </span>
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getEvidenceQualityClass(
                                          item.evidence_quality_status
                                        )}`}
                                      >
                                        {mapEvidenceQualityLabel(item.evidence_quality_status)}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        Oficial {toNumber(item.official_evidence_count)} · Aprobada {toNumber(item.approved_evidence_count)}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        Evidencias {toNumber(item.evidence_count)}
                                      </span>
                                      <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                                        Pendientes {toNumber(item.pending_evidence_count)}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                        {t('sidebar.findings')} {toNumber(item.open_findings_count)}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                        NC {toNumber(item.open_nonconformities_count)}
                                      </span>
                                    </div>

                                    <div>
                                      <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                                        {translateClauseLabel(item.clause || 'Sin cláusula', locale)} · {translateControlLabel(item.description, locale)}
                                      </h3>
                                      <div className="mt-1 text-sm text-slate-500">
                                        {translateDisplayText(item.category, locale, 'category') || t('controls.noCategory')} · {t('controls.operation')}:{' '}
                                        {item.operation_name || '—'}
                                      </div>
                                    </div>

                                    {(item.also_valid_for || []).length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {(item.also_valid_for || []).map((code: string) => (
                                          <span
                                            key={code}
                                            className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700"
                                          >
                                            {t('controls.alsoValidFor')} {code}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {needsEvidenceAttention && (
                                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {t('controls.needsEvidenceAttention')}
                                      </div>
                                    )}
                                  </div>

                                  {!isReadOnly && (
                                    <button
                                      onClick={() => void disableControl(item.catalog_control_id)}
                                      disabled={actionLoading === `disable-${item.catalog_control_id}`}
                                      className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {actionLoading === `disable-${item.catalog_control_id}`
                                        ? t('controls.disabling')
                                        : t('controls.disable')}
                                    </button>
                                  )}
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  <FieldBlock label={t('common.status')}>
                                    <select
                                      value={draft.status}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            status: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                    >
                                      <option value="pendiente">{t('statuses.controls.pendiente')}</option>
                                      <option value="parcial">{t('statuses.controls.parcial')}</option>
                                      <option value="cumple">Cumple</option>
                                      <option value="no cumple">No cumple</option>
                                    </select>
                                  </FieldBlock>

                                  <FieldBlock label="Score">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={draft.score}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            score: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                    />
                                  </FieldBlock>

                                  <FieldBlock label={t('controls.priority')}>
                                    <select
                                      value={draft.priority}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            priority: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                    >
                                      <option value="alta">{t('statuses.findings.alto')}</option>
                                      <option value="media">{t('statuses.findings.medio')}</option>
                                      <option value="baja">{t('statuses.findings.bajo')}</option>
                                    </select>
                                  </FieldBlock>

                                  <FieldBlock label={t('controls.dueDate')}>
                                    <input
                                      type="date"
                                      value={draft.due_date}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            due_date: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                    />
                                  </FieldBlock>

                                  <FieldBlock label={t('controls.applicability')}>
                                    <select
                                      value={draft.applicability}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            applicability: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                    >
                                      <option value="aplica">{t('controls.applies')}</option>
                                      <option value="no_aplica">{t('statuses.controls.no_aplica')}</option>
                                      <option value="parcial">{t('statuses.controls.parcial')}</option>
                                    </select>
                                  </FieldBlock>

                                  <FieldBlock label={t('controls.ownerEmail')}>
                                    <input
                                      value={draft.responsible_user_id}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.tenant_control_id]: {
                                            ...draft,
                                            responsible_user_id: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                      disabled={isReadOnly}
                                      placeholder={t('login.emailPlaceholder')}
                                    />
                                  </FieldBlock>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => void openQuickNonconformity(item)}
                                      disabled={
                                        isReadOnly ||
                                        actionLoading === `nc-${item.tenant_control_id}`
                                      }
                                      className="rounded-2xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {actionLoading === `nc-${item.tenant_control_id}`
                                        ? 'Abriendo...'
                                        : t('findings.nonconformities')}
                                    </button>

                                    <button
                                      onClick={() => void openQuickFinding(item)}
                                      disabled={
                                        isReadOnly ||
                                        actionLoading === `finding-${item.tenant_control_id}`
                                      }
                                      className="rounded-2xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {actionLoading === `finding-${item.tenant_control_id}`
                                        ? 'Abriendo...'
                                        : t('sidebar.findings')}
                                    </button>

                                    <button
                                      onClick={() => void openQuickActionPlan(item)}
                                      disabled={
                                        isReadOnly ||
                                        actionLoading === `plan-${item.tenant_control_id}`
                                      }
                                      className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {actionLoading === `plan-${item.tenant_control_id}`
                                        ? 'Abriendo...'
                                        : t('sidebar.actionPlan')}
                                    </button>

                                    <button
                                      onClick={() => void toggleEvidencePanel(item.tenant_control_id)}
                                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                                    >
                                      {evidenceExpanded
                                        ? t('controls.hideEvidence')
                                        : t('controls.manageEvidence')}
                                    </button>
                                  </div>

                                  {!isReadOnly && (
                                    <button
                                      onClick={() => void saveControl(item)}
                                      disabled={saving}
                                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                      {saving ? t('controls.saving') : t('controls.saveChanges')}
                                    </button>
                                  )}
                                </div>

                                {evidenceExpanded && (
                                  <div className="mt-5 border-t border-slate-200 pt-5 space-y-5">
                                    {!isReadOnly && (
                                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 space-y-3">
                                        <div className="font-semibold text-slate-900">
                                          {t('controls.uploadEvidence')}
                                        </div>

                                        <input
                                          type="text"
                                          value={uploadDescriptions[item.tenant_control_id] || ''}
                                          onChange={(e) =>
                                            setUploadDescriptions((prev) => ({
                                              ...prev,
                                              [item.tenant_control_id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Descripción de la evidencia"
                                          className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                        />

                                        <input
                                          type="file"
                                          onChange={(e) =>
                                            setUploadFiles((prev) => ({
                                              ...prev,
                                              [item.tenant_control_id]:
                                                e.target.files?.[0] || null,
                                            }))
                                          }
                                          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm"
                                        />

                                        <div>
                                          <button
                                            onClick={() => void uploadEvidence(item)}
                                            disabled={
                                              actionLoading ===
                                              `upload-evidence-${item.tenant_control_id}`
                                            }
                                            className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                          >
                                            {actionLoading ===
                                            `upload-evidence-${item.tenant_control_id}`
                                              ? 'Subiendo...'
                                              : t('controls.uploadEvidence')}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    <div className="space-y-3">
                                      <div className="font-semibold text-slate-900">
                                        {t('controls.linkedEvidence')}
                                      </div>

                                      {evidenceItems.length === 0 && (
                                        <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                                          {t('controls.noEvidenceForControl')}
                                        </div>
                                      )}

                                      {evidenceItems.map((evidence) => (
                                        <div
                                          key={evidence.id}
                                          className="rounded-[22px] border border-slate-200 bg-white p-4 space-y-3"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <div className="font-medium text-slate-900">
                                                {evidence.file_name || t('controls.unnamedFile')}
                                              </div>
                                              <div className="text-sm text-slate-500">
                                                {translateDisplayText(evidence.description, locale, 'evidence') || t('controls.noDescription')}
                                              </div>
                                              <div className="mt-1 text-xs text-slate-400">
                                                {t('controls.uploadedAt')}: {formatDateTime(evidence.created_at)}
                                              </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                              <span
                                                className={`rounded-full px-2 py-1 text-xs font-semibold ${evidenceStatusClass(
                                                  evidence.status
                                                )}`}
                                              >
                                                {translateStatusLabel(evidence.status || 'pendiente', locale)}
                                              </span>

                                              {getIntegratedEvidenceCompliancePct(evidence) !== null && (
                                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                                  Cumplimiento evidencia {getIntegratedEvidenceCompliancePct(evidence)}%
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                            {evidence.validity_result && (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                                {t('controls.validity')}: {evidence.validity_result}
                                              </span>
                                            )}
                                            {evidence.contribution_level && (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                                {t('controls.contribution')}: {evidence.contribution_level}
                                              </span>
                                            )}
                                            {evidence.reviewed_by_label && (
                                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                                {t('controls.reviewedBy')}: {evidence.reviewed_by_label}
                                              </span>
                                            )}
                                            {evidence.action_plan_title && (
                                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700">
                                                {evidence.action_plan_title}
                                              </span>
                                            )}
                                          </div>

                                          {evidence.rejection_reason && (
                                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                              {t('controls.rejectionReason')}: {evidence.rejection_reason}
                                            </div>
                                          )}

                                          {isIntegratedEvidence(evidence) && (
                                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="font-semibold">
                                                  Evidencia integrada desde fuente documental
                                                </div>
                                                <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs font-bold text-blue-700">
                                                  Google Drive
                                                </span>
                                              </div>

                                              <div className="mt-2 grid gap-2 text-xs text-blue-800 md:grid-cols-2 xl:grid-cols-4">
                                                <span>
                                                  Norma: <b>{getEvidenceMetadataForDisplay(evidence).suggested_standard_code || '—'}</b>
                                                </span>
                                                <span>
                                                  Control: <b>{getEvidenceMetadataForDisplay(evidence).suggested_control_ref || '—'}</b>
                                                </span>
                                                <span>
                                                  Fuente: <b>{getEvidenceMetadataForDisplay(evidence).source_name || '—'}</b>
                                                </span>
                                                <span>
                                                  Carpeta: <b>{getEvidenceMetadataForDisplay(evidence).folder_path || '—'}</b>
                                                </span>
                                              </div>

                                              <div className="mt-2 text-xs text-blue-700">
                                                Esta evidencia ya fue promovida desde una sugerencia documental y queda visible en el control asociado. Solo impacta salud/cumplimiento si está aprobada y validada.
                                              </div>
                                            </div>
                                          )}

                                          {(evidence.file_path || evidence.web_view_url || evidence.metadata?.web_view_url) && (
                                            <div className="flex flex-wrap gap-2">
                                              {evidence.file_path && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openAuthorizedFile(
                                                      `${API_URL}/api/evidences/file/${evidence.id}`,
                                                      token
                                                    )
                                                  }
                                                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                                                >
                                                  {t('controls.viewFile')}
                                                </button>
                                              )}

                                            </div>
                                          )}

                                          {!evidence.file_path && getIntegratedEvidenceUrl(evidence) && (
                                            <div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  window.open(
                                                    getIntegratedEvidenceUrl(evidence),
                                                    '_blank',
                                                    'noopener,noreferrer'
                                                  )
                                                }
                                                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                              >
                                                Abrir en Drive
                                              </button>
                                            </div>
                                          )}

                                          {isIntegratedEvidence(evidence) &&
                                            String(evidence.status || '').toLowerCase() === 'aprobada' && (
                                              <div className="flex flex-wrap gap-2">
                                                {isOfficialIntegratedEvidence(evidence) ? (
                                                  <span className="inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                                                    Evidencia oficial del control
                                                  </span>
                                                ) : (
                                                  <button
                                                  type="button"
                                                  onClick={() =>
                                                    void markIntegratedEvidenceAsOfficial(item, evidence)
                                                  }
                                                  disabled={actionLoading === `official-${evidence.id}`}
                                                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                                >
                                                  {actionLoading === `official-${evidence.id}`
                                                    ? 'Aplicando...'
                                                    : 'Establecer como evidencia oficial'}
                                                </button>
                                                )}
                                              </div>
                                            )}

                                          {canReviewEvidence &&
                                            String(evidence.status || '').toLowerCase() !==
                                              'aprobada' && (
                                              <div className="space-y-2">
                                                <input
                                                  type="text"
                                                  value={approvalNotes[evidence.id] || ''}
                                                  onChange={(ev) =>
                                                    setApprovalNotes((prev) => ({
                                                      ...prev,
                                                      [evidence.id]: ev.target.value,
                                                    }))
                                                  }
                                                  placeholder={t('controls.reviewCommentPlaceholder')}
                                                  className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
                                                />

                                                <div className="flex flex-wrap gap-2">
                                                  <button
                                                    onClick={() =>
                                                      void reviewEvidence(
                                                        item,
                                                        evidence,
                                                        'aprobada'
                                                      )
                                                    }
                                                    disabled={
                                                      actionLoading ===
                                                      `aprobada-${evidence.id}`
                                                    }
                                                    className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                                  >
                                                    {actionLoading === `aprobada-${evidence.id}`
                                                      ? t('controls.approving')
                                                      : t('controls.approve')}
                                                  </button>

                                                  <button
                                                    onClick={() =>
                                                      void reviewEvidence(
                                                        item,
                                                        evidence,
                                                        'rechazada'
                                                      )
                                                    }
                                                    disabled={
                                                      actionLoading ===
                                                      `rechazada-${evidence.id}`
                                                    }
                                                    className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                                  >
                                                    {actionLoading === `rechazada-${evidence.id}`
                                                      ? t('controls.rejecting')
                                                      : t('controls.reject')}
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FilterCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: 'slate' | 'green' | 'amber' | 'red' | 'violet' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'border-slate-200 bg-white text-slate-900',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
        {title}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight break-words">{value}</div>
    </div>
  );
}
