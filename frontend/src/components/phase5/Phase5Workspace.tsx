'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import EnterpriseDomainWorkspaceShell, { type EnterpriseDomainWorkspaceKey } from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';
import OfficialAnalyticsPanel from '@/components/math-governance/OfficialAnalyticsPanel';
import {
  ActionableEmptyState,
  DataTrustIndicator,
  EnterpriseFilterBar,
  EnterpriseRowActions,
  EnterpriseTableShell,
  UniversalStateBlock,
} from '@/components/ui/enterprise';
import { presentationLabel } from '@/utils/presentationLabels';

type Phase5Item = Record<string, unknown>;

type Phase5WorkspaceProps = {
  title: string;
  description: string;
  endpoint: string;
  primaryLabel: string;
  columns: Array<{ key: string; label: string }>;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
  capabilityLabel?: string;
  analyticsDomain?: string;
  loadCollection?: boolean;
  domainWorkspace?: EnterpriseDomainWorkspaceKey;
  children?: ReactNode;
};

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return 'Ver detalle';
  return String(value);
}

function displayValue(key: string, value: unknown) {
  const raw = text(value);
  const normalized = raw.toLowerCase();

  if (key.toLowerCase().includes('frequency') || ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on_demand'].includes(normalized)) {
    return presentationLabel(normalized, raw);
  }

  return presentationLabel(normalized, raw.replaceAll('_', ' '));
}

function isWarning(item: Phase5Item) {
  const freshness = String(item.freshness_status || '').toLowerCase();
  const quality = String(item.quality_status || '').toLowerCase();
  const trust = String(item.trust_status || '').toLowerCase();
  return ['stale', 'expired', 'unavailable', 'unknown'].includes(freshness) ||
    ['rejected', 'unknown'].includes(quality) ||
    ['attention', 'untrusted', 'unknown'].includes(trust);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeRows(payload: unknown): Phase5Item[] {
  const data = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(data)) return data as Phase5Item[];
  if (Array.isArray((data as { items?: unknown })?.items)) return (data as { items: Phase5Item[] }).items;
  if (Array.isArray((data as { rows?: unknown })?.rows)) return (data as { rows: Phase5Item[] }).rows;
  if (data && typeof data === 'object') return [data as Phase5Item];
  return [];
}

function entityTypeFromEndpoint(endpoint: string) {
  if (endpoint.startsWith('/api/metrics')) return 'metric_definition';
  if (endpoint.startsWith('/api/assurance-tests')) return 'assurance_test_definition';
  if (endpoint.startsWith('/api/loss-events')) return 'loss_event';
  if (endpoint.startsWith('/api/dashboards')) return 'dashboard_definition';
  if (endpoint.startsWith('/api/reports')) return 'report_definition';
  if (endpoint.startsWith('/api/report-generations')) return 'report_generation';
  if (endpoint.startsWith('/api/surveys')) return 'survey_definition';
  if (endpoint.startsWith('/api/survey-campaigns')) return 'assessment_campaign';
  if (endpoint.startsWith('/api/data/elements')) return 'data_element';
  if (endpoint.startsWith('/api/data')) return 'data_domain';
  return 'grc_entity';
}

export default function Phase5Workspace({
  title,
  description,
  endpoint,
  primaryLabel,
  columns,
  emptyMessage,
  emptyAction,
  capabilityLabel,
  analyticsDomain,
  loadCollection = true,
  domainWorkspace,
  children,
}: Phase5WorkspaceProps) {
  const [rows, setRows] = useState<Phase5Item[]>([]);
  const [loading, setLoading] = useState(loadCollection);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  const requestEndpoint = useMemo(() => endpoint, [endpoint]);
  const entityType = useMemo(() => entityTypeFromEndpoint(endpoint), [endpoint]);
  const filteredRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      columns
        .map((column) => row[column.key])
        .some((value) => text(value).toLowerCase().includes(query))
    );
  }, [columns, rows, tableSearch]);

  useEffect(() => {
    if (!loadCollection) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await apiRequestJson(requestEndpoint, {
          fallbackMessage: `No fue posible cargar ${primaryLabel}.`,
        });
        if (!cancelled) {
          setRows(normalizeRows(json));
          setLastLoadedAt(new Date().toLocaleString('es-CL'));
        }
      } catch (err) {
        if (!cancelled) {
          const code = err instanceof ApiClientError ? err.code : 'LOAD_ERROR';
          setError({ code, message: err instanceof Error ? err.message : 'Error inesperado cargando datos.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadCollection, primaryLabel, requestEndpoint]);

  const retry = () => {
    setLastLoadedAt('');
    setRows([]);
    setLoading(true);
    setError(null);
    setTimeout(() => {
      apiRequestJson(requestEndpoint, { fallbackMessage: `No fue posible cargar ${primaryLabel}.` })
        .then((json) => {
          setRows(normalizeRows(json));
          setLastLoadedAt(new Date().toLocaleString('es-CL'));
        })
        .catch((err) => setError({
          code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR',
          message: err instanceof Error ? err.message : 'Error inesperado cargando datos.',
        }))
        .finally(() => setLoading(false));
    }, 0);
  };

  const loadStatusPanel = (
    <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-4 py-3 text-xs text-[var(--tcdx-color-text-secondary)]">
      <div className="font-semibold text-[var(--tcdx-color-text-primary)]">{capabilityLabel || primaryLabel}</div>
      <div>Última carga: {lastLoadedAt || 'pendiente'}</div>
    </div>
  );

  const workspaceContent = (
    <div className="space-y-5">
      {!domainWorkspace && (
        <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tcdx-color-primary)]">Gobierno analítico GRC</p>
            <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
          </div>
          {loadStatusPanel}
        </div>
        </section>
      )}

        {children && (
          <div className="mt-6 grid gap-4">
            {children}
          </div>
        )}

        {analyticsDomain !== undefined && (
          <div className="mt-6">
            <OfficialAnalyticsPanel
              title="Resultados oficiales disponibles para esta vista"
              domain={analyticsDomain || undefined}
              compact
            />
          </div>
        )}

        {loading && (
          <UniversalStateBlock state="loading" title="Cargando información gobernada" />
        )}

        {!loading && error && (
          <UniversalStateBlock
            state={error.code === 'CAPABILITY_NOT_INCLUDED' || error.code === 'PERMISSION_DENIED' ? 'not_available' : 'error'}
            title={error.code === 'TENANT_REQUIRED'
              ? 'Selecciona una empresa'
              : error.code === 'CAPABILITY_NOT_INCLUDED'
                ? 'Capacidad no incluida en el plan'
                : error.code === 'PERMISSION_DENIED'
                  ? 'Permiso insuficiente'
                  : 'No fue posible cargar la información'}
            description={error.message}
            action={(
              <div className="flex flex-wrap gap-2">
              {error.code === 'TENANT_REQUIRED' && (
                <Link className="rounded-md bg-[var(--tcdx-color-primary)] px-3 py-2 text-xs font-semibold text-white" href="/admin-saas">
                  Seleccionar empresa
                </Link>
              )}
              <button
                type="button"
                onClick={retry}
                className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-800"
              >
                Reintentar
              </button>
              </div>
            )}
          />
        )}

        {loadCollection && !loading && !error && rows.length === 0 && (
          <ActionableEmptyState
            title="Sin datos"
            reason={emptyMessage}
            ctaLabel={emptyAction?.label}
            href={emptyAction?.href}
          />
        )}

        {loadCollection && !loading && !error && rows.length > 0 && (
          <div className="space-y-3">
            <EnterpriseFilterBar
              count={`${filteredRows.length} de ${rows.length} ${primaryLabel}`}
              actions={
                tableSearch ? (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 text-xs font-bold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                  >
                    Limpiar
                  </button>
                ) : null
              }
            >
              <label className="sm:col-span-2">
                <span className="text-xs font-bold text-[var(--tcdx-color-text-secondary)]">Buscar</span>
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder={`Buscar en ${primaryLabel}`}
                  className="mt-1 min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 text-sm text-[var(--tcdx-color-text-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                />
              </label>
            </EnterpriseFilterBar>

            {filteredRows.length === 0 ? (
              <UniversalStateBlock
                state="empty"
                title="Sin resultados"
                description="No hay registros que coincidan con la búsqueda actual."
              />
            ) : (
              <EnterpriseTableShell density="compact" maxHeight="620px">
                <table className="min-w-[980px] w-full table-fixed text-left text-sm">
                  <thead>
                    <tr>
                      {columns.map((column, index) => (
                        <th
                          key={column.key}
                          scope="col"
                          className={index === 0 ? 'w-[24%] px-3 py-3 text-left' : 'px-3 py-3 text-left'}
                        >
                          {column.label}
                        </th>
                      ))}
                      <th scope="col" className="w-[150px] px-3 py-3 text-left">Confianza</th>
                      <th scope="col" className="w-[190px] px-3 py-3 text-left">Fórmula</th>
                      <th scope="col" className="w-[150px] px-3 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredRows.map((row, index) => (
                      <tr
                        key={String(row.id || row.metric_code || row.dashboard_key || index)}
                        className={isWarning(row) ? 'bg-amber-50/60' : ''}
                      >
                        {columns.map((column, columnIndex) => (
                          <td key={column.key} className="px-3 py-3 align-top text-[var(--tcdx-color-text-ink)]">
                            <span
                              className={columnIndex === 0 ? 'line-clamp-2 font-semibold' : 'line-clamp-2 text-[var(--tcdx-color-text-secondary)]'}
                              title={displayValue(column.key, row[column.key])}
                            >
                              {displayValue(column.key, row[column.key])}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-3 align-top">
                          <DataTrustIndicator
                            status={String(row.trust_status || row.quality_status || '')}
                            coverage={typeof row.coverage === 'number' || typeof row.coverage === 'string' ? row.coverage : null}
                            freshness={typeof row.freshness_status === 'string' ? row.freshness_status : null}
                            source={typeof row.source_status === 'string' ? row.source_status : null}
                            warnings={stringList(row.warnings)}
                            label={isWarning(row) ? 'Data Trust con advertencias' : 'Data Trust'}
                          />
                        </td>
                        <td className="px-3 py-3 align-top text-xs">
                          <div className="line-clamp-1 font-semibold text-[var(--tcdx-color-text-ink)]">
                            {displayValue('formula', row.formula_code || row.official_formula_code || row.result_code)}
                          </div>
                          <div className="text-[var(--tcdx-color-text-secondary)]">
                            v{displayValue('version', row.formula_version || row.official_formula_version || row.version_number)}
                          </div>
                          <div className="line-clamp-1 text-[var(--tcdx-color-text-secondary)]">
                            {displayValue('trust', row.coverage ?? row.trust_status ?? row.source_status)}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {row.id ? (
                            <EnterpriseRowActions>
                              <Link className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--tcdx-color-primary)] hover:bg-[var(--tcdx-color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]" href={`/datos/lineage?entityType=${encodeURIComponent(String(row.entity_type || entityType))}&entityId=${encodeURIComponent(String(row.id))}&mode=lineage`}>
                                Lineage
                              </Link>
                              <Link className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--tcdx-color-primary)] hover:bg-[var(--tcdx-color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]" href={`/datos/lineage?entityType=${encodeURIComponent(String(row.entity_type || entityType))}&entityId=${encodeURIComponent(String(row.id))}&mode=impact`}>
                                Impacto
                              </Link>
                            </EnterpriseRowActions>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </EnterpriseTableShell>
            )}
          </div>
        )}
      </div>
  );

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      {domainWorkspace ? (
        <EnterpriseDomainWorkspaceShell
          domain={domainWorkspace}
          title={title}
          description={description}
          actions={loadStatusPanel}
        >
          {workspaceContent}
        </EnterpriseDomainWorkspaceShell>
      ) : (
        workspaceContent
      )}
    </main>
  );
}
