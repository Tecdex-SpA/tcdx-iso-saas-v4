import type { ReactNode } from 'react';
import EnterpriseBadge from './EnterpriseBadge';
import { cx } from './utils';

export type DataTrustStatus =
  | 'trusted'
  | 'trusted_with_warnings'
  | 'low_confidence'
  | 'insufficient_data'
  | 'unavailable'
  | string;

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type DataTrustIndicatorProps = {
  status?: DataTrustStatus | null;
  confidence?: number | string | null;
  coverage?: number | string | null;
  freshness?: string | null;
  source?: string | null;
  timestamp?: string | null;
  provenance?: ReactNode;
  warnings?: Array<string | null | undefined> | null;
  label?: string;
  variant?: 'chip' | 'panel';
  className?: string;
};

function normalizedStatus(status?: DataTrustStatus | null) {
  const raw = String(status || '').toLowerCase();
  if (['trusted', 'acceptable', 'source_ready', 'fresh', 'valid'].includes(raw)) return 'trusted';
  if (['trusted_with_warnings', 'source_ready_with_warnings', 'attention', 'warning'].includes(raw)) return 'trusted_with_warnings';
  if (['low_confidence', 'untrusted', 'quality_failed', 'rejected', 'failed'].includes(raw)) return 'low_confidence';
  if (['insufficient_data', 'insufficient', 'unmeasured', 'stale_source'].includes(raw)) return 'insufficient_data';
  return 'unavailable';
}

export function dataTrustLabel(status?: DataTrustStatus | null) {
  const labels: Record<string, string> = {
    trusted: 'Confiable',
    trusted_with_warnings: 'Confiable con advertencias',
    low_confidence: 'Baja confianza',
    insufficient_data: 'Datos insuficientes',
    unavailable: 'No disponible',
  };
  return labels[normalizedStatus(status)];
}

function dataTrustTone(status?: DataTrustStatus | null): Tone {
  const state = normalizedStatus(status);
  if (state === 'trusted') return 'success';
  if (state === 'low_confidence') return 'danger';
  if (state === 'trusted_with_warnings' || state === 'insufficient_data') return 'warning';
  return 'neutral';
}

function formatScalar(value: number | string | null | undefined, suffix = '') {
  if (value === null || value === undefined || value === '') return 'No disponible';
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}${suffix}` : 'No disponible';
  return value;
}

export default function DataTrustIndicator({
  status,
  confidence,
  coverage,
  freshness,
  source,
  timestamp,
  provenance,
  warnings,
  label = 'Data Trust',
  variant = 'chip',
  className,
}: DataTrustIndicatorProps) {
  const visibleWarnings = (warnings || []).filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  const content = (
    <dl className="mt-3 grid gap-2 text-xs text-[var(--tcdx-color-text-secondary)]">
      <div className="flex justify-between gap-3"><dt>Estado</dt><dd className="text-right font-semibold text-[var(--tcdx-color-text-ink)]">{dataTrustLabel(status)}</dd></div>
      {status && <div className="flex justify-between gap-3"><dt>Estado canónico</dt><dd className="text-right">{String(status)}</dd></div>}
      {confidence !== null && confidence !== undefined && <div className="flex justify-between gap-3"><dt>Confianza</dt><dd className="text-right">{formatScalar(confidence)}</dd></div>}
      {coverage !== null && coverage !== undefined && <div className="flex justify-between gap-3"><dt>Cobertura</dt><dd className="text-right">{formatScalar(coverage)}</dd></div>}
      {freshness && <div className="flex justify-between gap-3"><dt>Vigencia</dt><dd className="text-right">{freshness}</dd></div>}
      {source && <div className="flex justify-between gap-3"><dt>Fuente</dt><dd className="text-right">{source}</dd></div>}
      {timestamp && <div className="flex justify-between gap-3"><dt>Timestamp</dt><dd className="text-right">{timestamp}</dd></div>}
      {provenance && <div><dt>Provenance</dt><dd className="mt-1">{provenance}</dd></div>}
      {visibleWarnings.length > 0 && <div><dt>Warnings</dt><dd className="mt-1">{visibleWarnings.join(', ')}</dd></div>}
    </dl>
  );

  if (variant === 'panel') {
    return (
      <section className={cx('rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4', className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-secondary)]">{label}</div>
          <EnterpriseBadge tone={dataTrustTone(status)}>{dataTrustLabel(status)}</EnterpriseBadge>
        </div>
        {content}
      </section>
    );
  }

  return (
    <details className={cx('group inline-block rounded-[var(--tcdx-radius-tecdex-sm)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--tcdx-color-primary)]', className)}>
      <summary className="list-none cursor-pointer">
        <EnterpriseBadge tone={dataTrustTone(status)}>{dataTrustLabel(status)}</EnterpriseBadge>
      </summary>
      <div className="mt-2 min-w-64 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-3 shadow-[var(--tcdx-shadow-tecdex-sm)]">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tcdx-color-text-secondary)]">{label}</div>
        {content}
      </div>
    </details>
  );
}
