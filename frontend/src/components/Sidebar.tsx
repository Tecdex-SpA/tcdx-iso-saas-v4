'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getUserFromToken } from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  CLIENT_MVP_NAV_ITEMS,
  PLATFORM_ROLES,
  canAccessMvpFeature,
  isPathInRoutes,
} from '@/utils/mvpPermissions';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

const SERVICE_LOGO_SRC =
  process.env.NEXT_PUBLIC_TCDX_LOGO_URL || '/logo.png';

const POWERED_BY_LOGO_SRC =
  process.env.NEXT_PUBLIC_TECDX_POWERED_LOGO_URL || '/tecdex.png';

type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

type NavItemProps = {
  href: string;
  label: string;
  icon: ReactNode;
  collapsed?: boolean;
  active?: boolean;
};

type ModuleMap = Record<
  string,
  {
    module_key: string;
    module_name?: string;
    is_enabled: boolean;
  }
>;

function NavItem({ href, label, icon, collapsed, active }: NavItemProps) {
  return (
    <a
      href={href}
      title={label}
      className={[
        'group flex w-full items-center rounded-lg text-sm font-medium transition-all duration-200',
        collapsed ? 'justify-center px-2 py-3' : 'justify-start gap-3 px-3 py-2.5 text-left',
        active
          ? 'bg-[linear-gradient(135deg,#0f6fd6_0%,#0b5cad_100%)] text-white shadow-[0_14px_30px_rgba(15,111,214,0.34)] ring-1 ring-white/12'
          : 'text-white/76 hover:bg-white/10 hover:text-white hover:ring-1 hover:ring-white/8',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 transition-colors',
          active ? 'text-white' : 'text-white/62 group-hover:text-white',
        ].join(' ')}
      >
        {icon}
      </span>
      {!collapsed && <span className="block min-w-0 flex-1 truncate text-left">{label}</span>}
    </a>
  );
}

function resolveRole(user: any): string {
  return String(user?.role || user?.user_role || user?.userRole || '').toLowerCase();
}

function MvpIcon({ href, className }: { href: string; className: string }) {
  if (href === '/dashboard') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 12l9-9 9 9" />
        <path d="M9 21V9h6v12" />
      </svg>
    );
  }

  if (href === '/cumplimiento-auditoria') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
        <path d="M9 12l2 2 4-5" />
      </svg>
    );
  }

  if (href === '/evidencias') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 7h5l2 3h11v10H3z" />
      </svg>
    );
  }

  if (href === '/riesgos') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10.29 3.86l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
      </svg>
    );
  }

  if (href === '/planes-accion') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </svg>
    );
  }

  if (href === '/exportes') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
      </svg>
    );
  }

  if (href === '/ia-compliance') {
    return (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="8" y="8" width="8" height="8" rx="2" />
        <path d="M12 8V5" />
        <path d="M12 19v-3" />
        <path d="M8 12H5" />
        <path d="M19 12h-3" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
    </svg>
  );
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { loading: entitlementsLoading, aiEnabled, canUseAiFeature } = useTenantEntitlements();

  const [role, setRole] = useState<string | null>(null);
  const [moduleMap, setModuleMap] = useState<ModuleMap | null>(null);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  useEffect(() => {
    const user = getUserFromToken();
    const resolvedRole = resolveRole(user) || null;

    setRole(resolvedRole);

    const loadModules = async () => {
      const token = localStorage.getItem('token');

      // Plataforma y dealer no dependen de módulos tenant en sidebar.
      if (resolvedRole === 'dealer' || PLATFORM_ROLES.includes(resolvedRole || '')) {
        setModuleMap({});
        setModulesLoaded(true);
        return;
      }

      if (!token) {
        setModuleMap({});
        setModulesLoaded(true);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/me/modules`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          console.error('ERROR LOAD SIDEBAR MODULES:', json);
          setModuleMap({});
          return;
        }

        setModuleMap(json?.module_map || {});
      } catch (err) {
        console.error('ERROR LOAD SIDEBAR MODULES:', err);
        setModuleMap({});
      } finally {
        setModulesLoaded(true);
      }
    };

    loadModules();
  }, []);

  const normalizedRole = String(role || '').toLowerCase();

  const isDealer = normalizedRole === 'dealer';
  const isPlatformAdmin = PLATFORM_ROLES.includes(normalizedRole);

  const canSeeAiCompliance =
    !entitlementsLoading && aiEnabled && canUseAiFeature('suggestions');
  const iconClass = 'h-5 w-5';

  const isActive = (href: string) => {
    if (href === '/cumplimiento-auditoria') {
      return isPathInRoutes(pathname, [
        '/cumplimiento-auditoria',
        '/diagnostico',
        '/iso-health',
        '/health',
        '/controles',
        '/soa',
        '/ciclo-vida',
        '/auditorias',
        '/hallazgos',
        '/no-conformidades',
      ]);
    }

    if (href === '/riesgos') {
      return isPathInRoutes(pathname, ['/riesgos', '/matriz-riesgo', '/activos']);
    }

    if (href === '/planes-accion') {
      return isPathInRoutes(pathname, ['/planes-accion', '/plan-accion', '/acciones-recomendadas']);
    }

    if (href === '/configuracion') {
      return isPathInRoutes(pathname, ['/configuracion', '/usuarios', '/perfil', '/perfil-empresa']);
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const hasModule = useCallback((moduleKey: string) => {
    // Plataforma y dealer no se bloquean aquí por módulos tenant.
    if (isPlatformAdmin || isDealer) return true;

    // Mientras no cargue el mapa, ocultamos los módulos contratables
    // para evitar parpadeo de opciones que luego desaparecen.
    if (!modulesLoaded) return false;

    if (!moduleMap) return false;

    // Si el módulo no existe en el mapa, no bloqueamos.
    if (!Object.prototype.hasOwnProperty.call(moduleMap, moduleKey)) {
      return true;
    }

    return moduleMap[moduleKey]?.is_enabled === true;
  }, [isDealer, isPlatformAdmin, moduleMap, modulesLoaded]);

  const generalItems = useMemo(() => {
    return CLIENT_MVP_NAV_ITEMS
      .filter((item) => {
        if (!canAccessMvpFeature(normalizedRole, item.feature)) return false;
        if (item.href === '/ia-compliance' && !canSeeAiCompliance) return false;
        if (item.moduleKey && !hasModule(item.moduleKey)) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        icon: <MvpIcon href={item.href} className={iconClass} />,
      }));
  }, [canSeeAiCompliance, hasModule, iconClass, normalizedRole]);

  const platformItems = [
    {
      href: '/admin-saas',
      label: t('sidebar.saasAdmin'),
      icon: (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
          <path d="M16 8h2a2 2 0 0 1 2 2v11" />
          <path d="M3 21h18" />
          <path d="M8 7h2" />
          <path d="M8 11h2" />
          <path d="M8 15h2" />
          <path d="M16 13h1" />
          <path d="M16 17h1" />
          <circle cx="19" cy="5" r="2" />
        </svg>
      ),
    },
  ];

  const dealerItems = [
    {
      href: '/dealer',
      label: t('sidebar.dealerPortal'),
      icon: (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-7h6v7" />
          <circle cx="18" cy="5" r="2" />
        </svg>
      ),
    },

    {
      href: '/cotizador',
      label: t('sidebar.quoteBuilder'),
      icon: (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4" />
          <path d="M10 11h6" />
          <path d="M10 15h6" />
          <path d="M10 19h3" />
          <path d="M4 7h3" />
          <path d="M4 11h3" />
          <path d="M4 15h3" />
        </svg>
      ),
    },
    {
      href: '/prefacturacion',
      label: t('sidebar.prebilling'),
      icon: (
        <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      ),
    },
  ];

  const sectionLabel = (label: string) => {
    if (collapsed) return null;

    return (
      <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>
    );
  };

  return (
    <aside
      className={[
        'tcdx-shell-sidebar relative flex h-screen flex-col border-r border-white/10 text-white shadow-[18px_0_42px_rgba(8,25,58,0.22)] transition-all duration-300',
        collapsed ? 'w-[88px] px-3 pt-4 pb-5' : 'w-[272px] px-4 pt-4 pb-5',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-7 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#102033] shadow-lg transition hover:bg-slate-50"
        title={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
      >
        <svg
          className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div className={`relative z-10 mb-5 flex h-14 items-center ${collapsed ? 'justify-center' : 'justify-start pl-1'}`}>
        <img
          src={SERVICE_LOGO_SRC}
          alt="Logo"
          className={collapsed ? 'h-10 w-10 object-contain' : 'h-auto w-28 scale-[1.45] object-contain origin-left'}
        />
      </div>

      <nav className="tcdx-scrollbar relative z-10 flex-1 overflow-y-auto pr-1 text-sm">
        {isPlatformAdmin && (
          <>
            {sectionLabel(t('sidebar.platform'))}
            <div className="space-y-2">
              {platformItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  active={isActive(item.href)}
                  icon={item.icon}
                />
              ))}
            </div>
          </>
        )}

        {isDealer && !isPlatformAdmin && (
          <>
            {sectionLabel(t('sidebar.dealer'))}
            <div className="space-y-2">
              {dealerItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  active={isActive(item.href)}
                  icon={item.icon}
                />
              ))}
            </div>
          </>
        )}

        {!isPlatformAdmin && !isDealer && (
          <>
            {sectionLabel(t('sidebar.general'))}
            <div className="space-y-2">
              {generalItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  collapsed={collapsed}
                  active={isActive(item.href)}
                  icon={item.icon}
                />
              ))}
            </div>

          </>
        )}
      </nav>

      <div className={['relative z-10 mt-4 border-t border-white/10 pt-4', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed ? (
          <div title={t('sidebar.poweredBy')} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/10">
            <img src={SERVICE_LOGO_SRC} alt="Tecdex" className="h-7 w-7 object-contain" />
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/7 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
              Powered by
            </p>
            <div className="flex items-center gap-3">
              <img src={POWERED_BY_LOGO_SRC} alt="Tecdex" className="h-12 w-auto object-contain" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
