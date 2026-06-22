import type { ReactNode } from 'react';
import { cx } from './utils';

type EnterpriseAiPanelProps = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function EnterpriseAiPanel({
  children,
  title,
  subtitle,
  icon,
  actions,
  className,
}: EnterpriseAiPanelProps) {
  return (
    <section className={cx('enterprise-ai-panel overflow-hidden p-5', className)}>
      {(title || subtitle || icon || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white text-blue-700 shadow-sm">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
