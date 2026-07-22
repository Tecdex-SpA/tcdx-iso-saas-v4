'use client';

import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import TcdxIcon, { type TcdxIconName } from '@/components/icons/TcdxIcon';
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

function getLinkIconName(href: string): TcdxIconName {
  if (href.includes('diagnostico')) return 'clipboard';
  if (href.includes('iso-health')) return 'heart';
  if (href.includes('controles')) return 'controls';
  if (href.includes('soa')) return 'soa';
  if (href.includes('ciclo-vida')) return 'activity';
  if (href.includes('auditorias')) return 'audit';
  if (href.includes('hallazgos')) return 'finding';
  if (href.includes('no-conformidades')) return 'alert';
  if (href.includes('matriz-riesgo')) return 'risk';
  if (href.includes('activos')) return 'building';
  return 'dashboard';
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

        <section aria-label="Selector de vistas internas" className="enterprise-card p-0">
          <div className="border-b border-[var(--tcdx-color-border)] px-5 py-4">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tcdx-color-primary)]">
              Vistas internas
            </div>
            <div className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
              Accesos operacionales disponibles para el rol activo.
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group flex min-h-[120px] gap-3 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[rgba(240,114,29,0.32)] hover:shadow-[var(--tcdx-shadow-tecdex-sm)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(81,171,168,0.24)] bg-[rgba(81,171,168,0.12)] text-[var(--tcdx-color-secondary-hover)]">
                  <TcdxIcon name={getLinkIconName(link.href)} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <EnterpriseBadge className={toneClasses[link.tone || 'blue']}>
                    Operación
                  </EnterpriseBadge>
                  <span className="mt-3 block text-base font-semibold text-[var(--tcdx-color-text-ink)] group-hover:text-[var(--tcdx-color-primary)]">
                    {link.title}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--tcdx-color-text-secondary)]">{link.description}</span>
                </span>
              </a>
            ))}

            {visibleLinks.length === 0 && (
              <EnterpriseEmptyState
                title="No hay opciones visibles"
                description="No hay opciones visibles para este rol dentro de esta vista operacional."
                className="text-sm text-[var(--tcdx-color-text-secondary)]"
              />
            )}
          </div>
        </section>

        {notes.length > 0 && (
          <EnterpriseCard className="border-amber-200 bg-amber-50 text-sm leading-6 text-amber-900">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </EnterpriseCard>
        )}

        {children}
      </div>
    </AppLayout>
  );
}
