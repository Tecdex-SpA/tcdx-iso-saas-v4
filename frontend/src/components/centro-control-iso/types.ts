import type {
  DataQuality,
  IsoActivity,
  IsoCommandSummary,
  IsoPriority,
  IsoStandardReadiness,
} from '@/components/command-center-iso/types';

export type UnifiedIsoAlert = {
  level: 'info' | 'warning' | 'critical' | string;
  type: string;
  standard_code?: string | null;
  version_code?: string | null;
  title: string;
  message?: string | null;
  route?: string | null;
};

export type UnifiedIsoQuickLink = {
  label: string;
  route: string;
  kind: string;
};

export type UnifiedIsoResponse = {
  ok?: boolean;
  tenant_id?: string;
  tenant?: { id?: string | null; name?: string | null };
  summary: IsoCommandSummary & {
    contracted_standards?: number;
    total_versions_evaluated?: number;
  };
  standard_cards: IsoStandardReadiness[];
  standards?: IsoStandardReadiness[];
  transition_items?: Array<{
    standard_code: string;
    version_code: string;
    display_name?: string | null;
    certifiable: boolean;
    publication_status?: string | null;
    readiness_score?: number;
    warning?: string;
    route?: string | null;
  }>;
  health?: {
    readiness_score: number;
    readiness_label: string;
    coverage_pct: number;
    data_quality?: string;
  };
  workflow?: {
    suggested: number;
    converted: number;
    open_action_plans: number;
    open_findings: number;
    open_nonconformities: number;
  };
  risks?: {
    high_or_critical: number;
    standards_with_risk: number;
  };
  priorities: IsoPriority[];
  transition_priorities?: IsoPriority[];
  activity: IsoActivity[];
  alerts: UnifiedIsoAlert[];
  quick_links: UnifiedIsoQuickLink[];
  data_quality: DataQuality;
};
