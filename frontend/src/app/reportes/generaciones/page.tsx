'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { ApiClientError, apiRequestJson, buildTenantHeaders, getApiBaseUrl } from '@/utils/apiClient';
import { presentationLabel } from '@/utils/presentationLabels';

type ReportDefinition = {
  id?: string;
  display_name?: string;
  report_key?: string;
  section_config?: Array<{ title?: string; result_code?: string; analytical_result_code?: string }>;
  filter_config?: { period?: { start?: string; end?: string } };
};

type ReportGeneration = {
  id?: string;
  report_definition_id?: string;
  generation_key?: string;
  format?: string;
  status?: string;
  requested_at?: string;
  started_at?: string;
  finished_at?: string;
  metadata?: Record<string, unknown>;
};

function dataOf<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: T }).data;
  return payload as T;
}

function formatDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

function formatPeriod(definition?: ReportDefinition) {
  const period = definition?.filter_config?.period;
  const start = period?.start ? String(period.start).slice(0, 10) : '';
  const end = period?.end ? String(period.end).slice(0, 10) : '';
  if (start && end) return `${start} a ${end}`;
  return 'Período configurado en el informe';
}

function contentLabel(definition?: ReportDefinition) {
  const firstSection = Array.isArray(definition?.section_config) ? definition?.section_config?.[0] : null;
  return firstSection?.title || presentationLabel(firstSection?.result_code || firstSection?.analytical_result_code, 'Contenido oficial');
}

function rowTitle(generation: ReportGeneration, definition?: ReportDefinition) {
  return definition?.display_name || generation.generation_key || 'Informe generado';
}

function canDownload(generation: ReportGeneration) {
  return String(generation.status || '').toLowerCase() === 'generated' && Boolean(generation.id);
}

export default function ReportGenerationHistory() {
  const [generations, setGenerations] = useState<ReportGeneration[]>([]);
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const definitionsById = useMemo(() => {
    const map = new Map<string, ReportDefinition>();
    definitions.forEach((definition) => {
      if (definition.id) map.set(definition.id, definition);
    });
    return map;
  }, [definitions]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [generationPayload, reportPayload] = await Promise.all([
        apiRequestJson('/api/report-generations', { fallbackMessage: 'No fue posible cargar informes generados.' }),
        apiRequestJson('/api/reports', { fallbackMessage: 'No fue posible cargar definiciones de reportes.' }),
      ]);
      const generationRows = dataOf<ReportGeneration[]>(generationPayload);
      const reportRows = dataOf<ReportDefinition[]>(reportPayload);
      setGenerations(Array.isArray(generationRows) ? generationRows : []);
      setDefinitions(Array.isArray(reportRows) ? reportRows : []);
    } catch (err) {
      const message = err instanceof ApiClientError || err instanceof Error
        ? err.message
        : 'No fue posible cargar informes generados.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const download = async (generation: ReportGeneration) => {
    if (!generation.id) return;
    try {
      const { headers } = buildTenantHeaders();
      const requestHeaders = new Headers(headers);
      requestHeaders.delete('Content-Type');
      const response = await fetch(`${getApiBaseUrl()}/api/report-generations/${encodeURIComponent(generation.id)}/download`, {
        headers: requestHeaders,
      });
      if (!response.ok) throw new ApiClientError(`HTTP_${response.status}`, 'No fue posible descargar el informe.', response.status);
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      const definition = definitionsById.get(String(generation.report_definition_id || ''));
      anchor.href = blobUrl;
      anchor.download = `${String(rowTitle(generation, definition)).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'informe-generado'}.${String(generation.format || 'pdf').toLowerCase()}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No fue posible descargar el informe.');
    }
  };

  return (
    <AppLayout>
      <EnterpriseDomainWorkspaceShell
        domain="reports"
        eyebrow="Reportes"
        title="Informes generados"
        description="Aquí aparecen los informes que ya fueron generados desde el Diseñador de reportes, junto con su estado, fecha, formato y opción de descarga."
        actions={
          <Link
            href="/reportes/studio"
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)]"
          >
            Volver al Diseñador
          </Link>
        }
      >
        <div className="space-y-5">
          <section className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tcdx-color-primary)]">
                  Diseñador de reportes {'->'} Informes generados
                </div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
                  Genera un informe en el Diseñador y vuelve aquí para revisar su estado o descargar la salida disponible.
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface)]"
              >
                Actualizar
              </button>
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
              Cargando informes generados...
            </div>
          ) : generations.length === 0 ? (
            <section className="rounded-md border border-dashed border-[var(--tcdx-color-border)] bg-white p-6">
              <h2 className="text-lg font-semibold text-[var(--tcdx-color-text-ink)]">No hay informes generados.</h2>
              <p className="mt-2 text-sm text-[var(--tcdx-color-text-secondary)]">
                Todavía no has generado informes desde el Diseñador de reportes.
              </p>
              <Link
                href="/reportes/studio"
                className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--tcdx-color-action-primary)] px-4 text-sm font-semibold text-white"
              >
                Ir al Diseñador
              </Link>
            </section>
          ) : (
            <section className="overflow-hidden rounded-md border border-[var(--tcdx-color-border)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] text-left text-xs font-bold uppercase tracking-[0.12em] text-[var(--tcdx-color-text-muted)]">
                      <th className="px-4 py-3">Informe</th>
                      <th className="px-4 py-3">Contenido</th>
                      <th className="px-4 py-3">Período</th>
                      <th className="px-4 py-3">Formato</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generations.map((generation, index) => {
                      const definition = definitionsById.get(String(generation.report_definition_id || ''));
                      return (
                        <tr key={generation.id || `${generation.generation_key}-${index}`} className="border-b border-[var(--tcdx-color-border)] align-top last:border-b-0">
                          <td className="px-4 py-4 font-semibold text-[var(--tcdx-color-text-ink)]">{rowTitle(generation, definition)}</td>
                          <td className="px-4 py-4 text-[var(--tcdx-color-text-secondary)]">{contentLabel(definition)}</td>
                          <td className="px-4 py-4 text-[var(--tcdx-color-text-secondary)]">{formatPeriod(definition)}</td>
                          <td className="px-4 py-4 font-semibold text-[var(--tcdx-color-text-ink)]">{String(generation.format || '-').toUpperCase()}</td>
                          <td className="px-4 py-4 text-[var(--tcdx-color-text-secondary)]">{formatDate(generation.finished_at || generation.requested_at || generation.started_at)}</td>
                          <td className="px-4 py-4">
                            <span className="rounded-full border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-3 py-1 text-xs font-semibold text-[var(--tcdx-color-text-ink)]">
                              {presentationLabel(generation.status, 'Pendiente')}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              disabled={!canDownload(generation)}
                              onClick={() => download(generation)}
                              className="inline-flex min-h-9 items-center rounded-md bg-[var(--tcdx-color-action-primary)] px-3 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-600"
                            >
                              Descargar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </EnterpriseDomainWorkspaceShell>
    </AppLayout>
  );
}
