import { confidenceLabel, confidenceTone } from './utils';
import type { IntelligenceBrief } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  compact?: boolean;
};

const toneClasses = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function IntelligenceConfidenceBadge({ brief, compact = false }: Props) {
  const tone = confidenceTone(brief);
  const label = confidenceLabel(brief);
  const score = brief?.confidence?.score;
  const suffix = typeof score === 'number' ? ` · ${Math.round(score)}%` : '';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {compact ? 'Conf.' : 'Confianza'}: {label}{suffix}
    </span>
  );
}
