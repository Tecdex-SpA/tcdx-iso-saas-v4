import type { IsoActivity } from './types';
import { formatDate, label } from './utils';

type Props = {
  activity: IsoActivity[];
};

export default function IsoActivityTimeline({ activity }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">Actividad reciente</h2>

      <div className="mt-4 space-y-4">
        {activity.length === 0 && (
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Aun no hay eventos recientes para mostrar.
          </div>
        )}

        {activity.map((event, index) => (
          <a
            key={`${event.type}-${event.id || index}`}
            href={event.route || '#'}
            className="flex gap-3 rounded-lg p-2 transition hover:bg-gray-50"
          >
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-950">{event.title}</div>
              <div className="mt-1 text-xs text-gray-500">
                {label(event.type)} · {[event.standard_code, event.version_code].filter(Boolean).join(' · ') || 'Sin norma'} · {formatDate(event.created_at)}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
