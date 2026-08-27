import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseFilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  count?: ReactNode;
  className?: string;
};

export default function EnterpriseFilterBar({
  children,
  actions,
  count,
  className,
}: EnterpriseFilterBarProps) {
  return (
    <div
      className={cx(
        'enterprise-filter flex flex-col gap-3 p-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between',
        className
      )}
    >
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
      {(actions || count) && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          {count && (
            <div
              aria-live="polite"
              className="rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--tcdx-color-text-secondary)]"
            >
              {count}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
