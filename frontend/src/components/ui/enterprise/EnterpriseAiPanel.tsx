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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--tcdx-radius-tecdex-md)] border border-[#B8D7F3] bg-white text-[#1B75D0]">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-bold tracking-normal text-[var(--tcdx-color-text-ink)]">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
