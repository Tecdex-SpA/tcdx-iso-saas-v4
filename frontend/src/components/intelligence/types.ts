export type IntelligenceKnowledgeBasis = {
  standard_family?: string | null;
  standard_code?: string | null;
  domain?: string | null;
  item_key?: string | null;
  source_record_id?: string | null;
  basis_type?: string | null;
  license_class?: string | null;
  evidence_used?: string | null;
  limitation?: string | null;
};

export type IntelligenceActionBasis = {
  source?: string | null;
  item_key?: string | null;
  source_record_id?: string | null;
  derived_from?: string | null;
};

export type IntelligenceMetricExplanation = {
  metric?: string;
  value?: number | string;
  state?: string;
  why?: string;
  impact?: string;
  recommended_action?: string;
  evidence_basis?: Array<Record<string, unknown>>;
  knowledge_basis?: IntelligenceKnowledgeBasis[];
  confidence?: string;
};

export type IntelligenceNextBestAction = {
  priority?: number;
  urgency?: string;
  title?: string;
  description?: string;
  reason?: string;
  expected_impact?: string;
  owner_role?: string;
  effort?: string;
  risk_if_ignored?: string;
  source?: string;
  confidence?: string;
  action_basis?: IntelligenceActionBasis;
};

export type IntelligenceBrief = {
  ok?: boolean;
  version?: string;
  tenant_id?: string;
  tenant?: {
    tenant_id?: string;
    name?: string | null;
    active_standards?: unknown[];
  };
  generated_at?: string;
  confidence?: {
    level?: string;
    score?: number;
    warnings?: string[];
    limitations?: string[];
  };
  data_quality?: {
    confidence?: string;
    score?: number;
    source_count?: number;
    limitation_count?: number;
    entity_counts?: Record<string, number>;
    warnings?: string[];
  };
  knowledge_context?: {
    source_file?: string;
    seed_version?: string;
    total_available_items?: number;
    sources_used?: unknown[];
    standards_covered?: string[];
    knowledge_items_used?: IntelligenceKnowledgeBasis[];
    rules_used?: unknown[];
    coverage_score?: number;
    license_warnings?: string[];
    missing_coverage?: string[];
  };
  knowledge_basis?: IntelligenceKnowledgeBasis[];
  findings?: Array<Record<string, unknown>>;
  main_risks?: Array<Record<string, unknown>>;
  metric_explanations?: IntelligenceMetricExplanation[];
  next_best_actions?: IntelligenceNextBestAction[];
  audit_readiness?: {
    score?: number;
    state?: string;
    explanation?: IntelligenceMetricExplanation | null;
  };
  overall?: {
    score?: number;
    state?: string;
  };
  scoring?: Record<string, number>;
  metadata?: {
    ai_used?: boolean;
    fallback_used?: boolean;
    fallback_reason?: string | null;
    ai_confidence?: string | null;
    ai_status?: 'pending' | 'ready' | 'fallback' | 'disabled' | string;
    ai_pending?: boolean;
    ai_latency_ms?: number;
    latency_ms?: number;
    cache_status?: string;
    knowledge_items_count?: number;
    rules_version?: string;
    scoring_version?: string;
    knowledge_seed_version?: string;
  };
  brief?: {
    confirmed_data?: string[];
    rule_inferences?: string[];
    ai_inferences?: string[];
    recommendations?: Array<{ title?: string; action_basis?: string | IntelligenceActionBasis }>;
    limitations?: string[];
  };
  source_trace?: unknown[];
};

export type IntelligenceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'partial'
  | 'error'
  | 'timeout'
  | 'forbidden'
  | 'no_session';
