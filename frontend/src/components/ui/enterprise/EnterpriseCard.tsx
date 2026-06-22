import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseCardProps = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export default function EnterpriseCard({
  children,
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
}: EnterpriseCardProps) {
  const hasHeader = title || subtitle || actions;

  return (
    <section className={cx('enterprise-card', className)}>
      {hasHeader && (
        <div className="enterprise-card-header">
          <div className="min-w-0">
            {title && <h2 className="enterprise-card-title">{title}</h2>}
            {subtitle && <p className="enterprise-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
