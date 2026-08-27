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
  scrollLabel?: string;
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
  scrollLabel,
}: EnterpriseTableShellProps) {
  const hasHeader = title || subtitle || actions;
  const regionLabel = scrollLabel || (typeof title === 'string' ? title : 'Tabla de datos');

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
      <div
        aria-label={regionLabel}
        className="overflow-auto tcdx-scrollbar"
        data-ui09-scroll-region="true"
        role="region"
        style={maxHeight ? { maxHeight } : undefined}
        tabIndex={0}
      >
        {children}
      </div>
      {footer && <div className="border-t border-[var(--tcdx-color-border)] px-4 py-3">{footer}</div>}
    </section>
  );
}
