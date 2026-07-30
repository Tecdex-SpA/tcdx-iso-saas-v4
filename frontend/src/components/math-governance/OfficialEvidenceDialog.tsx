'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

export type EvidenceKind = 'explanation' | 'lineage';
type UnknownRecord = Record<string, unknown>;

type Props = {
  open: boolean;
  kind: EvidenceKind;
  runId: string;
  formulaName: string;
  onClose: () => void;
};

type LoaderProps = Omit<Props, 'open'>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrap(payload: unknown): UnknownRecord {
  const value = isRecord(payload) && 'data' in payload ? payload.data : payload;
  return isRecord(value) ? value : { value };
}

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function EvidenceLoader({ kind, runId, formulaName, onClose }: LoaderProps) {
  const [data, setData] = useState<UnknownRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`, {
      fallbackMessage: `No fue posible cargar ${kind === 'explanation' ? 'la explicación' : 'el lineage'} del cálculo.`,
    })
      .then((payload) => { if (!cancelled) setData(unwrap(payload)); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar la evidencia.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, runId]);

  const lineage = Array.isArray(data?.lineage) ? data.lineage.filter(isRecord) : [];
  const variables = isRecord(data?.variables) ? data.variables : {};

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="official-evidence-title" className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-primary)]">Evidencia autenticada</p>
            <h3 id="official-evidence-title" className="mt-1 text-xl font-semibold text-slate-950">{kind === 'explanation' ? 'Explicación del cálculo' : 'Lineage del cálculo'}</h3>
            <p className="mt-1 text-sm text-slate-600">{formulaName} · ejecución {runId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700">Cerrar</button>
        </header>
        <div className="max-h-[calc(90vh-108px)] overflow-auto p-4">
          {loading && <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm">Cargando evidencia…</div>}
          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}
          {!loading && !error && data && kind === 'explanation' && (
            <div className="space-y-4">
              <dl className="grid gap-3 md:grid-cols-2">
                {[
                  ['Estado', data.status], ['Explicación', data.explanation], ['Tipo', data.explanation_type], ['Fórmula', data.formula_code],
                  ['Ejecución', data.run_status], ['Inicio', data.started_at], ['Término', data.completed_at],
                ].map(([label, value]) => <div key={String(label)} className="rounded-md border border-slate-200 bg-slate-50 p-3"><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-950">{display(value)}</dd></div>)}
              </dl>
              <section><h4 className="text-sm font-semibold text-slate-950">Variables utilizadas</h4>{Object.keys(variables).length ? <div className="mt-2 overflow-x-auto rounded-md border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Variable</th><th className="px-3 py-2 text-left">Valor</th></tr></thead><tbody>{Object.entries(variables).map(([key, value]) => <tr key={key} className="border-t"><td className="px-3 py-2 font-semibold">{key}</td><td className="px-3 py-2">{display(value)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-slate-600">La ejecución no reportó variables visibles.</p>}</section>
            </div>
          )}
          {!loading && !error && data && kind === 'lineage' && (
            lineage.length ? <div className="overflow-x-auto rounded-md border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Fuente física</th><th className="px-3 py-2 text-left">Contrato</th><th className="px-3 py-2 text-left">Registro</th><th className="px-3 py-2 text-left">Versión</th><th className="px-3 py-2 text-left">Snapshot</th></tr></thead><tbody>{lineage.map((row, index) => <tr key={index} className="border-t"><td className="px-3 py-2 font-semibold">{display(row.physical_source)}</td><td className="px-3 py-2">{display(row.source_contract)}</td><td className="px-3 py-2 break-all">{display(row.source_record)}</td><td className="px-3 py-2">{display(row.formula_version)}</td><td className="px-3 py-2 break-all">{display(row.dataset_snapshot)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">La ejecución no contiene lineage visible.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function OfficialEvidenceDialog({ open, kind, runId, formulaName, onClose }: Props) {
  if (!open || !runId) return null;
  return <EvidenceLoader key={`${kind}-${runId}`} kind={kind} runId={runId} formulaName={formulaName} onClose={onClose} />;
}
