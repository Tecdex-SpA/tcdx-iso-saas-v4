import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterprisePageProps = {
  children: ReactNode;
  className?: string;
};

export default function EnterprisePage({ children, className }: EnterprisePageProps) {
  return (
    <div className={cx('enterprise-page tcdx-premium-view w-full', className)}>
      {children}
    </div>
  );
}
