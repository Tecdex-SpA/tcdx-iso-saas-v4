import { asArray, cleanText, compactText } from './utils';
import type { IntelligenceBrief, IntelligenceNextBestAction } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  maxItems?: number;
};

function urgencyClass(value: unknown) {
  const normalized = cleanText(value, '').toLowerCase();
  if (normalized.includes('inmediata') || normalized.includes('7')) return 'border-red-200 bg-red-50 text-red-700';
  if (normalized.includes('30')) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function NextBestActionsPanel({ brief, maxItems = 3 }: Props) {
  const actions = asArray<IntelligenceNextBestAction>(brief?.next_best_actions).slice(0, maxItems);

  if (!actions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Sin acciones inteligentes priorizadas con los datos actuales.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <div key={`${action.title}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-950">
                {action.priority || index + 1}. {cleanText(action.title, 'Acción recomendada')}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">{compactText(action.description || action.reason, 'Sin descripción.', 220)}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyClass(action.urgency)}`}>
              {cleanText(action.urgency, 'planificada')}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div>Responsable: <span className="font-semibold text-slate-700">{cleanText(action.owner_role)}</span></div>
            <div>Confianza: <span className="font-semibold text-slate-700">{cleanText(action.confidence, 'media')}</span></div>
            <div>Base: <span className="font-semibold text-slate-700">{cleanText(action.action_basis?.source || action.source, 'regla')}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
