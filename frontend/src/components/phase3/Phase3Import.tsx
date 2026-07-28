'use client';

import Link from 'next/link';
import { ChangeEvent, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Phase3Nav from './Phase3Nav';
import { phase3Mutation, phase3Request } from './phase3Api';

const TEMPLATE_VERSION = 'phase3-operational-v1';
const entityOptions = [
  ['organizations', 'Unidades'],
  ['processes', 'Procesos'],
  ['services', 'Servicios'],
  ['bia', 'BIA'],
  ['continuity_plans', 'Planes de continuidad'],
  ['metrics', 'Indicadores KPI/KRI'],
] as const;

type ImportIssue = {
  column: string | null;
  code: string;
  message: string;
};

type ImportRow = {
  id?: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  errors: ImportIssue[];
  status: string;
};

type ImportResult = {
  batch: {
    id: string;
    entity_type: string;
    status: string;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    imported_rows?: number;
    failed_rows?: number;
    rolled_back_rows?: number;
    rollback_blocked_rows?: number;
  };
  rows: ImportRow[];
  can_confirm?: boolean;
};

type Template = {
  file_name: string;
  mime_type: string;
  content: string;
};

function parseCsv(source: string) {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (character === '\n') {
      row.push(cell.trim());
      if (row.some(value => value !== '')) matrix.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) matrix.push(row);
  const headers = matrix[0] || [];
  if (!headers.length || new Set(headers).size !== headers.length) {
    throw new Error('La cabecera CSV está vacía o contiene columnas duplicadas.');
  }
  return matrix.slice(1).map(values => Object.fromEntries(
    headers.map((header, index) => [header.trim(), values[index]?.trim() || ''])
  ));
}

export default function Phase3Import() {
  const [entityType, setEntityType] = useState<(typeof entityOptions)[number][0]>('organizations');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setNotice('');
    setResult(null);
    const file = event.target.files?.[0];
    if (!file) {
      setRows([]);
      setFileName('');
      return;
    }
    if (file.size > 2_000_000) {
      setError('El archivo supera el máximo seguro de 2 MB.');
      event.target.value = '';
      return;
    }
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length > 1000) throw new Error('El lote supera el máximo de 1000 filas.');
      setRows(parsed);
      setFileName(file.name);
      setNotice(`${parsed.length} filas leídas. Ejecuta la previsualización antes de confirmar.`);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : 'No fue posible leer el CSV.');
    }
  }

  async function downloadTemplate() {
    setBusy(true);
    setError('');
    try {
      const template = await phase3Request<Template>(`/templates/${entityType}`);
      const url = URL.createObjectURL(new Blob([template.content], { type: template.mime_type }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = template.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible descargar la plantilla.');
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmed(false);
    try {
      const payload = await phase3Mutation<ImportResult>('/imports/preview', {
        entity_type: entityType,
        template_version: TEMPLATE_VERSION,
        file_name: fileName,
        rows,
      });
      setResult(payload);
      setNotice('Previsualización completada. Revisa cada error antes de confirmar.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible previsualizar el lote.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!result || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      const payload = await phase3Mutation<ImportResult>(
        `/imports/${result.batch.id}/confirm`,
        { confirm: true }
      );
      setResult(payload);
      setNotice('Lote procesado. El resumen indica filas importadas y fallidas.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible confirmar el lote.');
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      const payload = await phase3Mutation<ImportResult>(
        `/imports/${result.batch.id}/rollback`,
        {}
      );
      setResult(payload);
      setNotice('Reversión procesada. Los registros modificados o relacionados se conservaron de forma segura.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible revertir el lote.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <section className="space-y-6">
        <nav aria-label="Migas de pan" className="text-sm text-[var(--tcdx-color-text-secondary)]">
          <Link href="/dashboard">Inicio</Link><span className="mx-2">/</span>
          <Link href="/operaciones-grc">Operación GRC</Link><span className="mx-2">/</span>
          <span aria-current="page">Importar datos</span>
        </nav>
        <Phase3Nav />
        <header>
          <p className="text-xs font-semibold uppercase text-[var(--tcdx-color-primary)]">Datos reales</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">
            Importación operacional segura
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
            Usa códigos legibles y correos del tenant. No ingreses UUIDs. La versión de plantilla es {TEMPLATE_VERSION}.
          </p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-300 bg-white p-4 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{notice}</div>}

        <section className="grid gap-4 rounded-xl border border-[var(--tcdx-color-border)] bg-white p-5 md:grid-cols-3">
          <label className="space-y-1 text-sm font-semibold">
            <span>Entidad</span>
            <select
              value={entityType}
              onChange={event => {
                setEntityType(event.target.value as typeof entityType);
                setRows([]);
                setResult(null);
              }}
              className="min-h-10 w-full rounded-lg border border-[var(--tcdx-border-strong)] bg-white px-3"
            >
              {entityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" disabled={busy} onClick={() => void downloadTemplate()} className="min-h-10 rounded-lg border border-[var(--tcdx-border-strong)] bg-white px-4 text-sm font-semibold">
              Descargar plantilla
            </button>
          </div>
          <label className="space-y-1 text-sm font-semibold">
            <span>Archivo CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={event => void readFile(event)} className="block w-full text-sm" />
          </label>
          <div className="md:col-span-3">
            <button type="button" disabled={busy || rows.length === 0} onClick={() => void preview()} className="min-h-10 rounded-lg bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? 'Procesando…' : 'Previsualizar y validar'}
            </button>
          </div>
        </section>

        {result && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['Estado', result.batch.status],
                ['Filas', result.batch.total_rows],
                ['Válidas', result.batch.valid_rows],
                ['Inválidas', result.batch.invalid_rows],
                ['Importadas', result.batch.imported_rows || 0],
              ].map(([label, value]) => (
                <article key={String(label)} className="rounded-xl border border-[var(--tcdx-color-border)] bg-white p-3">
                  <p className="text-xs text-[var(--tcdx-color-text-secondary)]">{label}</p>
                  <p className="mt-1 font-bold text-[var(--tcdx-color-text-primary)]">{value}</p>
                </article>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--tcdx-color-border)] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--tcdx-color-surface-alt)]">
                  <tr>
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Errores por columna</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tcdx-color-border)]">
                  {result.rows.map(row => (
                    <tr key={row.id || row.row_number}>
                      <td className="px-3 py-2">{row.row_number}</td>
                      <td className="px-3 py-2">{String(row.raw_data.code || '—')}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        {row.errors.length
                          ? row.errors.map(issue => `${issue.column || 'fila'}: ${issue.message}`).join(' · ')
                          : 'Sin errores'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.batch.status === 'preview_ready' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <label className="flex items-start gap-2 text-sm text-amber-950">
                  <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
                  <span>Confirmo que revisé la previsualización y deseo crear únicamente las filas válidas.</span>
                </label>
                <button type="button" disabled={busy || !confirmed || !result.can_confirm} onClick={() => void confirmImport()} className="mt-3 min-h-10 rounded-lg bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">
                  Confirmar importación
                </button>
              </div>
            )}
            {['confirmed', 'partial'].includes(result.batch.status) && (
              <button type="button" disabled={busy} onClick={() => void rollback()} className="min-h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700">
                Revertir lote de forma segura
              </button>
            )}
          </section>
        )}
      </section>
    </AppLayout>
  );
}
