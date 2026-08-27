'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { ApiClientError, apiRequestJson } from '@/utils/apiClient';
import GrcDecisionCenter from '@/components/math-governance/GrcDecisionCenter';
import OfficialAnalyticsPanel from '@/components/math-governance/OfficialAnalyticsPanel';

type Block = {
  status: string;
  data: Record<string, unknown> | null;
  freshness: string;
  trust: { status?: string; score?: number | null };
  source_count: number;
  warnings: string[];
  last_updated_at: string | null;
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
};

const MODULES = [
  ['Gobierno de datos', '/datos', 'data_trust'],
  ['Métricas', '/metricas', 'metrics'],
  ['Encuestas y evaluaciones', '/encuestas', 'surveys'],
  ['Tests de assurance', '/tests', 'assurance'],
  ['Eventos de pérdida', '/eventos-perdida', 'losses'],
  ['Datos y Analítica', '/bi', 'bi'],
  ['Diseñador de reportes', '/reportes/studio', 'reporting'],
  ['Cumplimiento', '/cumplimiento-auditoria', 'compliance'],
  ['Riesgos', '/matriz-riesgo', 'risks'],
  ['Controles', '/controles', 'controls'],
  ['Auditorías', '/auditorias', 'audits'],
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
    <EnterpriseDomainWorkspaceShell
      domain="intelligence"
      eyebrow="Inteligencia GRC"
      title="Inteligencia operativa y analítica"
      description="Consolida datos, métricas, riesgos, controles, evidencias, assurance, pérdidas, BI y reportes con trazabilidad y confianza."
      actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-focus)]"
          >
            Actualizar
          </button>
      }
    >
      <main className="space-y-6 text-[var(--tcdx-color-text-ink)]">
        <section className="rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        {loading && <div className="rounded-md border border-dashed p-6 text-sm">Cargando portal…</div>}

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


            <div className="mt-6">
              <GrcDecisionCenter
                title="Decisiones, prioridades e interpretación GRC"
                ctaHref="/metricas"
                ctaLabel="Ver métricas oficiales"
              />
            </div>

            <div className="mt-6"><OfficialAnalyticsPanel title="Indicadores funcionales oficiales del portal GRC" /></div>

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
    </EnterpriseDomainWorkspaceShell>
  );
}
