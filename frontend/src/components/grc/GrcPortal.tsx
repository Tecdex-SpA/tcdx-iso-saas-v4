'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';

type Block = {
  status: string;
  data: Record<string, unknown> | null;
  freshness: string;
  trust: { status?: string; score?: number | null };
  source_count: number;
  warnings: string[];
  last_updated_at: string | null;
};

type OfficialCalculation = {
  value?: number | string | null;
  unit?: string | null;
  status?: string;
  formula_code?: string;
  formula_version?: number;
  coverage?: number | null;
  trust_score?: number | null;
  trust_status?: string;
  warnings?: string[];
  explanation_url?: string | null;
  lineage_url?: string | null;
  calculation_run_id?: string | null;
};

type GrcOverview = {
  tenant?: Block;
  commercial?: Block;
  data_trust?: Block;
  compliance?: Block;
  risks?: Block;
  controls?: Block;
  evidence?: Block;
  audits?: Block;
  actions?: Block;
  metrics?: Block;
  surveys?: Block;
  assurance?: Block;
  losses?: Block;
  suppliers?: Block;
  incidents?: Block;
  continuity?: Block;
  bi?: Block;
  reporting?: Block;
  alerts?: Array<{ block: string; severity: string; message: string }>;
  request_id?: string | null;
  generated_at?: string;
  official_calculations?: Record<string, OfficialCalculation>;
};

const MODULES = [
  ['Gobierno de datos', '/datos', 'data_trust'],
  ['Métricas', '/metricas', 'metrics'],
  ['Encuestas y evaluaciones', '/encuestas', 'surveys'],
  ['Tests de assurance', '/tests', 'assurance'],
  ['Eventos de pérdida', '/eventos-perdida', 'losses'],
  ['Business Intelligence', '/bi', 'bi'],
  ['Report Studio', '/reportes/studio', 'reporting'],
  ['Cumplimiento', '/cumplimiento-auditoria', 'compliance'],
  ['Riesgos', '/matriz-riesgo', 'risks'],
  ['Controles', '/controles', 'controls'],
  ['Auditorías', '/auditor', 'audits'],
  ['Evidencias', '/evidencias', 'evidence'],
  ['Planes de acción', '/acciones-recomendadas', 'actions'],
  ['Terceros', '/proveedores', 'suppliers'],
  ['Continuidad', '/bia', 'continuity'],
  ['Incidentes', '/incidentes', 'incidents'],
] as const;

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin datos';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('es-CL') : 'Sin medición';
  if (typeof value === 'object') return 'Ver detalle';
  return String(value);
}

function blockTone(status: string) {
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-900';
  if (status === 'attention') return 'border-amber-200 bg-amber-50 text-amber-950';
  if (status === 'unmeasured') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-950';
}

export default function GrcPortal() {
  const [overview, setOverview] = useState<GrcOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = await apiRequestJson<{ data?: GrcOverview }>('/api/grc/overview', {
        fallbackMessage: 'No fue posible cargar el portal GRC.',
      });
      setOverview(payload.data || (payload as GrcOverview));
    } catch (err) {
      setError({
        code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR',
        message: err instanceof Error ? err.message : 'Error inesperado cargando el portal GRC.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiRequestJson<{ data?: GrcOverview }>('/api/grc/overview', {
      fallbackMessage: 'No fue posible cargar el portal GRC.',
    })
      .then((payload) => {
        if (!cancelled) setOverview(payload.data || (payload as GrcOverview));
      })
      .catch((err) => {
        if (!cancelled) {
          setError({
            code: err instanceof ApiClientError ? err.code : 'LOAD_ERROR',
            message: err instanceof Error ? err.message : 'Error inesperado cargando el portal GRC.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tenant = overview?.tenant?.data || {};
  const commercial = overview?.commercial?.data || {};
  const subscription = (commercial.subscription || {}) as Record<string, unknown>;
  const blocks = MODULES.map(([label, href, key]) => ({ label, href, key, block: overview?.[key as keyof GrcOverview] as Block | undefined }));

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-6 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--tcdx-color-primary)]">Portal GRC</p>
            <h1 className="mt-2 text-2xl font-semibold">Estado operativo y analítico</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
              Consolida datos, métricas, riesgos, controles, evidencias, assurance, pérdidas, BI y reportes con trazabilidad y confianza.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-[var(--tcdx-color-border)] px-4 py-2 text-sm font-semibold"
          >
            Actualizar
          </button>
        </div>

        {loading && <div className="mt-6 rounded-md border border-dashed p-6 text-sm">Cargando portal…</div>}

        {!loading && error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <div className="font-semibold">{error.code === 'TENANT_REQUIRED' ? 'Selecciona una empresa' : 'No fue posible cargar el portal'}</div>
            <p className="mt-1">{error.message}</p>
            {error.code === 'TENANT_REQUIRED' && (
              <Link className="mt-3 inline-flex rounded-md bg-[var(--tcdx-color-primary)] px-3 py-2 text-xs font-semibold text-white" href="/admin-saas">
                Ir a Administración SaaS
              </Link>
            )}
          </div>
        )}

        {!loading && !error && overview && (
          <>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
                <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Empresa</div>
                <div className="mt-1 font-semibold">{displayValue(tenant.name || tenant.id)}</div>
              </div>
              <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
                <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Plan vigente</div>
                <div className="mt-1 font-semibold">{displayValue(subscription.plan_key || subscription.plan_name)}</div>
              </div>
              <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
                <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Confianza del dato</div>
                <div className="mt-1 font-semibold">{displayValue(overview.data_trust?.trust?.score)} · {displayValue(overview.data_trust?.trust?.status)}</div>
              </div>
              <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
                <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Actualizado</div>
                <div className="mt-1 font-semibold">{displayValue(overview.generated_at)}</div>
              </div>
            </div>

            {overview.alerts && overview.alerts.length > 0 && (
              <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="font-semibold">Alertas analíticas</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {overview.alerts.slice(0, 8).map((alert, index) => (
                    <li key={`${alert.block}-${index}`}>{alert.block}: {alert.message}</li>
                  ))}
                </ul>
              </div>
            )}


            {overview.official_calculations && Object.keys(overview.official_calculations).length > 0 && (
              <section className="mt-6 rounded-md border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-4" aria-labelledby="official-grc-results">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Capa matemática oficial</p>
                    <h2 id="official-grc-results" className="mt-1 text-lg font-semibold">Resultados operativos trazables</h2>
                    <p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
                      Cada resultado conserva fórmula, versión, cobertura, confianza, warnings, explicación y lineage.
                    </p>
                  </div>
                  <Link href="/datos/lineage" className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-primary)]">
                    Ver lineage
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(overview.official_calculations).map(([key, result]) => (
                    <article key={key} className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-4 text-sm">
                      <div className="font-semibold">{key.replaceAll('_', ' ')}</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--tcdx-color-navy)]">
                        {displayValue(result.value)}{result.unit ? ` ${result.unit}` : ''}
                      </div>
                      <dl className="mt-3 space-y-1 text-xs text-[var(--tcdx-color-text-secondary)]">
                        <div className="flex justify-between gap-3"><dt>Estado</dt><dd className="font-semibold">{displayValue(result.status)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Fórmula</dt><dd className="font-semibold">{displayValue(result.formula_code)}@v{displayValue(result.formula_version)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Cobertura</dt><dd>{displayValue(result.coverage)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Confianza</dt><dd>{displayValue(result.trust_score)} · {displayValue(result.trust_status)}</dd></div>
                      </dl>
                      {result.warnings?.[0] && <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-950">{result.warnings[0]}</div>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--tcdx-color-primary)]">
                        {result.explanation_url && <Link href={result.explanation_url}>Explicación</Link>}
                        {result.lineage_url && <Link href={result.lineage_url}>Lineage</Link>}
                        {result.calculation_run_id && <span>Run {String(result.calculation_run_id).slice(0, 8)}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {blocks.map(({ label, href, block }) => (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-md border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${blockTone(block?.status || 'unmeasured')}`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="mt-2 text-xs uppercase tracking-wide">Estado: {displayValue(block?.status || 'unmeasured')}</div>
                  <div className="mt-2 text-sm">Fuentes: {block?.source_count ? block.source_count.toLocaleString('es-CL') : 'Sin datos'}</div>
                  <div className="mt-1 text-sm">Freshness: {displayValue(block?.freshness)}</div>
                  {block?.warnings?.[0] && <div className="mt-3 text-xs">{block.warnings[0]}</div>}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
