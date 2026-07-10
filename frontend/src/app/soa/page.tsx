'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import { useLanguage } from '@/context/LanguageContext';
import { getUserFromToken } from '@/utils/auth';
import { translateDisplayText, translateClauseLabel, translateStatusLabel } from '@/i18n/displayText';

const SOA_STANDARDS = [
  'ISO27001',
  'ISO27701',
  'ISO27017',
  'ISO27018',
  'ISO/IEC27701',
  'ISO/IEC27017',
  'ISO/IEC27018'
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type AuthUser = {
  tenant_id?: string | null;
  role?: string | null;
};

type SoAStandard = {
  code: string;
  name?: string | null;
  is_active?: boolean;
  tenant_controls?: number | string | null;
};

type SoARow = {
  tenant_control_id: string;
  controls_id_legacy?: string | null;
  modern_tenant_control_id?: string | null;
  tenant_id?: string | null;
  iso?: string | null;
  clause?: string | null;
  category?: string | null;
  description?: string | null;
  diagnostic_status?: string | null;
  applicable?: boolean | null;
  implementation_status?: string | null;
  justification?: string | null;
  notes?: string | null;
  owner?: string | null;
  review_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  evidence_count?: number | string | null;
  valid_evidence_count?: number | string | null;
  expired_evidence_count?: number | string | null;
  rejected_evidence_count?: number | string | null;
  open_findings_count?: number | string | null;
  open_nonconformities_count?: number | string | null;
  high_or_critical_risk_count?: number | string | null;
  overdue_actions_count?: number | string | null;
  inconsistencies?: string[];
};

type SoAField = keyof Pick<
  SoARow,
  'applicable' | 'implementation_status' | 'justification' | 'notes' | 'owner' | 'review_date'
>;

type SoAIntelligenceSignals = {
  evidence?: { evidence_count?: number | string | null };
  findings?: { open_findings_count?: number | string | null };
  nonconformities?: { open_nonconformities_count?: number | string | null };
  risks?: {
    high_risk_count?: number | string | null;
    critical_risk_count?: number | string | null;
  };
  actions?: { overdue_actions_count?: number | string | null };
};

type SoAIntelligenceSuggestion = {
  suggested_applicable?: boolean | null;
  suggested_implementation_status?: string | null;
  suggested_justification?: string | null;
  confidence_level?: string | null;
  confidence_score?: number | string | null;
};

type SoAAssessment = {
  id: string;
  status?: string | null;
};

type SoAIntelligenceRow = {
  tenant_control_id: string;
  clause?: string | null;
  description?: string | null;
  official?: {
    applicable?: boolean | null;
    implementation_status?: string | null;
  };
  system_suggestion?: SoAIntelligenceSuggestion;
  signals?: SoAIntelligenceSignals;
  latest_assessment?: SoAAssessment | null;
};

type SoAIntelligence = {
  summary?: {
    controls_with_evidence?: number | string | null;
    controls_with_open_findings?: number | string | null;
    controls_with_open_nc?: number | string | null;
    controls_with_high_risk?: number | string | null;
    controls_with_overdue_actions?: number | string | null;
    official_vs_suggested_differences?: number | string | null;
    low_confidence_suggestions?: number | string | null;
  };
  rows?: SoAIntelligenceRow[];
};

type SoAChangeLogRow = {
  id?: string;
  tenant_control_id?: string | null;
  created_at?: string | null;
};

type SoAPreflight = {
  standard_active?: boolean;
  active_operations_count?: number | string | null;
  tenant_controls_count?: number | string | null;
  legacy_controls_count?: number | string | null;
  soa_rows_count?: number | string | null;
  can_initialize_soa?: boolean;
  blocking_reason?: string | null;
};

type SoAMetrics = {
  total_controls?: number | string | null;
  decision_count?: number | string | null;
  applicable_count?: number | string | null;
  not_applicable_count?: number | string | null;
  not_applicable_justified_count?: number | string | null;
  pending_applicability_count?: number | string | null;
  implemented_applicable_count?: number | string | null;
  partial_applicable_count?: number | string | null;
  pending_applicable_count?: number | string | null;
  implementation_coverage_pct?: number | string | null;
  applicability_coverage_pct?: number | string | null;
  na_justification_coverage_pct?: number | string | null;
  controls_with_valid_evidence_count?: number | string | null;
  controls_with_expired_evidence_count?: number | string | null;
  controls_with_rejected_evidence_count?: number | string | null;
  evidence_validity_pct?: number | string | null;
  controls_with_open_findings_count?: number | string | null;
  controls_with_open_nonconformities_count?: number | string | null;
  controls_with_high_or_critical_risk_count?: number | string | null;
  controls_with_overdue_actions_count?: number | string | null;
  inconsistency_count?: number | string | null;
};

type SoAResponse = {
  rows?: unknown[];
  metrics?: SoAMetrics | null;
  requires_initialization?: boolean;
  message?: string | null;
  preflight?: SoAPreflight | null;
  inconsistencies?: unknown[];
};

function getTenantId(user: AuthUser | null) {
  return user?.tenant_id || '';
}

function isSoAStandard(value: unknown): value is SoAStandard {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

function isSoARow(value: unknown): value is SoARow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tenant_control_id' in value &&
    typeof (value as { tenant_control_id?: unknown }).tenant_control_id === 'string'
  );
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStandardCode(value: unknown) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.includes('27001')) return 'ISO27001';
  if (compact.includes('27701')) return 'ISO27701';
  if (compact.includes('27017')) return 'ISO27017';
  if (compact.includes('27018')) return 'ISO27018';
  return String(value || '').trim();
}

export default function SoAPage() {
  const { locale } = useLanguage();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [standards, setStandards] = useState<SoAStandard[]>([]);
  const [selectedISO, setSelectedISO] = useState('');
  const [data, setData] = useState<SoARow[]>([]);
  const [intelligence, setIntelligence] = useState<SoAIntelligence | null>(null);
  const [assessments, setAssessments] = useState<SoAAssessment[]>([]);
  const [changeLog, setChangeLog] = useState<SoAChangeLogRow[]>([]);
  const [backendMetrics, setBackendMetrics] = useState<SoAMetrics | null>(null);
  const [requiresInitialization, setRequiresInitialization] = useState(false);
  const [soaMessage, setSoaMessage] = useState<string>('');
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [savingId, setSavingId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [preflight, setPreflight] = useState<SoAPreflight | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    applicable: 'all',
    implementation: 'all',
    owner: 'all',
    issue: 'all'
  });

  const isReadOnly = user?.role === 'auditor';

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken() as AuthUser | null;

    setToken(authToken);
    setUser(u);

    if (!authToken || !getTenantId(u)) {
      setLoadingStandards(false);
      setLoadingData(false);
    }
  }, []);

  const loadStandards = useCallback(async (tenantId: string, authToken: string) => {
    try {
      setLoadingStandards(true);

      const res = await fetch(
        `${API_URL}/api/tenant-standards/${tenantId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD SOA STANDARDS:', json);
        setStandards([]);
        setSelectedISO('');
        return;
      }

      const activeStandards = (Array.isArray(json) ? json.filter(isSoAStandard) : []).filter(
        (s) =>
          (s.is_active || Number(s.tenant_controls) > 0) &&
          SOA_STANDARDS.includes(normalizeStandardCode(s.code))
      );

      setStandards(activeStandards);

      if (activeStandards.length > 0) {
        setSelectedISO((prev) => {
          const exists = activeStandards.some((s) => s.code === prev);
          return exists ? prev : activeStandards[0].code;
        });
      } else {
        setSelectedISO('');
      }
    } catch (err) {
      console.error('ERROR LOAD SOA STANDARDS:', err);
      setStandards([]);
      setSelectedISO('');
    } finally {
      setLoadingStandards(false);
    }
  }, []);

  const loadIntelligence = useCallback(async (tenantId: string, authToken: string, iso: string) => {
    try {
      setLoadingIntelligence(true);
      const [intelligenceRes, assessmentsRes, changeLogRes] = await Promise.all([
        fetch(`${API_URL}/api/soa/${tenantId}/intelligence?iso=${encodeURIComponent(iso)}`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_URL}/api/soa/${tenantId}/assessments?iso=${encodeURIComponent(iso)}`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_URL}/api/soa/${tenantId}/change-log?iso=${encodeURIComponent(iso)}`, { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      const [intelligenceJson, assessmentsJson, changeLogJson] = await Promise.all([
        intelligenceRes.json(),
        assessmentsRes.json(),
        changeLogRes.json()
      ]);
      setIntelligence(intelligenceRes.ok ? intelligenceJson : null);
      setAssessments(assessmentsRes.ok && Array.isArray(assessmentsJson) ? assessmentsJson : []);
      setChangeLog(changeLogRes.ok && Array.isArray(changeLogJson) ? changeLogJson : []);
      if (!intelligenceRes.ok) console.error('ERROR LOAD SOA INTELLIGENCE:', intelligenceJson);
    } catch (err) {
      console.error('ERROR LOAD SOA INTELLIGENCE:', err);
      setIntelligence(null);
      setAssessments([]);
      setChangeLog([]);
    } finally {
      setLoadingIntelligence(false);
    }
  }, []);

  const loadSoA = useCallback(async (tenantId: string, authToken: string, iso: string) => {
    try {
      setLoadingData(true);

      const preflightRes = await fetch(
        `${API_URL}/api/soa/${tenantId}/preflight?iso=${encodeURIComponent(iso)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      const preflightJson = await preflightRes.json();

      if (!preflightRes.ok) {
        console.error('ERROR LOAD SOA PREFLIGHT:', preflightJson);
        setPreflight(null);
      } else {
        setPreflight(preflightJson);
      }

      const res = await fetch(
        `${API_URL}/api/soa/${tenantId}?iso=${encodeURIComponent(iso)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD SOA:', json);
        setData([]);
        setBackendMetrics(null);
        setRequiresInitialization(false);
        setSoaMessage(json?.error || '');
        return;
      }

      if (Array.isArray(json)) {
        setData(json.filter(isSoARow));
        setBackendMetrics(null);
        setRequiresInitialization(false);
        setSoaMessage('');
      } else {
        const payload = json as SoAResponse;
        setData(Array.isArray(payload.rows) ? payload.rows.filter(isSoARow) : []);
        setBackendMetrics(payload.metrics || null);
        setRequiresInitialization(Boolean(payload.requires_initialization));
        setSoaMessage(typeof payload.message === 'string' ? payload.message : '');
        if (payload.preflight) setPreflight(payload.preflight);
      }
      setSelectedRowId('');
      await loadIntelligence(tenantId, authToken, iso);
    } catch (err) {
      console.error('ERROR LOAD SOA:', err);
      setData([]);
      setBackendMetrics(null);
      setRequiresInitialization(false);
      setSoaMessage('');
      setPreflight(null);
    } finally {
      setLoadingData(false);
    }
  }, [loadIntelligence]);

  const initializeSoA = async () => {
    if (!token || !user?.tenant_id || !selectedISO) return;

    try {
      setInitializing(true);
      const res = await fetch(
        `${API_URL}/api/soa/${user.tenant_id}/initialize?iso=${encodeURIComponent(selectedISO)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        alert(json?.blocking_reason || json?.error || 'No fue posible inicializar SoA');
        return;
      }

      await loadSoA(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR INITIALIZE SOA:', err);
      alert('Error inicializando SoA');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    if (!token || !user?.tenant_id) return;
    loadStandards(user.tenant_id, token);
  }, [loadStandards, token, user]);

  useEffect(() => {
    if (!token || !user?.tenant_id || !selectedISO) {
      if (!loadingStandards) setLoadingData(false);
      return;
    }

    loadSoA(user.tenant_id, token, selectedISO);
  }, [loadSoA, token, user, selectedISO, loadingStandards]);

  const changeField = (id: string, field: SoAField, value: SoARow[SoAField]) => {
    setData((prev) =>
      prev.map((row) => {
        if (row.tenant_control_id !== id) return row;

        const updated = { ...row, [field]: value };

        if (field === 'applicable') {
          if (value === false) {
            updated.implementation_status = 'no aplica';
          }
          if (value === true && updated.implementation_status === 'no aplica') {
            updated.implementation_status = 'pendiente';
          }
        }

        return updated;
      })
    );
  };

  const saveRow = async (row: SoARow) => {
    if (!token) return;

    try {
      setSavingId(row.tenant_control_id);

      const res = await fetch(
        `${API_URL}/api/soa/${row.tenant_control_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            applicable: row.applicable,
            implementation_status: row.implementation_status,
            justification: row.justification,
            notes: row.notes,
            owner: row.owner,
            review_date: row.review_date || null
          })
        }
      );

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error guardando SoA');
        return;
      }

      setData((prev) =>
        prev.map((r) =>
          r.tenant_control_id === row.tenant_control_id ? json : r
        )
      );
      setSelectedRowId(row.tenant_control_id);
      if (user?.tenant_id && selectedISO) {
        await loadSoA(user.tenant_id, token, selectedISO);
        setSelectedRowId(row.tenant_control_id);
      }
    } catch (err) {
      console.error('ERROR SAVE SOA:', err);
      alert('Error guardando SoA');
    } finally {
      setSavingId('');
    }
  };

  const createFinding = async (row: SoARow) => {
    if (!token || !user?.tenant_id) return;

    const title = window.prompt(
      `Título del hallazgo para ${row.clause}`,
      `Hallazgo SoA en control ${row.clause}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del hallazgo',
        row.justification || row.description || ''
      ) || '';

    let findingType = 'observacion';
    let severity = 'media';

    if (row.applicable === true && row.implementation_status === 'parcial') {
      findingType = 'observacion';
      severity = 'media';
    } else if (row.applicable === false) {
      findingType = 'oportunidad de mejora';
      severity = 'baja';
    }

    try {
      setActionLoading(`finding-${row.tenant_control_id}`);

      const res = await fetch(`${API_URL}/api/findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          iso_code: selectedISO,
          title,
          description,
          finding_type: findingType,
          severity,
          source_type: 'soa',
          tenant_control_id: row.tenant_control_id
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando hallazgo');
        return;
      }

      alert('Hallazgo creado correctamente');
      await loadIntelligence(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR CREATE SOA FINDING:', err);
      alert('Error creando hallazgo');
    } finally {
      setActionLoading('');
    }
  };

  const createActionPlan = async (row: SoARow) => {
    if (!token || !user?.tenant_id) return;

    const title = window.prompt(
      `Título del plan de acción para ${row.clause}`,
      `Acción SoA para control ${row.clause}`
    );

    if (!title) return;

    const description =
      window.prompt(
        'Descripción del plan de acción',
        row.justification || row.description || ''
      ) || '';

    const owner =
      window.prompt('Responsable del plan de acción', row.owner || '') || row.owner || '';

    let priority = 'media';
    if (row.applicable === true && row.implementation_status === 'parcial') {
      priority = 'media';
    } else if (row.applicable === false) {
      priority = 'baja';
    }

    try {
      setActionLoading(`action-${row.tenant_control_id}`);
      const actionTenantControlId = row.modern_tenant_control_id || row.tenant_control_id;

      const res = await fetch(`${API_URL}/api/action-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          iso_code: selectedISO,
          title,
          description,
          priority,
          owner,
          source_type: 'control',
          source_id: actionTenantControlId,
          tenant_control_id: actionTenantControlId
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error creando plan de acción');
        return;
      }

      alert('Plan de acción creado correctamente');
      await loadIntelligence(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR CREATE SOA ACTION PLAN:', err);
      alert('Error creando plan de acción');
    } finally {
      setActionLoading('');
    }
  };

  const runAssessment = async (tenantControlId: string, useAi = false) => {
    if (!token || !user?.tenant_id || !selectedISO) return;
    try {
      setActionLoading(`${useAi ? 'ai' : 'system'}-${tenantControlId}`);
      const res = await fetch(`${API_URL}/api/soa/${user.tenant_id}/assessments/run?iso=${encodeURIComponent(selectedISO)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_control_id: tenantControlId, use_ai: useAi })
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'No fue posible ejecutar evaluación SoA');
        return;
      }
      await loadIntelligence(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR RUN ASSESSMENT:', err);
      alert('Error ejecutando evaluación SoA');
    } finally {
      setActionLoading('');
    }
  };

  const runBatchAssessment = async () => {
    if (!token || !user?.tenant_id || !selectedISO) return;
    try {
      setActionLoading('batch-system');
      const res = await fetch(`${API_URL}/api/soa/${user.tenant_id}/assessments/run-batch?iso=${encodeURIComponent(selectedISO)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 50, use_ai: false })
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'No fue posible recalcular sugerencias');
        return;
      }
      await loadIntelligence(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR RUN BATCH ASSESSMENT:', err);
      alert('Error recalculando sugerencias');
    } finally {
      setActionLoading('');
    }
  };

  const applyAssessment = async (assessmentId: string) => {
    if (!token || !user?.tenant_id || !selectedISO) return;
    const confirmed = window.confirm('Esto modificará el SoA oficial de este control y quedará registrado. ¿Deseas continuar?');
    if (!confirmed) return;
    try {
      setActionLoading(`apply-${assessmentId}`);
      const res = await fetch(`${API_URL}/api/soa/${user.tenant_id}/assessments/${assessmentId}/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'No fue posible aplicar sugerencia');
        return;
      }
      await loadSoA(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR APPLY ASSESSMENT:', err);
      alert('Error aplicando sugerencia');
    } finally {
      setActionLoading('');
    }
  };

  const rejectAssessment = async (assessmentId: string) => {
    if (!token || !user?.tenant_id || !selectedISO) return;
    try {
      setActionLoading(`reject-${assessmentId}`);
      const res = await fetch(`${API_URL}/api/soa/${user.tenant_id}/assessments/${assessmentId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'No fue posible rechazar sugerencia');
        return;
      }
      await loadIntelligence(user.tenant_id, token, selectedISO);
    } catch (err) {
      console.error('ERROR REJECT ASSESSMENT:', err);
      alert('Error rechazando sugerencia');
    } finally {
      setActionLoading('');
    }
  };

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const reviewMissing = data.filter((r) => !r.review_date).length;
    const reviewOverdue = data.filter((r) => r.review_date && String(r.review_date).slice(0, 10) < today).length;
    const missingOwner = data.filter((r) => r.applicable === true && !String(r.owner || '').trim()).length;

    if (backendMetrics) {
      const notApplicable = toNumber(backendMetrics.not_applicable_count);
      const notApplicableJustified = toNumber(backendMetrics.not_applicable_justified_count);
      return {
        total: toNumber(backendMetrics.total_controls),
        applicability_defined: toNumber(backendMetrics.decision_count),
        applicable: toNumber(backendMetrics.applicable_count),
        notApplicable,
        implemented: toNumber(backendMetrics.implemented_applicable_count),
        partial: toNumber(backendMetrics.partial_applicable_count),
        notImplemented: 0,
        pending: toNumber(backendMetrics.pending_applicable_count) + toNumber(backendMetrics.pending_applicability_count),
        missingJustification: Math.max(notApplicable - notApplicableJustified, 0),
        missingOwner,
        reviewMissing,
        reviewOverdue,
        soaCompletionPercent: toNumber(backendMetrics.applicability_coverage_pct),
        implementationPercent: toNumber(backendMetrics.implementation_coverage_pct),
        exclusionJustificationPercent: toNumber(backendMetrics.na_justification_coverage_pct),
        evidenceValidityPercent: toNumber(backendMetrics.evidence_validity_pct),
        validEvidence: toNumber(backendMetrics.controls_with_valid_evidence_count),
        expiredEvidence: toNumber(backendMetrics.controls_with_expired_evidence_count),
        rejectedEvidence: toNumber(backendMetrics.controls_with_rejected_evidence_count),
        inconsistencyCount: toNumber(backendMetrics.inconsistency_count),
        openFindings: toNumber(backendMetrics.controls_with_open_findings_count),
        openNc: toNumber(backendMetrics.controls_with_open_nonconformities_count),
        highRisk: toNumber(backendMetrics.controls_with_high_or_critical_risk_count),
        overdueActions: toNumber(backendMetrics.controls_with_overdue_actions_count)
      };
    }

    const total = data.length;
    const applicable = data.filter((r) => r.applicable === true).length;
    const notApplicable = data.filter((r) => r.applicable === false).length;
    const applicabilityDefined = applicable + notApplicable;
    const implemented = data.filter((r) => r.implementation_status === 'implementado').length;
    const partial = data.filter((r) => r.implementation_status === 'parcial').length;
    const notImplemented = 0;
    const pending = data.filter((r) => r.implementation_status === 'pendiente').length;
    const applicableRows = data.filter((r) => r.applicable === true);
    const notApplicableRows = data.filter((r) => r.applicable === false);
    const missingJustification = notApplicableRows.filter((r) => !String(r.justification || '').trim()).length;
    const implementedApplicable = applicableRows.filter((r) => r.implementation_status === 'implementado').length;
    const justifiedExclusions = notApplicableRows.length - missingJustification;

    const percent = (value: number, base: number) => {
      if (!base) return 0;
      return Math.round((value / base) * 100);
    };

    return {
      total,
      applicability_defined: applicabilityDefined,
      applicable,
      notApplicable,
      implemented,
      partial,
      notImplemented,
      pending,
      missingJustification,
      missingOwner,
      reviewMissing,
      reviewOverdue,
      soaCompletionPercent: percent(applicabilityDefined, total),
      implementationPercent: percent(implementedApplicable, applicableRows.length),
      exclusionJustificationPercent: percent(justifiedExclusions, notApplicableRows.length),
      evidenceValidityPercent: 0,
      validEvidence: data.filter((r) => toNumber(r.valid_evidence_count) > 0).length,
      expiredEvidence: data.filter((r) => toNumber(r.expired_evidence_count) > 0).length,
      rejectedEvidence: data.filter((r) => toNumber(r.rejected_evidence_count) > 0).length,
      inconsistencyCount: data.filter((r) => (r.inconsistencies || []).length > 0).length,
      openFindings: data.filter((r) => toNumber(r.open_findings_count) > 0).length,
      openNc: data.filter((r) => toNumber(r.open_nonconformities_count) > 0).length,
      highRisk: data.filter((r) => toNumber(r.high_or_critical_risk_count) > 0).length,
      overdueActions: data.filter((r) => toNumber(r.overdue_actions_count) > 0).length
    };
  }, [backendMetrics, data]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        data
          .map((row) => row.category)
          .filter((value): value is string => typeof value === 'string' && Boolean(value))
      )
    ).sort();
  }, [data]);

  const ownerOptions = useMemo(() => {
    return Array.from(
      new Set(
        data
          .map((row) => row.owner)
          .filter((value): value is string => typeof value === 'string' && Boolean(value))
      )
    ).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const query = filters.search.trim().toLowerCase();

    return data.filter((row) => {
      const haystack = [
        row.clause,
        row.category,
        row.description,
        row.diagnostic_status,
        row.owner,
        row.justification,
        row.notes
      ].join(' ').toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (filters.category !== 'all' && row.category !== filters.category) return false;
      if (filters.implementation !== 'all' && (row.implementation_status || 'pendiente') !== filters.implementation) return false;
      if (filters.owner !== 'all' && row.owner !== filters.owner) return false;
      if (filters.applicable === 'true' && row.applicable !== true) return false;
      if (filters.applicable === 'false' && row.applicable !== false) return false;
      if (filters.applicable === 'pending' && row.applicable !== null && row.applicable !== undefined) return false;
      if (filters.issue === 'missing_justification' && !(row.applicable === false && !String(row.justification || '').trim())) return false;
      if (filters.issue === 'missing_owner' && String(row.owner || '').trim()) return false;
      if (filters.issue === 'review_missing' && row.review_date) return false;
      if (filters.issue === 'review_overdue' && !(row.review_date && String(row.review_date).slice(0, 10) < today)) return false;
      if (filters.issue === 'inconsistent' && !(row.inconsistencies || []).length) return false;
      return true;
    });
  }, [data, filters]);

  const selectedRow = useMemo(() => {
    if (!selectedRowId) return null;
    return data.find((row) => row.tenant_control_id === selectedRowId) || null;
  }, [data, selectedRowId]);

  const intelligenceByControl = useMemo(() => {
    const map = new Map<string, SoAIntelligenceRow>();
    (intelligence?.rows || []).forEach((row) => map.set(row.tenant_control_id, row));
    return map;
  }, [intelligence]);

  const selectedIntelligence = selectedRow ? intelligenceByControl.get(selectedRow.tenant_control_id) : null;

  if (loadingStandards) {
    return (
      <AppLayout>
        <div className="p-6">Cargando normas SoA...</div>
      </AppLayout>
    );
  }

  if (!loadingStandards && standards.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Statement of Applicability (SoA)</h1>

          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-2">
              Esta empresa no tiene normas que usen SoA
            </h2>

            <p className="text-sm text-gray-700">
              El módulo SoA solo aplica a normas de seguridad y privacidad como:
              <b> ISO27001, ISO/IEC27701, ISO/IEC27017, ISO/IEC27018</b>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loadingData) {
    return (
      <AppLayout>
        <div className="p-6">Cargando SoA...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Statement of Applicability</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">SoA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Define aplicabilidad, exclusiones justificadas, estado de implementación, responsable y revisión para controles de seguridad y privacidad.
            </p>
            {isReadOnly && (
              <div className="mt-2 text-sm font-semibold text-blue-800">
                Modo solo lectura para auditor.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedISO}
              onChange={(e) => setSelectedISO(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
            >
              {standards.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>

            {(requiresInitialization || preflight?.can_initialize_soa) && !isReadOnly && (
              <button
                type="button"
                onClick={initializeSoA}
                disabled={initializing}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {initializing ? 'Inicializando...' : 'Inicializar SoA'}
              </button>
            )}
          </div>
        </div>

        {preflight && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <PreflightCard title="Norma activa" value={preflight.standard_active ? 'Sí' : 'No'} tone={preflight.standard_active ? 'success' : 'warning'} />
            <PreflightCard title="Operaciones activas" value={preflight.active_operations_count ?? 0} />
            <PreflightCard title="Controles tenant" value={preflight.tenant_controls_count ?? 0} />
            <PreflightCard title="Controles legacy" value={preflight.legacy_controls_count ?? 0} />
            <PreflightCard title="Filas SoA" value={preflight.soa_rows_count ?? 0} tone={toNumber(preflight.soa_rows_count) > 0 ? 'success' : 'warning'} />
          </div>
        )}

        {preflight?.blocking_reason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <div className="font-black">SoA no disponible para la norma seleccionada</div>
            <div className="mt-1">Motivo: {preflight.blocking_reason}</div>
          </div>
        )}

        {data.length === 0 && (requiresInitialization || preflight?.can_initialize_soa) && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-xl font-black text-blue-950">SoA pendiente de inicialización</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
              {soaMessage || `${selectedISO} está activa y tiene ${preflight?.tenant_controls_count || 0} controles disponibles desde tenant_controls, pero aún no existen filas SoA materializadas.`}
            </p>
            {!isReadOnly && (
              <button
                type="button"
                onClick={initializeSoA}
                disabled={initializing}
                className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {initializing ? 'Inicializando...' : 'Inicializar SoA desde controles existentes'}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Cobertura aplicabilidad" value={`${metrics.soaCompletionPercent}%`} subtitle={`${metrics.applicability_defined} de ${metrics.total} definidos`} />
          <MetricCard title="Implementación aplicables" value={`${metrics.implementationPercent}%`} subtitle={`${metrics.implemented} implementados`} />
          <MetricCard title="Exclusiones justificadas" value={`${metrics.exclusionJustificationPercent}%`} subtitle={`${metrics.missingJustification} sin justificación`} />
          <MetricCard title="Inconsistencias" value={metrics.inconsistencyCount} subtitle={`${metrics.validEvidence} con evidencia válida · ${metrics.evidenceValidityPercent}%`} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard title="Total controles" value={metrics.total} compact />
          <MetricCard title="Aplican" value={metrics.applicable} compact />
          <MetricCard title="No aplican" value={metrics.notApplicable} compact />
          <MetricCard title="Implementados" value={metrics.implemented} compact />
          <MetricCard title="Parciales" value={metrics.partial} compact />
          <MetricCard title="Pendientes" value={metrics.pending} compact />
          <MetricCard title="Ev. vencida/rechazada" value={metrics.expiredEvidence + metrics.rejectedEvidence} compact />
          <MetricCard title="Revisión faltante" value={metrics.reviewMissing} compact />
        </div>

        {metrics.inconsistencyCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <div className="font-black">Inconsistencias SOA detectadas: {metrics.inconsistencyCount}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <span>Hallazgos abiertos: <b>{metrics.openFindings}</b></span>
              <span>NC abiertas: <b>{metrics.openNc}</b></span>
              <span>Riesgo alto/crítico: <b>{metrics.highRisk}</b></span>
              <span>Acciones vencidas: <b>{metrics.overdueActions}</b></span>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Inteligencia SoA</p>
              <h2 className="mt-1 text-xl font-black text-blue-950">Recomendaciones gobernadas</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-900">
                El sistema calcula señales y sugerencias separadas del SoA oficial. Ningún cambio se aplica sin aprobación humana autorizada.
              </p>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={runBatchAssessment}
                disabled={actionLoading === 'batch-system'}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {actionLoading === 'batch-system' ? 'Recalculando...' : 'Recalcular sugerencias sistema'}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <InsightCard title="Con evidencia" value={intelligence?.summary?.controls_with_evidence ?? 0} />
            <InsightCard title="Hallazgos abiertos" value={intelligence?.summary?.controls_with_open_findings ?? 0} tone="warning" />
            <InsightCard title="NC abiertas" value={intelligence?.summary?.controls_with_open_nc ?? 0} tone="danger" />
            <InsightCard title="Riesgo alto" value={intelligence?.summary?.controls_with_high_risk ?? 0} tone="danger" />
            <InsightCard title="Acciones vencidas" value={intelligence?.summary?.controls_with_overdue_actions ?? 0} tone="warning" />
            <InsightCard title="Diferencias" value={intelligence?.summary?.official_vs_suggested_differences ?? 0} tone="info" />
            <InsightCard title="Baja confianza" value={intelligence?.summary?.low_confidence_suggestions ?? 0} tone="neutral" />
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 px-4 py-3">
              <div>
                <div className="text-sm font-black text-slate-950">Comparación oficial vs sugerido</div>
                <div className="text-xs text-slate-500">
                  {loadingIntelligence ? 'Cargando inteligencia...' : `${intelligence?.rows?.length || 0} controles evaluables · ${assessments.length} assessments guardados · ${changeLog.length} cambios registrados`}
                </div>
              </div>
            </div>
            <div className="max-h-[390px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Control</th>
                    <th className="px-4 py-3">Oficial</th>
                    <th className="px-4 py-3">Sugerido</th>
                    <th className="px-4 py-3">Señales</th>
                    <th className="px-4 py-3">Confianza</th>
                    <th className="px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(intelligence?.rows || []).slice(0, 200).map((row) => {
                    const latest = row.latest_assessment;
                    return (
                      <tr key={row.tenant_control_id} className="hover:bg-blue-50/60">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setSelectedRowId(row.tenant_control_id)} className="text-left font-black text-blue-800 hover:text-blue-950">
                            {translateClauseLabel(row.clause, locale)}
                          </button>
                          <div className="mt-1 line-clamp-1 max-w-md text-xs text-slate-500">{translateDisplayText(row.description, locale, 'control')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={applicabilityLabel(row.official?.applicable)} />
                          <div className="mt-1"><StatusPill value={translateStatusLabel(row.official?.implementation_status || 'pendiente', locale)} /></div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={applicabilityLabel(row.system_suggestion?.suggested_applicable)} />
                          <div className="mt-1"><StatusPill value={translateStatusLabel(row.system_suggestion?.suggested_implementation_status || 'pendiente', locale)} /></div>
                        </td>
                        <td className="px-4 py-3 text-xs leading-5 text-slate-600">
                          Ev: {row.signals?.evidence?.evidence_count || 0} · Hall: {row.signals?.findings?.open_findings_count || 0} · NC: {row.signals?.nonconformities?.open_nonconformities_count || 0} · Acc: {row.signals?.actions?.overdue_actions_count || 0}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={`${row.system_suggestion?.confidence_level || 'baja'} ${row.system_suggestion?.confidence_score || 0}%`} />
                          {latest && <div className="mt-1 text-xs text-slate-500">Último: {latest.status}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {!isReadOnly && (
                              <>
                                <button onClick={() => runAssessment(row.tenant_control_id, false)} disabled={actionLoading === `system-${row.tenant_control_id}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">Sistema</button>
                                <button onClick={() => runAssessment(row.tenant_control_id, true)} disabled={actionLoading === `ai-${row.tenant_control_id}`} className="rounded-lg border border-blue-300 px-2.5 py-1 text-xs font-bold text-blue-700 disabled:opacity-50">IA</button>
                                {latest?.status === 'draft' && (
                                  <>
                                    <button onClick={() => applyAssessment(latest.id)} disabled={actionLoading === `apply-${latest.id}`} className="rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50">Aplicar</button>
                                    <button onClick={() => rejectAssessment(latest.id)} disabled={actionLoading === `reject-${latest.id}`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">Rechazar</button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingIntelligence && (!intelligence?.rows || intelligence.rows.length === 0) && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No hay inteligencia SoA disponible para la selección actual.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar cláusula, control o descripción"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm xl:col-span-2"
            />
            <select value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Todas las categorías</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value={filters.applicable} onChange={(e) => setFilters((prev) => ({ ...prev, applicable: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Aplicabilidad</option>
              <option value="true">Aplica</option>
              <option value="false">No aplica</option>
              <option value="pending">Pendiente</option>
            </select>
            <select value={filters.implementation} onChange={(e) => setFilters((prev) => ({ ...prev, implementation: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Estado implementación</option>
              <option value="pendiente">Pendiente</option>
              <option value="implementado">Implementado</option>
              <option value="parcial">Parcial</option>
              <option value="no aplica">No aplica</option>
            </select>
            <select value={filters.owner} onChange={(e) => setFilters((prev) => ({ ...prev, owner: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Responsable</option>
              {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <select value={filters.issue} onChange={(e) => setFilters((prev) => ({ ...prev, issue: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Sin alertas</option>
              <option value="inconsistent">Inconsistente</option>
              <option value="missing_justification">Sin justificación</option>
              <option value="missing_owner">Sin responsable</option>
              <option value="review_missing">Sin revisión</option>
              <option value="review_overdue">Revisión vencida</option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Mostrando {filteredData.length} de {data.length} controles</span>
            <button
              type="button"
              onClick={() => setFilters({ search: '', category: 'all', applicable: 'all', implementation: 'all', owner: 'all', issue: 'all' })}
              className="text-blue-700 hover:text-blue-900"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Control</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Aplica</th>
                    <th className="px-4 py-3">Implementación</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((row) => (
                    <tr
                      key={row.tenant_control_id}
                      onClick={() => setSelectedRowId(row.tenant_control_id)}
                      className={`cursor-pointer hover:bg-blue-50 ${selectedRow?.tenant_control_id === row.tenant_control_id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-950">{translateClauseLabel(row.clause, locale)}</div>
                        <div className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-600">{translateDisplayText(row.description, locale, 'control')}</div>
                        {(row.inconsistencies || []).length > 0 && (
                          <div className="mt-2"><StatusPill value={`${row.inconsistencies?.length || 0} inconsistencia(s)`} /></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{translateDisplayText(row.category || 'General', locale, 'category')}</td>
                      <td className="px-4 py-3"><StatusPill value={applicabilityLabel(row.applicable)} /></td>
                      <td className="px-4 py-3"><StatusPill value={translateStatusLabel(row.implementation_status || 'pendiente', locale)} /></td>
                      <td className="px-4 py-3 text-slate-600">{row.owner || 'Sin responsable'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.review_date ? String(row.review_date).slice(0, 10) : 'Sin fecha'}</td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No hay controles que coincidan con los filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedRow && (
            <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-blue-700">{translateClauseLabel(selectedRow.clause, locale)}</div>
                  <h2 className="mt-1 text-lg font-black text-slate-950">Detalle SoA</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{translateDisplayText(selectedRow.category || 'General', locale, 'category')}</p>
                </div>
                <button type="button" onClick={() => setSelectedRowId('')} className="text-sm font-bold text-slate-500 hover:text-slate-900">Cerrar</button>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-700">{translateDisplayText(selectedRow.description, locale, 'control')}</p>

              {(selectedRow.inconsistencies || []).length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                  <div className="font-black">Inconsistencias</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedRow.inconsistencies || []).map((code) => (
                      <StatusPill key={code} value={code} />
                    ))}
                  </div>
                </div>
              )}

              {selectedIntelligence && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-blue-700">Contexto inteligente</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-blue-950">
                    <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">Evidencias: <b>{selectedIntelligence.signals?.evidence?.evidence_count || 0}</b></div>
                    <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">Riesgos altos: <b>{toNumber(selectedIntelligence.signals?.risks?.high_risk_count) + toNumber(selectedIntelligence.signals?.risks?.critical_risk_count)}</b></div>
                    <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">Hallazgos abiertos: <b>{selectedIntelligence.signals?.findings?.open_findings_count || 0}</b></div>
                    <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100">Acciones vencidas: <b>{selectedIntelligence.signals?.actions?.overdue_actions_count || 0}</b></div>
                  </div>
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-700 ring-1 ring-blue-100">
                    <div className="font-black text-slate-950">Sugerencia sistema</div>
                    <div className="mt-1">{selectedIntelligence.system_suggestion?.suggested_justification || 'Sin explicación disponible.'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusPill value={applicabilityLabel(selectedIntelligence.system_suggestion?.suggested_applicable)} />
                      <StatusPill value={translateStatusLabel(selectedIntelligence.system_suggestion?.suggested_implementation_status || 'pendiente', locale)} />
                      <StatusPill value={`${selectedIntelligence.system_suggestion?.confidence_level || 'baja'} ${selectedIntelligence.system_suggestion?.confidence_score || 0}%`} />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Aplica</span>
                  <select
                    value={selectedRow.applicable === true ? 'true' : selectedRow.applicable === false ? 'false' : ''}
                    onChange={(e) => {
                      const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null;
                      changeField(selectedRow.tenant_control_id, 'applicable', value);
                    }}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Pendiente definir</option>
                    <option value="true">Sí aplica</option>
                    <option value="false">No aplica</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Estado implementación</span>
                  <select
                    value={selectedRow.implementation_status || 'pendiente'}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'implementation_status', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="implementado">Implementado</option>
                    <option value="parcial">Parcial</option>
                    <option value="no aplica">No aplica</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Responsable</span>
                  <input
                    value={selectedRow.owner || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'owner', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Responsable del control"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Fecha revisión</span>
                  <input
                    type="date"
                    value={selectedRow.review_date ? String(selectedRow.review_date).slice(0, 10) : ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'review_date', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Justificación</span>
                  <textarea
                    value={selectedRow.justification || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'justification', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Justificación de aplicabilidad o exclusión"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Notas</span>
                  <textarea
                    value={selectedRow.notes || ''}
                    onChange={(e) => changeField(selectedRow.tenant_control_id, 'notes', e.target.value)}
                    disabled={isReadOnly}
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Notas complementarias"
                  />
                </label>
              </div>

              {!isReadOnly && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => saveRow(selectedRow)} disabled={savingId === selectedRow.tenant_control_id} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                    {savingId === selectedRow.tenant_control_id ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => createFinding(selectedRow)} disabled={actionLoading === `finding-${selectedRow.tenant_control_id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
                    {actionLoading === `finding-${selectedRow.tenant_control_id}` ? 'Creando...' : 'Crear hallazgo'}
                  </button>
                  <button onClick={() => createActionPlan(selectedRow)} disabled={actionLoading === `action-${selectedRow.tenant_control_id}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">
                    {actionLoading === `action-${selectedRow.tenant_control_id}` ? 'Creando...' : 'Crear acción'}
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  compact = false,
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={compact ? 'mt-2 text-2xl font-black text-slate-950' : 'mt-2 text-3xl font-black text-slate-950'}>{value}</div>
      {subtitle && <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>}
    </div>
  );
}

function PreflightCard({
  title,
  value,
  tone = 'neutral',
}: {
  title: string;
  value: ReactNode;
  tone?: 'success' | 'warning' | 'neutral';
}) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  tone = 'info',
}: {
  title: string;
  value: ReactNode;
  tone?: 'danger' | 'warning' | 'neutral' | 'info';
}) {
  const toneClass = tone === 'danger'
    ? 'border-red-100 bg-red-50 text-red-800'
    : tone === 'warning'
    ? 'border-amber-100 bg-amber-50 text-amber-800'
    : tone === 'neutral'
    ? 'border-slate-100 bg-slate-50 text-slate-800'
    : 'border-blue-100 bg-white text-blue-900';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function applicabilityLabel(value: boolean | null | undefined) {
  if (value === true) return 'Aplica';
  if (value === false) return 'No aplica';
  return 'Pendiente';
}

function StatusPill({ value }: { value: ReactNode }) {
  const normalized = String(value || '').toLowerCase();
  const tone = normalized.includes('no implementado') || normalized.includes('venc')
    ? 'bg-red-50 text-red-700 ring-red-100'
    : normalized.includes('parcial') || normalized.includes('pendiente')
    ? 'bg-amber-50 text-amber-700 ring-amber-100'
    : normalized.includes('implementado') || normalized === 'aplica'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : 'bg-slate-50 text-slate-700 ring-slate-100';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>
      {value}
    </span>
  );
}
