import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseTableShellProps = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  maxHeight?: string;
  density?: 'compact' | 'comfortable';
};

export default function EnterpriseTableShell({
  children,
  title,
  subtitle,
  actions,
  footer,
  className,
  maxHeight,
  density = 'comfortable',
}: EnterpriseTableShellProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <section className={cx('enterprise-table', density === 'compact' && 'enterprise-table-compact', className)}>
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-[var(--tcdx-color-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="enterprise-card-title">{title}</h2>}
            {subtitle && <p className="enterprise-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
      )}
      <div className="overflow-auto tcdx-scrollbar" style={maxHeight ? { maxHeight } : undefined}>{children}</div>
      {footer && <div className="border-t border-[var(--tcdx-color-border)] px-4 py-3">{footer}</div>}
    </section>
  );
}
