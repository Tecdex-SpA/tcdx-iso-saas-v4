'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { ActionableEmptyState, UniversalStateBlock } from '@/components/ui/enterprise';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';
import { presentationLabel } from '@/utils/presentationLabels';

type RecordItem = Record<string, unknown>;

type EndpointState = {
  rows: RecordItem[];
  data: unknown;
  error?: string;
};

type DataCenterState = {
  loading: boolean;
  overview: EndpointState;
  domains: EndpointState;
  elements: EndpointState;
  quality: EndpointState;
  sources: EndpointState;
  catalog: EndpointState;
};

const VISIBLE_SOURCE_TYPES = new Set(['google_drive', 'manual_upload']);

const INITIAL_ENDPOINT: EndpointState = { rows: [], data: null };

function dataOf(payload: unknown) {
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data?: unknown }).data;
  return payload;
}

function normalizeRows(payload: unknown): RecordItem[] {
  const data = dataOf(payload);
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.items)) return data.items.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.rows)) return data.rows.filter(isRecord);
  if (isRecord(data)) return [data];
  return [];
}

function isRecord(value: unknown): value is RecordItem {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown, fallback = 'Sin dato') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function countLabel(value: number | null | undefined, singular: string, plural: string) {
  if (value === null || value === undefined) return 'No disponible';
  return `${value} ${value === 1 ? singular : plural}`;
}

function endpointError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

async function loadEndpoint(path: string, fallbackMessage: string): Promise<EndpointState> {
  try {
    const payload = await apiRequestJson(path, { fallbackMessage });
    return { rows: normalizeRows(payload), data: dataOf(payload) };
  } catch (error) {
    return { ...INITIAL_ENDPOINT, error: endpointError(error, fallbackMessage) };
  }
}

function statusClass(status: unknown) {
  const normalized = String(status || '').toLowerCase();
  if (['ok', 'active', 'trusted', 'acceptable', 'current', 'generated', 'completed'].includes(normalized)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (['attention', 'warning', 'stale', 'low_confidence', 'trusted_with_warnings'].includes(normalized)) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }
  if (['error', 'failed', 'rejected', 'untrusted'].includes(normalized)) {
    return 'border-red-200 bg-red-50 text-red-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function sourceType(source: RecordItem) {
  return String(source.source_type || source.provider || source.type || '').toLowerCase();
}

function sourceName(source: RecordItem) {
  const rawType = sourceType(source);
  if (rawType === 'google_drive') return 'Google Drive';
  if (rawType === 'manual_upload') return 'Carga manual';
  return text(source.source_name || source.name || rawType);
}

function overviewBlock(overview: unknown, key: string) {
  return isRecord(overview) && isRecord(overview[key]) ? overview[key] as RecordItem : null;
}

function blockSourceCount(block: RecordItem | null) {
  return numberValue(block?.source_count);
}

function blockWarnings(block: RecordItem | null) {
  return Array.isArray(block?.warnings) ? block.warnings.map((item) => String(item)).filter(Boolean) : [];
}

function recordTitle(item: RecordItem) {
  return text(
    item.display_name ||
      item.name ||
      item.domain_name ||
      item.data_element_name ||
      item.result_code ||
      item.analytical_result_code ||
      item.element_key ||
      item.domain_key,
  );
}

function realActionForMissing(missing: string[]) {
  if (missing.includes('sources')) return { label: 'Conectar evidencias', href: '/evidencias' };
  if (missing.includes('elements') || missing.includes('quality')) return { label: 'Abrir importaciones', href: '/importaciones' };
  return null;
}

export default function DataTraceabilityCenter() {
  const [state, setState] = useState<DataCenterState>({
    loading: true,
    overview: INITIAL_ENDPOINT,
    domains: INITIAL_ENDPOINT,
    elements: INITIAL_ENDPOINT,
    quality: INITIAL_ENDPOINT,
    sources: INITIAL_ENDPOINT,
    catalog: INITIAL_ENDPOINT,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const [overview, domains, elements, quality, sources, catalog] = await Promise.all([
        loadEndpoint('/api/grc/overview', 'No fue posible cargar resumen GRC.'),
        loadEndpoint('/api/data/domains?limit=50', 'No fue posible cargar dominios de datos.'),
        loadEndpoint('/api/data/elements?limit=50', 'No fue posible cargar elementos de datos.'),
        loadEndpoint('/api/data/quality?limit=50', 'No fue posible cargar calidad de datos.'),
        loadEndpoint('/api/evidence-library/sources', 'No fue posible cargar fuentes documentales.'),
        loadEndpoint('/api/grc/official/analytics/catalog', 'No fue posible cargar catálogo oficial.'),
      ]);
      if (!cancelled) setState({ loading: false, overview, domains, elements, quality, sources, catalog });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSources = useMemo(
    () => state.sources.rows.filter((source) => VISIBLE_SOURCE_TYPES.has(sourceType(source))),
    [state.sources.rows],
  );

  const officialResults = state.catalog.rows;
  const overview = state.overview.data;
  const metricsBlock = overviewBlock(overview, 'metrics');
  const trustBlock = overviewBlock(overview, 'data_trust');
  const reportingBlock = overviewBlock(overview, 'reporting');
  const alerts = isRecord(overview) && Array.isArray(overview.alerts) ? overview.alerts.filter(isRecord) : [];
  const officialCalculations = isRecord(overview) && isRecord(overview.official_calculations)
    ? Object.values(overview.official_calculations).filter(isRecord)
    : [];

  const missing = [
    visibleSources.length ? '' : 'sources',
    state.elements.rows.length ? '' : 'elements',
    state.quality.rows.length || blockSourceCount(trustBlock) ? '' : 'quality',
    officialCalculations.length || officialResults.length ? '' : 'dependencies',
  ].filter(Boolean);
  const nextAction = realActionForMissing(missing);

  const attentionItems = [
    ...alerts.slice(0, 4).map((alert) => ({
      title: presentationLabel(alert.block, text(alert.block, 'Bloque')),
      detail: text(alert.message),
      status: alert.severity || 'attention',
    })),
    ...state.quality.rows
      .filter((item) => !['valid', 'trusted', 'approved', 'ok'].includes(String(item.assessment_status || item.quality_status || '').toLowerCase()))
      .slice(0, 4)
      .map((item) => ({
        title: recordTitle(item),
        detail: text(item.findings || item.rule_name || item.assessment_status || 'Requiere revisión de calidad.'),
        status: item.assessment_status || item.quality_status || 'attention',
      })),
  ].slice(0, 6);

  const endpointErrors = [
    state.overview.error && `Resumen GRC: ${state.overview.error}`,
    state.domains.error && `Dominios: ${state.domains.error}`,
    state.elements.error && `Catálogo: ${state.elements.error}`,
    state.quality.error && `Calidad: ${state.quality.error}`,
    state.sources.error && `Fuentes: ${state.sources.error}`,
    state.catalog.error && `Resultados oficiales: ${state.catalog.error}`,
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <EnterpriseDomainWorkspaceShell
        domain="data"
        title="Centro de datos y trazabilidad"
        description="Puerta operativa para entender qué información tiene la plataforma, de dónde proviene, cómo se usa y qué falta para que métricas, reportes y evidencias sean trazables."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/importaciones" className="inline-flex min-h-10 items-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-action-primary)] px-3 text-xs font-bold text-white">
              Importaciones
            </Link>
            <Link href="/evidencias" className="inline-flex min-h-10 items-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 text-xs font-bold text-[var(--tcdx-color-primary)]">
              Evidencias
            </Link>
          </div>
        }
      >
        {state.loading ? (
          <UniversalStateBlock state="loading" title="Cargando centro de datos" description="Leyendo fuentes, dominios, calidad y dependencias existentes." />
        ) : (
          <div className="space-y-5">
            {endpointErrors.length > 0 && (
              <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">Información parcial</div>
                <p className="mt-1 leading-6">Algunas fuentes no respondieron o no están disponibles para el plan/rol actual. No se reemplazan con datos ficticios.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {endpointErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            )}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="Información disponible" value={countLabel(state.elements.rows.length, 'elemento', 'elementos')} detail={countLabel(state.domains.rows.length, 'dominio', 'dominios')} />
              <SummaryCard title="Fuentes visibles" value={countLabel(visibleSources.length, 'fuente', 'fuentes')} detail="Google Drive y carga manual en UI productiva" />
              <SummaryCard title="Confianza/calidad" value={countLabel(state.quality.rows.length || blockSourceCount(trustBlock), 'registro', 'registros')} detail={presentationLabel(trustBlock?.status || 'unmeasured')} status={trustBlock?.status} />
              <SummaryCard title="Uso en métricas/reportes" value={countLabel(blockSourceCount(metricsBlock), 'medición', 'mediciones')} detail={`${countLabel(blockSourceCount(reportingBlock), 'emisión', 'emisiones')} de reporte`} status={metricsBlock?.status} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Panel title="Fuentes de datos" helper="Origen productivo visible de información documental y operativa.">
                {visibleSources.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visibleSources.map((source, index) => (
                      <div key={String(source.source_id || source.id || index)} className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{sourceName(source)}</div>
                            <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">
                              {text(source.root_folder_name || source.source_reference || source.provider_account_email || source.account_email, 'Sin carpeta o cuenta informada')}
                            </div>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(source.status)}`}>
                            {presentationLabel(source.status)}
                          </span>
                        </div>
                        <div className="mt-3 text-xs text-[var(--tcdx-color-text-secondary)]">
                          {countLabel(numberValue(source.documents_count || source.document_count), 'documento', 'documentos')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ActionableEmptyState
                    title="Sin fuentes documentales visibles"
                    reason="Para trazar evidencias y sustentar métricas se necesita una fuente real. En la UI productiva se mantienen Google Drive y carga manual."
                    ctaLabel="Abrir evidencias"
                    href="/evidencias"
                  />
                )}
              </Panel>

              <Panel title="Calidad y confianza" helper="Lectura de assessments y Data Trust existentes; ausencia se mantiene como sin medición.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricBlock label="Confianza del dato" value={presentationLabel(trustBlock?.trust && isRecord(trustBlock.trust) ? trustBlock.trust.status : trustBlock?.status)} helper={blockWarnings(trustBlock)[0] || 'Sin advertencias principales.'} status={trustBlock?.status} />
                  <MetricBlock label="Vigencia" value={presentationLabel(metricsBlock?.freshness || trustBlock?.freshness)} helper={countLabel(blockSourceCount(metricsBlock), 'fuente medida', 'fuentes medidas')} status={metricsBlock?.freshness} />
                </div>
                {state.quality.rows.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {state.quality.rows.slice(0, 4).map((item, index) => (
                      <div key={String(item.id || index)} className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 py-2 text-sm">
                        <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{recordTitle(item)}</div>
                        <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{presentationLabel(item.assessment_status || item.quality_status)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Información disponible" helper="Dominios y elementos registrados por los endpoints de gobierno de datos.">
                {state.elements.rows.length || state.domains.rows.length ? (
                  <div className="space-y-2">
                    {[...state.elements.rows, ...state.domains.rows].slice(0, 8).map((item, index) => (
                      <div key={String(item.id || item.element_key || item.domain_key || index)} className="flex items-start justify-between gap-3 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 py-2 text-sm">
                        <div>
                          <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{recordTitle(item)}</div>
                          <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{text(item.business_definition || item.description || item.domain_name, 'Sin definición de negocio informada')}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{presentationLabel(item.status || 'active')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ActionableEmptyState
                    title="Sin catálogo de datos operativo"
                    reason="No hay elementos o dominios registrados. Las importaciones son la entrada disponible para incorporar información operacional sin inventar registros."
                    ctaLabel="Abrir importaciones"
                    href="/importaciones"
                  />
                )}
              </Panel>

              <Panel title="Trazabilidad y dependencias" helper="Qué métricas, cálculos y reportes consumen la información disponible.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricBlock label="Resultados oficiales" value={countLabel(officialResults.length, 'resultado', 'resultados')} helper="Catálogo oficial existente" />
                  <MetricBlock label="Cálculos leídos" value={countLabel(officialCalculations.length, 'cálculo', 'cálculos')} helper="Sin recalcular fórmulas" />
                  <MetricBlock label="Reportes generados" value={countLabel(blockSourceCount(reportingBlock), 'emisión', 'emisiones')} helper={blockWarnings(reportingBlock)[0] || 'Sin fallos reportados'} status={reportingBlock?.status} />
                </div>
                <div className="mt-3 space-y-2">
                  {officialResults.slice(0, 5).map((item, index) => (
                    <div key={String(item.result_code || item.analytical_result_code || index)} className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 py-2 text-sm">
                      <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{recordTitle(item)}</div>
                      <div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">
                        Depende de {presentationLabel(item.domain || 'general')} · fórmula {text(item.formula_code || item.formula_version, 'no informada')}
                      </div>
                    </div>
                  ))}
                  {!officialResults.length && (
                    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] bg-white p-4 text-sm text-[var(--tcdx-color-text-secondary)]">
                      No hay catálogo oficial disponible para mostrar dependencias desde esta vista.
                    </div>
                  )}
                </div>
              </Panel>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <Panel title="Problemas que requieren atención" helper="Sólo se listan señales reales de endpoints; no se fabrican estados.">
                {attentionItems.length ? (
                  <div className="space-y-2">
                    {attentionItems.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        <div className="font-semibold">{item.title}</div>
                        <div className="mt-1 text-xs leading-5">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ActionableEmptyState
                    title="Sin alertas de datos visibles"
                    reason="No hay advertencias publicadas por resumen GRC, calidad o Data Trust en este momento."
                  />
                )}
              </Panel>

              <Panel title="Próxima acción" helper="Acción real según lo que falta.">
                {nextAction ? (
                  <ActionableEmptyState
                    title="Completar base de datos trazable"
                    reason={missing.includes('sources')
                      ? 'Sin fuente documental visible, la plataforma no puede demostrar origen de evidencias.'
                      : 'Sin elementos/calidad registrados, el centro no puede explicar uso y confianza de la información.'}
                    ctaLabel={nextAction.label}
                    href={nextAction.href}
                  />
                ) : (
                  <ActionableEmptyState
                    title="Base mínima trazable disponible"
                    reason="Ya existen fuentes o datos suficientes para consultar calidad, dependencias y rutas avanzadas cuando se requiera análisis técnico."
                  />
                )}
                <div className="mt-3 grid gap-2 text-xs font-semibold">
                  <Link href="/datos/calidad" className="text-[var(--tcdx-color-primary)]">Detalle avanzado de calidad</Link>
                  <Link href="/datos/catalogo" className="text-[var(--tcdx-color-primary)]">Catálogo técnico</Link>
                  <Link href="/datos/lineage" className="text-[var(--tcdx-color-primary)]">Trazabilidad por entidad</Link>
                  <Link href="/datos/semantica" className="text-[var(--tcdx-color-primary)]">Capa semántica</Link>
                </div>
              </Panel>
            </section>
          </div>
        )}
      </EnterpriseDomainWorkspaceShell>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  status,
}: {
  title: string;
  value: string;
  detail: string;
  status?: unknown;
}) {
  return (
    <article className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--tcdx-color-text-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--tcdx-color-text-ink)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">{detail}</div>
      {status ? <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>{text(presentationLabel(status))}</span> : null}
    </article>
  );
}

function Panel({ title, helper, children }: { title: string; helper: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">{helper}</p>
      </div>
      {children}
    </section>
  );
}

function MetricBlock({ label, value, helper, status }: { label: string; value: string; helper: string; status?: unknown }) {
  return (
    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--tcdx-color-text-muted)]">{label}</div>
      <div className="mt-2 text-base font-semibold text-[var(--tcdx-color-text-ink)]">{value}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">{helper}</div>
      {status ? <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}>{text(presentationLabel(status))}</span> : null}
    </div>
  );
}
