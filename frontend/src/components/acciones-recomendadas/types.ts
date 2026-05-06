export type JsonObject = Record<string, unknown>;

export type RecommendedActionStatus =
  | 'pending'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'archived'
  | 'error'
  | string;

export type RecommendedAction = {
  id: string;
  tenant_id?: string;
  standard_code?: string | null;
  operation_id?: string | null;
  tenant_control_id?: string | null;
  source_module: string;
  source_entity_type?: string | null;
  source_entity_id?: string | null;
  source_reason?: string | null;
  suggestion_type: string;
  target_record_type: string;
  title: string;
  description?: string | null;
  rationale?: string | null;
  priority: 'critica' | 'alta' | 'media' | 'baja' | string;
  status: RecommendedActionStatus;
  suggested_owner?: string | null;
  suggested_due_date?: string | null;
  payload_json?: JsonObject | null;
  source_trace_json?: JsonObject | null;
  created_record_type?: string | null;
  created_record_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  control_iso?: string | null;
  control_clause?: string | null;
  control_category?: string | null;
  control_description?: string | null;
};

export type RecommendedActionsSummary = {
  tenant_id?: string;
  by_standard?: Array<{
    standard_code?: string | null;
    total_suggestions?: number;
    pending_count?: number;
    approved_count?: number;
    rejected_count?: number;
    critical_count?: number;
    high_count?: number;
    medium_count?: number;
    low_count?: number;
    action_plan_targets?: number;
    finding_targets?: number;
    nonconformity_targets?: number;
    evidence_request_targets?: number;
  }>;
  by_type?: Array<{
    suggestion_type?: string;
    target_record_type?: string;
    status?: string;
    count?: number;
  }>;
  recent?: RecommendedAction[];
  totals?: {
    total_suggestions?: number;
    pending_count?: number;
    approved_count?: number;
    rejected_count?: number;
    critical_count?: number;
    high_count?: number;
  };
};

export type RecommendedActionFilters = {
  status: string;
  standard: string;
  priority: string;
  type: string;
  source: string;
  search: string;
};

export type ActionFeedback = {
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: unknown;
} | null;
