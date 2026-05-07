export type DataQuality = {
  level: 'complete' | 'partial' | 'limited' | string;
  notes?: string[];
};

export type IsoCommandSummary = {
  active_standards: number;
  certifiable_standards: number;
  transition_standards: number;
  iso_controls_total: number;
  iso_controls_linked: number;
  coverage_pct: number;
  recommended_actions_open: number;
  recommended_actions_converted: number;
  high_risks: number;
  open_findings: number;
  open_nonconformities: number;
  open_action_plans: number;
  readiness_score: number;
  readiness_label: string;
};

export type IsoStandardReadiness = {
  standard_code: string;
  version_code: string;
  display_name?: string | null;
  certifiable?: boolean | null;
  publication_status?: string | null;
  coverage_pct: number;
  total_iso_controls: number;
  linked_iso_controls: number;
  unlinked_iso_controls: number;
  recommended_actions_open: number;
  recommended_actions_converted: number;
  high_risks: number;
  critical_risks: number;
  gaps_count: number;
  critical_gaps_count: number;
  high_gaps_count: number;
  documents_generated: number;
  open_action_plans: number;
  overdue_action_plans: number;
  open_findings: number;
  open_nonconformities: number;
  readiness_score: number;
  readiness_label: string;
  readiness_dimensions?: Array<{ key: string; score: number; weight: number }>;
  data_quality?: string;
  semaphore: 'saludable' | 'atencion' | 'critico' | 'transicion' | string;
};

export type IsoPriority = {
  priority: 'critica' | 'alta' | 'media' | 'baja' | string;
  standard_code?: string | null;
  version_code?: string | null;
  title: string;
  reason?: string | null;
  route?: string | null;
};

export type IsoActivity = {
  id?: string | null;
  type: string;
  title: string;
  standard_code?: string | null;
  version_code?: string | null;
  created_at?: string | null;
  route?: string | null;
};

export type IsoCommandCenterResponse = {
  ok?: boolean;
  tenant_id?: string;
  summary: IsoCommandSummary;
  standards: IsoStandardReadiness[];
  priorities: IsoPriority[];
  activity: IsoActivity[];
  data_quality: DataQuality;
};
