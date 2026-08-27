import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseRowActionsProps = {
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
};

export default function EnterpriseRowActions({
  children,
  align = 'end',
  className,
}: EnterpriseRowActionsProps) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-wrap items-center gap-2',
        align === 'end' ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {children}
    </div>
  );
}
