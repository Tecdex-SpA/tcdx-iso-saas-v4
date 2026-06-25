'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import CompanyProfileImpactPanel from '@/components/company-profile/CompanyProfileImpactPanel';
import {
  EnterpriseButton,
  EnterprisePageHeader,
} from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserFromToken } from '@/utils/auth';
import { getStatusLabel, getPriorityLabel, getSeverityLabel, getHealthStatusLabel, getRiskLevelLabel, getAuditStatusLabel, getEvidenceStatusLabel, getFindingStatusLabel, getActionPlanStatusLabel, getNotificationLevelLabel, getKpiColorLabel, getCategoryLabel } from '@/i18n/statusLabels';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

function isPlatformRole(user: unknown) {
  const record = user && typeof user === 'object' ? user as Record<string, unknown> : {};
  const role = String(record.role || record.user_role || record.userRole || '').toLowerCase();
  return ['superadmin', 'super_admin', 'platform_admin', 'admin_global', 'global_admin', 'owner'].includes(role);
}

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

type SprintHealthSummary = {
  global_score: number;
  status: string;
  label: string;
  color?: string;
  updated_at?: string;
  drivers?: string[];
  explanation?: string;
  dimensions?: Record<string, { score: number; weight: number }>;
  totals?: Record<string, number>;
  document_maturity?: {
    total_documents?: number;
    useful_documents?: number;
    processed_documents?: number;
    excluded_documents?: number;
    score?: number;
  };
  data_quality_warnings?: string[];
};

type SprintStandardHealth = {
  id?: string;
  standard_id?: string;
  standard_code?: string;
  name?: string;
  score?: number;
  status?: string;
  label?: string;
  controls_evaluated?: number;
  controls_covered?: number;
  controls_partially_covered?: number;
  controls_without_evidence?: number;
  gaps_open?: number;
  actions_overdue?: number;
  recommendations_pending?: number;
  explanation?: string;
};

type SprintProcessHealth = {
  id?: string | null;
  process_id?: string | null;
  operation_id?: string | null;
  name?: string;
  standard_code?: string;
  score?: number;
  status?: string;
  label?: string;
  controls_applicable?: number;
  coverage?: number;
  gaps_open?: number;
  actions_overdue?: number;
  risks_high?: number;
  missing_evidence?: number;
  main_issue?: string;
  explanation?: string;
};

type SprintKpi = {
  code: string;
  name: string;
  value: number;
  unit: string;
  status: string;
  description: string;
};

type SprintHealthDashboard = {
  global_score?: number;
  label?: string;
  status?: string;
  explanation?: string;
  critical_processes?: Array<{
    id?: string | null;
    process_id?: string | null;
    operation_id?: string | null;
    name?: string;
    standard_code?: string;
    score?: number;
    status?: string;
    main_issue?: string;
  }>;
  alerts?: {
    critical_gaps?: number;
    overdue_actions?: number;
    missing_evidence?: number;
  };
  data_quality_warnings?: string[];
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
  recommendation_trace_json: unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type TFunction = (key: string, params?: Record<string, string | number>) => string;

function statusLabel(status: string, t: TFunction) {
  const map: Record<string, string> = {
    saludable: t('statuses.controls.saludable'),
    atencion: t('statuses.controls.atencion'),
    deteriorado: t('statuses.controls.deteriorado'),
    critico: t('statuses.findings.critico'),
  };

  return map[status] || status || t('health.noStatus');
}

function priorityLabel(priority: string, t: TFunction) {
  const map: Record<string, string> = {
    urgente: t('health.priority.urgent'),
    alta: t('health.priority.high'),
    media: t('health.priority.medium'),
    baja: t('health.priority.low'),
  };

  return map[priority] || priority || t('health.noPriority');
}

function translateStatus(value: string | undefined, t: TFunction) {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    pendiente: t('statuses.evidence.pendiente'),
    aprobada: t('statuses.evidence.aprobada'),
    aprobado: t('statuses.evidence.aprobada'),
    rechazada: t('statuses.evidence.rechazada'),
    rechazado: t('statuses.evidence.rechazada'),
    abierto: t('findings.status.open'),
    en_progreso: t('audits.status.inProgress'),
    completado: t('audits.status.completed'),
    completada: t('audits.status.completed'),
    cancelado: t('audits.status.cancelled'),
    cancelada: t('audits.status.cancelled'),
    bloqueado: t('health.status.blocked'),
    saludable: t('statuses.controls.saludable'),
    atencion: t('statuses.controls.atencion'),
    deteriorado: t('statuses.controls.deteriorado'),
    critico: t('statuses.findings.critico'),
  };

  return map[normalized] || value || t('common.noData');
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

function sprintHealthColor(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'high') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (normalized === 'acceptable') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (normalized === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (normalized === 'low') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (normalized === 'critical') return 'bg-red-100 text-red-700 border-red-200';
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

function normalizeHealthApiPath(path: string) {
  if (path.startsWith('/api/')) return path;
  if (path.startsWith('/health')) return `/api${path}`;
  return path;
}

function healthApiErrorMessage(status: number, json: unknown, fallback: string) {
  const record = isRecord(json) ? json : {};
  const code = String(record.code || '').toUpperCase();
  if (status === 401 || code === 'NO_TOKEN') {
    return 'Sesión no válida o expirada. Vuelve a iniciar sesión.';
  }
  if (status === 403) {
    return 'No tienes permisos para acceder a este recurso.';
  }
  return String(record.error || record.message || fallback);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function settledData<T>(result: PromiseSettledResult<unknown>, fallback: T): T {
  if (result.status !== 'fulfilled') return fallback;
  const value = result.value && typeof result.value === 'object'
    ? result.value as { data?: unknown }
    : null;
  return (value?.data ?? fallback) as T;
}

function settledErrorMessage(result: PromiseSettledResult<unknown>) {
  if (result.status === 'fulfilled') return '';
  return result.reason instanceof Error ? result.reason.message : String(result.reason || '');
}

function buildUrl(
  path: string,
  tenantId?: string,
  extraParams?: Record<string, string>
) {
  const baseUrl =
    API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const url = new URL(normalizeHealthApiPath(path), baseUrl);

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
  maxLabel,
}: {
  title: string;
  value: string | number;
  max?: string | number;
  maxLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {max !== undefined && (
        <p className="mt-1 text-xs text-slate-500">{maxLabel}: {max}</p>
      )}
    </div>
  );
}

export default function HealthDashboardPage() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [canRefreshHealth, setCanRefreshHealth] = useState(false);

  const [summaries, setSummaries] = useState<HealthSummary[]>([]);
  const [standards, setStandards] = useState<StandardHealth[]>([]);
  const [sprintHealthSummary, setSprintHealthSummary] = useState<SprintHealthSummary | null>(null);
  const [sprintHealthDashboard, setSprintHealthDashboard] = useState<SprintHealthDashboard | null>(null);
  const [sprintStandards, setSprintStandards] = useState<SprintStandardHealth[]>([]);
  const [sprintProcesses, setSprintProcesses] = useState<SprintProcessHealth[]>([]);
  const [sprintKpis, setSprintKpis] = useState<SprintKpi[]>([]);
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
  const [selectedSprintProcess, setSelectedSprintProcess] = useState<string>('');
  const [remediationPriorityFilter, setRemediationPriorityFilter] =
    useState<string>('');
  const [remediationGapFilter, setRemediationGapFilter] =
    useState<string>('');

  const [loading, setLoading] = useState(true);
  const [loadingSprintHealth, setLoadingSprintHealth] = useState(true);
  const [loadingRemediation, setLoadingRemediation] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingActionId, setCreatingActionId] = useState('');
  const [error, setError] = useState('');
  const [sprintHealthError, setSprintHealthError] = useState('');
  const [lastSprintHealthLoadedAt, setLastSprintHealthLoadedAt] = useState<string>('');

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

    let json: unknown = null;

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        t('health.errors.invalidBackendResponse', { path, status: res.status })
      );
    }

    if (!res.ok || (isRecord(json) && json.ok === false)) {
      throw new Error(healthApiErrorMessage(res.status, json, t('health.errors.serviceQuery')));
    }

    return json;
  }

  async function loadSprintHealth(
    tenantId?: string,
    authTokenParam?: string | null
  ) {
    const authToken = authTokenParam || token;

    if (!authToken) {
      setLoadingSprintHealth(false);
      return;
    }

    try {
      setLoadingSprintHealth(true);
      setSprintHealthError('');

      const [summaryResult, dashboardResult, standardsResult, processesResult, kpisResult] = await Promise.allSettled([
        fetchJson('/api/health/summary', authToken, tenantId),
        fetchJson('/api/health/dashboard', authToken, tenantId),
        fetchJson('/api/health/standards', authToken, tenantId),
        fetchJson('/api/health/processes', authToken, tenantId),
        fetchJson('/api/health/kpis', authToken, tenantId),
      ]);

      setSprintHealthSummary(settledData<SprintHealthSummary | null>(summaryResult, null));
      setSprintHealthDashboard(settledData<SprintHealthDashboard | null>(dashboardResult, null));
      setSprintStandards(asArray<SprintStandardHealth>(settledData(standardsResult, [])));
      setSprintProcesses(asArray<SprintProcessHealth>(settledData(processesResult, [])));
      setSprintKpis(asArray<SprintKpi>(settledData(kpisResult, [])));
      const sprintError = [
        summaryResult,
        dashboardResult,
        standardsResult,
        processesResult,
        kpisResult,
      ].map(settledErrorMessage).find(Boolean);
      if (sprintError) {
        setSprintHealthError(sprintError);
      }
      setLastSprintHealthLoadedAt(new Date().toISOString());
    } catch (err: unknown) {
      setSprintHealthError(getErrorMessage(err, 'No fue posible cargar Health/KPIs Sprint 5.'));
      setSprintHealthSummary(null);
      setSprintHealthDashboard(null);
      setSprintStandards([]);
      setSprintProcesses([]);
      setSprintKpis([]);
    } finally {
      setLoadingSprintHealth(false);
    }
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
        summaryResult,
        planResult,
        executiveResult,
        executiveStandardsResult,
        approvalQueueResult,
        recoveredResult,
      ] = await Promise.allSettled([
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

      setRemediationSummary(asArray<RemediationSummary>(settledData(summaryResult, [])));
      setRemediationPlan(asArray<RemediationPlanItem>(settledData(planResult, [])));
      setRemediationExecutive(asArray<RemediationExecutiveTenant>(settledData(executiveResult, [])));
      setRemediationExecutiveStandards(asArray<RemediationExecutiveStandard>(settledData(executiveStandardsResult, [])));
      setEvidenceApprovalQueue(asArray<EvidenceApprovalItem>(settledData(approvalQueueResult, [])));
      setControlsRecovered(asArray<ControlRecoveredItem>(settledData(recoveredResult, [])));

      const remediationError = [
        summaryResult,
        planResult,
        executiveResult,
        executiveStandardsResult,
        approvalQueueResult,
        recoveredResult,
      ].map(settledErrorMessage).find(Boolean);
      if (remediationError) {
        setError(remediationError);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('health.errors.loadingRemediation')));
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

      const [auditResult, auditPlansResult, auditEvidencesResult] = await Promise.allSettled([
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

      setAuditLog(asArray<AuditLogItem>(settledData(auditResult, [])));
      setAuditActionPlans(asArray<AuditActionPlanItem>(settledData(auditPlansResult, [])));
      setAuditEvidences(asArray<AuditEvidenceItem>(settledData(auditEvidencesResult, [])));

      const auditError = [
        auditResult,
        auditPlansResult,
        auditEvidencesResult,
      ].map(settledErrorMessage).find(Boolean);
      if (auditError) {
        setError(auditError);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('health.errors.loadingLog')));
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
      setLoadingSprintHealth(false);
      setError(t('health.errors.missingToken'));
      return;
    }

    try {
      setLoading(true);
      setError('');

      await loadSprintHealth(tenantId, authToken);

      const [dashboardResult, rootCausesResult] = await Promise.allSettled([
        fetchJson('/health/dashboard', authToken, tenantId),
        fetchJson('/health/root-causes', authToken, tenantId),
      ]);

      const dashboardData = asArray<HealthSummary>(settledData(dashboardResult, []));
      const rootCauseData = asArray<RootCauseTenant>(settledData(rootCausesResult, []));

      setSummaries(dashboardData);
      setRootCauses(rootCauseData);

      const dashboardError = [dashboardResult, rootCausesResult]
        .map(settledErrorMessage)
        .find(Boolean);
      if (dashboardError) {
        setError(dashboardError);
      }

      const finalTenantId =
        tenantId ||
        selectedTenantId ||
        dashboardData[0]?.tenant_id ||
        rootCauseData[0]?.tenant_id ||
        '';

      if (finalTenantId) {
        setSelectedTenantId(finalTenantId);

        if (finalTenantId !== tenantId) {
          await loadSprintHealth(finalTenantId, authToken);
        }

        const [standardsResult, riskResult, standardRootResult] = await Promise.allSettled([
          fetchJson('/health/standards', authToken, finalTenantId),
          fetchJson('/health/controls-risk', authToken, finalTenantId),
          fetchJson('/health/root-causes/standards', authToken, finalTenantId),
        ]);

        setStandards(asArray<StandardHealth>(settledData(standardsResult, [])));
        setRiskControls(asArray<RiskControl>(settledData(riskResult, [])));
        setStandardRootCauses(asArray<RootCauseStandard>(settledData(standardRootResult, [])));

        const detailError = [standardsResult, riskResult, standardRootResult]
          .map(settledErrorMessage)
          .find(Boolean);
        if (detailError) {
          setError(detailError);
        }

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('health.errors.loadingDashboard')));
    } finally {
      setLoading(false);
    }
  }

  async function handleTenantChange(tenantId: string) {
    setSelectedTenantId(tenantId);
    setSelectedStandardCode('');
    setSelectedSprintProcess('');
    setRemediationPriorityFilter('');
    setRemediationGapFilter('');
    await loadDashboard(tenantId);
  }

  async function refreshHealth() {
    if (!token) {
      setError(t('health.errors.missingToken'));
      return;
    }

    if (!canRefreshHealth) {
      setError('No tienes permisos para recalcular o administrar Health ISO.');
      return;
    }

    try {
      setRefreshing(true);
      setError('');
      await loadSprintHealth(selectedTenantId || undefined, token);

      const res = await fetch(
        buildUrl('/health/refresh', selectedTenantId || undefined),
        {
          method: 'POST',
          headers: getAuthHeaders(token),
        }
      );

      const text = await res.text();
      let json: unknown = null;

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(t('health.errors.invalidRefreshResponse'));
      }

      if (!res.ok || (isRecord(json) && json.ok === false)) {
        throw new Error(healthApiErrorMessage(res.status, json, t('health.errors.refresh')));
      }

      await loadDashboard(selectedTenantId, token);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('health.errors.refresh')));
    } finally {
      setRefreshing(false);
    }
  }

  async function createRemediationAction(item: RemediationPlanItem) {
    if (!token) {
      setError(t('health.errors.missingToken'));
      return;
    }

    if (!canRefreshHealth) {
      const message = 'No tienes permisos para recalcular o administrar Health ISO.';
      setError(message);
      window.alert(message);
      return;
    }

    if (!item.tenant_control_id) {
      setError(t('health.errors.missingTenantControl'));
      return;
    }

    if (!item.standard_code) {
      setError(t('health.errors.missingStandardCode'));
      return;
    }

    const actionKey = `${item.tenant_control_id}-${item.main_gap_key}`;

    try {
      setCreatingActionId(actionKey);
      setError('');

      const res = await fetch(buildUrl('/health/remediation-plan/create-action'), {
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
            t('health.autoSuggestedActionDescription'),
          priority: item.remediation_priority || 'media',
          due_date: normalizeDateOnly(item.suggested_due_date),
          owner: item.suggested_owner_role || null,
          main_gap_key: item.main_gap_key || null,
          main_gap_label: item.main_gap_label || null,
        }),
      });

      const text = await res.text();
      let json: unknown = null;

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(t('health.errors.invalidCreatePlanResponse'));
      }

      if (!res.ok || (isRecord(json) && json.ok === false)) {
        throw new Error(healthApiErrorMessage(res.status, json, t('health.errors.createPlan')));
      }

      const responseRecord = isRecord(json) ? json : {};
      window.alert(
        responseRecord.already_exists
          ? t('health.planAlreadyExists')
          : t('health.planCreated')
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
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('health.errors.createPlan'));
      setError(message);
      window.alert(message);
    } finally {
      setCreatingActionId('');
    }
  }

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const user = getUserFromToken();
    setToken(authToken);

    if (authToken) {
      if (isPlatformRole(user)) {
        setCanRefreshHealth(true);
      } else {
        fetch(`${API_URL}/api/me/permissions`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
          .then((res) => res.json())
          .then((json) => {
            setCanRefreshHealth(json?.permission_map?.['health.refresh'] === true);
          })
          .catch(() => {
            setCanRefreshHealth(false);
          });
      }
      loadDashboard(undefined, authToken);
    } else {
      setLoading(false);
      setLoadingSprintHealth(false);
      setError(t('health.errors.missingToken'));
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
  const filteredSprintStandards = useMemo(() => {
    if (!selectedStandardCode) return sprintStandards;
    return sprintStandards.filter((item) => item.standard_code === selectedStandardCode);
  }, [sprintStandards, selectedStandardCode]);
  const filteredSprintProcesses = useMemo(() => {
    return sprintProcesses.filter((item) => {
      const key = `${item.standard_code || ''}:${item.process_id || item.operation_id || item.id || item.name || ''}`;
      if (selectedStandardCode && item.standard_code !== selectedStandardCode) return false;
      if (selectedSprintProcess && key !== selectedSprintProcess) return false;
      return true;
    });
  }, [sprintProcesses, selectedStandardCode, selectedSprintProcess]);
  const sprintProcessOptions = useMemo(() => {
    return sprintProcesses
      .filter((item) => !selectedStandardCode || item.standard_code === selectedStandardCode)
      .map((item) => ({
        key: `${item.standard_code || ''}:${item.process_id || item.operation_id || item.id || item.name || ''}`,
        label: `${item.standard_code || 'ISO'} · ${item.name || 'Proceso'}`,
      }));
  }, [sprintProcesses, selectedStandardCode]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {loading && summaries.length === 0 && loadingSprintHealth ? (
          <div className="enterprise-card">
            <p className="text-gray-600">{t('health.loadingDashboard')}</p>
          </div>
        ) : (
          <>
            <EnterprisePageHeader
              title={t('health.title')}
              subtitle={t('health.subtitle')}
              actions={
                <>
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

                <EnterpriseButton
                  type="button"
                  onClick={refreshHealth}
                  disabled={refreshing || !canRefreshHealth}
                  title={!canRefreshHealth ? 'No tienes permisos para recalcular o administrar Health ISO.' : undefined}
                  className="disabled:opacity-60"
                >
                  {refreshing ? t('health.recalculating') : t('health.recalculateHealth')}
                </EnterpriseButton>
                </>
              }
            />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <CompanyProfileImpactPanel
                moduleCode="health"
                title="Interpretación de salud según Perfil Empresa"
                compact
              />
            </div>

            <section className="enterprise-card">
              {loadingSprintHealth ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                  Cargando salud del sistema...
                </div>
              ) : sprintHealthError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  <p className="font-semibold">No fue posible cargar salud del sistema.</p>
                  <p className="mt-1">{sprintHealthError}</p>
                  <button
                    type="button"
                    onClick={() => loadSprintHealth(selectedTenantId || undefined, token)}
                    className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
                  >
                    Reintentar
                  </button>
                </div>
              ) : !sprintHealthSummary ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">No hay datos de salud disponibles.</p>
                  <p className="mt-1">
                    No se encontraron normas, procesos o controles evaluables para calcular Health.
                  </p>
                </div>
              ) : (
                <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Cumplimiento y Auditoría · Salud del sistema
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">
                      Health por norma y proceso
                    </h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">
                      Health es un indicador calculado de gestión, no certificación ni aprobación automática.
                      Fórmula: 35% cobertura de controles, 20% evidencias, 15% brechas,
                      15% acciones, 10% riesgos y 5% ciclo ISO/auditoría.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Última actualización:{' '}
                      {formatDateTime(sprintHealthSummary.updated_at || lastSprintHealthLoadedAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-950 px-5 py-4 text-white">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Health global
                    </div>
                    <div className="mt-2 flex items-end gap-3">
                      <span className="text-5xl font-bold">{toNumber(sprintHealthSummary.global_score).toFixed(0)}</span>
                      <span className={`mb-1 rounded-full border px-3 py-1 text-xs font-semibold ${sprintHealthColor(sprintHealthSummary.status)}`}>
                        {sprintHealthSummary.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  {sprintHealthSummary.explanation || 'Sin explicación de cálculo disponible.'}
                </div>

                {sprintHealthSummary.drivers && sprintHealthSummary.drivers.length > 0 && (
                  <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Drivers principales</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sprintHealthSummary.drivers.map((driver) => (
                        <span key={driver} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          {driver}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-medium text-gray-500">Controles sin evidencia</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                      {toNumber(sprintHealthSummary.totals?.controls_without_evidence ?? sprintHealthDashboard?.alerts?.missing_evidence)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-medium text-gray-500">Brechas abiertas</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                      {toNumber(sprintHealthSummary.totals?.gaps_open ?? sprintHealthDashboard?.alerts?.critical_gaps)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-medium text-gray-500">Acciones vencidas</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                      {toNumber(sprintHealthSummary.totals?.actions_overdue ?? sprintHealthDashboard?.alerts?.overdue_actions)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 md:flex-row">
                  <select
                    value={selectedStandardCode}
                    onChange={(e) => {
                      setSelectedStandardCode(e.target.value);
                      setSelectedSprintProcess('');
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                  >
                    <option value="">Todas las normas</option>
                    {sprintStandards.map((item) => (
                      <option key={item.standard_code || item.id} value={item.standard_code || ''}>
                        {item.name || item.standard_code}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedSprintProcess}
                    onChange={(e) => setSelectedSprintProcess(e.target.value)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                  >
                    <option value="">Todos los procesos</option>
                    {sprintProcessOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Health por norma</h3>
                    <div className="mt-3 space-y-3">
                      {filteredSprintStandards.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay normas evaluables.</p>
                      ) : (
                        filteredSprintStandards.map((item) => (
                          <div key={item.standard_code || item.id} className="rounded-xl bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-gray-900">{item.name || item.standard_code}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.controls_covered || 0} cubiertos · {item.controls_without_evidence || 0} sin evidencia · {item.actions_overdue || 0} acciones vencidas
                                </div>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sprintHealthColor(item.status)}`}>
                                {toNumber(item.score).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Health por proceso</h3>
                    <div className="mt-3 space-y-3">
                      {filteredSprintProcesses.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay procesos evaluables para el filtro.</p>
                      ) : (
                        filteredSprintProcesses.slice(0, 8).map((item) => (
                          <div key={`${item.standard_code}-${item.id || item.operation_id || item.name}`} className="rounded-xl bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-gray-900">{item.name || 'Proceso'}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.standard_code} · {item.main_issue || 'sin causa principal'}
                                </div>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sprintHealthColor(item.status)}`}>
                                {toNumber(item.score).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">KPIs mínimos reproducibles</h3>
                  </div>
                  <div className="max-h-[420px] overflow-auto tcdx-scrollbar">
                    <table className="min-w-[840px] w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">KPI</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sprintKpis.map((item) => (
                          <tr key={item.code}>
                            <td className="px-4 py-3 font-semibold text-gray-900">{item.code}</td>
                            <td className="px-4 py-3 text-gray-700">{item.name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {toNumber(item.value).toFixed(item.unit === '%' ? 0 : 0)} {item.unit}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${sprintHealthColor(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <a href="/cumplimiento-auditoria" className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white">
                    Abrir diagnóstico fortalecido
                  </a>
                  <a href="/evidencias" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Ver evidencias
                  </a>
                  <a href="/planes-accion" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Ver planes de acción
                  </a>
                  <a href="/riesgos" className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                    Ver riesgos
                  </a>
                </div>

                {sprintHealthSummary.data_quality_warnings && sprintHealthSummary.data_quality_warnings.length > 0 && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {sprintHealthSummary.data_quality_warnings.slice(0, 4).map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                )}
                </>
              )}
            </section>

            {selectedSummary && (
              <>
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {t('health.selectedCompany')}
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
                          {statusLabel(selectedSummary.tenant_health_status, t)}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                          {t('health.controlsCount', { count: selectedSummary.total_controls })}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                          {t('health.evidenceCount', { count: selectedSummary.total_evidences })}
                        </span>
                      </div>
                    </div>

                    <div className="w-full max-w-md">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-600">
                          {t('health.generalHealth')}
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
                          {t('health.intelligentAnalysis')}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-slate-900">
                          {t('health.mainDeteriorationCause')}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${causeColor(
                              mainCause?.cause_key
                            )}`}
                          >
                            {mainCause?.cause_label || t('health.noCause')}
                          </span>

                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {t('health.affectedControls', { count: toNumber(mainCause?.affected_controls).toFixed(0) })}
                          </span>
                        </div>
                      </div>

                      <div className="max-w-2xl rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-6 text-indigo-800">
                        {selectedRootCause.executive_recommendation}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                      <CauseMiniCard
                        title={t('health.cause.evidence')}
                        value={selectedRootCause.controls_with_evidence_gap}
                        max="30 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                      <CauseMiniCard
                        title={t('health.cause.compliance')}
                        value={selectedRootCause.controls_with_compliance_gap}
                        max="25 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                      <CauseMiniCard
                        title={t('health.cause.findings')}
                        value={selectedRootCause.controls_with_findings_gap}
                        max="15 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                      <CauseMiniCard
                        title={t('health.cause.actions')}
                        value={selectedRootCause.controls_with_action_gap}
                        max="10 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                      <CauseMiniCard
                        title={t('health.cause.risks')}
                        value={selectedRootCause.controls_with_risk_gap}
                        max="10 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                      <CauseMiniCard
                        title={t('health.cause.review')}
                        value={selectedRootCause.controls_with_review_gap}
                        max="10 pts"
                        maxLabel={t('health.maxExpected')}
                      />
                    </div>
                  </div>
                )}

                {selectedRemediationExecutive && (
                  <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {t('health.remediationExecutive')}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-slate-900">
                          {t('health.remediationStatus')}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {t('health.remediationSubtitle')}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                          {t('health.closurePercentage')}
                        </p>
                        <p className="mt-2 text-4xl font-bold text-emerald-700">
                          {toNumber(selectedRemediationExecutive.completion_percentage).toFixed(2)}%
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {t('health.lastUpdate')}: {formatDate(selectedRemediationExecutive.last_action_update)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Card
                        title={t('health.openActions')}
                        value={String(selectedRemediationExecutive.open_actions || '0')}
                        subtitle={t('health.inProgressCount', { count: selectedRemediationExecutive.in_progress_actions || '0' })}
                      />
                      <Card
                        title={t('health.overdueActions')}
                        value={String(selectedRemediationExecutive.overdue_actions || '0')}
                        subtitle={t('health.highOpenCount', { count: selectedRemediationExecutive.high_open_actions || '0' })}
                      />
                      <Card
                        title={t('health.completedActions')}
                        value={String(selectedRemediationExecutive.completed_actions || '0')}
                        subtitle={t('health.controlsClosedCount', { count: selectedRemediationExecutive.controls_with_completed_actions || '0' })}
                      />
                      <Card
                        title={t('health.pendingEvidence')}
                        value={String(selectedRemediationExecutive.pending_evidences || '0')}
                        subtitle={t('health.approvedCount', { count: selectedRemediationExecutive.approved_evidences || '0' })}
                      />
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-900">
                              {t('health.pendingEvidenceApproval')}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {t('health.pendingEvidenceSubtitle')}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => openEvidence(undefined, selectedStandardCode)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {t('health.viewEvidence')}
                          </button>
                        </div>

                        <div className="space-y-3">
                          {loadingRemediation ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              {t('health.loadingPendingEvidence')}
                            </div>
                          ) : evidenceApprovalQueue.length === 0 ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              {t('health.noPendingEvidence')}
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
                                      {item.file_name || t('health.evidenceWithoutFile')}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.standard_code} · {t('common.clause')} {item.clause || 'N/A'}
                                    </div>
                                  </div>

                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${evidenceStatusColor(
                                      item.status
                                    )}`}
                                  >
                                    {translateStatus(item.status || 'pendiente', t)}
                                  </span>
                                </div>

                                <div className="mt-2 text-xs leading-5 text-slate-600">
                                  {item.control_description || item.evidence_description || t('header.noDescription')}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.standard_code)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    {t('health.openEvidence')}
                                  </button>

                                  {item.action_plan_id && (
                                    <button
                                      type="button"
                                      onClick={() => openPlan(item.action_plan_id, item.standard_code)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      {t('health.viewPlan')}
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
                              {t('health.recoveredControls')}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {t('health.recoveredControlsSubtitle')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {loadingRemediation ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              {t('health.loadingRecoveredControls')}
                            </div>
                          ) : controlsRecovered.length === 0 ? (
                            <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                              {t('health.noRecoveredControls')}
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
                                      {item.control_description || t('health.recoveredControl')}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.iso_code} · {t('common.clause')} {item.clause || 'N/A'}
                                    </div>
                                  </div>

                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${auditEventColor(
                                      item.event_label
                                    )}`}
                                  >
                                    {item.event_label || t('health.recovered')}
                                  </span>
                                </div>

                                <div className="mt-2 text-xs leading-5 text-slate-600">
                                  {t('health.plan')}: {item.action_plan_title || t('health.completedPlan')}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {t('health.recovered')}: {formatDateTime(item.recovered_at)}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.action_plan_id && (
                                    <button
                                      type="button"
                                      onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                    >
                                      {t('health.viewPlan')}
                                    </button>
                                  )}

                                  {item.evidence_id && (
                                    <button
                                      type="button"
                                      onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                      {t('health.viewEvidence')}
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
                        {t('health.traceability')}
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        {t('health.operationalLog')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {t('health.operationalLogSubtitle')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('health.appliedFilter')}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {selectedStandardCode || t('health.allStandards')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card
                      title={t('health.recentEvents')}
                      value={String(auditSummary.totalEvents)}
                      subtitle={t('health.combinedTimeline')}
                    />
                    <Card
                      title={t('health.planEvents')}
                      value={String(auditSummary.planEvents)}
                      subtitle={t('health.planEventsSubtitle')}
                    />
                    <Card
                      title={t('health.evidenceEvents')}
                      value={String(auditSummary.evidenceEvents)}
                      subtitle={t('health.evidenceEventsSubtitle')}
                    />
                    <Card
                      title={t('health.recoveries')}
                      value={String(auditSummary.recoveredEvents)}
                      subtitle={t('health.recoveriesSubtitle')}
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-1">
                      <div className="mb-3">
                        <h4 className="font-bold text-slate-900">
                          {t('health.generalTimeline')}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {t('health.generalTimelineSubtitle')}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.loadingLog')}
                          </div>
                        ) : auditLog.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.noRecentEvents')}
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
                                    ? t('health.plan')
                                    : item.event_source === 'evidence'
                                    ? t('health.evidence')
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
                                {item.primary_label || t('health.event')}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code
                                  ? `${item.iso_code}${item.clause ? ` · ${item.clause}` : ''}`
                                  : t('health.noStandard')}{' '}
                                · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    {t('health.viewPlan')}
                                  </button>
                                )}

                                {item.evidence_id && (
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    {t('health.viewEvidence')}
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
                          {t('health.actionPlanChanges')}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {t('health.actionPlanChangesSubtitle')}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.loadingPlanEvents')}
                          </div>
                        ) : auditActionPlans.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.noPlanEvents')}
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
                                    {translateStatus(item.new_status, t)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {item.action_plan_title || t('health.actionPlan')}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              {(item.old_status || item.new_status) && (
                                <div className="mt-2 text-[11px] text-slate-500">
                                  {t('common.status')}: {translateStatus(item.old_status, t)} → {translateStatus(item.new_status, t)}
                                </div>
                              )}

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code || t('health.noStandard')} · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                                  >
                                    {t('health.openPlan')}
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
                          {t('health.evidenceChanges')}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {t('health.evidenceChangesSubtitle')}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {loadingAudit ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.loadingEvidenceEvents')}
                          </div>
                        ) : auditEvidences.length === 0 ? (
                          <div className="rounded-xl bg-white p-4 text-sm text-slate-500">
                            {t('health.noEvidenceEvents')}
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
                                    {translateStatus(item.new_status, t)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 font-semibold text-slate-900">
                                {item.file_name || item.evidence_description || t('health.evidence')}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-600">
                                {item.event_description}
                              </div>

                              <div className="mt-2 text-[11px] text-slate-500">
                                {item.iso_code
                                  ? `${item.iso_code}${item.clause ? ` · ${item.clause}` : ''}`
                                  : t('health.noStandard')}{' '}
                                · {formatDateTime(item.changed_at)}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.evidence_id && (
                                  <button
                                    type="button"
                                    onClick={() => openEvidence(item.evidence_id, item.iso_code)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                  >
                                    {t('health.openEvidence')}
                                  </button>
                                )}

                                {item.action_plan_id && (
                                  <button
                                    type="button"
                                    onClick={() => openPlan(item.action_plan_id, item.iso_code)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    {t('health.viewPlan')}
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
                        {t('health.suggestedPlan')}
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-slate-900">
                        {t('health.prioritizedRemediation')}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {t('health.prioritizedRemediationSubtitle')}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${causeColor(
                            mainRemediationGap?.main_gap_key
                          )}`}
                        >
                          {mainRemediationGap?.main_gap_label ||
                            t('health.noMainGap')}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {t('health.nextDueDate')}:{' '}
                          {formatDate(selectedRemediationSummary?.nearest_due_date)}
                        </span>
                      </div>
                    </div>

                    <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {t('common.actions')}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                          {selectedRemediationSummary?.total_suggested_actions ||
                            '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                          {t('health.priority.urgentPlural')}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-red-700">
                          {selectedRemediationSummary?.urgent_actions || '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">
                          {t('health.priority.highPlural')}
                        </p>
                        <p className="mt-2 text-3xl font-bold text-orange-700">
                          {selectedRemediationSummary?.high_actions || '0'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                          {t('health.evidence')}
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
                      <option value="">{t('health.allPriorities')}</option>
                      <option value="urgente">{t('health.priority.urgent')}</option>
                      <option value="alta">{t('health.priority.high')}</option>
                      <option value="media">{t('health.priority.medium')}</option>
                      <option value="baja">{t('health.priority.low')}</option>
                    </select>

                    <select
                      value={remediationGapFilter}
                      onChange={(e) => setRemediationGapFilter(e.target.value)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                    >
                      <option value="">{t('health.allGaps')}</option>
                      <option value="evidence">{t('health.gap.evidence')}</option>
                      <option value="compliance">{t('health.gap.compliance')}</option>
                      <option value="findings">{t('health.gap.findings')}</option>
                      <option value="actions">{t('health.gap.actions')}</option>
                      <option value="action_followup">
                        {t('health.gap.actionFollowup')}
                      </option>
                      <option value="risk">{t('health.gap.risk')}</option>
                      <option value="review">{t('health.gap.review')}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setRemediationPriorityFilter('');
                        setRemediationGapFilter('');
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      {t('health.clearRemediationFilters')}
                    </button>
                  </div>

                  <div className="max-h-[520px] overflow-auto tcdx-scrollbar">
                    <table className="w-full min-w-[1550px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                          <th className="w-[110px] py-3 pr-4">{t('common.priority')}</th>
                          <th className="w-[140px] py-3 pr-4">{t('common.standard')}</th>
                          <th className="w-[90px] py-3 pr-4">{t('common.clause')}</th>
                          <th className="min-w-[390px] py-3 pr-4">
                            {t('health.suggestedAction')}
                          </th>
                          <th className="min-w-[190px] py-3 pr-4">{t('health.gapLabel')}</th>
                          <th className="min-w-[290px] py-3 pr-4">
                            {t('health.suggestedOwner')}
                          </th>
                          <th className="w-[120px] py-3 pr-4">{t('common.dueDate')}</th>
                          <th className="w-[110px] py-3 pr-4">{t('health.health')}</th>
                          <th className="w-[120px] py-3 pr-4">{t('common.actions')}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {loadingRemediation ? (
                          <tr>
                            <td className="py-6 text-gray-500" colSpan={9}>
                              {t('health.loadingRemediationPlan')}
                            </td>
                          </tr>
                        ) : remediationPlan.length === 0 ? (
                          <tr>
                            <td className="py-6 text-gray-500" colSpan={9}>
                              {t('health.noRemediationActions')}
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
                                    {priorityLabel(item.remediation_priority, t)}
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
                                    {t('controls.control')}: {item.control_description}
                                  </div>
                                </td>

                                <td className="min-w-[190px] py-4 pr-4 align-top">
                                  <span
                                    className={`inline-flex min-w-[132px] max-w-[175px] items-center justify-center rounded-lg border px-3 py-1.5 text-center text-xs font-semibold leading-snug whitespace-normal break-words ${causeColor(
                                      item.main_gap_key
                                    )}`}
                                  >
                                    {item.main_gap_label || t('health.noGap')}
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
                                    disabled={isCreating || !canRefreshHealth}
                                    title={!canRefreshHealth ? 'No tienes permisos para recalcular o administrar Health ISO.' : undefined}
                                    className="inline-flex min-w-[92px] items-center justify-center rounded-xl bg-[#1b2733] px-3 py-2 text-center text-xs font-semibold leading-tight text-white shadow-sm transition hover:bg-[#24384a] disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isCreating ? t('health.creating') : t('health.createPlan')}
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
                        {t('health.remediationByStandard')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('health.remediationByStandardSubtitle')}
                      </p>
                    </div>

                    <div className="max-h-[420px] overflow-auto tcdx-scrollbar">
                      <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                            <th className="py-3 pr-4">{t('common.standard')}</th>
                            <th className="py-3 pr-4">Total</th>
                            <th className="py-3 pr-4">{t('health.open')}</th>
                            <th className="py-3 pr-4">{t('audits.status.inProgress')}</th>
                            <th className="py-3 pr-4">{t('health.overdue')}</th>
                            <th className="py-3 pr-4">{t('audits.status.completed')}</th>
                            <th className="py-3 pr-4">% {t('health.closure')}</th>
                            <th className="py-3 pr-4">{t('health.pendingEvidence')}</th>
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
                    title={t('health.generalHealth')}
                    value={`${score.toFixed(2)}%`}
                    subtitle={t('health.controlAverage')}
                    color={selectedSummary.kpi_health_color}
                  />
                  <Card
                    title={t('health.evidenceCoverage')}
                    value={`${evidenceCoverage.toFixed(2)}%`}
                    subtitle={t('health.loadedEvidenceCount', { count: selectedSummary.total_evidences })}
                    color={selectedSummary.kpi_evidence_coverage_color}
                  />
                  <Card
                    title={t('health.deterioratedControls')}
                    value={`${deteriorated.toFixed(2)}%`}
                    subtitle={t('health.deterioratedCriticalCount', { deteriorated: selectedSummary.deteriorated_controls, critical: selectedSummary.critical_controls })}
                    color={selectedSummary.kpi_deteriorated_controls_color}
                  />
                  <Card
                    title={t('health.healthyControls')}
                    value={`${selectedSummary.healthy_percentage}%`}
                    subtitle={t('health.healthyCount', { count: selectedSummary.healthy_controls })}
                    color={selectedSummary.kpi_health_color}
                  />
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <Card
                    title={t('health.healthy')}
                    value={selectedSummary.healthy_controls}
                    subtitle={t('health.greenControls')}
                  />
                  <Card
                    title={t('health.needsAttention')}
                    value={selectedSummary.attention_controls}
                    subtitle={t('health.yellowControls')}
                  />
                  <Card
                    title={t('health.deteriorated')}
                    value={selectedSummary.deteriorated_controls}
                    subtitle={t('health.deterioratedControls')}
                  />
                  <Card
                    title={t('health.critical')}
                    value={selectedSummary.critical_controls}
                    subtitle={t('health.immediatePriority')}
                  />
                </div>
              </>
            )}

            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {t('health.healthByStandard')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {t('health.healthByStandardSubtitle')}
                  </p>
                </div>

                <select
                  value={selectedStandardCode}
                  onChange={(e) => setSelectedStandardCode(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm"
                >
                  <option value="">{t('health.allStandards')}</option>
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

              <div className="max-h-[520px] overflow-auto tcdx-scrollbar">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-3 pr-4">{t('common.standard')}</th>
                      <th className="py-3 pr-4">{t('sidebar.controls')}</th>
                      <th className="py-3 pr-4">{t('health.health')}</th>
                      <th className="py-3 pr-4">{t('common.status')}</th>
                      <th className="py-3 pr-4">{t('sidebar.evidence')}</th>
                      <th className="py-3 pr-4">{t('health.deteriorated')}</th>
                      <th className="py-3 pr-4">{t('health.mainCause')}</th>
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
                              {statusLabel(item.standard_health_status, t)}
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
                                t('health.noCause')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {standards.length === 0 && (
                      <tr>
                        <td className="py-6 text-gray-500" colSpan={7}>
                          {t('health.noStandards')}
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
                  {t('health.highestRiskControls')}
                </h3>
                <p className="text-sm text-gray-500">
                  {t('health.highestRiskControlsSubtitle')}
                </p>
              </div>

              <div className="max-h-[420px] overflow-auto tcdx-scrollbar">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                      <th className="py-3 pr-4">{t('common.standard')}</th>
                      <th className="py-3 pr-4">{t('common.clause')}</th>
                      <th className="py-3 pr-4">{t('controls.control')}</th>
                      <th className="py-3 pr-4">{t('health.controlStatus')}</th>
                      <th className="py-3 pr-4">{t('sidebar.evidence')}</th>
                      <th className="py-3 pr-4">{t('health.health')}</th>
                      <th className="py-3 pr-4">{t('health.calculation')}</th>
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
                            {translateStatus(item.control_status, t)}
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
                              {t('health.short.evidence')}: {toNumber(item.evidence_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-700">
                              {t('health.short.compliance')}: {toNumber(item.compliance_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">
                              {t('health.short.findings')}: {toNumber(item.findings_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">
                              {t('health.short.actions')}: {toNumber(item.action_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-purple-50 px-2 py-1 text-purple-700">
                              {t('health.short.risk')}: {toNumber(item.risk_score).toFixed(0)}
                            </span>
                            <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">
                              {t('health.short.review')}: {toNumber(item.review_score).toFixed(0)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredRiskControls.length === 0 && (
                      <tr>
                        <td className="py-6 text-gray-500" colSpan={7}>
                          {t('health.noDeterioratedControls')}
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
