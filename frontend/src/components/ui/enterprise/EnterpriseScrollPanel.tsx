import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseScrollPanelProps = {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
};

export default function EnterpriseScrollPanel({
  children,
  className,
  maxHeight = '420px',
}: EnterpriseScrollPanelProps) {
  return (
    <div
      className={cx('enterprise-scroll-panel tcdx-scrollbar', className)}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}
