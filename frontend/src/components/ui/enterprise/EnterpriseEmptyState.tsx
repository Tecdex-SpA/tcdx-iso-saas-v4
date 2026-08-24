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
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-md)] bg-[#EAF3FC] text-[#1B75D0]">{icon}</div>}
      <h3 className="text-[15px] font-bold text-[var(--tcdx-color-text-ink)]">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
