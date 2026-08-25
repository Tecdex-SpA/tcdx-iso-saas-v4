'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  EnterpriseBadge,
  EnterpriseButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
} from '@/components/ui/enterprise';
import RiskControlWorkspaceShell from '@/components/risk-control/RiskControlWorkspaceShell';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequestJson, resolveEffectiveTenantContext } from '@/utils/apiClient';
import { phase3Request, type Phase3Record } from '@/components/phase3/phase3Api';

type UnknownRecord = Record<string, unknown>;

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  count?: number;
};

type ScopeStandard = {
  code: string;
  name?: string;
  is_active?: boolean | string | number;
  active_operations_count?: number | string;
  active_operation_ids?: string[];
};

type ScopeResponse = {
  operations?: { id?: string; name?: string; code?: string | null; is_active?: boolean }[];
  standards?: ScopeStandard[];
};

type IsoRiskMatrixOption = {
  standard_code: string;
  version_code: string;
  display_name?: string;
  recommended?: boolean;
  latest_run_id?: string | null;
};

type IsoRiskMatrixRun = {
  id?: string;
  run_id?: string;
  standard_code?: string;
  version_code?: string;
  risk_posture?: string;
};

type IsoRiskMatrixItem = {
  id?: string;
  run_id?: string | null;
  risk_code?: string | null;
  risk_title?: string | null;
  risk_description?: string | null;
  risk_category?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  asset_criticality?: string | null;
  likelihood?: number | string | null;
  impact?: number | string | null;
  inherent_risk_score?: number | string | null;
  inherent_risk_level?: string | null;
  residual_likelihood?: number | string | null;
  residual_impact?: number | string | null;
  residual_risk_score?: number | string | null;
  residual_risk_level?: string | null;
  treatment_strategy?: string | null;
  status?: string | null;
  confidence?: number | string | null;
};

type AssetRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  iso?: string | null;
  criticality?: string | null;
  owner?: string | null;
  related_standards?: string[];
  created_at?: string | null;
};

type AssetRiskRow = {
  id: string;
  asset_id?: string | null;
  risk?: string | null;
  impact?: string | null;
  probability?: string | null;
  level?: string | null;
};

type RiskSourceState = 'loaded' | 'empty' | 'unavailable' | 'error';
type RiskDataState = 'measured' | 'zero' | 'no_data' | 'insufficient' | 'not_calculable' | 'unavailable' | 'error';
type RiskSourceType = 'iso_matrix' | 'asset_risk' | 'quantitative';
type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

type SourceStatus = {
  state: RiskSourceState;
  message?: string;
};

type RiskRegisterRow = {
  stableKey: string;
  sourceType: RiskSourceType;
  id: string;
  displayId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  level: RiskLevel;
  levelLabel: string;
  status?: string | null;
  owner?: string | null;
  assetName?: string | null;
  assetId?: string | null;
  standard?: string | null;
  date?: string | null;
  inherentScore?: number | null;
  residualScore?: number | null;
  likelihood?: number | null;
  impact?: number | null;
  treatment?: string | null;
  confidence?: number | null;
  sourceLabelKey: string;
  sourceState: RiskDataState;
  raw: UnknownRecord;
};

type SortKey = 'displayId' | 'title' | 'level' | 'status' | 'owner' | 'sourceType';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 20;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapData<T>(value: unknown, fallback: T): T {
  if (isRecord(value) && 'data' in value) return (value as ApiEnvelope<T>).data ?? fallback;
  return (value as T) ?? fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLevel(value: unknown): RiskLevel {
  const text = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['critico', 'critical'].includes(text)) return 'critical';
  if (['alto', 'alta', 'high'].includes(text)) return 'high';
  if (['medio', 'media', 'medium'].includes(text)) return 'medium';
  if (['bajo', 'baja', 'low'].includes(text)) return 'low';
  return 'unknown';
}

function levelRank(level: RiskLevel) {
  return { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 }[level];
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function localStatus(value?: string | null, locale = 'es') {
  if (!value) return locale === 'en' ? 'Unavailable' : 'No disponible';
  const normalized = String(value).toLowerCase();
  const es: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    pendiente: 'Pendiente',
    reviewed: 'Revisado',
    revisado: 'Revisado',
    approved: 'Aprobado',
    aprobado: 'Aprobado',
    active: 'Activo',
    activo: 'Activo',
    open: 'Abierto',
    abierto: 'Abierto',
    closed: 'Cerrado',
    cerrado: 'Cerrado',
    mitigated: 'Mitigado',
    mitigado: 'Mitigado',
  };
  const en: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    reviewed: 'Reviewed',
    approved: 'Approved',
    active: 'Active',
    open: 'Open',
    closed: 'Closed',
    mitigated: 'Mitigated',
  };
  return (locale === 'en' ? en : es)[normalized] || String(value).replaceAll('_', ' ');
}

function dataStateLabel(state: RiskDataState, locale: string) {
  const en = locale === 'en';
  const labels: Record<RiskDataState, string> = {
    measured: en ? 'Measured' : 'Con medición',
    zero: en ? 'Real zero' : 'Cero real',
    no_data: en ? 'No data' : 'Sin datos',
    insufficient: en ? 'Insufficient data' : 'Dato insuficiente',
    not_calculable: en ? 'Not calculable' : 'No calculable',
    unavailable: en ? 'Unavailable' : 'No disponible',
    error: en ? 'Error' : 'Error',
  };
  return labels[state];
}

function levelLabel(level: RiskLevel, locale: string) {
  const en = locale === 'en';
  const labels: Record<RiskLevel, string> = {
    critical: en ? 'Critical' : 'Crítico',
    high: en ? 'High' : 'Alto',
    medium: en ? 'Medium' : 'Medio',
    low: en ? 'Low' : 'Bajo',
    unknown: en ? 'Unavailable' : 'No disponible',
  };
  return labels[level];
}

function levelTone(level: RiskLevel) {
  if (level === 'critical' || level === 'high') return 'danger';
  if (level === 'medium') return 'warning';
  if (level === 'low') return 'success';
  return 'neutral';
}

function sourceStateFromScores(row: {
  inherentScore?: number | null;
  residualScore?: number | null;
  level: RiskLevel;
  confidence?: number | null;
}): RiskDataState {
  if (row.confidence !== null && row.confidence !== undefined && row.confidence < 0.45) return 'insufficient';
  if (row.inherentScore === 0 || row.residualScore === 0) return 'zero';
  if (row.inherentScore !== null || row.residualScore !== null || row.level !== 'unknown') return 'measured';
  return 'unavailable';
}

function normalizeMatrixRows(items: IsoRiskMatrixItem[], run: IsoRiskMatrixRun | null, locale: string): RiskRegisterRow[] {
  return items
    .filter((item): item is IsoRiskMatrixItem & { id: string } => typeof item.id === 'string' && item.id.length > 0)
    .map((item) => {
      const inherentScore = toNumberOrNull(item.inherent_risk_score);
      const residualScore = toNumberOrNull(item.residual_risk_score);
      const level = normalizeLevel(item.residual_risk_level || item.inherent_risk_level);
      const confidence = toNumberOrNull(item.confidence);
      const title = item.risk_title || item.risk_code || item.id;
      const row = {
        stableKey: `iso_matrix:${item.id}`,
        sourceType: 'iso_matrix' as const,
        id: item.id,
        displayId: item.risk_code || shortId(item.id),
        title,
        description: item.risk_description,
        category: item.risk_category,
        level,
        levelLabel: levelLabel(level, locale),
        status: item.status,
        assetName: item.asset_name,
        standard: run?.standard_code || undefined,
        inherentScore,
        residualScore,
        likelihood: toNumberOrNull(item.likelihood),
        impact: toNumberOrNull(item.impact),
        treatment: item.treatment_strategy,
        confidence,
        sourceLabelKey: 'riskControlWorkspace.sources.isoMatrix',
        sourceState: 'unavailable' as RiskDataState,
        raw: item as UnknownRecord,
      };
      return { ...row, sourceState: sourceStateFromScores(row) };
    });
}

function normalizeAssetRiskRows(assetRisks: { asset: AssetRow; risks: AssetRiskRow[] }[], locale: string): RiskRegisterRow[] {
  return assetRisks.flatMap(({ asset, risks }) =>
    risks
      .filter((risk): risk is AssetRiskRow & { id: string } => typeof risk.id === 'string' && risk.id.length > 0)
      .map((risk) => {
        const level = normalizeLevel(risk.level);
        const scoreKnown = risk.impact || risk.probability || risk.level;
        return {
          stableKey: `asset_risk:${risk.id}`,
          sourceType: 'asset_risk',
          id: risk.id,
          displayId: shortId(risk.id),
          title: risk.risk || risk.id,
          description: risk.risk,
          category: asset.type,
          level,
          levelLabel: levelLabel(level, locale),
          status: asset.criticality,
          owner: asset.owner,
          assetName: asset.name,
          assetId: asset.id,
          standard: asset.iso || asset.related_standards?.[0] || null,
          likelihood: toNumberOrNull(risk.probability),
          impact: toNumberOrNull(risk.impact),
          sourceLabelKey: 'riskControlWorkspace.sources.assetRisk',
          sourceState: scoreKnown ? 'measured' : 'unavailable',
          raw: { ...risk, asset } as UnknownRecord,
        } satisfies RiskRegisterRow;
      })
  );
}

function normalizeQuantitativeRows(records: Phase3Record[], locale: string): RiskRegisterRow[] {
  return records
    .filter((record) => typeof record.id === 'string' && record.id.length > 0)
    .map((record) => {
      const annualizedLoss = toNumberOrNull(record.annualized_loss);
      const expectedImpact = toNumberOrNull(record.expected_impact);
      const hasMeasurement = annualizedLoss !== null || expectedImpact !== null;
      return {
        stableKey: `quantitative:${record.id}`,
        sourceType: 'quantitative',
        id: record.id,
        displayId: record.code || shortId(record.id),
        title: String(record.scenario || record.title || record.name || record.code || record.id),
        description: typeof record.assumptions === 'string' ? record.assumptions : null,
        category: 'quantitative',
        level: 'unknown',
        levelLabel: levelLabel('unknown', locale),
        status: record.status || record.lifecycle_status,
        owner: typeof record.owner_user_id === 'string' ? record.owner_user_id : null,
        assetName: null,
        standard: null,
        date: typeof record.updated_at === 'string' ? record.updated_at : record.created_at,
        inherentScore: expectedImpact,
        residualScore: annualizedLoss,
        sourceLabelKey: 'riskControlWorkspace.sources.quantitative',
        sourceState: hasMeasurement ? (annualizedLoss === 0 || expectedImpact === 0 ? 'zero' : 'measured') : 'unavailable',
        raw: record,
      } satisfies RiskRegisterRow;
    });
}

function uniqueSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function sortRows(rows: RiskRegisterRow[], key: SortKey, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'level') return (levelRank(a.level) - levelRank(b.level)) * multiplier;
    const left = String(a[key] || '').toLowerCase();
    const right = String(b[key] || '').toLowerCase();
    return left.localeCompare(right) * multiplier;
  });
}

function SourceSummary({
  statuses,
}: {
  statuses: Record<RiskSourceType, SourceStatus>;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {(Object.keys(statuses) as RiskSourceType[]).map((source) => {
        const state = statuses[source];
        const tone = state.state === 'error' ? 'danger' : state.state === 'loaded' ? 'success' : 'neutral';
        return (
          <div key={source} className="rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[var(--tcdx-color-text-secondary)]">{t(`riskControlWorkspace.sources.${source === 'iso_matrix' ? 'isoMatrix' : source === 'asset_risk' ? 'assetRisk' : 'quantitative'}`)}</span>
              <EnterpriseBadge tone={tone}>{t(`riskControlWorkspace.sourceStates.${state.state}`)}</EnterpriseBadge>
            </div>
            {state.message && <p className="mt-2 text-xs text-[var(--tcdx-color-text-secondary)]">{state.message}</p>}
          </div>
        );
      })}
    </div>
  );
}

function RiskDetailDrawer({
  row,
  onClose,
  locale,
}: {
  row: RiskRegisterRow;
  onClose: () => void;
  locale: string;
}) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const container = document.getElementById('risk-detail-drawer');
      const focusable = Array.from(
        container?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) || []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [onClose]);

  const rows = [
    [t('riskControlWorkspace.detail.identifier'), row.displayId],
    [t('riskControlWorkspace.detail.source'), t(row.sourceLabelKey)],
    [t('riskControlWorkspace.detail.classification'), row.category || dataStateLabel('unavailable', locale)],
    [t('riskControlWorkspace.detail.status'), localStatus(row.status, locale)],
    [t('riskControlWorkspace.detail.owner'), row.owner || dataStateLabel('unavailable', locale)],
    [t('riskControlWorkspace.detail.asset'), row.assetName || dataStateLabel('unavailable', locale)],
    [t('riskControlWorkspace.detail.inherent'), row.inherentScore === null || row.inherentScore === undefined ? dataStateLabel('unavailable', locale) : row.inherentScore],
    [t('riskControlWorkspace.detail.residual'), row.residualScore === null || row.residualScore === undefined ? dataStateLabel('unavailable', locale) : row.residualScore],
    [t('riskControlWorkspace.detail.trust'), dataStateLabel(row.sourceState, locale)],
  ];

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label={t('riskControlWorkspace.detail.closeOverlay')}
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />
      <aside
        id="risk-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-detail-title"
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[var(--tcdx-radius-tecdex-lg)] bg-white p-5 shadow-2xl focus:outline-none md:inset-x-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[460px] md:rounded-none md:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tcdx-color-primary)]">
              {t('riskControlWorkspace.detail.eyebrow')}
            </p>
            <h2 id="risk-detail-title" className="mt-2 text-xl font-black text-[var(--tcdx-color-text-ink)]">
              {row.title}
            </h2>
            <p className="mt-1 text-xs text-[var(--tcdx-color-text-secondary)]">{row.stableKey}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
          >
            {t('riskControlWorkspace.detail.close')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <EnterpriseBadge tone={levelTone(row.level)}>{row.levelLabel}</EnterpriseBadge>
          <EnterpriseBadge tone="neutral">{dataStateLabel(row.sourceState, locale)}</EnterpriseBadge>
        </div>

        <section className="mt-5 space-y-3" aria-label={t('riskControlWorkspace.detail.summary')}>
          {rows.map(([label, value]) => (
            <div key={String(label)} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-b border-[var(--tcdx-color-border)] pb-2 text-sm">
              <dt className="font-bold text-[var(--tcdx-color-text-secondary)]">{label}</dt>
              <dd className="min-w-0 break-words text-[var(--tcdx-color-text-ink)]">{value}</dd>
            </div>
          ))}
        </section>

        {row.description && (
          <section className="mt-5 rounded-[var(--tcdx-radius-tecdex-md)] bg-[var(--tcdx-color-surface-muted)] p-4">
            <h3 className="text-sm font-black text-[var(--tcdx-color-text-ink)]">{t('riskControlWorkspace.detail.description')}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">{row.description}</p>
          </section>
        )}

        <section className="mt-5 rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] p-4">
          <h3 className="text-sm font-black text-[var(--tcdx-color-text-ink)]">{t('riskControlWorkspace.detail.aiTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">
            {row.sourceType === 'quantitative'
              ? t('riskControlWorkspace.detail.aiQuantitative')
              : t('riskControlWorkspace.detail.aiUnavailable')}
          </p>
        </section>

        {row.sourceType === 'quantitative' && (
          <Link
            href={`/riesgo-cuantitativo/${encodeURIComponent(row.id)}`}
            className="mt-5 inline-flex min-h-11 items-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
          >
            {t('riskControlWorkspace.detail.openQuantitative')}
          </Link>
        )}
      </aside>
    </div>
  );
}

export default function RiskRegisterWorkspace() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<RiskRegisterRow[]>([]);
  const [statuses, setStatuses] = useState<Record<RiskSourceType, SourceStatus>>({
    iso_matrix: { state: 'unavailable' },
    asset_risk: { state: 'unavailable' },
    quantitative: { state: 'unavailable' },
  });
  const [matrixOptions, setMatrixOptions] = useState<IsoRiskMatrixOption[]>([]);
  const [selectedRow, setSelectedRow] = useState<RiskRegisterRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = searchParams.get('q') || '';
  const source = searchParams.get('source') || 'all';
  const level = searchParams.get('level') || 'all';
  const status = searchParams.get('status') || 'all';
  const owner = searchParams.get('owner') || 'all';
  const standard = searchParams.get('standard') || '';
  const sort = (searchParams.get('sort') as SortKey) || 'level';
  const direction = (searchParams.get('direction') as SortDirection) || 'desc';
  const parsedPage = Number(searchParams.get('page') ?? '1');
  const page = Math.max(1, Number.isFinite(parsedPage) ? parsedPage : 1);

  const updateQuery = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (!value || value === 'all' || (key === 'page' && value === '1')) params.delete(key);
        else params.set(key, value);
      });
      router.replace(`/riesgos?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const nextRows: RiskRegisterRow[] = [];
    const nextStatuses: Record<RiskSourceType, SourceStatus> = {
      iso_matrix: { state: 'unavailable' },
      asset_risk: { state: 'unavailable' },
      quantitative: { state: 'unavailable' },
    };

    try {
      const { tenantId } = resolveEffectiveTenantContext();
      if (!tenantId) {
        throw new Error(t('riskControlWorkspace.errors.invalidTenant'));
      }

      const scopePayload = await apiRequestJson<ApiEnvelope<ScopeResponse>>(`/api/tenant-standards/scope/${encodeURIComponent(tenantId)}`, {
        fallbackMessage: t('riskControlWorkspace.errors.scope'),
        locale,
      });
      const scope = unwrapData<ScopeResponse>(scopePayload, {});
      const operationalStandards = asArray<ScopeStandard>(scope.standards).filter((item) => {
        const active = item.is_active === true || item.is_active === 'true' || item.is_active === 1;
        const activeOperationsCount = Number(item.active_operations_count ?? Number.NaN);
        return active && Number.isFinite(activeOperationsCount) && activeOperationsCount > 0;
      });

      const matrixOptionsPayload = await apiRequestJson<ApiEnvelope<{ options?: IsoRiskMatrixOption[] }>>(
        `/api/iso-risk-matrix/${encodeURIComponent(tenantId)}/options`,
        { fallbackMessage: t('riskControlWorkspace.errors.matrixOptions'), locale }
      ).catch(async (cause) => {
        nextStatuses.iso_matrix = { state: 'error', message: cause instanceof Error ? cause.message : t('riskControlWorkspace.errors.matrixOptions') };
        return null;
      });
      const optionsData = unwrapData<{ options?: IsoRiskMatrixOption[] }>(matrixOptionsPayload, {});
      const options = asArray<IsoRiskMatrixOption>(optionsData.options);
      setMatrixOptions(options);
      const selectedOption =
        options.find((option) => `${option.standard_code}:${option.version_code}` === standard) ||
        options.find((option) => option.recommended) ||
        options.find((option) => operationalStandards.some((standardItem) => standardItem.code === option.standard_code)) ||
        options[0] ||
        null;

      if (selectedOption) {
        const params = new URLSearchParams({
          standard_code: selectedOption.standard_code,
          version_code: selectedOption.version_code,
        });
        const latestPayload = await apiRequestJson<ApiEnvelope<{ run?: IsoRiskMatrixRun; items?: IsoRiskMatrixItem[] }>>(
          `/api/iso-risk-matrix/${encodeURIComponent(tenantId)}/latest?${params.toString()}`,
          { fallbackMessage: t('riskControlWorkspace.errors.matrix'), locale }
        ).catch((cause) => {
          nextStatuses.iso_matrix = { state: 'error', message: cause instanceof Error ? cause.message : t('riskControlWorkspace.errors.matrix') };
          return null;
        });
        if (latestPayload) {
          const latest = unwrapData<{ run?: IsoRiskMatrixRun; items?: IsoRiskMatrixItem[] }>(latestPayload, {});
          const matrixRows = normalizeMatrixRows(asArray<IsoRiskMatrixItem>(latest.items), latest.run || null, locale);
          nextRows.push(...matrixRows);
          nextStatuses.iso_matrix = { state: matrixRows.length ? 'loaded' : 'empty' };
        }
      } else if (nextStatuses.iso_matrix.state !== 'error') {
        nextStatuses.iso_matrix = { state: 'empty', message: t('riskControlWorkspace.errors.noOperationalScope') };
      }

      const assetsPayload = await apiRequestJson<ApiEnvelope<AssetRow[]>>(`/api/assets/${encodeURIComponent(tenantId)}`, {
        fallbackMessage: t('riskControlWorkspace.errors.assets'),
        locale,
      }).catch((cause) => {
        nextStatuses.asset_risk = { state: 'error', message: cause instanceof Error ? cause.message : t('riskControlWorkspace.errors.assets') };
        return null;
      });
      if (assetsPayload) {
        const assets = unwrapData<AssetRow[]>(assetsPayload, []);
        const riskGroups = await Promise.all(
          assets.map(async (asset) => {
            const riskPayload = await apiRequestJson<ApiEnvelope<AssetRiskRow[]>>(
              `/api/assets/risk/${encodeURIComponent(asset.id)}`,
              { fallbackMessage: t('riskControlWorkspace.errors.assetRisks'), locale }
            ).catch(() => ({ data: [] as AssetRiskRow[] }));
            return { asset, risks: unwrapData<AssetRiskRow[]>(riskPayload, []) };
          })
        );
        const assetRows = normalizeAssetRiskRows(riskGroups, locale);
        nextRows.push(...assetRows);
        nextStatuses.asset_risk = { state: assetRows.length ? 'loaded' : 'empty' };
      }

      const quantitativeRecords = await phase3Request<Phase3Record[]>('/quantitative-risks?limit=200&offset=0').catch((cause) => {
        nextStatuses.quantitative = { state: 'error', message: cause instanceof Error ? cause.message : t('riskControlWorkspace.errors.quantitative') };
        return null;
      });
      if (quantitativeRecords) {
        const quantitativeRows = normalizeQuantitativeRows(quantitativeRecords, locale);
        nextRows.push(...quantitativeRows);
        nextStatuses.quantitative = { state: quantitativeRows.length ? 'loaded' : 'empty' };
      }

      setRows(nextRows);
      setStatuses(nextStatuses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('riskControlWorkspace.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [locale, standard, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (source !== 'all' && row.sourceType !== source) return false;
      if (level !== 'all' && row.level !== level) return false;
      if (status !== 'all' && String(row.status || '') !== status) return false;
      if (owner !== 'all' && String(row.owner || '') !== owner) return false;
      if (search) {
        const haystack = [row.displayId, row.title, row.description, row.assetName, row.owner, row.standard, row.stableKey]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [level, owner, query, rows, source, status]);

  const sortedRows = useMemo(() => sortRows(filteredRows, sort, direction), [direction, filteredRows, sort]);
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  const filterOptions = useMemo(() => {
    return {
      statuses: uniqueSorted(rows.map((row) => row.status)),
      owners: uniqueSorted(rows.map((row) => row.owner)),
    };
  }, [rows]);

  const kpis = useMemo(() => {
    const allSourcesFinished = (Object.values(statuses) as SourceStatus[]).every((item) => item.state === 'loaded' || item.state === 'empty');
    const hasErrors = (Object.values(statuses) as SourceStatus[]).some((item) => item.state === 'error');
    const totalState: RiskDataState = allSourcesFinished ? (rows.length === 0 ? 'zero' : 'measured') : hasErrors ? 'error' : 'unavailable';
    const highRows = rows.filter((row) => row.level === 'critical' || row.level === 'high');
    const untreatedRows = rows.filter((row) => !row.treatment && row.sourceType === 'iso_matrix');
    return [
      {
        label: t('riskControlWorkspace.kpis.total'),
        value: totalState === 'measured' || totalState === 'zero' ? String(rows.length) : dataStateLabel(totalState, locale),
        meta: t('riskControlWorkspace.kpis.loadedScope'),
        tone: totalState === 'error' ? 'danger' : 'info',
      },
      {
        label: t('riskControlWorkspace.kpis.high'),
        value: allSourcesFinished ? String(highRows.length) : dataStateLabel('unavailable', locale),
        meta: t('riskControlWorkspace.kpis.fromLoadedRecords'),
        tone: highRows.length ? 'danger' : 'neutral',
      },
      {
        label: t('riskControlWorkspace.kpis.untreated'),
        value: statuses.iso_matrix.state === 'loaded' || statuses.iso_matrix.state === 'empty' ? String(untreatedRows.length) : dataStateLabel('unavailable', locale),
        meta: t('riskControlWorkspace.kpis.matrixOnly'),
        tone: untreatedRows.length ? 'warning' : 'neutral',
      },
      {
        label: t('riskControlWorkspace.kpis.quantitative'),
        value: statuses.quantitative.state === 'loaded' || statuses.quantitative.state === 'empty'
          ? String(rows.filter((row) => row.sourceType === 'quantitative').length)
          : dataStateLabel(statuses.quantitative.state === 'error' ? 'error' : 'unavailable', locale),
        meta: t('riskControlWorkspace.kpis.phase3'),
        tone: 'neutral',
      },
    ] as const;
  }, [locale, rows, statuses, t]);

  function updateSort(nextSort: SortKey) {
    updateQuery({
      sort: nextSort,
      direction: sort === nextSort && direction === 'desc' ? 'asc' : 'desc',
      page: '1',
    });
  }

  return (
    <RiskControlWorkspaceShell
      activeView="register"
      actions={
        <EnterpriseButton type="button" variant="secondary" onClick={() => void load()}>
          {t('riskControlWorkspace.actions.refresh')}
        </EnterpriseButton>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <EnterpriseKpiCard key={kpi.label} label={kpi.label} value={kpi.value} meta={kpi.meta} tone={kpi.tone} />
        ))}
      </div>

      <SourceSummary statuses={statuses} />

      <EnterpriseCard
        title={t('riskControlWorkspace.filters.title')}
        subtitle={t('riskControlWorkspace.filters.subtitle')}
      >
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="text-xs font-bold text-[var(--tcdx-color-text-secondary)]">{t('riskControlWorkspace.filters.search')}</span>
            <input
              value={query}
              onChange={(event) => updateQuery({ q: event.target.value, page: '1' })}
              className="mt-1 min-h-11 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
            />
          </label>
          <SelectFilter label={t('riskControlWorkspace.filters.source')} value={source} onChange={(value) => updateQuery({ source: value, page: '1' })} options={[
            ['all', t('riskControlWorkspace.filters.all')],
            ['iso_matrix', t('riskControlWorkspace.sources.isoMatrix')],
            ['asset_risk', t('riskControlWorkspace.sources.assetRisk')],
            ['quantitative', t('riskControlWorkspace.sources.quantitative')],
          ]} />
          <SelectFilter label={t('riskControlWorkspace.filters.level')} value={level} onChange={(value) => updateQuery({ level: value, page: '1' })} options={[
            ['all', t('riskControlWorkspace.filters.all')],
            ['critical', levelLabel('critical', locale)],
            ['high', levelLabel('high', locale)],
            ['medium', levelLabel('medium', locale)],
            ['low', levelLabel('low', locale)],
            ['unknown', levelLabel('unknown', locale)],
          ]} />
          <SelectFilter label={t('riskControlWorkspace.filters.status')} value={status} onChange={(value) => updateQuery({ status: value, page: '1' })} options={[
            ['all', t('riskControlWorkspace.filters.all')],
            ...filterOptions.statuses.map((item) => [item, localStatus(item, locale)] as [string, string]),
          ]} />
          <SelectFilter label={t('riskControlWorkspace.filters.owner')} value={owner} onChange={(value) => updateQuery({ owner: value, page: '1' })} options={[
            ['all', t('riskControlWorkspace.filters.all')],
            ...filterOptions.owners.map((item) => [item, item] as [string, string]),
          ]} />
          {matrixOptions.length > 1 && (
            <SelectFilter
              label={t('riskControlWorkspace.filters.standard')}
              value={standard}
              onChange={(value) => updateQuery({ standard: value, page: '1' })}
              options={[
                ['', t('riskControlWorkspace.filters.recommended')],
                ...matrixOptions.map((item) => [`${item.standard_code}:${item.version_code}`, item.display_name || `${item.standard_code} ${item.version_code}`] as [string, string]),
              ]}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--tcdx-color-border)] px-4 py-3 text-xs text-[var(--tcdx-color-text-secondary)]">
          <EnterpriseBadge tone="neutral">{t('riskControlWorkspace.filters.localPagination')}</EnterpriseBadge>
          {(query || source !== 'all' || level !== 'all' || status !== 'all' || owner !== 'all' || standard) && (
            <button
              type="button"
              className="min-h-9 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-3 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
              onClick={() => router.replace('/riesgos', { scroll: false })}
            >
              {t('riskControlWorkspace.filters.clear')}
            </button>
          )}
        </div>
      </EnterpriseCard>

      <EnterpriseCard
        title={t('riskControlWorkspace.table.title')}
        subtitle={t('riskControlWorkspace.table.subtitle')}
      >
        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-[var(--tcdx-radius-tecdex-md)] bg-[var(--tcdx-color-surface-muted)]" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-4 text-sm text-[var(--tcdx-color-danger)]">{error}</div>
        ) : sortedRows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="text-left text-xs uppercase text-[var(--tcdx-color-text-secondary)]">
                    <th className="w-10 px-4 py-3"><span className="sr-only">{t('riskControlWorkspace.table.select')}</span></th>
                    <SortableHeader className="w-[120px]" label={t('riskControlWorkspace.table.id')} sortKey="displayId" currentSort={sort} direction={direction} onSort={updateSort} />
                    <SortableHeader className="w-[32%]" label={t('riskControlWorkspace.table.risk')} sortKey="title" currentSort={sort} direction={direction} onSort={updateSort} />
                    <SortableHeader className="w-[105px]" label={t('riskControlWorkspace.table.level')} sortKey="level" currentSort={sort} direction={direction} onSort={updateSort} />
                    <SortableHeader className="w-[120px]" label={t('riskControlWorkspace.table.status')} sortKey="status" currentSort={sort} direction={direction} onSort={updateSort} />
                    <SortableHeader className="w-[130px]" label={t('riskControlWorkspace.table.owner')} sortKey="owner" currentSort={sort} direction={direction} onSort={updateSort} />
                    <SortableHeader className="w-[120px]" label={t('riskControlWorkspace.table.source')} sortKey="sourceType" currentSort={sort} direction={direction} onSort={updateSort} />
                    <th className="w-[110px] px-3 py-3">{t('riskControlWorkspace.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.stableKey}
                      className="group border-t border-[var(--tcdx-color-border)] hover:bg-[var(--tcdx-color-surface-muted)]"
                      aria-selected={selectedRow?.stableKey === row.stableKey}
                    >
                      <td className="border-t border-[var(--tcdx-color-border)] px-4 py-3">
                        <input
                          type="radio"
                          name="risk-register-selected-row"
                          checked={selectedRow?.stableKey === row.stableKey}
                          onChange={() => setSelectedRow(row)}
                          aria-label={t('riskControlWorkspace.table.selectRisk', { id: row.displayId })}
                          className="h-4 w-4 rounded border-[var(--tcdx-color-border)] accent-[var(--tcdx-color-primary)]"
                        />
                      </td>
                      <td className="truncate border-t border-[var(--tcdx-color-border)] px-3 py-3 font-bold text-[var(--tcdx-color-text-ink)]" title={row.stableKey}>{row.displayId}</td>
                      <td className="border-t border-[var(--tcdx-color-border)] px-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-[var(--tcdx-color-text-ink)]" title={row.title}>{row.title}</div>
                          <div className="truncate text-xs text-[var(--tcdx-color-text-secondary)]">{row.assetName || row.standard || row.stableKey}</div>
                        </div>
                      </td>
                      <td className="border-t border-[var(--tcdx-color-border)] px-3 py-3"><EnterpriseBadge tone={levelTone(row.level)}>{row.levelLabel}</EnterpriseBadge></td>
                      <td className="truncate border-t border-[var(--tcdx-color-border)] px-3 py-3" title={localStatus(row.status, locale)}>{localStatus(row.status, locale)}</td>
                      <td className="truncate border-t border-[var(--tcdx-color-border)] px-3 py-3" title={row.owner || dataStateLabel('unavailable', locale)}>{row.owner || dataStateLabel('unavailable', locale)}</td>
                      <td className="truncate border-t border-[var(--tcdx-color-border)] px-3 py-3" title={t(row.sourceLabelKey)}>{t(row.sourceLabelKey)}</td>
                      <td className="border-t border-[var(--tcdx-color-border)] px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRow(row)}
                          className="min-h-10 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-2 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                        >
                          {t('riskControlWorkspace.table.view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {pageRows.map((row) => (
                <button
                  type="button"
                  key={row.stableKey}
                  onClick={() => setSelectedRow(row)}
                  className="min-h-44 rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white p-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
                >
                  <span className="text-xs font-black text-[var(--tcdx-color-primary)]">{row.displayId}</span>
                  <span className="mt-2 block text-base font-black text-[var(--tcdx-color-text-ink)]">{row.title}</span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    <EnterpriseBadge tone={levelTone(row.level)}>{row.levelLabel}</EnterpriseBadge>
                    <EnterpriseBadge tone="neutral">{t(row.sourceLabelKey)}</EnterpriseBadge>
                  </span>
                  <span className="mt-3 block text-sm text-[var(--tcdx-color-text-secondary)]">
                    {row.owner || row.assetName || row.standard || dataStateLabel('unavailable', locale)}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--tcdx-color-border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[var(--tcdx-color-text-secondary)]">
                {t('riskControlWorkspace.table.pagination', { shown: pageRows.length, total: sortedRows.length })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateQuery({ page: String(page - 1) })}
                  className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-3 font-bold disabled:opacity-40"
                >
                  {t('riskControlWorkspace.table.previous')}
                </button>
                <span>{page}/{totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => updateQuery({ page: String(page + 1) })}
                  className="min-h-10 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] px-3 font-bold disabled:opacity-40"
                >
                  {t('riskControlWorkspace.table.next')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <EnterpriseEmptyState
            title={t('riskControlWorkspace.empty.title')}
            description={t('riskControlWorkspace.empty.description')}
          />
        )}
      </EnterpriseCard>

      {selectedRow && <RiskDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} locale={locale} />}
    </RiskControlWorkspaceShell>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-bold text-[var(--tcdx-color-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'recommended'} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDirection;
  onSort: (sort: SortKey) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th className={`${className} px-3 py-3`} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex min-h-9 items-center gap-1 rounded-[var(--tcdx-radius-tecdex-sm)] px-1 font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
      >
        {label}
        <span aria-hidden="true">{active ? (direction === 'asc' ? '^' : 'v') : '-'}</span>
      </button>
    </th>
  );
}
