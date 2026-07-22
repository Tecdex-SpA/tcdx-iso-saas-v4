'use client';

import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  EnterpriseBadge,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterprisePageHeader,
} from '@/components/ui/enterprise';
import { getUserFromToken } from '@/utils/auth';
import {
  canAccessMvpFeature,
  getMvpRoleGroup,
  type MvpFeatureKey,
} from '@/utils/mvpPermissions';

type MvpLink = {
  href: string;
  title: string;
  description: string;
  feature: MvpFeatureKey;
  moduleKey?: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
};

type MvpViewShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  links: MvpLink[];
  notes?: string[];
  children?: ReactNode;
};

const toneClasses = {
  blue: 'border-[rgba(81,171,168,0.24)] bg-[rgba(81,171,168,0.12)] text-[var(--tcdx-color-secondary-hover)]',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
  slate: 'border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-primary)]',
};

function getCurrentRole() {
  const user = getUserFromToken();
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

export default function MvpViewShell({
  eyebrow,
  title,
  description,
  links,
  notes = [],
  children,
}: MvpViewShellProps) {
  const role = getCurrentRole();
  const roleGroup = getMvpRoleGroup(role);
  const visibleLinks = links.filter((link) => canAccessMvpFeature(role, link.feature));

  return (
    <AppLayout>
      <div className="space-y-6">
        <EnterpriseCard>
          <EnterprisePageHeader
            eyebrow={eyebrow}
            title={title}
            subtitle={description}
            className="mb-0"
            actions={
            <div className="enterprise-muted-panel px-4 py-3 text-sm text-[var(--tcdx-color-text-secondary)]">
              <div className="font-semibold text-[var(--tcdx-color-text-ink)]">Rol activo</div>
              <div className="mt-1">{roleGroup === 'unknown' ? role || 'sin rol' : roleGroup}</div>
            </div>
            }
          />
        </EnterpriseCard>

        {notes.length > 0 && (
          <EnterpriseCard className="border-amber-200 bg-amber-50 text-sm leading-6 text-amber-900">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </EnterpriseCard>
        )}

        {children}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="enterprise-card group transition hover:-translate-y-0.5 hover:border-[rgba(240,114,29,0.32)] hover:shadow-md focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]"
            >
              <EnterpriseBadge className={toneClasses[link.tone || 'blue']}>
                Operación
              </EnterpriseBadge>
              <h2 className="mt-4 text-lg font-semibold text-[var(--tcdx-color-text-ink)] group-hover:text-[var(--tcdx-color-primary)]">
                {link.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--tcdx-color-text-secondary)]">{link.description}</p>
            </a>
          ))}

          {visibleLinks.length === 0 && (
            <EnterpriseEmptyState
              title="No hay opciones visibles"
              description="No hay opciones visibles para este rol dentro de esta vista operacional."
              className="text-sm text-[var(--tcdx-color-text-secondary)]"
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}
