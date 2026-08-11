import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterprisePageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function EnterprisePageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: EnterprisePageHeaderProps) {
  return (
    <section className={cx('enterprise-page-header', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">
            {eyebrow}
          </div>
        )}
        <h1 className="enterprise-page-title">{title}</h1>
        {subtitle && <p className="enterprise-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">{actions}</div>}
    </section>
  );
}
