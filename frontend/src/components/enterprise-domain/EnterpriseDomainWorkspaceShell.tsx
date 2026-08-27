'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { EnterprisePageHeader } from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';

export type EnterpriseDomainWorkspaceKey =
  | 'compliance'
  | 'audit'
  | 'data'
  | 'intelligence'
  | 'reports';

type DomainTab = {
  href: string;
  labelKey: string;
};

const DOMAIN_TABS: Record<EnterpriseDomainWorkspaceKey, DomainTab[]> = {
  compliance: [
    { href: '/cumplimiento-auditoria', labelKey: 'navigation.destinations.isoOverview' },
    { href: '/diagnostico', labelKey: 'navigation.destinations.diagnosis' },
    { href: '/iso-health', labelKey: 'navigation.destinations.isoHealth' },
    { href: '/soa', labelKey: 'navigation.destinations.soa' },
    { href: '/ciclo-vida', labelKey: 'navigation.destinations.lifecycle' },
  ],
  audit: [
    { href: '/planes-accion', labelKey: 'navigation.destinations.actionPlans' },
    { href: '/auditorias', labelKey: 'navigation.destinations.audits' },
    { href: '/hallazgos', labelKey: 'navigation.destinations.findings' },
    { href: '/no-conformidades', labelKey: 'navigation.destinations.nonconformities' },
    { href: '/acciones-recomendadas', labelKey: 'navigation.destinations.recommendations' },
  ],
  data: [
    { href: '/evidencias', labelKey: 'navigation.destinations.evidence' },
    { href: '/datos', labelKey: 'navigation.destinations.data' },
    { href: '/datos/calidad', labelKey: 'navigation.destinations.dataQuality' },
    { href: '/datos/catalogo', labelKey: 'navigation.destinations.dataCatalog' },
    { href: '/datos/lineage', labelKey: 'navigation.destinations.lineage' },
    { href: '/datos/semantica', labelKey: 'navigation.destinations.semanticLayer' },
    { href: '/importaciones', labelKey: 'navigation.destinations.imports' },
  ],
  intelligence: [
    { href: '/metricas', labelKey: 'navigation.destinations.metrics' },
    { href: '/indicadores', labelKey: 'navigation.destinations.indicators' },
    { href: '/grc', labelKey: 'navigation.destinations.grcAnalysis' },
    { href: '/encuestas', labelKey: 'navigation.destinations.surveys' },
    { href: '/ia-compliance', labelKey: 'navigation.destinations.aiCompliance' },
  ],
  reports: [
    { href: '/exportes', labelKey: 'navigation.destinations.exports' },
    { href: '/bi', labelKey: 'navigation.destinations.bi' },
    { href: '/reportes/studio', labelKey: 'navigation.destinations.reportStudio' },
    { href: '/reportes/generaciones', labelKey: 'navigation.destinations.reportGenerations' },
  ],
};

const DOMAIN_COPY: Record<EnterpriseDomainWorkspaceKey, { eyebrowKey: string; titleKey: string; descriptionKey: string }> = {
  compliance: {
    eyebrowKey: 'enterpriseDomainWorkspace.compliance.eyebrow',
    titleKey: 'enterpriseDomainWorkspace.compliance.title',
    descriptionKey: 'enterpriseDomainWorkspace.compliance.description',
  },
  audit: {
    eyebrowKey: 'enterpriseDomainWorkspace.audit.eyebrow',
    titleKey: 'enterpriseDomainWorkspace.audit.title',
    descriptionKey: 'enterpriseDomainWorkspace.audit.description',
  },
  data: {
    eyebrowKey: 'enterpriseDomainWorkspace.data.eyebrow',
    titleKey: 'enterpriseDomainWorkspace.data.title',
    descriptionKey: 'enterpriseDomainWorkspace.data.description',
  },
  intelligence: {
    eyebrowKey: 'enterpriseDomainWorkspace.intelligence.eyebrow',
    titleKey: 'enterpriseDomainWorkspace.intelligence.title',
    descriptionKey: 'enterpriseDomainWorkspace.intelligence.description',
  },
  reports: {
    eyebrowKey: 'enterpriseDomainWorkspace.reports.eyebrow',
    titleKey: 'enterpriseDomainWorkspace.reports.title',
    descriptionKey: 'enterpriseDomainWorkspace.reports.description',
  },
};

function isActiveTab(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveTabHref(pathname: string, tabs: DomainTab[]) {
  return tabs
    .filter((tab) => isActiveTab(pathname, tab.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function EnterpriseDomainWorkspaceTabs({
  domain,
  compact = false,
}: {
  domain: EnterpriseDomainWorkspaceKey;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const tabs = DOMAIN_TABS[domain];
  const activeHref = getActiveTabHref(pathname, tabs);
  const scrollHelpId = `enterprise-domain-${domain}-tabs-scroll-help`;

  return (
    <>
      <span id={scrollHelpId} className="sr-only">
        Las pestañas pueden desplazarse horizontalmente en pantallas estrechas.
      </span>
      <nav
        aria-describedby={scrollHelpId}
        aria-label={t('enterpriseDomainWorkspace.tabsLabel')}
        className="enterprise-tab-scroll overflow-x-auto rounded-[var(--tcdx-radius-tecdex-md)] border border-[var(--tcdx-color-border)] bg-white shadow-[var(--tcdx-shadow-card)] tcdx-scrollbar"
      >
        <div className="flex min-w-max items-center gap-1 p-1" role="list">
          {tabs.map((tab) => {
            const active = activeHref === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'min-h-11 flex-none whitespace-nowrap rounded-[var(--tcdx-radius-tecdex-sm)] px-3 py-2 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[var(--tcdx-color-primary)] sm:px-4 sm:text-sm',
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
    </>
  );
}

export default function EnterpriseDomainWorkspaceShell({
  domain,
  actions,
  children,
  compactHeader = false,
  eyebrow,
  title,
  description,
}: {
  domain: EnterpriseDomainWorkspaceKey;
  actions?: ReactNode;
  children?: ReactNode;
  compactHeader?: boolean;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}) {
  const { t } = useTranslation();
  const copy = DOMAIN_COPY[domain];

  return (
    <section className="enterprise-domain-workspace space-y-5">
      <EnterprisePageHeader
        eyebrow={eyebrow ?? t(copy.eyebrowKey)}
        title={title ?? t(copy.titleKey)}
        subtitle={compactHeader ? undefined : description ?? t(copy.descriptionKey)}
        actions={actions}
      />
      <EnterpriseDomainWorkspaceTabs domain={domain} compact={compactHeader} />
      {children}
    </section>
  );
}
