import type {
  IntelligenceBrief,
  IntelligenceKnowledgeBasis,
  IntelligenceMetricExplanation,
} from './types';

const PROHIBITED_KEY_RE = /(raw_text|full_text|content_text|normative_text|standard_text|clause_text|prompt|token|secret|password|authorization|base_conocimiento|knowledge_base_full)/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function cleanText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

export function compactText(value: unknown, fallback = '-', max = 180): string {
  const text = cleanText(value, fallback);
  if (text === fallback || text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatScore(value: unknown): string {
  const score = Math.max(0, Math.min(100, asNumber(value)));
  return `${Math.round(score)}`;
}

export function scoreTone(value: unknown): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const score = asNumber(value);
  if (score >= 75) return 'success';
  if (score >= 45) return 'warning';
  if (score > 0) return 'danger';
  return 'neutral';
}

export function stateTone(value: unknown): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const normalized = cleanText(value, '').toLowerCase();
  if (['alta', 'high', 'saludable', 'ok'].includes(normalized)) return 'success';
  if (['media', 'medium', 'atencion', 'atención', 'acceptable'].includes(normalized)) return 'warning';
  if (['baja', 'low', 'critica', 'crítica', 'critical', 'deteriorado'].includes(normalized)) return 'danger';
  return 'neutral';
}

export function confidenceLabel(brief: IntelligenceBrief | null | undefined): string {
  const confidence = brief?.confidence;
  if (confidence?.level) return cleanText(confidence.level);
  const score = asNumber(confidence?.score, -1);
  if (score >= 75) return 'alta';
  if (score >= 45) return 'media';
  if (score >= 0) return 'baja';
  return 'no informada';
}

export function confidenceTone(brief: IntelligenceBrief | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  const label = confidenceLabel(brief).toLowerCase();
  if (label.includes('alta') || label.includes('high')) return 'success';
  if (label.includes('media') || label.includes('medium')) return 'warning';
  if (label.includes('baja') || label.includes('low')) return 'danger';
  return 'neutral';
}

function sanitizeBasisItem(item: unknown): IntelligenceKnowledgeBasis | null {
  if (!isRecord(item)) return null;

  const safe: IntelligenceKnowledgeBasis = {
    standard_family: compactText(item.standard_family || item.standardFamily, '-', 80),
    standard_code: compactText(item.standard_code || item.standardCode, '-', 80),
    domain: compactText(item.domain || item.control_domain, '-', 120),
    item_key: compactText(item.item_key || item.itemKey || item.record_id, '-', 120),
    source_record_id: compactText(item.source_record_id || item.sourceRecordId || item.record_id, '-', 120),
    basis_type: compactText(item.basis_type || item.item_type || item.type || 'knowledge_basis', '-', 80),
    license_class: compactText(item.license_class || 'derived_summary', '-', 80),
    evidence_used: compactText(item.evidence_used || item.evidence || item.source || item.title, '-', 140),
    limitation: compactText(item.limitation || item.warning || item.license_warning, '-', 180),
  };

  const hasValue = Object.values(safe).some((value) => value && value !== '-');
  return hasValue ? safe : null;
}

export function sanitizeKnowledgeBasis(items: unknown, max = 12): IntelligenceKnowledgeBasis[] {
  return asArray(items)
    .map(sanitizeBasisItem)
    .filter((item): item is IntelligenceKnowledgeBasis => Boolean(item))
    .filter((item) => {
      const serialized = JSON.stringify(item);
      return !PROHIBITED_KEY_RE.test(serialized);
    })
    .slice(0, max);
}

export function collectKnowledgeBasis(brief: IntelligenceBrief | null | undefined, max = 12): IntelligenceKnowledgeBasis[] {
  if (!brief) return [];
  const direct = sanitizeKnowledgeBasis(brief.knowledge_basis, max);
  const context = sanitizeKnowledgeBasis(brief.knowledge_context?.knowledge_items_used, max);
  const metricBasis = asArray<IntelligenceMetricExplanation>(brief.metric_explanations)
    .flatMap((metric) => sanitizeKnowledgeBasis(metric.knowledge_basis, max));
  const findingBasis = asArray<Record<string, unknown>>(brief.findings)
    .flatMap((finding) => sanitizeKnowledgeBasis(finding.knowledge_basis, max));

  const byKey = new Map<string, IntelligenceKnowledgeBasis>();
  [...direct, ...context, ...metricBasis, ...findingBasis].forEach((item) => {
    const key = `${item.item_key || '-'}:${item.source_record_id || '-'}:${item.domain || '-'}`;
    if (!byKey.has(key)) byKey.set(key, item);
  });
  return Array.from(byKey.values()).slice(0, max);
}

export function explanationForMetric(
  brief: IntelligenceBrief | null | undefined,
  metric: string
): IntelligenceMetricExplanation | null {
  const fromAuditReadiness = metric === 'audit_readiness' ? brief?.audit_readiness?.explanation : null;
  if (fromAuditReadiness) return fromAuditReadiness;
  return asArray<IntelligenceMetricExplanation>(brief?.metric_explanations)
    .find((item) => item.metric === metric) || null;
}

export function executiveSummary(brief: IntelligenceBrief | null | undefined): string {
  const ai = asArray<string>(brief?.brief?.ai_inferences).find(Boolean);
  if (ai) return cleanText(ai);
  const rule = asArray<string>(brief?.brief?.rule_inferences).find(Boolean);
  if (rule) return cleanText(rule);
  const confirmed = asArray<string>(brief?.brief?.confirmed_data).join(' ');
  return cleanText(confirmed, 'Sin resumen inteligente disponible para este tenant.');
}

export function dataQualityWarnings(brief: IntelligenceBrief | null | undefined): string[] {
  return Array.from(new Set([
    ...asArray<string>(brief?.data_quality?.warnings),
    ...asArray<string>(brief?.confidence?.warnings),
    ...asArray<string>(brief?.knowledge_context?.license_warnings),
    ...asArray<string>(brief?.knowledge_context?.missing_coverage),
    ...asArray<string>(brief?.brief?.limitations),
  ].map((item) => compactText(item, '', 220)).filter(Boolean))).slice(0, 8);
}

export function hasUsefulBrief(brief: IntelligenceBrief | null | undefined): boolean {
  if (!brief) return false;
  return Boolean(
    brief.overall ||
      brief.audit_readiness ||
      asArray(brief.next_best_actions).length ||
      asArray(brief.metric_explanations).length ||
      asArray(brief.brief?.confirmed_data).length
  );
}
