import type { IsoPriority } from './types';
import { label, priorityClass } from './utils';

type Props = {
  priorities: IsoPriority[];
};

export default function IsoPriorityList({ priorities }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-950">Proximas prioridades</h2>
        <a href="/acciones-recomendadas" className="text-xs font-semibold text-blue-700 hover:text-blue-900">
          Ver acciones
        </a>
      </div>

      <div className="mt-4 space-y-3">
        {priorities.length === 0 && (
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            No hay prioridades calculadas con los datos actuales.
          </div>
        )}

        {priorities.map((item, index) => (
          <a
            key={`${item.title}-${index}`}
            href={item.route || '#'}
            className="block rounded-lg border border-gray-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 rounded px-2 py-1 text-xs font-semibold ${priorityClass(item.priority)}`}>
                {label(item.priority)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-950">{item.title}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {[item.standard_code, item.version_code].filter(Boolean).join(' · ')}
                </div>
                {item.reason && <p className="mt-2 text-sm text-gray-600">{item.reason}</p>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
