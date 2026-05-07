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

export type DashboardV2ActionItem = {
  id: string;
  standard_code?: string | null;
  source_module?: string | null;
  suggestion_type?: string | null;
  target_record_type?: string | null;
  title: string;
  description?: string | null;
  rationale?: string | null;
  priority?: string | null;
  status?: string | null;
  suggested_owner?: string | null;
  suggested_due_date?: string | null;
  created_record_type?: string | null;
  created_record_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DashboardV2ActionsPanel = {
  summary: {
    total: number;
    pending: number;
    converted: number;
    overdue: number;
    pending_approval: number;
    critical: number;
    open_action_plans: number;
    open_findings: number;
    open_nonconformities: number;
  };
  by_standard: Array<Record<string, number | string | null>>;
  recent: DashboardV2ActionItem[];
  work_pending: Array<Record<string, number | string | null>>;
  data_quality?: string;
};

export type DashboardV2RiskItem = {
  id: string;
  standard_code?: string | null;
  version_code?: string | null;
  risk_code?: string | null;
  risk_title: string;
  risk_description?: string | null;
  risk_category?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  asset_criticality?: string | null;
  inherent_risk_score?: number | string | null;
  inherent_risk_level?: string | null;
  residual_risk_score?: number | string | null;
  residual_risk_level?: string | null;
  treatment_strategy?: string | null;
  status?: string | null;
  confidence?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DashboardV2RisksPanel = {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    without_owner: number;
    without_treatment: number;
    upcoming_due: number;
  };
  by_standard: Array<Record<string, number | string | null>>;
  priority_risks: DashboardV2RiskItem[];
  all_risks: DashboardV2RiskItem[];
  data_quality?: string;
};

export type DashboardV2KpiItem = {
  id?: string;
  kpi_id?: string;
  code?: string;
  name?: string;
  category?: string | null;
  unit?: string | null;
  standard_code?: string | null;
  value?: number | string | null;
  numerator_value?: number | string | null;
  denominator_value?: number | string | null;
  status_color?: string | null;
  calculated_at?: string | null;
};

export type DashboardV2KpisPanel = {
  summary: {
    measured_kpis: number;
    green: number;
    yellow: number;
    red: number;
    gray: number;
    executive_score: number;
    last_calculated_at?: string | null;
  };
  by_standard: Array<Record<string, number | string | null>>;
  items: DashboardV2KpiItem[];
  data_quality?: string;
};

export type DashboardV2Tab = {
  key: string;
  title: string;
  status: string;
  metric?: number | string | null;
};

export type DashboardV2BlockKey =
  | 'standards'
  | 'salud_iso'
  | 'ciclo_vida'
  | 'acciones'
  | 'riesgos'
  | 'kpis'
  | 'alertas';

export type DashboardV2Layout = {
  version: number;
  order: DashboardV2BlockKey[];
  collapsed: Partial<Record<DashboardV2BlockKey, boolean>>;
  updated_at?: string;
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
  operational_panels?: {
    actions?: DashboardV2ActionsPanel;
    risks?: DashboardV2RisksPanel;
    kpis?: DashboardV2KpisPanel;
    alerts?: DashboardV2Alert[];
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
