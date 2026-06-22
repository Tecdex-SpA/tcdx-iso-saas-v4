import type { ReactNode } from 'react';
import { cx } from './utils';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
};

type EnterpriseBadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export default function EnterpriseBadge({ children, tone = 'neutral', className }: EnterpriseBadgeProps) {
  return <span className={cx('enterprise-badge', toneClasses[tone], className)}>{children}</span>;
}
