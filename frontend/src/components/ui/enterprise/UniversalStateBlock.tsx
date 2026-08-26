import type { ReactNode } from 'react';
import EnterpriseBadge from './EnterpriseBadge';
import { cx } from './utils';

export type UniversalDataState =
  | 'measured'
  | 'zero'
  | 'empty'
  | 'insufficient'
  | 'not_calculable'
  | 'not_available'
  | 'error'
  | 'stale'
  | 'partial'
  | 'loading';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const stateMeta: Record<UniversalDataState, { label: string; tone: Tone; title: string }> = {
  measured: { label: 'Con medición', tone: 'success', title: 'Con medición' },
  zero: { label: '0', tone: 'neutral', title: 'Cero real' },
  empty: { label: 'Sin datos', tone: 'neutral', title: 'Sin datos' },
  insufficient: { label: 'Datos insuficientes', tone: 'warning', title: 'Datos insuficientes' },
  not_calculable: { label: 'No calculable', tone: 'warning', title: 'No calculable' },
  not_available: { label: 'No disponible', tone: 'neutral', title: 'No disponible' },
  error: { label: 'Error', tone: 'danger', title: 'Error' },
  stale: { label: 'Desactualizado', tone: 'warning', title: 'Desactualizado' },
  partial: { label: 'Datos parciales', tone: 'warning', title: 'Datos parciales' },
  loading: { label: 'Cargando', tone: 'info', title: 'Cargando' },
};

export function universalStateLabel(state: UniversalDataState) {
  return stateMeta[state].label;
}

export function universalStateTone(state: UniversalDataState): Tone {
  return stateMeta[state].tone;
}

export function UniversalStateBadge({
  state,
  label,
  className,
}: {
  state: UniversalDataState;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <EnterpriseBadge tone={stateMeta[state].tone} className={className}>
      {label ?? stateMeta[state].label}
    </EnterpriseBadge>
  );
}

export default function UniversalStateBlock({
  state,
  title,
  description,
  action,
  className,
}: {
  state: UniversalDataState;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const meta = stateMeta[state];
  const alertProps = state === 'error' ? { role: 'alert' as const } : state === 'loading' ? { role: 'status' as const, 'aria-busy': true } : {};

  return (
    <div
      {...alertProps}
      className={cx(
        'rounded-[var(--tcdx-radius-tecdex-sm)] border bg-white p-4 text-sm',
        state === 'error' ? 'border-[#F5B5B5] text-[#C62828]' : 'border-[var(--tcdx-color-border)] text-[var(--tcdx-color-text-secondary)]',
        state === 'loading' && 'border-dashed',
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{title ?? meta.title}</div>
          {description && <p className="mt-1 leading-6">{description}</p>}
        </div>
        <UniversalStateBadge state={state} />
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
