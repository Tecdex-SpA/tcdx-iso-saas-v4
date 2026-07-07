import { asArray, cleanText, explanationForMetric, formatScore, scoreTone } from './utils';
import type { IntelligenceBrief } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  metric?: string;
  title?: string;
};

const toneClasses = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
};

export default function MetricExplanationPanel({
  brief,
  metric = 'health_score',
  title = 'Explicación del score',
}: Props) {
  const explanation = explanationForMetric(brief, metric);
  const evidence = asArray<Record<string, unknown>>(explanation?.evidence_basis).slice(0, 4);
  const basis = asArray(explanation?.knowledge_basis);
  const value = explanation?.value ?? (metric === 'health_score' ? brief?.overall?.score : brief?.scoring?.[metric]);
  const tone = scoreTone(value);

  if (!explanation && !brief) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Intelligence Layer</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            {cleanText(explanation?.why, 'Lectura basada en datos confirmados del tenant, reglas determinísticas y cobertura KB disponible.')}
          </p>
        </div>
        <div className="min-w-28 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score</div>
          <div className="mt-1 text-3xl font-bold text-slate-950">{formatScore(value)}</div>
          <div className={`mt-2 h-1.5 rounded-full ${toneClasses[tone]}`} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Factores e impacto</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{cleanText(explanation?.impact, 'Sin impacto calculado.')}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Acción sugerida: {cleanText(explanation?.recommended_action, 'Completar datos y revisar brechas activas.')}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Controles, dominios y evidencia</div>
          {evidence.length ? (
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {evidence.map((item, index) => (
                <li key={index}>
                  {cleanText(item.source)} · {cleanText(item.title || item.id)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Sin evidencia puntual asociada al cálculo.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Knowledge basis resumido: {basis.length ? `${basis.length} fundamentos aplicables en la lectura.` : 'sin fundamento KB aplicable para este score.'}
      </div>
    </section>
  );
}
