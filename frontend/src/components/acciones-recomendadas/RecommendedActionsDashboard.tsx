'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getStoredValidToken,
  getTenantIdFromToken,
  getUserFromToken,
  getUserRoleFromToken,
} from '@/utils/auth';
import RecommendedActionCard from './RecommendedActionCard';
import RecommendedActionDetailModal from './RecommendedActionDetailModal';
import RecommendedActionFilters from './RecommendedActionFilters';
import RecommendedActionStats from './RecommendedActionStats';
import type {
  ActionFeedback,
  JsonObject,
  RecommendedAction,
  RecommendedActionFilters as Filters,
  RecommendedActionsSummary,
} from './types';
import { canMutate, label, sourceLabel, targetLabel } from './utils';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://192.168.100.120:3000';

const INITIAL_FILTERS: Filters = {
  status: 'pending',
  standard: '',
  priority: '',
  type: '',
  source: '',
  search: '',
};

type ApiEnvelope = {
  ok?: boolean;
  error?: string;
  data?: unknown;
  dry_run?: boolean;
  success?: boolean;
  count?: number;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function getResponseMessage(status: number, fallback: string) {
  if (status === 401 || status === 403) return 'Sesion no valida o sin permisos.';
  if (status >= 500) return 'No fue posible cargar recomendaciones.';
  return fallback;
}

export default function RecommendedActionsDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [summary, setSummary] = useState<RecommendedActionsSummary | null>(null);
  const [actions, setActions] = useState<RecommendedAction[]>([]);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<RecommendedAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const [error, setError] = useState<string>('');
  const [conversionPreview, setConversionPreview] = useState<JsonObject | null>(null);

  const readonly = !canMutate(role);

  const requestJson = useCallback(async (
    path: string,
    options: RequestInit = {}
  ) => {
    if (!token) {
      throw new Error('No hay sesion activa.');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let json: ApiEnvelope | null = null;

    try {
      json = text ? JSON.parse(text) as ApiEnvelope : null;
    } catch {
      throw new Error(`Respuesta invalida del backend (${response.status}).`);
    }

    if (!json) {
      throw new Error(`Respuesta vacia del backend (${response.status}).`);
    }

    if (!response.ok || json?.ok === false) {
      throw new Error(json?.error || getResponseMessage(response.status, 'No fue posible procesar la solicitud.'));
    }

    return json;
  }, [token]);

  const buildSuggestionQuery = useCallback((nextFilters: Filters) => {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.standard) params.set('standard_code', nextFilters.standard);
    if (nextFilters.priority) params.set('priority', nextFilters.priority);
    if (nextFilters.type) params.set('suggestion_type', nextFilters.type);
    return params.toString();
  }, [tenantId]);

  const loadData = useCallback(async (nextFilters: Filters) => {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const summaryPath = tenantId
        ? `/api/iso-operational-execution/summary?tenant_id=${encodeURIComponent(tenantId)}`
        : '/api/iso-operational-execution/summary';
      const suggestionsQuery = buildSuggestionQuery(nextFilters);
      const suggestionsPath = `/api/iso-operational-execution/suggestions${suggestionsQuery ? `?${suggestionsQuery}` : ''}`;

      const [summaryResponse, suggestionsResponse] = await Promise.all([
        requestJson(summaryPath),
        requestJson(suggestionsPath),
      ]);

      setSummary((summaryResponse.data as RecommendedActionsSummary | undefined) || null);
      setActions(Array.isArray(suggestionsResponse.data) ? suggestionsResponse.data as RecommendedAction[] : []);
    } catch (err: unknown) {
      setError(errorMessage(err, 'No fue posible cargar recomendaciones.'));
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [buildSuggestionQuery, requestJson, tenantId, token]);

  useEffect(() => {
    const validToken = getStoredValidToken();
    const user = getUserFromToken();
    setToken(validToken);
    setTenantId(getTenantIdFromToken());
    setRole(getUserRoleFromToken());

    if (!validToken || !user) {
      setLoading(false);
      setError('No hay una sesion activa. Ingresa nuevamente para ver recomendaciones ISO.');
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadData(INITIAL_FILTERS);
    }
  }, [loadData, token]);

  const filteredActions = useMemo(() => {
    const text = filters.search.trim().toLowerCase();

    return actions.filter((action) => {
      if (filters.source && action.source_module !== filters.source) return false;
      if (!text) return true;

      const haystack = [
        action.title,
        action.description,
        action.rationale,
        action.standard_code,
        action.suggestion_type,
        action.target_record_type,
        action.source_module,
        action.suggested_owner,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(text);
    });
  }, [actions, filters.search, filters.source]);

  const metadata = useMemo(() => {
    const standardSet = new Set<string>();
    const sourceSet = new Set<string>();
    const typeSet = new Set<string>();

    actions.forEach((action) => {
      if (action.standard_code) standardSet.add(action.standard_code);
      if (action.source_module) sourceSet.add(action.source_module);
      if (action.suggestion_type) typeSet.add(action.suggestion_type);
    });

    summary?.by_standard?.forEach((row) => {
      if (row.standard_code) standardSet.add(row.standard_code);
    });

    return {
      standards: Array.from(standardSet).sort(),
      sources: Array.from(sourceSet).sort(),
      types: Array.from(typeSet).sort(),
    };
  }, [actions, summary]);

  const handleFiltersChange = (next: Filters) => {
    setFilters(next);
    loadData(next);
  };

  const handleGenerate = async () => {
    if (readonly) {
      setFeedback({ kind: 'warning', message: 'Tu rol permite revisar, pero no generar recomendaciones.' });
      return;
    }

    const scope = filters.standard ? ` para ${filters.standard}` : '';
    const confirmed = window.confirm(
      `Se ejecutara primero una simulacion y luego podras confirmar la generacion real${scope}. No se crearan planes ni evidencias.`
    );
    if (!confirmed) return;

    try {
      setGenerating(true);
      setFeedback(null);

      const body = {
        tenant_id: tenantId,
        standard_code: filters.standard || undefined,
        dry_run: true,
      };
      const dryRun = await requestJson('/api/iso-operational-execution/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const dryRunData = asJsonObject(dryRun.data);
      const count = Number(dryRunData.generated_count || 0);
      const apply = window.confirm(
        `La simulacion encontro ${count} recomendacion(es). Confirmas guardar sugerencias pendientes?`
      );

      if (!apply) {
        setFeedback({
          kind: 'info',
          message: `Simulacion completada: ${count} recomendacion(es), sin escritura real.`,
        data: dryRun.data,
        });
        return;
      }

      const real = await requestJson('/api/iso-operational-execution/generate', {
        method: 'POST',
        body: JSON.stringify({ ...body, dry_run: false }),
      });

      const realData = asJsonObject(real.data);
      setFeedback({
        kind: 'success',
        message: `Generacion completada: ${Number(realData.inserted_count || 0)} sugerencia(s) nueva(s).`,
        data: real.data,
      });
      await loadData(filters);
    } catch (err: unknown) {
      setFeedback({ kind: 'error', message: errorMessage(err, 'No fue posible generar recomendaciones.') });
    } finally {
      setGenerating(false);
    }
  };

  const handleDryRun = async (action: RecommendedAction) => {
    try {
      setBusyId(action.id);
      const result = await requestJson(`/api/iso-recommended-actions/${action.id}/dry-run-convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          options: {},
        }),
      });
      const resultData = asJsonObject(result.data);
      setSelected(action);
      setConversionPreview(resultData);
      const blocked = Array.isArray(resultData.blocked_reasons)
        ? resultData.blocked_reasons.filter(Boolean).join(' | ')
        : '';
      setFeedback({
        kind: resultData.can_convert === false ? 'warning' : 'info',
        message: resultData.can_convert === false
          ? `Conversion bloqueada: ${blocked || 'requiere revision manual.'}`
          : `Dry-run OK: se podria crear ${targetLabel(String(resultData.target_type || action.target_record_type))}.`,
        data: result.data,
      });
    } catch (err: unknown) {
      setFeedback({ kind: 'error', message: errorMessage(err, 'No fue posible simular la conversion.') });
    } finally {
      setBusyId(null);
    }
  };

  const handleConvert = async (action: RecommendedAction) => {
    try {
      setBusyId(action.id);
      const dryRun = await requestJson(`/api/iso-recommended-actions/${action.id}/dry-run-convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          options: {},
        }),
      });

      const dryRunData = asJsonObject(dryRun.data);
      setSelected(action);
      setConversionPreview(dryRunData);
      if (dryRunData.can_convert === false) {
        const blocked = Array.isArray(dryRunData.blocked_reasons)
          ? dryRunData.blocked_reasons.filter(Boolean).join(' | ')
          : '';
        setFeedback({
          kind: 'warning',
          message: `Conversion bloqueada: ${blocked || 'requiere revision manual.'}`,
          data: dryRun.data,
        });
        return;
      }

      const confirmed = window.confirm(
        `El backend puede crear ${targetLabel(String(dryRunData.target_type || action.target_record_type))} desde esta sugerencia. Confirmas la conversion real?`
      );
      if (!confirmed) {
        setFeedback({
          kind: 'info',
          message: 'Conversion cancelada despues del dry-run. No se escribieron datos operativos.',
          data: dryRun.data,
        });
        return;
      }

      const result = await requestJson(`/api/iso-recommended-actions/${action.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          target_type: action.target_record_type,
          confirmed: true,
          options: {},
        }),
      });

      setFeedback({
        kind: 'success',
        message: 'Sugerencia convertida correctamente.',
        data: result.data,
      });
      setSelected(null);
      setConversionPreview(null);
      await loadData(filters);
    } catch (err: unknown) {
      setFeedback({ kind: 'error', message: errorMessage(err, 'No fue posible convertir la sugerencia.') });
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (action: RecommendedAction) => {
    const reason = window.prompt('Motivo opcional para descartar la sugerencia:') || '';
    const confirmed = window.confirm('Confirmas descartar esta sugerencia?');
    if (!confirmed) return;

    try {
      setBusyId(action.id);
      const result = await requestJson(`/api/iso-operational-execution/${action.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: tenantId,
          rejection_comment: reason || undefined,
        }),
      });

      setFeedback({
        kind: 'success',
        message: 'Sugerencia descartada correctamente.',
        data: result.data,
      });
      setSelected(null);
      setConversionPreview(null);
      await loadData(filters);
    } catch (err: unknown) {
      setFeedback({ kind: 'error', message: errorMessage(err, 'No fue posible descartar la sugerencia.') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-gray-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Inteligencia ISO operativa
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-950">
                Acciones Recomendadas ISO
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Convierte diagnosticos, riesgos, documentos y controles ISO en trabajo operativo gestionable, con revision humana antes de crear registros.
              </p>
            </div>
            <div className="flex flex-nowrap gap-2 overflow-x-auto lg:justify-end">
              <button
                type="button"
                onClick={() => loadData(filters)}
                className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-gray-50"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={readonly || generating || !token}
                className="inline-flex items-center justify-center rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap hover:bg-blue-800 disabled:opacity-45"
              >
                {generating ? 'Generando...' : 'Generar recomendaciones'}
              </button>
            </div>
          </div>
        </section>

        {feedback && (
          <div
            className={[
              'rounded-lg border px-4 py-3 text-sm',
              feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : '',
              feedback.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : '',
              feedback.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : '',
              feedback.kind === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800' : '',
            ].join(' ')}
          >
            {feedback.message}
          </div>
        )}

        <RecommendedActionStats summary={summary} />

        <RecommendedActionFilters
          filters={filters}
          standards={metadata.standards}
          sources={metadata.sources}
          types={metadata.types}
          onChange={handleFiltersChange}
          onRefresh={() => loadData(filters)}
        />

        {summary?.by_standard && summary.by_standard.length > 0 && (
          <section className="grid gap-4 lg:grid-cols-3">
            {summary.by_standard.map((row) => (
              <div key={row.standard_code || 'sin-norma'} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">{row.standard_code || 'Sin norma'}</div>
                    <div className="mt-1 text-xs text-gray-500">{Number(row.total_suggestions || 0)} recomendaciones</div>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                    {Number(row.pending_count || 0)} pendientes
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  <div className="rounded bg-red-50 p-2 text-red-700">
                    <div className="font-bold">{Number(row.critical_count || 0)}</div>
                    Crit.
                  </div>
                  <div className="rounded bg-orange-50 p-2 text-orange-700">
                    <div className="font-bold">{Number(row.high_count || 0)}</div>
                    Altas
                  </div>
                  <div className="rounded bg-emerald-50 p-2 text-emerald-700">
                    <div className="font-bold">{Number(row.approved_count || 0)}</div>
                    Conv.
                  </div>
                  <div className="rounded bg-gray-100 p-2 text-gray-700">
                    <div className="font-bold">{Number(row.rejected_count || 0)}</div>
                    Desc.
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {loading && (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-36 animate-pulse rounded-lg border border-gray-200 bg-white" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                {error}
              </div>
            )}

            {!loading && !error && filteredActions.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <div className="text-lg font-semibold text-gray-950">Sin recomendaciones para estos filtros</div>
                <p className="mt-2 text-sm text-gray-600">
                  Ajusta filtros o ejecuta una generacion segura. La pantalla no crea planes, evidencias ni hallazgos al cargar.
                </p>
              </div>
            )}

            {!loading && !error && filteredActions.map((action) => (
              <RecommendedActionCard
                key={action.id}
                action={action}
                selected={selected?.id === action.id}
                readonly={readonly}
                busy={busyId === action.id}
                onSelect={setSelected}
                onAccept={handleDryRun}
                onConvert={handleConvert}
                onDismiss={handleDismiss}
              />
            ))}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-950">Lectura ejecutiva</h2>
              <p className="mt-2 text-sm text-gray-600">
                Las sugerencias se mantienen como pendientes hasta que un usuario autorizado las convierta. Aceptar ejecuta solo una simulacion; Crear tarea confirma la escritura operativa.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-950">Tipos principales</h2>
              <div className="mt-3 space-y-2">
                {(summary?.by_type || []).slice(0, 8).map((row) => (
                  <div key={`${row.suggestion_type}-${row.target_record_type}-${row.status}`} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-xs">
                    <span className="text-gray-700">
                      {label(row.suggestion_type)} · {targetLabel(row.target_record_type)}
                    </span>
                    <span className="font-semibold text-gray-950">{row.count}</span>
                  </div>
                ))}
                {(!summary?.by_type || summary.by_type.length === 0) && (
                  <div className="text-sm text-gray-500">Aun no hay desglose por tipo.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-950">Origenes detectados</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {metadata.sources.length > 0 ? metadata.sources.map((source) => (
                  <span key={source} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                    {sourceLabel(source)}
                  </span>
                )) : (
                  <span className="text-sm text-gray-500">Sin origenes disponibles.</span>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      <RecommendedActionDetailModal
        action={selected}
        conversionPreview={conversionPreview}
        readonly={readonly}
        busy={Boolean(selected && busyId === selected.id)}
        onClose={() => {
          setSelected(null);
          setConversionPreview(null);
        }}
        onAccept={handleDryRun}
        onConvert={handleConvert}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
