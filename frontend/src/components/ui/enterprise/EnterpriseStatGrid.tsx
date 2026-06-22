import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseStatGridProps = {
  children: ReactNode;
  className?: string;
};

export default function EnterpriseStatGrid({ children, className }: EnterpriseStatGridProps) {
  return (
    <div className={cx('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {children}
    </div>
  );
}
