import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseTableShellProps = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function EnterpriseTableShell({
  children,
  title,
  subtitle,
  actions,
  className,
}: EnterpriseTableShellProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <section className={cx('enterprise-table', className)}>
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="enterprise-card-title">{title}</h2>}
            {subtitle && <p className="enterprise-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="overflow-x-auto tcdx-scrollbar">{children}</div>
    </section>
  );
}
