export type DashboardV2Standard = {
  standard_code: string;
  version_code: string;
  display_name?: string | null;
  certifiable: boolean;
  publication_status?: string | null;
  health_status?: string | null;
  readiness_score: number;
  readiness_label?: string | null;
  coverage_pct: number;
  open_gaps: number;
  high_risks: number;
  pending_actions: number;
  lifecycle_status?: string | null;
  documents_generated: number;
  last_reviewed_at?: string | null;
  updated_at?: string | null;
  data_quality?: string | null;
};

export type DashboardV2Alert = {
  level: string;
  type: string;
  standard_code?: string | null;
  version_code?: string | null;
  title: string;
  message?: string | null;
  route?: string | null;
};

export type DashboardV2Priority = {
  priority: string;
  standard_code?: string | null;
  version_code?: string | null;
  title: string;
  reason?: string | null;
  route?: string | null;
};

export type DashboardV2Tab = {
  key: string;
  title: string;
  status: string;
  metric?: number | string | null;
};

export type DashboardV2Response = {
  tenant?: {
    id?: string | null;
    name?: string | null;
    service_status?: string | null;
    updated_at?: string | null;
  };
  tenant_id?: string;
  last_updated_at?: string;
  executive_readiness: {
    headline: string;
    score: number;
    readiness_label?: string | null;
    statement: string;
    blockers: string[];
    blockers_summary: string;
    calculated_at?: string | null;
    alert_count?: number;
  };
  general_health: {
    score: number;
    label?: string | null;
    coverage_pct: number;
    status?: string | null;
  };
  audit_readiness: {
    score: number;
    label?: string | null;
    message: string;
    blockers: string[];
    calculated_at?: string | null;
  };
  active_standards: DashboardV2Standard[];
  summary: {
    active_standards: number;
    operational_versions: number;
    transition_versions: number;
    readiness_score: number;
    coverage_pct: number;
    pending_actions: number;
    converted_actions: number;
    high_risks: number;
    open_findings: number;
    open_nonconformities: number;
    open_action_plans: number;
  };
  work?: {
    actions?: Record<string, number>;
    risks?: Record<string, number>;
    kpis?: {
      total_kpis: number;
      measured_kpis: number;
      green: number;
      yellow: number;
      red: number;
      gray: number;
      last_calculated_at?: string | null;
      data_quality?: string;
    };
  };
  alerts: DashboardV2Alert[];
  priorities: DashboardV2Priority[];
  tabs: DashboardV2Tab[];
  customization?: {
    layout_version: string;
    supports_reorder: boolean;
    supports_user_layout: boolean;
    planned_storage?: string;
    blocks?: string[];
  };
  data_quality?: {
    level: string;
    notes?: string[];
  };
};
