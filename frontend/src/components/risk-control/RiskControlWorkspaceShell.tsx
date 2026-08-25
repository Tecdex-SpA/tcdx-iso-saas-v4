'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EnterprisePageHeader } from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';

export type RiskControlViewKey = 'register' | 'matrix' | 'controls' | 'assets' | 'quantitative';

export const RISK_CONTROL_WORKSPACE_TABS: {
  key: RiskControlViewKey;
  href: string;
  labelKey: string;
}[] = [
  { key: 'register', href: '/riesgos', labelKey: 'riskControlWorkspace.tabs.register' },
  { key: 'matrix', href: '/matriz-riesgo', labelKey: 'riskControlWorkspace.tabs.matrix' },
  { key: 'controls', href: '/controles', labelKey: 'riskControlWorkspace.tabs.controls' },
  { key: 'assets', href: '/activos', labelKey: 'riskControlWorkspace.tabs.assets' },
  { key: 'quantitative', href: '/riesgo-cuantitativo', labelKey: 'riskControlWorkspace.tabs.quantitative' },
];

const viewCopy: Record<RiskControlViewKey, { titleKey: string; descriptionKey: string }> = {
  register: {
    titleKey: 'riskControlWorkspace.views.register.title',
    descriptionKey: 'riskControlWorkspace.views.register.description',
  },
  matrix: {
    titleKey: 'riskControlWorkspace.views.matrix.title',
    descriptionKey: 'riskControlWorkspace.views.matrix.description',
  },
  controls: {
    titleKey: 'riskControlWorkspace.views.controls.title',
    descriptionKey: 'riskControlWorkspace.views.controls.description',
  },
  assets: {
    titleKey: 'riskControlWorkspace.views.assets.title',
    descriptionKey: 'riskControlWorkspace.views.assets.description',
  },
  quantitative: {
    titleKey: 'riskControlWorkspace.views.quantitative.title',
    descriptionKey: 'riskControlWorkspace.views.quantitative.description',
  },
};

export function RiskControlWorkspaceTabs({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('riskControlWorkspace.tabsLabel')}
      className="overflow-x-auto rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white shadow-[var(--tcdx-shadow-card)] tcdx-scrollbar"
    >
      <div className="flex min-w-max items-center gap-1 p-1" role="list">
        {RISK_CONTROL_WORKSPACE_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={[
                'min-h-11 flex-none whitespace-nowrap rounded-[var(--tcdx-radius-tecdex-sm)] px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)] sm:px-4 sm:text-sm',
                compact ? 'px-3 text-xs sm:text-sm' : '',
                active
                  ? 'bg-[var(--tcdx-color-primary)] text-white shadow-sm'
                  : 'text-[var(--tcdx-color-text-secondary)] hover:bg-[var(--tcdx-color-surface-muted)] hover:text-[var(--tcdx-color-text-ink)]',
              ].join(' ')}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function RiskControlWorkspaceShell({
  activeView,
  actions,
  children,
  compactHeader = false,
}: {
  activeView: RiskControlViewKey;
  actions?: ReactNode;
  children?: ReactNode;
  compactHeader?: boolean;
}) {
  const { t } = useTranslation();
  const copy = viewCopy[activeView];

  return (
    <section className="risk-control-workspace space-y-5">
      <EnterprisePageHeader
        eyebrow={t('riskControlWorkspace.eyebrow')}
        title={t(copy.titleKey)}
        subtitle={compactHeader ? undefined : t(copy.descriptionKey)}
        actions={actions}
        className="risk-control-workspace-header"
      />
      <RiskControlWorkspaceTabs compact={compactHeader} />
      {children}
    </section>
  );
}
