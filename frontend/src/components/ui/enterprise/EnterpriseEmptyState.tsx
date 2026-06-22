import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function EnterpriseEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EnterpriseEmptyStateProps) {
  return (
    <div className={cx('enterprise-empty-state', className)}>
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{icon}</div>}
      <h3 className="text-base font-black text-slate-950">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
