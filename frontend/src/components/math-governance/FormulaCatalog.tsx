'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  ApiClientError,
  apiRequestJson,
  getActiveTenantId,
} from '@/utils/apiClient';
import { getUserRoleFromToken } from '@/utils/auth';

type UnknownRecord = Record<string, unknown>;

type CatalogItem = {
  result_code: string;
  analytical_result_code: string;
  display_name: string;
  domain: string;
  formula_code: string;
  formula_version: number;
  unit: string;
  source_status: string;
  trust_status: string;
  latest_calculation_run: string;
  latest_snapshot: string;
};

type RecalculationResult = {
  formula_code: string;
  display_name: string;
  domain: string;
  status: 'calculated' | 'unmeasured' | 'source_unavailable' | 'not_applicable' | 'failed';
  source_code: string;
  physical_sources: string[];
  source_counts: { received: number; usable: number; excluded: number };
  value: number | null;
  unit: string;
  calculation_run_id: string;
  snapshot_id: string;
  warnings: string[];
  error: string;
};

type RecalculationPayload = {
  status: string;
  period: { start: string | null; end: string | null; timezone: string };
  summary: Record<string, number>;
  results: RecalculationResult[];
};

type EvidenceKind = 'explanation' | 'lineage';

type EvidenceDialog = {
  kind: EvidenceKind;
  runId: string;
  formulaName: string;
  data: UnknownRecord | null;
};

const PLATFORM_ROLES = new Set([
  'superadmin',
  'super_admin',
  'platform_admin',
  'admin_global',
  'global_admin',
  'owner',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

function objectId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  return stringValue(value.run_id || value.id || value.calculation_run_id || value.snapshot_id);
}

function unwrapData(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}

function normalizeCatalog(payload: unknown): CatalogItem[] {
  const data = unwrapData(payload);
  if (!Array.isArray(data)) return [];

  return data.filter(isRecord).map((item) => ({
    result_code: stringValue(item.result_code),
    analytical_result_code: stringValue(item.analytical_result_code),
    display_name: stringValue(item.display_name),
    domain: stringValue(item.domain, 'general'),
    formula_code: stringValue(item.formula_code),
    formula_version: numberValue(item.formula_version, 1),
    unit: stringValue(item.unit, 'sin unidad'),
    source_status: stringValue(item.source_status, 'unknown'),
    trust_status: stringValue(item.trust_status, 'unknown'),
    latest_calculation_run: objectId(item.latest_calculation_run),
    latest_snapshot: objectId(item.latest_snapshot),
  }));
}

function normalizeRecalculation(payload: unknown): RecalculationPayload | null {
  const data = unwrapData(payload);
  if (!isRecord(data)) return null;
  const rawSummary = isRecord(data.summary) ? data.summary : {};
  const rawPeriod = isRecord(data.period) ? data.period : {};
  const rawResults = Array.isArray(data.results) ? data.results : [];

  return {
    status: stringValue(data.status, 'completed'),
    period: {
      start: stringValue(rawPeriod.start) || null,
      end: stringValue(rawPeriod.end) || null,
      timezone: stringValue(rawPeriod.timezone, 'America/Santiago'),
    },
    summary: Object.fromEntries(
      Object.entries(rawSummary).map(([key, value]) => [key, numberValue(value)])
    ),
    results: rawResults.filter(isRecord).map((item) => {
      const status = stringValue(item.status, 'failed') as RecalculationResult['status'];
      const counts = isRecord(item.source_counts) ? item.source_counts : {};
      return {
        formula_code: stringValue(item.formula_code),
        display_name: stringValue(item.display_name),
        domain: stringValue(item.domain, 'general'),
        status,
        source_code: stringValue(item.source_code),
        physical_sources: stringArray(item.physical_sources),
        source_counts: {
          received: numberValue(counts.received),
          usable: numberValue(counts.usable),
          excluded: numberValue(counts.excluded),
        },
        value: item.value === null || item.value === undefined ? null : numberValue(item.value),
        unit: stringValue(item.unit),
        calculation_run_id: objectId(item.calculation_run_id),
        snapshot_id: objectId(item.snapshot_id),
        warnings: stringArray(item.warnings),
        error: stringValue(item.error),
      };
    }),
  };
}

function normalizeEvidence(payload: unknown): UnknownRecord {
  const data = unwrapData(payload);
  return isRecord(data) ? data : { value: data };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function statusLabel(value?: string) {
  const labels: Record<string, string> = {
    available: 'Disponible',
    trusted: 'Confiable',
    source_unavailable: 'Sin fuente',
    calculated: 'Calculada',
    unmeasured: 'Sin medición',
    not_applicable: 'No aplicable',
    failed: 'Error',
    unknown: 'Pendiente',
  };
  return labels[String(value || 'unknown')] || String(value || 'Pendiente');
}

function statusTone(value?: string) {
  const status = String(value || '').toLowerCase();
  if (['available', 'trusted', 'calculated'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-950';
  if (['unmeasured', 'source_unavailable', 'not_applicable'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-950';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function evidenceTitle(kind: EvidenceKind) {
  return kind === 'explanation' ? 'Explicación del cálculo' : 'Lineage del cálculo';
}

function DisplayValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span>—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sí' : 'No'}</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span>{String(value)}</span>;
  return <span>{JSON.stringify(value)}</span>;
}

function ExplanationEvidence({ data }: { data: UnknownRecord }) {
  const variables = isRecord(data.variables) ? data.variables : {};
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const rows = [
    ['Estado de evidencia', data.status],
    ['Explicación', data.explanation],
    ['Tipo de explicación', data.explanation_type],
    ['Fórmula', data.formula_code],
    ['Estado de ejecución', data.run_status],
    ['Inicio', data.started_at],
    ['Término', data.completed_at],
    ['Paquete matemático', metadata.package],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={String(label)} className="rounded-md border border-[var(--tcdx-color-border)] bg-slate-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-text-secondary)]">{label}</dt>
            <dd className="mt-1 break-words text-sm text-[var(--tcdx-color-text-ink)]"><DisplayValue value={value} /></dd>
          </div>
        ))}
      </dl>
      <section>
        <h4 className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Variables utilizadas</h4>
        {Object.keys(variables).length ? (
          <div className="mt-2 overflow-x-auto rounded-md border border-[var(--tcdx-color-border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Variable</th><th className="px-3 py-2 text-left">Valor</th></tr></thead>
              <tbody>{Object.entries(variables).map(([key, value]) => <tr key={key} className="border-t"><td className="px-3 py-2 font-semibold">{key}</td><td className="px-3 py-2"><DisplayValue value={value} /></td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="mt-2 text-sm text-[var(--tcdx-color-text-secondary)]">La ejecución no reportó variables visibles.</p>}
      </section>
    </div>
  );
}

function LineageEvidence({ data }: { data: UnknownRecord }) {
  const lineage = Array.isArray(data.lineage) ? data.lineage.filter(isRecord) : [];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[var(--tcdx-color-border)] bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-[var(--tcdx-color-text-secondary)]">Estado</div><div className="mt-1 text-sm"><DisplayValue value={data.status} /></div></div>
        <div className="rounded-md border border-[var(--tcdx-color-border)] bg-slate-50 p-3"><div className="text-xs font-semibold uppercase text-[var(--tcdx-color-text-secondary)]">Ejecución</div><div className="mt-1 break-all text-sm"><DisplayValue value={data.calculation_run_id} /></div></div>
      </div>
      {lineage.length ? (
        <div className="overflow-x-auto rounded-md border border-[var(--tcdx-color-border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Fuente física</th><th className="px-3 py-2 text-left">Source contract</th><th className="px-3 py-2 text-left">Registro fuente</th><th className="px-3 py-2 text-left">Versión fórmula</th><th className="px-3 py-2 text-left">Snapshot</th></tr></thead>
            <tbody>{lineage.map((row, index) => <tr key={`${stringValue(row.source_record)}-${index}`} className="border-t"><td className="px-3 py-2 font-semibold">{stringValue(row.physical_source, '—')}</td><td className="px-3 py-2">{stringValue(row.source_contract, '—')}</td><td className="px-3 py-2 break-all">{stringValue(row.source_record, '—')}</td><td className="px-3 py-2">{stringValue(row.formula_version, '—')}</td><td className="px-3 py-2 break-all">{stringValue(row.dataset_snapshot, '—')}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="text-sm text-[var(--tcdx-color-text-secondary)]">La ejecución no contiene registros de lineage visibles.</p>}
    </div>
  );
}

export default function FormulaCatalog() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const role = getUserRoleFromToken();
  const isPlatform = PLATFORM_ROLES.has(role);
  const tenantReady = !isPlatform || Boolean(getActiveTenantId());
  const { loading: entitlementsLoading, entitlements } = useTenantEntitlements();
  const engineDecision = entitlements.capabilities['metrics.engine'];
  const engineAllowed = !engineDecision || (engineDecision.enabled === true && engineDecision.read_only !== true);

  const [start, setStart] = useState(isoDate(yearStart));
  const [end, setEnd] = useState(isoDate(now));
  const [domain, setDomain] = useState('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [lastRun, setLastRun] = useState<RecalculationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceDialog | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequestJson('/api/grc/official/analytics/catalog', {
        fallbackMessage: 'No fue posible cargar las fórmulas oficiales.',
      });
      setCatalog(normalizeCatalog(payload));
    } catch (err) {
      setCatalog([]);
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar las fórmulas oficiales.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantReady) void loadCatalog();
    else {
      setCatalog([]);
      setLoading(false);
      setError('Selecciona una empresa para cargar el catálogo y habilitar el recálculo.');
    }
  }, [loadCatalog, tenantReady]);

  const domains = useMemo(() => Array.from(new Set(catalog.map((item) => item.domain).filter(Boolean))).sort(), [catalog]);
  const visible = useMemo(() => domain ? catalog.filter((item) => item.domain === domain) : catalog, [catalog, domain]);
  const runMap = useMemo(() => new Map((lastRun?.results || []).map((item) => [item.formula_code, item])), [lastRun]);

  async function recalculate() {
    if (!tenantReady) {
      setError('Selecciona una empresa antes de recalcular.');
      return;
    }
    if (!engineAllowed) {
      setError('La capacidad metrics.engine no está habilitada para esta empresa o está en modo solo lectura.');
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const response = await apiRequestJson('/api/grc/official/recalculate', {
        method: 'POST',
        body: JSON.stringify({
          domain: domain || undefined,
          period: {
            start: start ? `${start}T00:00:00.000Z` : null,
            end: end ? `${end}T23:59:59.999Z` : null,
            timezone: 'America/Santiago',
          },
        }),
        fallbackMessage: 'No fue posible recalcular las fórmulas con los datos existentes.',
      });
      const normalized = normalizeRecalculation(response);
      if (!normalized) throw new Error('El backend no devolvió un resumen válido de recálculo.');
      setLastRun(normalized);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible recalcular las fórmulas.');
    } finally {
      setRunning(false);
    }
  }

  async function openEvidence(kind: EvidenceKind, runId: string, formulaName: string) {
    setEvidence({ kind, runId, formulaName, data: null });
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const payload = await apiRequestJson(`/api/grc/official/calculations/${runId}/${kind}`, {
        fallbackMessage: `No fue posible cargar ${kind === 'explanation' ? 'la explicación' : 'el lineage'} del cálculo.`,
      });
      setEvidence({ kind, runId, formulaName, data: normalizeEvidence(payload) });
    } catch (err) {
      setEvidenceError(err instanceof ApiClientError || err instanceof Error ? err.message : 'No fue posible cargar la evidencia del cálculo.');
    } finally {
      setEvidenceLoading(false);
    }
  }

  function closeEvidence() {
    setEvidence(null);
    setEvidenceError(null);
    setEvidenceLoading(false);
  }

  const recalculateDisabled = running || loading || entitlementsLoading || !tenantReady || !engineAllowed;
  const recalculateReason = !tenantReady
    ? 'Selecciona una empresa para habilitar el recálculo.'
    : !engineAllowed
      ? 'La capacidad metrics.engine no está habilitada o es de solo lectura.'
      : '';

  return (
    <section id="catalogo-formulas" className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Capa matemática oficial</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--tcdx-color-text-ink)]">Catálogo de fórmulas y recálculo</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">
          Las fórmulas leen únicamente los datos operacionales del tenant activo. El recálculo genera resultados, snapshots, explicación y lineage trazables.
        </p>
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-[var(--tcdx-color-border)] bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Desde<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Hasta<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-[var(--tcdx-color-text-ink)]">Dominio<select value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-1 block min-h-10 w-full rounded-md border border-[var(--tcdx-color-border)] bg-white px-3 font-normal"><option value="">Todos los dominios</option>{domains.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" onClick={recalculate} disabled={recalculateDisabled} className="min-h-10 self-end rounded-md bg-[var(--tcdx-color-action-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{running ? 'Calculando…' : 'Recalcular desde datos existentes'}</button>
      </div>

      {recalculateReason && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{recalculateReason}</div>}
      {error && <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</div>}

      {lastRun && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Calculadas', lastRun.summary.calculated || 0], ['Sin medición', lastRun.summary.unmeasured || 0], ['Sin fuente', lastRun.summary.source_unavailable || 0], ['No aplicables', lastRun.summary.not_applicable || 0], ['Errores', lastRun.summary.failed || 0]].map(([label, value]) => <div key={String(label)} className="rounded-md border border-[var(--tcdx-color-border)] bg-white p-3"><div className="text-xs text-[var(--tcdx-color-text-secondary)]">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}</div>}

      {loading ? <div className="mt-5 rounded-md border border-dashed p-4 text-sm">Cargando fórmulas oficiales…</div> : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--tcdx-color-text-secondary)]"><th className="border-b px-3 py-2">Fórmula</th><th className="border-b px-3 py-2">Dominio</th><th className="border-b px-3 py-2">Versión</th><th className="border-b px-3 py-2">Fuente operacional</th><th className="border-b px-3 py-2">Resultado</th><th className="border-b px-3 py-2">Evidencia</th></tr></thead>
            <tbody>{visible.map((item) => {
              const formulaCode = item.formula_code || item.result_code || item.analytical_result_code || 'unknown';
              const result = runMap.get(formulaCode);
              const runId = result?.calculation_run_id || item.latest_calculation_run;
              const formulaName = item.display_name || formulaCode;
              return <tr key={`${formulaCode}-${item.result_code}`}><td className="border-b px-3 py-3"><div className="font-semibold text-[var(--tcdx-color-text-ink)]">{formulaName}</div><div className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{formulaCode}</div></td><td className="border-b px-3 py-3">{item.domain}</td><td className="border-b px-3 py-3">v{item.formula_version} · {item.unit}</td><td className="border-b px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(result?.status === 'calculated' ? 'available' : item.source_status)}`}>{statusLabel(result?.status === 'calculated' ? 'available' : item.source_status)}</span>{result && <div className="mt-2 max-w-xs text-xs text-[var(--tcdx-color-text-secondary)]"><div>{result.physical_sources.length ? result.physical_sources.join(', ') : result.source_code || 'Sin tabla resuelta'}</div><div className="mt-1">Recibidos: {result.source_counts.received} · Usables: {result.source_counts.usable} · Excluidos: {result.source_counts.excluded}</div></div>}</td><td className="border-b px-3 py-3">{result ? <div><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(result.status)}`}>{statusLabel(result.status)}</span>{result.status === 'calculated' && <div className="mt-1 font-semibold">{result.value ?? '—'} {result.unit}</div>}{(result.error || result.warnings[0]) && <div className="mt-1 max-w-sm text-xs text-[var(--tcdx-color-text-secondary)]">{result.error || result.warnings[0]}</div>}</div> : <span className="text-[var(--tcdx-color-text-secondary)]">Pendiente de recálculo</span>}</td><td className="border-b px-3 py-3">{runId ? <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--tcdx-color-primary)]"><button type="button" onClick={() => void openEvidence('explanation', runId, formulaName)} className="rounded-md border border-[var(--tcdx-color-border)] bg-white px-2 py-1 hover:bg-slate-50">Explicación</button><button type="button" onClick={() => void openEvidence('lineage', runId, formulaName)} className="rounded-md border border-[var(--tcdx-color-border)] bg-white px-2 py-1 hover:bg-slate-50">Lineage</button></div> : <span className="text-xs text-[var(--tcdx-color-text-secondary)]">Sin ejecución</span>}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}

      {evidence && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEvidence(); }}><section role="dialog" aria-modal="true" aria-labelledby="formula-evidence-title" className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl border border-[var(--tcdx-color-border)] bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-[var(--tcdx-color-border)] p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--tcdx-color-primary)]">Evidencia autenticada</p><h3 id="formula-evidence-title" className="mt-1 text-xl font-semibold text-[var(--tcdx-color-text-ink)]">{evidenceTitle(evidence.kind)}</h3><p className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">{evidence.formulaName} · ejecución {evidence.runId}</p></div><button type="button" onClick={closeEvidence} className="rounded-md border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-semibold">Cerrar</button></header><div className="max-h-[calc(90vh-108px)] overflow-auto p-4">{evidenceLoading && <div className="rounded-md border border-dashed p-4 text-sm">Cargando evidencia…</div>}{evidenceError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950">{evidenceError}</div>}{!evidenceLoading && !evidenceError && evidence.data && (evidence.kind === 'explanation' ? <ExplanationEvidence data={evidence.data} /> : <LineageEvidence data={evidence.data} />)}</div></section></div>}
    </section>
  );
}
