'use client';

import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
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
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
  slate: 'border-slate-100 bg-slate-50 text-slate-700',
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
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Rol activo</div>
              <div className="mt-1">{roleGroup === 'unknown' ? role || 'sin rol' : roleGroup}</div>
            </div>
          </div>
        </section>

        {notes.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            {notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </section>
        )}

        {children}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div
                className={[
                  'inline-flex rounded-lg border px-3 py-1 text-xs font-semibold',
                  toneClasses[link.tone || 'blue'],
                ].join(' ')}
              >
                MVP
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950 group-hover:text-blue-700">
                {link.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
            </a>
          ))}

          {visibleLinks.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              No hay opciones visibles para este rol dentro de esta vista MVP.
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
