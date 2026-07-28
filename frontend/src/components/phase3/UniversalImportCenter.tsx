'use client';

import Link from 'next/link';
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AppLayout from '@/components/AppLayout';
import TcdxIcon from '@/components/icons/TcdxIcon';
import Phase3Nav from './Phase3Nav';
import { getApiBaseUrl, readJsonResponse } from '@/utils/apiClient';
import { getStoredValidToken } from '@/utils/auth';

type ImportField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
};

type ImportDefinition = {
  entityType: string;
  version: string;
  wave: number;
  displayName: string;
  description: string;
  dependencies: string[];
  fields: ImportField[];
  duplicatePolicy: string;
  duplicatePolicies: string[];
  availability: 'importable_now' | 'blocked';
  classification?: string;
  blockedReason?: string;
  maximumRows: number;
  maximumFileSize: number;
};

type ImportIssue = {
  column: string | null;
  code: string;
  message: string;
  suggestion?: string;
};

type ImportRow = {
  id?: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  errors: ImportIssue[];
  warnings?: ImportIssue[];
  status: string;
  operation?: string;
};

type ImportBatch = {
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
  created_at?: string;
  source_format?: string;
  file_name?: string;
  summary?: Record<string, unknown>;
};

type ImportResult = {
  batch: ImportBatch;
  rows: ImportRow[];
  can_confirm?: boolean;
};

type Envelope<T> = {
  ok: boolean;
  data: T;
  code?: string;
  error?: string;
};

const policyLabels: Record<string, string> = {
  create_only: 'Crear solamente',
  update_existing: 'Actualizar existentes',
  create_or_update: 'Crear o actualizar',
  reject_duplicates: 'Rechazar duplicados',
};

async function importRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredValidToken();
  if (!token) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${getApiBaseUrl()}/api/imports${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
  const payload = await readJsonResponse<Envelope<T>>(response);
  return payload.data;
}

async function downloadImportFile(path: string, fallbackName: string) {
  const token = getStoredValidToken();
  if (!token) throw new Error('La sesión no está disponible. Vuelve a iniciar sesión.');
  const response = await fetch(`${getApiBaseUrl()}/api/imports${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'No fue posible descargar el archivo.');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] || fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function UniversalImportCenter() {
  const [definitions, setDefinitions] = useState<ImportDefinition[]>([]);
  const [entityType, setEntityType] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState('create_only');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [rowFilter, setRowFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [confirmed, setConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeDefinitions = useMemo(
    () => definitions.filter(definition => definition.availability === 'importable_now'),
    [definitions]
  );
  const blockedDefinitions = useMemo(
    () => definitions.filter(definition => definition.availability === 'blocked'),
    [definitions]
  );
  const selected = definitions.find(definition => definition.entityType === entityType) || null;

  const refreshHistory = useCallback(async () => {
    const rows = await importRequest<ImportBatch[]>('/history?limit=25');
    setHistory(rows);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      importRequest<ImportDefinition[]>('/definitions'),
      importRequest<ImportBatch[]>('/history?limit=25'),
    ]).then(([available, previous]) => {
      if (!active) return;
      setDefinitions(available);
      setHistory(previous);
      const first = available.find(definition => definition.availability === 'importable_now');
      if (first) {
        setEntityType(first.entityType);
        setDuplicatePolicy(first.duplicatePolicy);
      }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'No fue posible cargar las definiciones.');
    });
    return () => { active = false; };
  }, []);

  function setSelectedFile(nextFile: File | null) {
    setError('');
    setNotice('');
    setResult(null);
    setConfirmed(false);
    if (!nextFile) {
      setFile(null);
      return;
    }
    const extension = nextFile.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'csv'].includes(extension || '')) {
      setError('Selecciona un archivo .xlsx. CSV se admite solo como formato secundario.');
      setFile(null);
      return;
    }
    if (selected && nextFile.size > selected.maximumFileSize) {
      setError(`El archivo supera el máximo de ${Math.round(selected.maximumFileSize / 1024 / 1024)} MB.`);
      setFile(null);
      return;
    }
    setFile(nextFile);
    setNotice(`${nextFile.name} está listo para previsualizar. Todavía no se ha modificado ningún dato.`);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] || null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    setSelectedFile(event.dataTransfer.files?.[0] || null);
  }

  async function preview() {
    if (!file || !selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmed(false);
    try {
      const body = new FormData();
      body.set('entity_type', selected.entityType);
      body.set('duplicate_policy', duplicatePolicy);
      body.set('file', file);
      const payload = await importRequest<ImportResult>('/preview', {
        method: 'POST',
        body,
      });
      setResult(payload);
      setNotice('Previsualización completada. Revisa filas y errores antes de confirmar.');
      await refreshHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible previsualizar el archivo.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!result || !confirmed) return;
    setBusy(true);
    setError('');
    try {
      const payload = await importRequest<ImportResult>(`/${result.batch.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
      setResult(payload);
      setNotice('Lote procesado. El resumen conserva el detalle por fila y la trazabilidad.');
      await refreshHistory();
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
      const payload = await importRequest<ImportResult>(`/${result.batch.id}/rollback`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setResult(payload);
      setNotice('Rollback procesado. Solo se revirtieron registros creados por este lote y sin cambios posteriores.');
      await refreshHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible revertir el lote.');
    } finally {
      setBusy(false);
    }
  }

  const visibleRows = (result?.rows || []).filter(row => (
    rowFilter === 'all'
      || (rowFilter === 'valid' && row.status === 'valid')
      || (rowFilter === 'invalid' && row.status !== 'valid')
  ));

  return (
    <AppLayout>
      <main className="space-y-6">
        <nav aria-label="Migas de pan" className="text-sm text-[var(--tcdx-color-text-secondary)]">
          <Link href="/dashboard">Inicio</Link><span className="mx-2">/</span>
          <Link href="/operaciones-grc">Operación GRC</Link><span className="mx-2">/</span>
          <span aria-current="page">Importaciones</span>
        </nav>
        <Phase3Nav />

        <header className="flex flex-col gap-3 border-b border-[var(--tcdx-color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--tcdx-color-primary)]">Gestión de datos</p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--tcdx-color-text-primary)]">
              Importaciones
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
              Descarga una plantilla Excel con catálogos de esta empresa, carga el archivo y revisa la previsualización antes de confirmar.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--tcdx-color-text-secondary)]">
            <TcdxIcon name="shield" className="h-5 w-5" aria-hidden="true" />
            <span>Relaciones por código y correo, sin UUID</span>
          </div>
        </header>

        {error && (
          <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="border-l-4 border-[var(--tcdx-color-teal)] bg-cyan-50 px-4 py-3 text-sm text-slate-900">
            {notice}
          </div>
        )}

        <section aria-labelledby="import-order-title" className="border border-[var(--tcdx-color-border)] bg-white p-5">
          <h2 id="import-order-title" className="text-base font-bold text-[var(--tcdx-color-text-primary)]">
            Orden recomendado
          </h2>
          <ol className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            {[
              ['1', 'Unidades', 'Definen los códigos usados por procesos.'],
              ['2', 'Procesos', 'Relacionan unit_code y owner_email.'],
              ['3', 'Servicios y continuidad', 'Usan process_code, service_code y códigos previos.'],
            ].map(([number, title, text]) => (
              <li key={number} className="flex gap-3 border-t border-[var(--tcdx-color-border)] pt-3">
                <span className="font-bold text-[var(--tcdx-color-primary)]">{number}</span>
                <span><strong className="block text-slate-900">{title}</strong><span className="text-slate-600">{text}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
          <div className="space-y-5 border border-[var(--tcdx-color-border)] bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-900">
                <span>Entidad</span>
                <select
                  value={entityType}
                  onChange={event => {
                    const next = definitions.find(item => item.entityType === event.target.value);
                    setEntityType(event.target.value);
                    setDuplicatePolicy(next?.duplicatePolicy || 'create_only');
                    setFile(null);
                    setResult(null);
                  }}
                  className="min-h-11 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3"
                >
                  {[1, 2, 3].map(wave => (
                    <optgroup key={wave} label={`Ola ${wave}`}>
                      {activeDefinitions.filter(item => item.wave === wave).map(item => (
                        <option key={item.entityType} value={item.entityType}>{item.displayName}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-900">
                <span>Política de duplicados</span>
                <select
                  value={duplicatePolicy}
                  onChange={event => setDuplicatePolicy(event.target.value)}
                  className="min-h-11 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3"
                >
                  {(selected?.duplicatePolicies || []).map(policy => (
                    <option key={policy} value={policy}>{policyLabels[policy] || policy}</option>
                  ))}
                </select>
              </label>
            </div>

            {selected && (
              <div className="text-sm text-slate-600">
                <p>{selected.description}</p>
                {selected.dependencies.length > 0 && (
                  <p className="mt-1"><strong>Requiere:</strong> {selected.dependencies.join(', ')}.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selected}
                onClick={() => selected && void downloadImportFile(
                  `/templates/${selected.entityType}.xlsx`,
                  `tcdx-${selected.entityType}.xlsx`
                ).catch(cause => setError(cause.message))}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <TcdxIcon name="export" className="h-4 w-4" aria-hidden="true" />
                Descargar plantilla Excel
              </button>
              <button
                type="button"
                disabled={busy || !selected}
                onClick={() => selected && void downloadImportFile(
                  `/catalogs/${selected.entityType}.xlsx`,
                  `tcdx-catalogos-${selected.entityType}.xlsx`
                ).catch(cause => setError(cause.message))}
                className="min-h-11 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Descargar catálogos
              </button>
            </div>

            <div
              onDragEnter={() => setDragging(true)}
              onDragOver={event => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={[
                'border-2 border-dashed p-6 text-center transition',
                dragging
                  ? 'border-[var(--tcdx-color-primary)] bg-orange-50'
                  : 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface-alt)]',
              ].join(' ')}
            >
              <TcdxIcon name="document" className="mx-auto h-7 w-7 text-[var(--tcdx-color-primary)]" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Arrastra el archivo .xlsx aquí
              </p>
              <p className="mt-1 text-xs text-slate-600">
                CSV permanece disponible como formato secundario. No se aceptan .xls, .xlsm ni .xlsb.
              </p>
              <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-4 text-sm font-semibold">
                Seleccionar archivo
                <input
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={onFileChange}
                  className="sr-only"
                />
              </label>
              {file && <p className="mt-3 break-words text-sm text-slate-800">{file.name}</p>}
            </div>

            <button
              type="button"
              disabled={busy || !file || !selected}
              onClick={() => void preview()}
              className="min-h-11 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-navy)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Procesando…' : 'Previsualizar y validar'}
            </button>
          </div>

          <aside className="border border-[var(--tcdx-color-border)] bg-white p-5">
            <h2 className="text-base font-bold text-slate-900">Cobertura declarada</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-600">Operables</dt><dd className="text-xl font-bold text-slate-900">{activeDefinitions.length}</dd></div>
              <div><dt className="text-slate-600">Bloqueadas</dt><dd className="text-xl font-bold text-slate-900">{blockedDefinitions.length}</dd></div>
            </dl>
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Entidades no habilitadas
              </summary>
              <ul className="mt-3 space-y-3 text-xs text-slate-600">
                {blockedDefinitions.map(item => (
                  <li key={item.entityType} className="border-t border-[var(--tcdx-color-border)] pt-2">
                    <strong className="block text-slate-900">{item.displayName}</strong>
                    {item.blockedReason}
                  </li>
                ))}
              </ul>
            </details>
          </aside>
        </section>

        {result && (
          <section className="space-y-4" aria-labelledby="preview-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="preview-title" className="text-lg font-bold text-slate-900">Previsualización</h2>
              {result.batch.invalid_rows > 0 && (
                <button
                  type="button"
                  onClick={() => void downloadImportFile(
                    `/${result.batch.id}/errors.xlsx`,
                    `tcdx-errores-${result.batch.id}.xlsx`
                  ).catch(cause => setError(cause.message))}
                  className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-border-strong)] bg-white px-3 text-sm font-semibold"
                >
                  Descargar archivo con errores
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['Estado', result.batch.status],
                ['Filas', result.batch.total_rows],
                ['Válidas', result.batch.valid_rows],
                ['Rechazadas', result.batch.invalid_rows],
                ['Importadas', result.batch.imported_rows || 0],
              ].map(([label, value]) => (
                <article key={String(label)} className="border border-[var(--tcdx-color-border)] bg-white p-3">
                  <p className="text-xs text-slate-600">{label}</p>
                  <p className="mt-1 break-words font-bold text-slate-900">{value}</p>
                </article>
              ))}
            </div>
            <div className="flex gap-2" role="group" aria-label="Filtrar filas">
              {(['all', 'valid', 'invalid'] as const).map(filter => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={rowFilter === filter}
                  onClick={() => setRowFilter(filter)}
                  className={[
                    'min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border px-3 text-sm font-semibold',
                    rowFilter === filter
                      ? 'border-[var(--tcdx-color-navy)] bg-[var(--tcdx-color-navy)] text-white'
                      : 'border-[var(--tcdx-color-border)] bg-white text-slate-800',
                  ].join(' ')}
                >
                  {filter === 'all' ? 'Todas' : filter === 'valid' ? 'Válidas' : 'Con errores'}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto border border-[var(--tcdx-color-border)] bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--tcdx-color-surface-alt)] text-slate-900">
                  <tr>
                    <th className="px-3 py-3">Fila</th>
                    <th className="px-3 py-3">Clave</th>
                    <th className="px-3 py-3">Operación</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="min-w-80 px-3 py-3">Validación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tcdx-color-border)]">
                  {visibleRows.map(row => (
                    <tr key={row.id || row.row_number}>
                      <td className="px-3 py-3">{row.row_number}</td>
                      <td className="max-w-64 break-words px-3 py-3">
                        {String(row.raw_data.code || row.raw_data.metric_code || row.raw_data.plan_code || '—')}
                      </td>
                      <td className="px-3 py-3">{row.operation || 'create'}</td>
                      <td className="px-3 py-3">{row.status}</td>
                      <td className="px-3 py-3">
                        {row.errors.length
                          ? row.errors.map(issue => (
                            <p key={`${issue.column}-${issue.code}`}>
                              <strong>{issue.column || 'fila'}:</strong> {issue.message}
                            </p>
                          ))
                          : 'Sin errores'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.batch.status === 'preview_ready' && (
              <div className="border border-amber-300 bg-amber-50 p-4">
                <label className="flex items-start gap-3 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={event => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-5 w-5"
                  />
                  <span>Confirmo que revisé la previsualización y autorizo procesar únicamente las filas válidas.</span>
                </label>
                <button
                  type="button"
                  disabled={busy || !confirmed || result.batch.valid_rows === 0}
                  onClick={() => void confirmImport()}
                  className="mt-3 min-h-11 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Confirmar importación
                </button>
              </div>
            )}
            {['confirmed', 'partial'].includes(result.batch.status) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void rollback()}
                className="min-h-11 rounded-[var(--tcdx-radius-tecdex-sm)] border border-red-400 bg-white px-4 text-sm font-semibold text-red-800 disabled:opacity-50"
              >
                Revertir este lote
              </button>
            )}
          </section>
        )}

        <section aria-labelledby="history-title" className="space-y-3">
          <h2 id="history-title" className="text-lg font-bold text-slate-900">Historial de lotes</h2>
          <div className="overflow-x-auto border border-[var(--tcdx-color-border)] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--tcdx-color-surface-alt)]">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Entidad</th>
                  <th className="px-3 py-3">Archivo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Filas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--tcdx-color-border)]">
                {history.map(batch => (
                  <tr key={batch.id}>
                    <td className="whitespace-nowrap px-3 py-3">
                      {batch.created_at ? new Date(batch.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-3">{batch.entity_type}</td>
                    <td className="max-w-72 break-words px-3 py-3">{batch.file_name || '—'}</td>
                    <td className="px-3 py-3">{batch.status}</td>
                    <td className="px-3 py-3">{batch.total_rows}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-600">No hay lotes registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppLayout>
  );
}
