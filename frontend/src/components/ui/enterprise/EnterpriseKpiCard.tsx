import type { ReactNode } from 'react';
import { cx } from './utils';

type KpiTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneClasses: Record<KpiTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-red-50 text-red-700 ring-red-100',
  info: 'bg-blue-50 text-blue-700 ring-blue-100',
  neutral: 'bg-slate-50 text-slate-700 ring-slate-100',
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-600">{label}</p>
          <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">{value}</div>
          {delta && <div className="mt-2 text-sm font-bold text-blue-700">{delta}</div>}
          {meta && <div className="mt-1 text-xs leading-5 text-slate-500">{meta}</div>}
        </div>
        {icon && (
          <span className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1', toneClasses[tone])}>
            {icon}
          </span>
        )}
      </div>
    </article>
  );
}
