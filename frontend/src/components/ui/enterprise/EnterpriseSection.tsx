import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseSectionProps = {
  children: ReactNode;
  className?: string;
};

export default function EnterpriseSection({ children, className }: EnterpriseSectionProps) {
  return <section className={cx('enterprise-section', className)}>{children}</section>;
}
