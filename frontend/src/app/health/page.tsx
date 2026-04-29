'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

type HealthSummary = {
  tenant_id: string;
  tenant_name: string;
  total_controls: string;
  healthy_controls: string;
  attention_controls: string;
  deteriorated_controls: string;
  critical_controls: string;
  avg_health_score: string;
  tenant_health_status: string;
  healthy_percentage: string;
  controls_with_evidence_percentage: string;
  total_evidences: string;
  approved_evidences: string;
  pending_evidences: string;
  rejected_evidences: string;
  kpi_health_value: string;
  kpi_health_color: string;
  kpi_evidence_coverage_value: string;
  kpi_evidence_coverage_color: string;
  kpi_deteriorated_controls_value: string;
  kpi_deteriorated_controls_color: string;
  last_calculated_at: string;
};

type StandardHealth = {
  tenant_id: string;
  tenant_name: string;
  standard_code: string;
  standard_name: string;
  total_controls: string;
  healthy_controls: string;
  attention_controls: string;
  deteriorated_controls: string;
  critical_controls: string;
  avg_health_score: string;
  standard_health_status: string;
  healthy_percentage?: string;
  controls_with_evidence_percentage: string;
  kpi_standard_health_value?: string;
  kpi_standard_health_color: string;
  kpi_evidence_coverage_value?: string;
  kpi_evidence_coverage_color: string;
  kpi_deteriorated_controls_value: string;
  kpi_deteriorated_controls_color: string;
};

type CauseJson = {
  cause_key?: string;
  cause_label?: string;
  affected_controls?: number | string;
  avg_score?: number | string;
  max_score?: number | string;
  severity_weight?: number | string;
};

type RootCauseTenant = {
  tenant_id: string;
  tenant_name: string;
  total_controls: string;
  avg_health_score: string;
  healthy_controls: string;
  attention_controls: string;
  deteriorated_controls: string;
  critical_controls: string;

  controls_with_evidence_gap: string;
  controls_with_compliance_gap: string;
  controls_with_findings_gap: string;
  controls_with_action_gap: string;
  controls_with_risk_gap: string;
  controls_with_review_gap: string;

  avg_evidence_score: string;
  avg_compliance_score: string;
  avg_findings_score: string;
  avg_action_score: string;
  avg_risk_score: string;
  avg_review_score: string;

  total_evidences: string;
  approved_evidences: string;
  pending_evidences: string;
  rejected_evidences: string;
  open_findings: string;
  open_actions: string;
  overdue_actions: string;
  high_risks: string;

  main_cause_json: CauseJson | null;
  causes_json: CauseJson[];
  executive_recommendation: string;
};

type RootCauseStandard = {
  tenant_id: string;
  tenant_name: string;
  standard_code: string;
  standard_name: string;
  total_controls: string;
  avg_health_score: string;
  healthy_controls: string;
  attention_controls: string;
  deteriorated_controls: string;
  critical_controls: string;

  controls_with_evidence_gap: string;
  controls_with_compliance_gap: string;
  controls_with_findings_gap: string;
  controls_with_action_gap: string;
  controls_with_risk_gap: string;
  controls_with_review_gap: string;

  avg_evidence_score: string;
  avg_compliance_score: string;
  avg_findings_score: string;
  avg_action_score: string;
  avg_risk_score: string;
  avg_review_score: string;

  main_cause_json: CauseJson | null;
  causes_json: CauseJson[];
};

type RemediationMainGap = {
  total?: number | string;
  main_gap_key?: string;
  main_gap_label?: string;
  avg_health_score?: number | string;
};

type RemediationSummary = {
  tenant_id: string;
  tenant_name: string;
  total_suggested_actions: string;
  urgent_actions: string;
  high_actions: string;
  medium_actions: string;
  evidence_actions: string;
  compliance_actions: string;
  findings_actions?: string;
  action_followup_actions?: string;
  risk_actions: string;
  review_actions: string;
  avg_affected_health_score: string;
  nearest_due_date: string;
  main_gap_summary_json: RemediationMainGap | null;
};

type RemediationPlanItem = {
  tenant_id: string;
  tenant_name: string;
  tenant_control_id: string;
  standard_code: string;
  clause: string;
  category: string;
  control_description: string;
  control_status: string;
  control_priority: string;
  applicability: string;
  health_score: string;
  health_status: string;

  evidence_score: string;
  compliance_score: string;
  findings_score: string;
  action_score: string;
  risk_score: string;
  review_score: string;

  evidence_count: number;
  approved_evidence_count: number;
  pending_evidence_count: number;
  rejected_evidence_count: number;
  open_findings_count: number;
  open_actions_count: number;
  overdue_actions_count: number;
  high_risks_count: number;

  main_gap_key: string;
  main_gap_label: string;
  main_deficit_value: string;
  remediation_priority: string;
  remediation_priority_order: number;
  suggested_action_type: string;
  suggested_owner_role: string;
  suggested_due_days: number;
  suggested_action_title: string;
  suggested_action_description: string;
  suggested_due_date: string;
  recommendation_trace_json: any;
  calculated_at: string;
};

type RemediationExecutiveTenant = {
  tenant_id: string;
  tenant_name: string;
  total_action_plans: string;
  open_actions: string;
  in_progress_actions: string;
  blocked_actions: string;
  completed_actions: string;
  cancelled_actions: string;
  overdue_actions: string;
  high_open_actions: string;
  health_generated_actions: string;
  controls_with_actions: string;
  controls_with_completed_actions: string;
  pending_evidences: string;
  approved_evidences: string;
  rejected_evidences: string;
  completion_percentage: string;
  nearest_due_date: string;
  last_action_update: string;
};

type RemediationExecutiveStandard = {
  tenant_id: string;
  tenant_name: string;
  standard_code: string;
  total_action_plans: string;
  open_actions: string;
  in_progress_actions: string;
  blocked_actions: string;
  completed_actions: string;
  overdue_actions: string;
  pending_evidences: string;
  approved_evidences: string;
  completion_percentage: string;
  nearest_due_date: string;
  last_action_update: string;
};

type EvidenceApprovalItem = {
  evidence_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_control_id: string;
  control_id: string;
  standard_code: string;
  clause: string;
  control_description: string;
  evidence_description: string;
  file_name: string;
  file_path: string;
  status: string;
  validated: boolean;
  evidence_type: string;
  created_at: string;
  expires_at: string;
  action_plan_id: string;
  action_plan_title: string;
  action_plan_status: string;
  action_plan_priority: string;
};

type ControlRecoveredItem = {
  tenant_id: string;
  tenant_name: string;
  tenant_control_id: string;
  action_plan_id: string;
  evidence_id?: string;
  iso_code: string;
  clause: string;
  control_description: string;
  action_plan_title: string;
  file_name: string;
  evidence_approved_at?: string;
  evidence_approved_by?: string;
  plan_completed_at?: string;
  plan_completed_by?: string;
  recovered_at: string;
  event_label: string;
};

type AuditLogItem = {
  event_source: 'action_plan' | 'evidence' | string;
  event_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_control_id?: string;
  action_plan_id?: string;
  evidence_id?: string;
  iso_code?: string;
  clause?: string;
  primary_label?: string;
  event_label: string;
  event_description: string;
  old_status?: string;
  new_status?: string;
  changed_at: string;
};

type AuditActionPlanItem = {
  audit_event_id: string;
  tenant_id: string;
  tenant_name: string;
  action_plan_id: string;
  tenant_control_id?: string;
  iso_code?: string;
  action_plan_title?: string;
  source_type?: string;
  action?: string;
  changed_at: string;
  actor_user_id?: string;
  event_label: string;
  event_description: string;
  old_status?: string;
  new_status?: string;
  old_priority?: string;
  new_priority?: string;
  old_owner?: string;
  new_owner?: string;
  old_due_date?: string;
  new_due_date?: string;
  old_completed_at?: string;
  new_completed_at?: string;
};

type AuditEvidenceItem = {
  audit_event_id: string;
  tenant_id: string;
  tenant_name: string;
  evidence_id: string;
  tenant_control_id?: string;
  catalog_control_id?: string;
  action_plan_id?: string;
  iso_code?: string;
  clause?: string;
  control_description?: string;
  file_name?: string;
  file_path?: string;
  evidence_description?: string;
  evidence_type?: string;
  action?: string;
  changed_at: string;
  actor_user_id?: string;
  event_label: string;
  event_description: string;
  old_status?: string;
  new_status?: string;
  validated?: boolean;
  reviewed_at?: string;
  rejection_reason?: string;
  uploaded_from?: string;
  last_review_status?: string;
};

type RiskControl = {
  tenant_id: string;
  tenant_name: string;
  tenant_control_id: string;
  standard_code: string;
  clause: string;
  category: string;
  control_description: string;
  control_status: string;
  priority: string;
  applicability: string;
  health_score: string;
  health_status: string;
  evidence_count: number;
  approved_evidence_count: number;
  pending_evidence_count: number;
  rejected_evidence_count: number;
  open_findings_count?: number;
  open_actions_count?: number;
  overdue_actions_count?: number;
  high_risks_count?: number;
  evidence_score?: string;
  compliance_score?: string;
  findings_score?: string;
  action_score?: string;
  risk_score?: string;
  review_score?: string;
};

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    saludable: 'Saludable',
    atencion: 'Atención',
    deteriorado: 'Deteriorado',
    critico: 'Crítico',
  };

  return map[status] || status || 'Sin estado';
}

function priorityLabel(priority: string) {
  const map: Record<string, string> = {
    urgente: 'Urgente',
    alta: 'Alta',
    media: 'Media',
    baja: 'Baja',
  };

  return map[priority] || priority || 'Sin prioridad';
}

function colorClasses(color?: string) {
  if (color === 'green') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (color === 'yellow') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }

  if (color === 'red') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function statusColor(status?: string) {
  if (status === 'saludable') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (status === 'atencion') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }

  if (status === 'deteriorado') {
    return 'bg-orange-100 text-orange-700 border-orange-200';
  }

  if (status === 'critico') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function priorityColor(priority?: string) {
  if (priority === 'urgente') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  if (priority === 'alta') {
    return 'bg-orange-100 text-orange-700 border-orange-200';
  }

  if (priority === 'media') {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }

  if (priority === 'baja') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function evidenceStatusColor(status?: string) {
  const value = String(status || '').toLowerCase();

  if (['aprobada', 'aprobado', 'approved'].includes(value)) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (['rechazada', 'rechazado', 'rejected'].includes(value)) {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  return 'bg-amber-100 text-amber-700 border-amber-200';
}

function actionStatusColor(status?: string) {
  if (status === 'abierto') {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  if (status === 'en progreso') {
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  }

  if (status === 'bloqueado') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  if (status === 'completado') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (status === 'cancelado') {
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function progressColor(value: number) {
  if (value >= 85) return 'bg-emerald-500';
  if (value >= 60) return 'bg-amber-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function causeColor(causeKey?: string) {
  if (causeKey === 'evidence') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  if (causeKey === 'compliance') {
    return 'bg-orange-50 text-orange-700 border-orange-200';
  }

  if (causeKey === 'findings') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  if (causeKey === 'actions') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (causeKey === 'action_followup') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  if (causeKey === 'risk') {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }

  if (causeKey === 'review') {
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function timelineSourceColor(source?: string) {
  if (source === 'action_plan') {
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  }

  if (source === 'evidence') {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function auditEventColor(label?: string) {
  const value = String(label || '').toLowerCase();

  if (value.includes('aprobada') || value.includes('recuperado') || value.includes('completado')) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  if (value.includes('rechazada') || value.includes('eliminado') || value.includes('bloqueado')) {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  if (value.includes('actualizado')) {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }

  if (value.includes('cargada') || value.includes('creado')) {
    return 'bg-blue-100 text-blue-700 border-blue-200';
  }

  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function formatDate(value?: string) {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value?: string) {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeDateOnly(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function getAuthHeaders(token: string | null) {
  return {
    Authorization: `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
  };
}

function buildUrl(
  path: string,
  tenantId?: string,
  extraParams?: Record<string, string>
) {
  const url = new URL(`${API_URL}${path}`);

  if (tenantId) {
    url.searchParams.set('tenant_id', tenantId);
  }

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function openPlan(actionPlanId?: string, iso?: string) {
  if (!actionPlanId) {
    window.location.href = '/plan-accion';
    return;
  }

  const params = new URLSearchParams();
  params.set('id', actionPlanId);
  if (iso) params.set('iso', iso);

  window.location.href = `/plan-accion?${params.toString()}`;
}

function openEvidence(evidenceId?: string, iso?: string) {
  const params = new URLSearchParams();

  if (evidenceId) params.set('id', evidenceId);
  if (iso) params.set('iso', iso);

  window.location.href = `/evidencias?${params.toString()}`;
}

function Card({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>

        {color && (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorClasses(
              color
            )}`}
          >
            {color.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

function CauseMiniCard({
  title,
  value,
  max,
}: {
  title: string;
  value: string | number;
  max?: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {max !== undefined && (
        <p className="mt-1 text-xs text-slate-500">Máximo esperado: {max}</p>
      )}
    </div>
  );
}

export default function HealthDashboardPage() {
  const [token, setToken] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [standards, setStandards] = useState<StandardHealth[]>([]);
  const [rootCauses, setRootCauses] = useState<RootCauseTenant[]>([]);
  const [standardRootCauses, setStandardRootCauses] = useState<
    RootCauseStandard[]
  >([]);
  const [riskControls, setRiskControls] = useState<RiskControl[]>([]);
  const [remediationSummary, setRemediationSummary] = useState<
    RemediationSummary[]
  >([]);
  const [remediationPlan, setRemediationPlan] = useState<RemediationPlanItem[]>(
    []
  );

  const [remediationExecutive, setRemediationExecutive] = useState<
    RemediationExecutiveTenant[]
  >([]);
  const [remediationExecutiveStandards, setRemediationExecutiveStandards] =
    useState<RemediationExecutiveStandard[]>([]);
  const [evidenceApprovalQueue, setEvidenceApprovalQueue] = useState<
    EvidenceApprovalItem[]
  >([]);
  const [controlsRecovered, setControlsRecovered] = useState<
    ControlRecoveredItem[]
  >([]);

  const [auditLog, setAuditLog] = useState<AuditLogItem[]>([]);
  const [auditActionPlans, setAuditActionPlans] = useState<AuditActionPlanItem[]>(
    []
  );
  const [auditEvidences, setAuditEvidences] = useState<AuditEvidenceItem[]>([]);

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedStandardCode, setSelectedStandardCode] = useState<string>('');
  const [remediationPriorityFilter, setRemediationPriorityFilter] =
    useState<string>('');
  const [remediationGapFilter, setRemediationGapFilter] =
    useState<string>('');

  const [loading, setLoading] = useState(true);
  const [loadingRemediation, setLoadingRemediation] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingActionId, setCreatingActionId] = useState('');
  const [error, setError] = useState('');

  const selectedSummary = useMemo(() => {
    return (
      summaries.find((item) => item.tenant_id === selectedTenantId) ||
      summaries[0]
    );
  }, [summaries, selectedTenantId]);

  const selectedRootCause = useMemo(() => {
    return (
      rootCauses.find((item) => item.tenant_id === selectedTenantId) ||
      rootCauses[0]
    );
  }, [rootCauses, selectedTenantId]);

  const selectedRemediationSummary = useMemo(() => {
    return (
      remediationSummary.find((item) => item.tenant_id === selectedTenantId) ||
      remediationSummary[0]
    );
  }, [remediationSummary, selectedTenantId]);

  const selectedRemediationExecutive = useMemo(() => {
    return (
      remediationExecutive.find((item) => item.tenant_id === selectedTenantId) ||
      remediationExecutive[0]
    );
  }, [remediationExecutive, selectedTenantId]);

  const standardCauseMap = useMemo(() => {
    const map = new Map<string, RootCauseStandard>();

    standardRootCauses.forEach((item) => {
      map.set(item.standard_code, item);
    });

    return map;
  }, [standardRootCauses]);

  const filteredRiskControls = useMemo(() => {
    if (!selectedStandardCode) return riskControls;

    return riskControls.filter(
      (item) => item.standard_code === selectedStandardCode
    );
  }, [riskControls, selectedStandardCode]);

  const filteredRemediationExecutiveStandards = useMemo(() => {
    if (!selectedStandardCode) return remediationExecutiveStandards;

    return remediationExecutiveStandards.filter(
      (item) => item.standard_code === selectedStandardCode
    );
  }, [remediationExecutiveStandards, selectedStandardCode]);

  const auditSummary = useMemo(() => {
    return {
      totalEvents: auditLog.length,
      planEvents: auditActionPlans.length,
      evidenceEvents: auditEvidences.length,
      recoveredEvents: controlsRecovered.length,
    };
  }, [auditLog, auditActionPlans, auditEvidences, controlsRecovered]);

  async function fetchJson(
    path: string,
    authToken: string,
    tenantId?: string,
    extraParams?: Record<string, string>
  ) {
    const res = await fetch(buildUrl(path, tenantId, extraParams), {
      headers: getAuthHeaders(authToken),
    });

    const text = await res.text();

    let json: any = null;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Respuesta inválida del backend en ${path}. HTTP ${res.status}.`
      );
    }

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Error consultando servicio');
    }

    return json;
  }

  async function loadRemediationData(
    tenantId?: string,
    authTokenParam?: string | null,
    filters?: {
      standardCode?: string;
      priority?: string;
      gap?: string;
    }
  ) {
    const authToken = authTokenParam || token;

    if (!authToken) return;

    try {
      setLoadingRemediation(true);

      const standardCode = filters?.standardCode ?? selectedStandardCode;
      const priority = filters?.priority ?? remediationPriorityFilter;
      const gap = filters?.gap ?? remediationGapFilter;

      const [
        summaryJson,
        planJson,
        executiveJson,
        executiveStandardsJson,
        approvalQueueJson,
        recoveredJson,
      ] = await Promise.all([
        fetchJson('/health/remediation-summary', authToken, tenantId),
        fetchJson('/health/remediation-plan', authToken, tenantId, {
          limit: '50',
          standard_code: standardCode,
          priority,
          gap,
        }),
        fetchJson('/health/remediation-executive', authToken, tenantId),
        fetchJson('/health/remediation-executive/standards', authToken, tenantId, {
          standard_code: standardCode,
        }),
        fetchJson('/health/evidence-approval-queue', authToken, tenantId, {
          limit: '20',
          standard_code: standardCode,
        }),
        fetchJson('/health/controls-recovered', authToken, tenantId, {
          limit: '20',
          standard_code: standardCode,
        }),
      ]);

      setRemediationSummary(summaryJson.data || []);
      setRemediationPlan(planJson.data || []);
      setRemediationExecutive(executiveJson.data || []);
      setRemediationExecutiveStandards(executiveStandardsJson.data || []);
      setEvidenceApprovalQueue(approvalQueueJson.data || []);
      setControlsRecovered(recoveredJson.data || []);
    } catch (err: any) {
      setError(err.message || 'Error cargando plan de remediación');
    } finally {
      setLoadingRemediation(false);
    }
  }

  async function loadAuditData(
    tenantId?: string,
    authTokenParam?: string | null,
    filters?: { standardCode?: string }
  ) {
    const authToken = authTokenParam || token;

    if (!authToken) return;

    try {
      setLoadingAudit(true);

      const standardCode = filters?.standardCode ?? selectedStandardCode;

      const [auditJson, auditPlansJson, auditEvidencesJson] = await Promise.all([
        fetchJson('/health/audit-log', authToken, tenantId, {
          limit: '30',
          standard_code: standardCode,
        }),
        fetchJson('/health/audit-log/action-plans', authToken, tenantId, {
          limit: '20',
          standard_code: standardCode,
        }),
        fetchJson('/health/audit-log/evidences', authToken, tenantId, {
          limit: '20',
          standard_code: standardCode,
        }),
      ]);

      setAuditLog(auditJson.data || []);
      setAuditActionPlans(auditPlansJson.data || []);
      setAuditEvidences(auditEvidencesJson.data || []);
    } catch (err: any) {
      setError(err.message || 'Error cargando bitácora');
    } finally {
      setLoadingAudit(false);
    }
  }

  async function loadDashboard(
    tenantId?: string,
    authTokenParam?: string | null
  ) {
    const authToken = authTokenParam || token;

    if (!authToken) {
      setLoading(false);
      setError('Token no encontrado. Inicia sesión nuevamente.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [dashboardJson, rootCausesJson] = await Promise.all([
        fetchJson('/health/dashboard', authToken, tenantId),
        fetchJson('/health/root-causes', authToken, tenantId),
      ]);

      const dashboardData: HealthSummary[] = dashboardJson.data || [];
      const rootCauseData: RootCauseTenant[] = rootCausesJson.data || [];

      setSummaries(dashboardData);
      setRootCauses(rootCauseData);

      const finalTenantId =
        tenantId ||
        selectedTenantId ||
        dashboardData[0]?.tenant_id ||
        rootCauseData[0]?.tenant_id ||
        '';

      if (finalTenantId) {
        setSelectedTenantId(finalTenantId);

        const [standardsJson, riskJson, standardRootJson] = await Promise.all([
          fetchJson('/health/standards', authToken, finalTenantId),
          fetchJson('/health/controls-risk', authToken, finalTenantId),
          fetchJson('/health/root-causes/standards', authToken, finalTenantId),
        ]);

        setStandards(standardsJson.data || []);
        setRiskControls(riskJson.data || []);
        setStandardRootCauses(standardRootJson.data || []);

        await Promise.all([
          loadRemediationData(finalTenantId, authToken, {
            standardCode: selectedStandardCode,
            priority: remediationPriorityFilter,
            gap: remediationGapFilter,
          }),
          loadAuditData(finalTenantId, authToken, {
            standardCode: selectedStandardCode,
          }),
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado cargando dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleTenantChange(tenantId: string) {
    setSelectedTenantId(tenantId);
    setSelectedStandardCode('');
    setRemediationPriorityFilter('');
    setRemediationGapFilter('');
    await loadDashboard(tenantId);
  }

  async function refreshHealth() {
    if (!token) {
      setError('Token no encontrado. Inicia sesión nuevamente.');
      return;
    }

    try {
      setRefreshing(true);
      setError('');

      const res = await fetch(
        buildUrl('/health/refresh', selectedTenantId || undefined),
        {
          method: 'POST',
          headers: getAuthHeaders(token),
        }
      );

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Respuesta inválida del backend al recalcular salud.');
      }

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Error recalculando salud');
      }

      await loadDashboard(selectedTenantId, token);
    } catch (err: any) {
      setError(err.message || 'Error recalculando salud');
    } finally {
      setRefreshing(false);
    }
  }

  async function createRemediationAction(item: RemediationPlanItem) {
    if (!token) {
      setError('Token no encontrado. Inicia sesión nuevamente.');
      return;
    }

    if (!item.tenant_control_id) {
      setError('No se puede crear el plan: falta tenant_control_id.');
      return;
    }

    if (!item.standard_code) {
      setError('No se puede crear el plan: falta iso_code / standard_code.');
      return;
    }

    const actionKey = `${item.tenant_control_id}-${item.main_gap_key}`;

    try {
      setCreatingActionId(actionKey);
      setError('');

      const res = await fetch(`${API_URL}/health/remediation-plan/create-action`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          tenant_id: item.tenant_id || selectedTenantId,
          tenant_control_id: item.tenant_control_id,
          iso_code: item.standard_code,
          standard_code: item.standard_code,
          title:
            item.suggested_action_title ||
            `Regularizar control: ${item.control_description}`,
          description:
            item.suggested_action_description ||
            'Acción sugerida automáticamente por el motor de salud ISO.',
          priority: item.remediation_priority || 'media',
          due_date: normalizeDateOnly(item.suggested_due_date),
          owner: item.suggested_owner_role || null,
          main_gap_key: item.main_gap_key || null,
          main_gap_label: item.main_gap_label || null,
        }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Respuesta inválida del backend al crear plan.');
      }

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Error creando plan de acción');
      }

      window.alert(
        json.already_exists
          ? 'Ya existe un plan abierto para este control.'
          : 'Plan de acción creado correctamente.'
      );

      await Promise.all([
        loadRemediationData(selectedTenantId, token, {
          standardCode: selectedStandardCode,
          priority: remediationPriorityFilter,
          gap: remediationGapFilter,
        }),
        loadAuditData(selectedTenantId, token, {
          standardCode: selectedStandardCode,
        }),
      ]);
    } catch (err: any) {
      const message = err.message || 'Error creando plan de acción';
      setError(message);
      window.alert(message);
    } finally {
      setCreatingActionId('');
    }
  }

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    setToken(authToken);

    if (authToken) {
      loadDashboard(undefined, authToken);
    } else {
      setLoading(false);
      setError('Token no encontrado. Inicia sesión nuevamente.');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token || !selectedTenantId) return;

    loadRemediationData(selectedTenantId, token, {
      standardCode: selectedStandardCode,
      priority: remediationPriorityFilter,
      gap: remediationGapFilter,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStandardCode, remediationPriorityFilter, remediationGapFilter]);

  useEffect(() => {
    if (!token || !selectedTenantId) return;

    loadAuditData(selectedTenantId, token, {
      standardCode: selectedStandardCode,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStandardCode]);

  const score = toNumber(selectedSummary?.avg_health_score);
  const evidenceCoverage = toNumber(
    selectedSummary?.controls_with_evidence_percentage
  );
  const deteriorated = toNumber(
    selectedSummary?.kpi_deteriorated_controls_value
  );
  const mainCause = selectedRootCause?.main_cause_json;
  const mainRemediationGap = selectedRemediationSummary?.main_gap_summary_json;

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-100 p-6">
        {loading && summaries.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-gray-600">Cargando dashboard de salud...</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Dashboard de Salud ISO
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  KPIs, evidencias, causas raíz, remediación, trazabilidad y estado de controles por empresa y norma.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {summaries.length > 1 && (
                  <select
                    value={selectedTenantId}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                  >
                    {summaries.map((tenant) => (
                      <option key={tenant.tenant_id} value={tenant.tenant_id}>
                        {tenant.tenant_name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={refreshHealth}
                  disabled={refreshing}
                  className="rounded-xl bg-[#1b2733] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24384a] disabled:opacity-60"
                >
                  {refreshing ? 'Recalculando...' : 'Recalcular salud'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {selectedSummary && (
              <>
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Empresa seleccionada
                      </p>
                      <h2 className="mt-1 text-2xl font-bold text-gray-900">
                        {selectedSummary.tenant_name}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(
                            selectedSummary.tenant_health_status
                          )}`}
                        >
                          {statusLabel(selectedSummary.tenant_health_status)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                          {selectedSummary.total_controls} controles
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                          {selectedSummary.total_evidences} evidencias
                        </span>
                      </div>
                    </div>

                    <div className="w-full max-w-md">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-600">
                          Salud general
                        </span>
                        <span className="font-bold text-gray-900">
                          {score.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${progressColor(
                            score
                          )}`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {selectedRootCause && (
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Análisis inteligente
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-slate-900">
                          Causa principal de deterioro
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${causeColor(
                              mainCause?.cause_key
                            )}`}
                          >
                            {mainCause?.cause_label || 'Sin causa identificada'}
                          </span>

                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {toNumber(mainCause?.affected_controls).toFixed(0)} controles afectados
                          </span>
                        </div>
                      </div>

                      <div className="max-w-2xl rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-800">
                        {selectedRootCause.executive_recommendation}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                      <CauseMiniCard
                        title="Evidencias"
                        value={selectedRootCause.controls_with_evidence_gap}
                        max="30 pts"
                      />
                      <CauseMiniCard
                        title="Cumplimiento"
                        value={selectedRootCause.controls_with_compliance_gap}
                        max="25 pts"
                      />
                      <CauseMiniCard
                        title="Hallazgos"
                        value={selectedRootCause.controls_with_findings_gap}
                        max="15 pts"
                      />
                      <CauseMiniCard
                        title="Acciones"
                        value={selectedRootCause.controls_with_action_gap}
                        max="10 pts"
                      />
                      <CauseMiniCard
                        title="Riesgos"
                        value={selectedRootCause.controls_with_risk_gap}
                        max="10 pts"
                      />
                      <CauseMiniCard
                        title="Revisión"
                        value={selectedRootCause.controls_with_review_gap}
                        max="10 pts"
                      />
                    </div>
                  </div>
                )}

                {selectedRemediationExecutive && (
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Ejecutivo de remediación
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-slate-900">
                          Estado operativo de acciones y evidencias
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Seguimiento de acciones abiertas, vencidas, evidencias pendientes y controles recuperados.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                          Porcentaje de cierre
                        </p>
                        <p className="mt-2 text-4xl font-bold text-emerald-700">
                          {toNumber(selectedRemediationExecutive.completion_percentage).toFixed(2)}%
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          Última actualización: {formatDate(selectedRemediationExecutive.last_action_update)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Card
                        title="Acciones abiertas"
                        value={String(selectedRemediationExecutive.open_actions || '0')}
                        subtitle={`${selectedRemediationExecutive.in_progress_actions || '0'} en progreso`}
                      />
                      <Card
                        title="Acciones vencidas"
                        value={String(selectedRemediationExecutive.overdue_actions || '0')}
                        subtitle={`${selectedRemediationExecutive.high_open_actions || '0'} altas abiertas`}
                      />
                      <Card
                        title="Completadas"
                        value={String(selectedRemediationExecutive.completed_actions || '0')}
                        subtitle={`${selectedRemediationExecutive.controls_with_completed_actions || '0'} controles con cierre`}
                      />
                      <Card
                        title="Evidencias pendientes"
                        value={String(selectedRemediationExecutive.pending_evidences || '0')}
                        subtitle={`${selectedRemediationExecutive.approved_evidences || '0'} aprobadas`}
                      />
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              Evidencias pendientes de aprobación
                            </h4>
                            <p className="text-xs text-slate-500">
                              Últimas evidencias pendientes o no validadas.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => openEvidence(undefined, selectedStandardCode)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver evidencias
                          </button>
                        </div>

                        <div className="space-y-3">
                          {loadingRemediation ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              Cargando evidencias pendientes...
                            </div>
                          ) : evidenceApprovalQueue.length === 0 ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              No hay evidencias pendientes para esta selección.
                            </div>
                          ) : (
                            evidenceApprovalQueue.slice(0, 6).map((item) => (
                              <div
                                key={item.evidence_id}
                                className="rounded-xl border border-slate-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {item.file_name || 'Evidencia sin archivo'}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.standard_code} · Cláusula {item.clause || 'N/A'}
                                    </div>
                                  </div>

                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${evidenceStatusColor(
                                      item.status
                                    )}`}
                                  >
                                    {item.status || 'pendiente'}
                                  </span>
                                </div>

                                <div className="mt-2 text-xs leading-5 text-slate-600">
                                  {item.control_description || item.evidence_description || 'Sin descripción'}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.standard_code)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    Abrir evidencia
                                  </button>

                                  {item.action_plan_id && (
                                    <button
                                      type="button"
                                      onClick={() => openPlan(item.action_plan_id, item.standard_code)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Ver plan
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              Controles recuperados
                            </h4>
                            <p className="text-xs text-slate-500">
                              Controles que tienen evidencia aprobada y plan completado en la bitácora.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {loadingRemediation ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              Cargando controles recuperados...
                            </div>
                          ) : controlsRecovered.length === 0 ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              No hay controles recuperados para esta selección.
                            </div>
                          ) : (
                            controlsRecovered.slice(0, 6).map((item) => (
                              <div
                                key={`${item.tenant_control_id}-${item.action_plan_id}-${item.evidence_id || 'no-ev'}`}
                                className="rounded-xl border border-slate-200 bg-white p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {item.control_description || 'Control recuperado'}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.iso_code} · Cláusula {item.clause || 'N/A'}
                                    </div>
                                  </div>

                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${auditEventColor(
                                      item.event_label
                                    )}`}
                                  >
                                    {item.event_label || 'Recuperado'}
                                  </span>
                                </div>

                                <div className="mt-2 text-xs leading-5 text-slate-600">
                                  Plan: {item.action_plan_title || 'Plan completado'}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  Recuperado: {formatDateTime(item.recovered_at)}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.action_plan_id && (
                                    <button
                                      type="button"
                                      onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                    >
                                      Ver plan
                                    </button>
                                  )}

                                  {item.evidence_id && (
                                    <button
                                      type="button"
                                      onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      Ver evidencia
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Trazabilidad
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        Bitácora operativa del sistema
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Registro reciente de creación, cambios, aprobaciones y cierres relacionados con Health.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Filtro aplicado
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {selectedStandardCode || 'Todas las normas'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card
                      title="Eventos recientes"
                      value={String(auditSummary.totalEvents)}
                      subtitle="Timeline combinado"
                    />
                    <Card
                      title="Eventos de planes"
                      value={String(auditSummary.planEvents)}
                      subtitle="Creaciones, cambios y cierres"
                    />
                    <Card
                      title="Eventos de evidencias"
                      value={String(auditSummary.evidenceEvents)}
                      subtitle="Carga, validación y aprobación"
                    />
                    <Card
                      title="Recuperaciones"
                      value={String(auditSummary.recoveredEvents)}
                      subtitle="Controles con cierre trazable"
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-1">
                      <div className="mb-3">
                        <h4 className="font-bold text-slate-900">
                          Timeline general
                        </h4>
                        <p className="text-xs text-slate-500">
                          Últimos eventos relevantes del sistema.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            Cargando bitácora...
                          </div>
                        ) : auditLog.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            No hay eventos recientes para esta selección.
                          </div>
                        ) : (
                          auditLog.slice(0, 8).map((item) => (
                            <div
                              key={`${item.event_source}-${item.event_id}`}
                              className="rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${timelineSourceColor(
                                    item.event_source
                                  )}`}
                                >
                                  {item.event_source === 'action_plan'
                                    ? 'Plan'
                                    : item.event_source === 'evidence'
                                    ? 'Evidencia'
                                    : item.event_source}
                                </span>

                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${auditEventColor(
                                    item.event_label
                                  )}`}
                                >
                                  {item.event_label}
                                </span>
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {item.primary_label || 'Evento'}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code
                                  ? `${item.iso_code}${item.clause ? ` · ${item.clause}` : ''}`
                                  : 'Sin norma'}{' '}
                                · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Ver plan
                                  </button>
                                )}

                                {item.evidence_id && (
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Ver evidencia
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3">
                        <h4 className="font-bold text-slate-900">
                          Cambios en planes de acción
                        </h4>
                        <p className="text-xs text-slate-500">
                          Bitácora de creación, actualización y cierre de acciones.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            Cargando eventos de planes...
                          </div>
                        ) : auditActionPlans.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            No hay eventos de planes para esta selección.
                          </div>
                        ) : (
                          auditActionPlans.slice(0, 8).map((item) => (
                            <div
                              key={item.audit_event_id}
                              className="rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${auditEventColor(
                                    item.event_label
                                  )}`}
                                >
                                  {item.event_label}
                                </span>

                                {item.new_status && (
                                  <span
                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${actionStatusColor(
                                      item.new_status
                                    )}`}
                                  >
                                    {item.new_status}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {item.action_plan_title || 'Plan de acción'}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              {(item.old_status || item.new_status) && (
                                <div className="mt-2 text-[11px] text-slate-500">
                                  Estado: {item.old_status || '—'} → {item.new_status || '—'}
                                </div>
                              )}

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code || 'Sin norma'} · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                                  >
                                    Abrir plan
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3">
                        <h4 className="font-bold text-slate-900">
                          Cambios en evidencias
                        </h4>
                        <p className="text-xs text-slate-500">
                          Bitácora de carga, validación, aprobación y rechazo.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            Cargando eventos de evidencias...
                          </div>
                        ) : auditEvidences.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            No hay eventos de evidencias para esta selección.
                          </div>
                        ) : (
                          auditEvidences.slice(0, 8).map((item) => (
                            <div
                              key={item.audit_event_id}
                              className="rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${auditEventColor(
                                    item.event_label
                                  )}`}
                                >
                                  {item.event_label}
                                </span>

                                {item.new_status && (
                                  <span
                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${evidenceStatusColor(
                                      item.new_status
                                    )}`}
                                  >
                                    {item.new_status}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {item.file_name || item.evidence_description || 'Evidencia'}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code
                                  ? `${item.iso_code}${item.clause ? ` · ${item.clause}` : ''}`
                                  : 'Sin norma'}{' '}
                                · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.evidence_id && (
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    Abrir evidencia
                                  </button>
                                )}

                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Ver plan
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Plan sugerido
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        Remediación priorizada
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Acciones recomendadas automáticamente según la salud real de controles.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${causeColor(
                            mainRemediationGap?.main_gap_key
                          )}`}
                        >
                          {mainRemediationGap?.main_gap_label ||
                            'Sin brecha principal'}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          Próximo vencimiento:{' '}
                          {formatDate(selectedRemediationSummary?.nearest_due_date)}
                        </span>
                      </div>
                    </div>

                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Acciones
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                          {selectedRemediationSummary?.total_suggested_actions ||
                            '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                          Urgentes
                        </p>
                        <p className="mt-2 text-3xl font-bold text-red-700">
                          {selectedRemediationSummary?.urgent_actions || '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">
                          Altas
                        </p>
                        <p className="mt-2 text-3xl font-bold text-orange-700">
                          {selectedRemediationSummary?.high_actions || '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                          Evidencia
                        </p>
                        <p className="mt-2 text-3xl font-bold text-blue-700">
                          {selectedRemediationSummary?.evidence_actions || '0'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <select
                      value={remediationPriorityFilter}
                      onChange={(e) =>
                        setRemediationPriorityFilter(e.target.value)
                      }
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                    >
                      <option value="">Todas las prioridades</option>
                      <option value="urgente">Urgente</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>

                    <select
                      value={remediationGapFilter}
                      onChange={(e) => setRemediationGapFilter(e.target.value)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                    >
                      <option value="">Todas las brechas</option>
                      <option value="evidence">Brecha de evidencias</option>
                      <option value="compliance">Brecha de cumplimiento</option>
                      <option value="findings">Brecha de hallazgos</option>
                      <option value="actions">Brecha de acciones</option>
                      <option value="action_followup">
                        Seguimiento de acciones
                      </option>
                      <option value="risk">Brecha de riesgos</option>
                      <option value="review">Brecha de revisión</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setRemediationPriorityFilter('');
                        setRemediationGapFilter('');
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Limpiar filtros de remediación
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1550px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                          <th className="w-[110px] py-3 pr-4">Prioridad</th>
                          <th className="w-[140px] py-3 pr-4">Norma</th>
                          <th className="w-[90px] py-3 pr-4">Cláusula</th>
                          <th className="min-w-[390px] py-3 pr-4">
                            Acción sugerida
                          </th>
                          <th className="min-w-[190px] py-3 pr-4">Brecha</th>
                          <th className="min-w-[290px] py-3 pr-4">
                            Responsable sugerido
                          </th>
                          <th className="w-[120px] py-3 pr-4">Vence</th>
                          <th className="w-[110px] py-3 pr-4">Salud</th>
                          <th className="w-[120px] py-3 pr-4">Acción</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loadingRemediation ? (
                          <tr>
                            <td className="py-6 text-gray-500" colSpan={9}>
                              Cargando plan de remediación...
                            </td>
                          </tr>
                        ) : remediationPlan.length === 0 ? (
                          <tr>
                            <td className="py-6 text-gray-500" colSpan={9}>
                              No hay acciones de remediación para los filtros seleccionados.
                            </td>
                          </tr>
                        ) : (
                          remediationPlan.map((item) => {
                            const actionKey = `${item.tenant_control_id}-${item.main_gap_key}`;
                            const isCreating = creatingActionId === actionKey;

                            return (
                              <tr
                                key={`${item.tenant_control_id}-${item.main_gap_key}`}
                                className="border-b border-gray-100 align-top"
                              >
                                <td className="py-4 pr-4 align-top">
                                  <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${priorityColor(
                                      item.remediation_priority
                                    )}`}
                                  >
                                    {priorityLabel(item.remediation_priority)}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 align-top font-semibold text-gray-900">
                                  {item.standard_code}
                                </td>

                                <td className="py-4 pr-4 align-top text-gray-700">
                                  {item.clause}
                                </td>

                                <td className="py-4 pr-4 align-top">
                                  <div className="font-semibold text-gray-900">
                                    {item.suggested_action_title}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-gray-500">
                                    {item.suggested_action_description}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-slate-400">
                                    Control: {item.control_description}
                                  </div>
                                </td>

                                <td className="min-w-[190px] py-4 pr-4 align-top">
                                  <span
                                    className={`inline-flex min-w-[132px] max-w-[175px] items-center justify-center rounded-lg border px-3 py-1.5 text-center text-xs font-semibold leading-snug whitespace-normal break-words ${causeColor(
                                      item.main_gap_key
                                    )}`}
                                  >
                                    {item.main_gap_label || 'Sin brecha'}
                                  </span>
                                </td>

                                <td className="min-w-[290px] py-4 pr-4 align-top text-gray-700">
                                  <span className="block max-w-[280px] leading-5">
                                    {item.suggested_owner_role}
                                  </span>
                                </td>

                                <td className="py-4 pr-4 align-top text-gray-700">
                                  {formatDate(item.suggested_due_date)}
                                </td>

                                <td className="py-4 pr-4 align-top">
                                  <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(
                                      item.health_status
                                    )}`}
                                  >
                                    {toNumber(item.health_score).toFixed(2)}%
                                  </span>
                                </td>

                                <td className="py-4 pr-4 align-top">
                                  <button
                                    type="button"
                                    onClick={() => createRemediationAction(item)}
                                    disabled={isCreating}
                                    className="inline-flex min-w-[92px] items-center justify-center rounded-xl bg-[#1b2733] px-3 py-2 text-center text-xs font-semibold leading-tight text-white shadow-sm transition hover:bg-[#24384a] disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isCreating ? 'Creando...' : 'Crear plan'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredRemediationExecutiveStandards.length > 0 && (
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900">
                        Remediación por norma
                      </h3>
                      <p className="text-sm text-gray-500">
                        Distribución de acciones, vencimientos y evidencias por estándar.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                            <th className="py-3 pr-4">Norma</th>
                            <th className="py-3 pr-4">Total</th>
                            <th className="py-3 pr-4">Abiertas</th>
                            <th className="py-3 pr-4">En progreso</th>
                            <th className="py-3 pr-4">Vencidas</th>
                            <th className="py-3 pr-4">Completadas</th>
                            <th className="py-3 pr-4">% cierre</th>
                            <th className="py-3 pr-4">Evidencias pendientes</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredRemediationExecutiveStandards.map((item) => (
                            <tr
                              key={`${item.tenant_id}-${item.standard_code}-remediation`}
                              className="border-b border-gray-100"
                            >
                              <td className="py-4 pr-4 font-semibold text-gray-900">
                                {item.standard_code}
                              </td>
                              <td className="py-4 pr-4 text-gray-700">
                                {item.total_action_plans || '0'}
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${actionStatusColor('abierto')}`}>
                                  {item.open_actions || '0'}
                                </span>
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${actionStatusColor('en progreso')}`}>
                                  {item.in_progress_actions || '0'}
                                </span>
                              </td>
                              <td className="py-4 pr-4">
                                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                                  {item.overdue_actions || '0'}
                                </span>
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${actionStatusColor('completado')}`}>
                                  {item.completed_actions || '0'}
                                </span>
                              </td>
                              <td className="py-4 pr-4 font-semibold text-gray-900">
                                {toNumber(item.completion_percentage).toFixed(2)}%
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${evidenceStatusColor('pendiente')}`}>
                                  {item.pending_evidences || '0'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card
                    title="Salud general"
                    value={`${score.toFixed(2)}%`}
                    subtitle="Promedio de controles"
                    color={selectedSummary.kpi_health_color}
                  />
                  <Card
                    title="Cobertura de evidencias"
                    value={`${evidenceCoverage.toFixed(2)}%`}
                    subtitle={`${selectedSummary.total_evidences} evidencias cargadas`}
                    color={selectedSummary.kpi_evidence_coverage_color}
                  />
                  <Card
                    title="Controles deteriorados"
                    value={`${deteriorated.toFixed(2)}%`}
                    subtitle={`${selectedSummary.deteriorated_controls} deteriorados / ${selectedSummary.critical_controls} críticos`}
                    color={selectedSummary.kpi_deteriorated_controls_color}
                  />
                  <Card
                    title="Controles saludables"
                    value={`${selectedSummary.healthy_percentage}%`}
                    subtitle={`${selectedSummary.healthy_controls} saludables`}
                    color={selectedSummary.kpi_health_color}
                  />
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Card
                    title="Saludables"
                    value={selectedSummary.healthy_controls}
                    subtitle="Controles en verde"
                  />
                  <Card
                    title="En atención"
                    value={selectedSummary.attention_controls}
                    subtitle="Controles en amarillo"
                  />
                  <Card
                    title="Deteriorados"
                    value={selectedSummary.deteriorated_controls}
                    subtitle="Controles deteriorados"
                  />
                  <Card
                    title="Críticos"
                    value={selectedSummary.critical_controls}
                    subtitle="Prioridad inmediata"
                  />
                </div>
              </>
            )}

            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Salud por norma
                  </h3>
                  <p className="text-sm text-gray-500">
                    Estado consolidado de cada estándar activo para la empresa.
                  </p>
                </div>

                <select
                  value={selectedStandardCode}
                  onChange={(e) => setSelectedStandardCode(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                >
                  <option value="">Todas las normas</option>
                  {standards.map((item) => (
                    <option
                      key={item.standard_code}
                      value={item.standard_code}
                    >
                      {item.standard_code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-3 pr-4">Norma</th>
                      <th className="py-3 pr-4">Controles</th>
                      <th className="py-3 pr-4">Salud</th>
                      <th className="py-3 pr-4">Estado</th>
                      <th className="py-3 pr-4">Evidencias</th>
                      <th className="py-3 pr-4">Deteriorados</th>
                      <th className="py-3 pr-4">Causa principal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {standards.map((item) => {
                      const value = toNumber(item.avg_health_score);
                      const standardCause = standardCauseMap.get(
                        item.standard_code
                      );
                      const mainStandardCause =
                        standardCause?.main_cause_json || null;

                      return (
                        <tr
                          key={`${item.tenant_id}-${item.standard_code}`}
                          className="border-b border-gray-100"
                        >
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-gray-900">
                              {item.standard_code}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.standard_name}
                            </div>
                          </td>

                          <td className="py-4 pr-4 text-gray-700">
                            {item.total_controls}
                          </td>

                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200">
                                <div
                                  className={`h-full rounded-full ${progressColor(
                                    value
                                  )}`}
                                  style={{ width: `${Math.min(value, 100)}%` }}
                                />
                              </div>
                              <span className="font-semibold text-gray-900">
                                {value.toFixed(2)}%
                              </span>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(
                                item.standard_health_status
                              )}`}
                            >
                              {statusLabel(item.standard_health_status)}
                            </span>
                          </td>

                          <td className="py-4 pr-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorClasses(
                                item.kpi_evidence_coverage_color
                              )}`}
                            >
                              {toNumber(
                                item.controls_with_evidence_percentage
                              ).toFixed(2)}
                              %
                            </span>
                          </td>

                          <td className="py-4 pr-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${colorClasses(
                                item.kpi_deteriorated_controls_color
                              )}`}
                            >
                              {toNumber(
                                item.kpi_deteriorated_controls_value
                              ).toFixed(2)}
                              %
                            </span>
                          </td>

                          <td className="py-4 pr-4">
                            <span
                              className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold ${causeColor(
                                mainStandardCause?.cause_key
                              )}`}
                            >
                              {mainStandardCause?.cause_label ||
                                'Sin causa identificada'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {standards.length === 0 && (
                      <tr>
                        <td className="py-6 text-gray-500" colSpan={7}>
                          No hay normas disponibles para esta empresa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Controles con mayor riesgo
                </h3>
                <p className="text-sm text-gray-500">
                  Primeros 100 controles deteriorados o críticos para la empresa seleccionada.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-3 pr-4">Norma</th>
                      <th className="py-3 pr-4">Cláusula</th>
                      <th className="py-3 pr-4">Control</th>
                      <th className="py-3 pr-4">Estado control</th>
                      <th className="py-3 pr-4">Evidencias</th>
                      <th className="py-3 pr-4">Salud</th>
                      <th className="py-3 pr-4">Cálculo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRiskControls.map((item) => (
                      <tr
                        key={item.tenant_control_id}
                        className="border-b border-gray-100"
                      >
                        <td className="py-4 pr-4 font-semibold text-gray-900">
                          {item.standard_code}
                        </td>

                        <td className="py-4 pr-4 text-gray-700">
                          {item.clause}
                        </td>

                        <td className="py-4 pr-4">
                          <div className="font-medium text-gray-900">
                            {item.control_description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.category}
                          </div>
                        </td>

                        <td className="py-4 pr-4">
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                            {item.control_status}
                          </span>
                        </td>

                        <td className="py-4 pr-4 text-gray-700">
                          {item.evidence_count}
                        </td>

                        <td className="py-4 pr-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusColor(
                              item.health_status
                            )}`}
                          >
                            {toNumber(item.health_score).toFixed(2)}%
                          </span>
                        </td>

                        <td className="py-4 pr-4">
                          <div className="grid min-w-[320px] grid-cols-3 gap-2 text-xs">
                            <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">
                              Ev: {toNumber(item.evidence_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-700">
                              Cump: {toNumber(item.compliance_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">
                              Hall: {toNumber(item.findings_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
                              Acc: {toNumber(item.action_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-purple-50 px-2 py-1 text-purple-700">
                              Ries: {toNumber(item.risk_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                              Rev: {toNumber(item.review_score).toFixed(0)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredRiskControls.length === 0 && (
                      <tr>
                        <td className="py-6 text-gray-500" colSpan={7}>
                          No hay controles deteriorados para esta empresa o norma.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
