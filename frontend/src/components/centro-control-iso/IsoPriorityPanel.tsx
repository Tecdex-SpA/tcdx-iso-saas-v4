import type { IsoPriority } from '@/components/command-center-iso/types';
import { priorityClass } from './utils';

type Props = {
  priorities: IsoPriority[];
};

export default function IsoPriorityPanel({ priorities }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Prioridades operativas</h2>
          <p className="mt-1 text-xs text-slate-500">Top brechas, riesgos y acciones pendientes de las normas contratadas.</p>
        </div>
        <a href="/acciones-recomendadas" className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
          Gestionar
        </a>
      </div>

      <div className="mt-4 space-y-3">
        {priorities.length === 0 && (
          <div className="rounded bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No hay prioridades criticas calculadas con los datos actuales.
          </div>
        )}

        {priorities.slice(0, 8).map((priority, index) => (
          <a
            key={`${priority.standard_code}-${priority.version_code}-${priority.title}-${index}`}
            href={priority.route || '/acciones-recomendadas'}
            className="block rounded border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">{priority.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {priority.standard_code} {priority.version_code} · {priority.reason || 'Revision sugerida'}
                </div>
              </div>
              <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${priorityClass(priority.priority)}`}>
                {priority.priority}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
