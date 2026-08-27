import type { ReactNode } from 'react';
import { cx } from './utils';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-[#BFE7CC] bg-[#EAF7EE] text-[#168A3A]',
  warning: 'border-[#F7D98A] bg-[#FFF7E0] text-[#B77900]',
  danger: 'border-[#F5B5B5] bg-[#FDECEC] text-[#C62828]',
  info: 'border-[#B8D7F3] bg-[#EAF3FC] text-[#1B75D0]',
  neutral: 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface-muted)] text-[var(--tcdx-color-text-secondary)]',
};

type EnterpriseBadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export default function EnterpriseBadge({ children, tone = 'neutral', className }: EnterpriseBadgeProps) {
  return <span className={cx('enterprise-badge', toneClasses[tone], className)}>{children}</span>;
}
