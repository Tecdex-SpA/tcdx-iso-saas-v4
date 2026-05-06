import type { JsonObject, RecommendedAction } from './types';
import {
  formatDate,
  label,
  priorityClass,
  relatedLinks,
  sourceLabel,
  statusClass,
  targetLabel,
} from './utils';

type Props = {
  action: RecommendedAction | null;
  readonly?: boolean;
  busy?: boolean;
  onClose: () => void;
  onAccept: (action: RecommendedAction) => void;
  onConvert: (action: RecommendedAction) => void;
  onDismiss: (action: RecommendedAction) => void;
};

function TraceBlock({ title, data }: { title: string; data?: JsonObject | null }) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <details className="rounded border border-gray-200 bg-gray-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">{title}</summary>
      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function textValue(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export default function RecommendedActionDetailModal({
  action,
  readonly = false,
  busy = false,
  onClose,
  onAccept,
  onConvert,
  onDismiss,
}: Props) {
  if (!action) return null;

  const canAct = !readonly && action.status === 'pending';
  const links = relatedLinks(action);
  const payload = action.payload_json || {};
  const trace = action.source_trace_json || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
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
            <h2 className="mt-3 text-xl font-semibold text-gray-950">{action.title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {action.description || action.rationale || 'Sin descripcion disponible.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(92vh-168px)] overflow-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Origen</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{sourceLabel(action.source_module)}</div>
              <div className="mt-2 text-xs text-gray-500">
                {action.source_entity_type || 'Sin entidad'} {action.source_entity_id ? `· ${action.source_entity_id}` : ''}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Destino operativo</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{targetLabel(action.target_record_type)}</div>
              <div className="mt-2 text-xs text-gray-500">
                {action.created_record_type ? `${targetLabel(action.created_record_type)} creado` : 'Pendiente de conversion'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Responsable sugerido</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{action.suggested_owner || 'Sin asignar'}</div>
              <div className="mt-2 text-xs text-gray-500">Vence: {formatDate(action.suggested_due_date)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Justificacion</h3>
              <p className="mt-2 text-sm text-gray-600">
                {action.rationale || action.source_reason || 'La recomendacion proviene de inteligencia ISO operacional y requiere revision humana.'}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Impacto esperado</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.expected_result || payload.impact,
                  'Reducir brechas, ordenar evidencia y convertir hallazgos ISO en trabajo gestionable.'
                )}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Riesgo si no se ejecuta</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.risk_if_ignored || payload.risk_hint,
                  'La brecha puede persistir y afectar auditorias, controles, evidencia o seguimiento operativo.'
                )}
              </p>
            </section>
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Proximo paso</h3>
              <p className="mt-2 text-sm text-gray-600">
                {textValue(
                  payload.next_step || payload.recommendation,
                  'Revisar el detalle, validar responsable y convertir solo si corresponde.'
                )}
              </p>
            </section>
          </div>

          {links.length > 0 && (
            <section className="mt-5 rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-950">Entidades relacionadas</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <TraceBlock title="Payload operativo" data={payload} />
            <TraceBlock title="Trazabilidad de origen" data={trace} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={() => onDismiss(action)}
            disabled={!canAct || busy}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-45"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={() => onAccept(action)}
            disabled={!canAct || busy}
            className="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-45"
          >
            Validar dry-run
          </button>
          <button
            type="button"
            onClick={() => onConvert(action)}
            disabled={!canAct || busy}
            className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
          >
            Crear tarea / plan
          </button>
        </div>
      </div>
    </div>
  );
}
