import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseToolbarProps = {
  children: ReactNode;
  className?: string;
};

export default function EnterpriseToolbar({ children, className }: EnterpriseToolbarProps) {
  return (
    <div className={cx('enterprise-toolbar flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  );
}
