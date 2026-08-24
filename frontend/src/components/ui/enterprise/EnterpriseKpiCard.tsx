import type { ReactNode } from 'react';
import { cx } from './utils';

type KpiTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<KpiTone, string> = {
  success: 'bg-[#EAF7EE] text-[#168A3A] ring-[#BFE7CC]',
  warning: 'bg-[#FFF7E0] text-[#B77900] ring-[#F7D98A]',
  danger: 'bg-[#FDECEC] text-[#C62828] ring-[#F5B5B5]',
  info: 'bg-[#EAF3FC] text-[#1B75D0] ring-[#B8D7F3]',
  neutral: 'bg-[var(--tcdx-color-surface-muted)] text-[var(--tcdx-color-text-primary)] ring-[var(--tcdx-color-border)]',
};

type EnterpriseKpiCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  delta?: ReactNode;
  tone?: KpiTone;
  className?: string;
};

export default function EnterpriseKpiCard({
  label,
  value,
  icon,
  meta,
  delta,
  tone = 'info',
  className,
}: EnterpriseKpiCardProps) {
  return (
    <article className={cx('enterprise-kpi-card group relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[var(--tcdx-color-primary)] opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[var(--tcdx-color-text-primary)]">{label}</p>
          <div className="mt-2 text-[30px] font-extrabold leading-tight tracking-normal text-[var(--tcdx-color-text-ink)]">{value}</div>
          {delta && <div className="mt-2 text-xs font-bold text-[var(--tcdx-color-primary)]">{delta}</div>}
          {meta && <div className="mt-1 text-xs leading-5 text-[var(--tcdx-color-text-secondary)]">{meta}</div>}
        </div>
        {icon && (
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--tcdx-radius-tecdex-md)] ring-1', toneClasses[tone])}>
            {icon}
          </span>
        )}
      </div>
    </article>
  );
}
