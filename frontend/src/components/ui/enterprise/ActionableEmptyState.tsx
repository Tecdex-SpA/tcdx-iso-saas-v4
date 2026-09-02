import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './utils';

type ActionableEmptyStateProps = {
  title: ReactNode;
  reason?: ReactNode;
  ctaLabel?: string;
  href?: string;
  className?: string;
};

export default function ActionableEmptyState({
  title,
  reason,
  ctaLabel,
  href,
  className,
}: ActionableEmptyStateProps) {
  const safeHref = typeof href === 'string' && href.trim() && href.trim() !== '#' ? href.trim() : '';
  const hasAction = Boolean(ctaLabel && safeHref);

  return (
    <div
      className={cx(
        'rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4 text-sm text-[var(--tcdx-color-text-secondary)]',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{title}</div>
          {reason && <p className="mt-1 max-w-3xl leading-6">{reason}</p>}
        </div>
        {hasAction && (
          <Link
            href={safeHref}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 text-xs font-bold text-[var(--tcdx-color-primary)] hover:bg-[var(--tcdx-color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
