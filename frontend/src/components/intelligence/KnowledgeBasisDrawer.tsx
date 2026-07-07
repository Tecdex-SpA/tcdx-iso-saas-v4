'use client';

import { sanitizeKnowledgeBasis } from './utils';
import type { IntelligenceKnowledgeBasis } from './types';

type Props = {
  open: boolean;
  items?: IntelligenceKnowledgeBasis[] | unknown[];
  title?: string;
  onClose: () => void;
};

function Field({ label, value }: { label: string; value: unknown }) {
  const safe = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-700">{safe}</div>
    </div>
  );
}

export default function KnowledgeBasisDrawer({
  open,
  items = [],
  title = 'Fundamento Knowledge Base',
  onClose,
}: Props) {
  if (!open) return null;

  const safeItems = sanitizeKnowledgeBasis(items, 30);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar fundamento"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Knowledge basis</div>
            <h2 className="mt-2 text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Se muestran identificadores, clasificación y trazabilidad resumida. No se expone texto normativo extenso ni la base completa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        {safeItems.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No hay fundamento KB visible para esta lectura.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {safeItems.map((item, index) => (
              <div key={`${item.item_key}-${item.source_record_id}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Estándar/familia" value={`${item.standard_family || '-'} ${item.standard_code || ''}`.trim()} />
                  <Field label="Dominio" value={item.domain} />
                  <Field label="item_key" value={item.item_key} />
                  <Field label="source_record_id" value={item.source_record_id} />
                  <Field label="basis_type" value={item.basis_type} />
                  <Field label="license_class" value={item.license_class} />
                  <Field label="Evidencia usada" value={item.evidence_used} />
                  <Field label="Limitación" value={item.limitation} />
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
