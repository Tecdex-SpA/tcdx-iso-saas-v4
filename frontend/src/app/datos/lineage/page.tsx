'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import { apiRequestJson } from '@/utils/apiClient';

type GraphPayload = {
  root?: { entity_type?: string; entity_id?: string };
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  warnings?: string[];
  direction?: string;
};

export default function LineageExplorer() {
  const params = useSearchParams();
  const entityType = params.get('entityType') || '';
  const entityId = params.get('entityId') || '';
  const mode = params.get('mode') === 'impact' ? 'impact' : 'lineage';
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const endpoint = useMemo(() => {
    if (!entityType || !entityId) return '';
    return mode === 'impact'
      ? `/api/data/impact/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`
      : `/api/data/lineage/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
  }, [entityId, entityType, mode]);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    const loadGraph = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequestJson<{ data?: GraphPayload }>(endpoint);
        if (!cancelled) setGraph(payload.data || (payload as GraphPayload));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible cargar el grafo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <EnterpriseDomainWorkspaceShell
        domain="data"
        eyebrow="Trazabilidad analítica"
        title="Lineage e Impact Graph"
        description="Navega relaciones tenant-scoped entre datos, métricas, evidencias, tests, pérdidas, dashboards y reportes."
      >
      <section className="rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">

        {!endpoint && (
          <div className="mt-6 rounded-md border border-dashed p-6 text-sm text-[var(--tcdx-color-text-secondary)]">
            Selecciona una entidad desde métricas, tests, pérdidas, dashboard o reporte para consultar lineage o impacto.
          </div>
        )}
        {loading && <div className="mt-6 rounded-md border border-dashed p-6 text-sm">Cargando grafo…</div>}
        {error && <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {graph && !loading && !error && (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
              <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Raíz</div>
              <div className="mt-1 font-semibold">{graph.root?.entity_type || entityType}</div>
              <div className="mt-1 break-all text-xs">{graph.root?.entity_id || entityId}</div>
              <div className="mt-3 text-xs">Modo: {graph.direction || mode}</div>
            </div>
            <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
              <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Nodos</div>
              <div className="mt-1 text-2xl font-semibold">{graph.nodes?.length || 0}</div>
            </div>
            <div className="rounded-md border border-[var(--tcdx-color-border)] p-4">
              <div className="text-xs uppercase text-[var(--tcdx-color-text-secondary)]">Relaciones</div>
              <div className="mt-1 text-2xl font-semibold">{graph.edges?.length || 0}</div>
            </div>
            <div className="overflow-x-auto rounded-md border border-[var(--tcdx-color-border)] lg:col-span-3">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--tcdx-color-surface)]">
                  <tr>
                    <th className="px-4 py-3 text-left">Desde</th>
                    <th className="px-4 py-3 text-left">Relación</th>
                    <th className="px-4 py-3 text-left">Hacia</th>
                    <th className="px-4 py-3 text-left">Explicación</th>
                  </tr>
                </thead>
                <tbody>
                  {(graph.edges || []).map((edge, index) => (
                    <tr key={`${edge.from_type}-${edge.to_type}-${index}`} className="border-t">
                      <td className="px-4 py-3">{String(edge.from_type || '—')}</td>
                      <td className="px-4 py-3">{String(edge.relation_type || '—')}</td>
                      <td className="px-4 py-3">{String(edge.to_type || '—')}</td>
                      <td className="px-4 py-3">{String(edge.explanation || edge.transformation || 'Sin explicación registrada.')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      </EnterpriseDomainWorkspaceShell>
    </main>
  );
}
