import type { RecommendedAction } from './types';
import { formatDate, label, priorityClass, relatedLinks, sourceLabel, statusClass, targetLabel } from './utils';

type Props = {
  action: RecommendedAction;
  selected?: boolean;
  readonly?: boolean;
  busy?: boolean;
  onSelect: (action: RecommendedAction) => void;
  onAccept: (action: RecommendedAction) => void;
  onDismiss: (action: RecommendedAction) => void;
  onConvert: (action: RecommendedAction) => void;
};

export default function RecommendedActionCard({
  action,
  selected = false,
  readonly = false,
  busy = false,
  onSelect,
  onAccept,
  onDismiss,
  onConvert,
}: Props) {
  const links = relatedLinks(action);
  const canAct = !readonly && action.status === 'pending';

  return (
    <article
      className={[
        'rounded-lg border bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md',
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200',
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={() => onSelect(action)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-xs font-semibold ${priorityClass(action.priority)}`}>
              {label(action.priority)}
            </span>
            <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(action.status)}`}>
              {label(action.status)}
            </span>
            <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
              {action.standard_code || 'Sin norma'}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold text-gray-950">
            {action.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {action.description || action.rationale || 'Sin descripcion disponible.'}
          </p>

          <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-3">
            <div>
              <span className="font-medium text-gray-700">Origen:</span> {sourceLabel(action.source_module)}
            </div>
            <div>
              <span className="font-medium text-gray-700">Tipo:</span> {label(action.suggestion_type)}
            </div>
            <div>
              <span className="font-medium text-gray-700">Destino:</span> {targetLabel(action.target_record_type)}
            </div>
            <div>
              <span className="font-medium text-gray-700">Responsable:</span> {action.suggested_owner || 'Sin asignar'}
            </div>
            <div>
              <span className="font-medium text-gray-700">Fecha:</span> {formatDate(action.suggested_due_date)}
            </div>
            <div>
              <span className="font-medium text-gray-700">Actualizado:</span> {formatDate(action.updated_at || action.created_at)}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[250px] lg:justify-end">
          <button
            type="button"
            onClick={() => onSelect(action)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            Ver detalle
          </button>
          <button
            type="button"
            onClick={() => onAccept(action)}
            disabled={!canAct || busy}
            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-45"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => onConvert(action)}
            disabled={!canAct || busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-45"
          >
            Crear tarea
          </button>
          <button
            type="button"
            onClick={() => onDismiss(action)}
            disabled={!canAct || busy}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-45"
          >
            Descartar
          </button>
        </div>
      </div>

      {links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {links.map((link) => (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
