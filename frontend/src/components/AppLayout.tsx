'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { EnterprisePage } from '@/components/ui/enterprise';
import EnglishVisualTextGuard from './EnglishVisualTextGuard';
import EnglishDbDisplayTextGuard from '@/components/EnglishDbDisplayTextGuard';
import EnglishFindingsTextGuard from './EnglishFindingsTextGuard';
import EnglishAdminSaasTextGuard from './EnglishAdminSaasTextGuard';
import {
  getHomePathByRole,
  getUserFromToken,
  isTokenExpired,
} from '@/utils/auth';
import { getApiBaseUrl } from '@/utils/apiClient';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  DEALER_ROUTES,
  FUNCTIONAL_MVP_SUBFLOW_ROUTES,
  INTERNAL_CLIENT_HIDDEN_ROUTES,
  PLATFORM_ROLES,
  PLATFORM_ROUTES,
  canAccessMvpFeature,
  getMvpRouteRule,
  isPathInRoutes,
} from '@/utils/mvpPermissions';

const API_URL = getApiBaseUrl();

type ModuleAccessResponse = {
  ok: boolean;
  scope?: {
    user_id?: string;
    role?: string;
    tenant_id?: string | null;
    tenant_name?: string | null;
    service_status?: string | null;
    suspended_at?: string | null;
    suspension_reason?: string | null;
    deleted_at?: string | null;
    deletion_reason?: string | null;
    is_platform?: boolean;
    is_dealer?: boolean;
  };
  module_map?: Record<
    string,
    {
      module_key: string;
      module_name?: string;
      is_enabled: boolean;
    }
  >;
  error?: string;
};

type PermissionsResponse = {
  ok: boolean;
  permission_map?: Record<string, boolean>;
  error?: string;
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { loading: entitlementsLoading, aiEnabled, canUseAiFeature } = useTenantEntitlements();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const routeRules = useMemo(() => {
    return {
      platformOnly: [...PLATFORM_ROUTES, ...INTERNAL_CLIENT_HIDDEN_ROUTES],
      dealerOnly: DEALER_ROUTES,
      adminOrPlatform: [],
      moduleProtected: [
        {
          module_key: 'ai',
          routes: ['/ia-compliance'],
          fallback: '/dashboard',
          label: 'IA Compliance',
          permission_key: null,
          permission_denied_message: null,
        },
        {
          module_key: 'risks',
          routes: ['/riesgos', '/matriz-riesgo', '/activos'],
          fallback: '/dashboard',
          label: t('sidebar.riskMatrix'),
          permission_key: null,
          permission_denied_message: null,
        },
        {
          module_key: 'audits',
          routes: ['/auditorias'],
          fallback: '/dashboard',
          label: t('sidebar.audits'),
          permission_key: null,
          permission_denied_message: null,
        },
        {
          module_key: 'evidences',
          routes: ['/evidencias'],
          fallback: '/dashboard',
          label: t('sidebar.evidence'),
          permission_key: null,
          permission_denied_message: null,
        },
        {
          module_key: 'health',
          routes: ['/iso-health', '/health', '/administrar-kpis'],
          fallback: '/dashboard',
          label: 'Health ISO',
          permission_key: 'health.view',
          permission_denied_message: 'No tienes permisos para ver Health ISO.',
        },
        {
          module_key: 'grc_phase2_integrated',
          routes: ['/grc-global', '/privacidad', '/incidentes', '/proveedores', '/conectores'],
          fallback: '/dashboard',
          label: 'GRC integrado',
          permission_key: null,
          permission_denied_message: null,
        },
        {
          module_key: 'grc_phase3_operations',
          routes: [
            '/operaciones-grc',
            '/importaciones',
            '/unidades',
            '/procesos',
            '/servicios',
            '/bia',
            '/continuidad',
            '/crisis',
            '/indicadores',
            '/riesgo-cuantitativo',
          ],
          fallback: '/dashboard',
          label: 'Operación GRC',
          permission_key: null,
          permission_denied_message: null,
        },
      ],
    };
  }, [t]);

  const isRoute = useCallback((routes: string[]) => {
    return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }, [pathname]);

  const getRequiredModuleForPath = useCallback(() => {
    return routeRules.moduleProtected.find((item) => isRoute(item.routes)) || null;
  }, [isRoute, routeRules.moduleProtected]);

  const getModuleAccess = useCallback(async (token: string): Promise<ModuleAccessResponse> => {
    const res = await fetch(`${API_URL}/api/me/modules`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();

    let json: ModuleAccessResponse | null = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(t('app.invalidModulesResponse', { status: res.status }));
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || t('app.modulesError'));
    }

    return json;
  }, [t]);

  const getPermissions = useCallback(async (token: string): Promise<PermissionsResponse> => {
    const res = await fetch(`${API_URL}/api/me/permissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();

    let json: PermissionsResponse | null = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(t('app.invalidModulesResponse', { status: res.status }));
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || t('app.permissionsError'));
    }

    return json;
  }, [t]);

  function moduleIsEnabled(
    moduleMap: ModuleAccessResponse['module_map'],
    moduleKey: string
  ) {
    if (!moduleMap || !Object.prototype.hasOwnProperty.call(moduleMap, moduleKey)) {
      return true;
    }

    return moduleMap[moduleKey]?.is_enabled === true;
  }

  useEffect(() => {
    let cancelled = false;

    const validateAccess = async () => {
      try {
        setCheckingAccess(true);
        setAccessDeniedMessage('');

        const token = localStorage.getItem('token');

        if (!token) {
          window.location.href = '/login';
          return;
        }

        if (isTokenExpired(token)) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }

        const user = getUserFromToken();

        if (!user) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }

        const role = String(
          user?.role || user?.user_role || user?.userRole || ''
        ).toLowerCase();

        const isPlatform = PLATFORM_ROLES.includes(role);

        const isDealer = role === 'dealer';
        const isFunctionalMvpSubflow = FUNCTIONAL_MVP_SUBFLOW_ROUTES.includes(pathname);

        const homePath = getHomePathByRole(role);
        const isExecutiveClient =
          role === 'viewer' ||
          role === 'cliente' ||
          role === 'client' ||
          role === 'solo_lectura' ||
          role === 'read_only' ||
          role === 'readonly' ||
          role === 'ejecutivo';

        if (isDealer && !isRoute(routeRules.dealerOnly)) {
          window.location.href = '/dealer';
          return;
        }

        if (!isDealer && isRoute(routeRules.dealerOnly)) {
          window.location.href = homePath;
          return;
        }

        if (!isPlatform && isRoute(routeRules.platformOnly) && !isFunctionalMvpSubflow) {
          window.location.href = homePath;
          return;
        }

        if (
          !isPlatform &&
          !isDealer &&
          isPathInRoutes(pathname, INTERNAL_CLIENT_HIDDEN_ROUTES) &&
          !isFunctionalMvpSubflow
        ) {
          window.location.href = homePath;
          return;
        }

        const mvpRouteRule = getMvpRouteRule(pathname);

        if (
          isExecutiveClient &&
          isPathInRoutes(pathname, [
            '/diagnostico',
            '/controles',
            '/soa',
            '/ciclo-vida',
            '/auditorias',
            '/auditorias/ejecucion',
            '/hallazgos',
            '/no-conformidades',
          ])
        ) {
          window.location.href = '/cumplimiento-auditoria';
          return;
        }

        if (
          !isPlatform &&
          !isDealer &&
          mvpRouteRule &&
          !canAccessMvpFeature(role, mvpRouteRule.feature)
        ) {
          window.location.href = homePath;
          return;
        }

        if (!isPlatform && !isDealer) {
          const moduleAccess = await getModuleAccess(token);

          const serviceStatus = String(
            moduleAccess?.scope?.service_status || 'active'
          ).toLowerCase();

          const tenantName =
            moduleAccess?.scope?.tenant_name || t('common.company').toLowerCase();

          if (
            serviceStatus === 'suspended' ||
            serviceStatus === 'suspended_non_payment'
          ) {
            if (!cancelled) {
              setAccessDeniedMessage(t('app.serviceSuspended', { tenantName }));
              setCheckingAccess(false);
            }
            return;
          }

          if (serviceStatus === 'deleted') {
            if (!cancelled) {
              setAccessDeniedMessage(t('app.serviceDeleted', { tenantName }));
              setCheckingAccess(false);
            }
            return;
          }

          const requiredModule = getRequiredModuleForPath();

          if (requiredModule) {

            if (!moduleIsEnabled(moduleAccess.module_map, requiredModule.module_key)) {
              if (!cancelled) {
                setAccessDeniedMessage(t('app.moduleDisabled', { module: requiredModule.label }));
                setCheckingAccess(false);
              }
              return;
            }

            if (requiredModule.permission_key) {
              const permissions = await getPermissions(token);
              if (permissions.permission_map?.[requiredModule.permission_key] !== true) {
                if (!cancelled) {
                  setAccessDeniedMessage(
                    requiredModule.permission_denied_message || t('app.permissionsError')
                  );
                  setCheckingAccess(false);
                }
                return;
              }
            }
          }
        }

        if (!cancelled) {
          setAccessDeniedMessage('');
          setCheckingAccess(false);
        }
      } catch (error: unknown) {
        console.error('ERROR VALIDATING APP ACCESS:', error);

        if (!cancelled) {
          setAccessDeniedMessage(
            error instanceof Error ? error.message : t('app.permissionsError')
          );
          setCheckingAccess(false);
        }
      }
    };

    validateAccess();

    return () => {
      cancelled = true;
    };
  }, [getModuleAccess, getPermissions, getRequiredModuleForPath, isRoute, pathname, routeRules, t]);

  useEffect(() => {
    if (entitlementsLoading) return;
    const currentView =
      typeof window === 'undefined'
        ? ''
        : new URLSearchParams(window.location.search).get('view') || '';

    const aiComplianceRoute =
      pathname === '/ia' ||
      pathname === '/ia-compliance' ||
      pathname.startsWith('/ia-compliance/');

    const aiAuditorRoute =
      pathname === '/ia-auditor' ||
      pathname === '/auditorias/ia' ||
      (pathname === '/auditorias' && currentView === 'ia');

    if (
      (aiComplianceRoute && (!aiEnabled || !canUseAiFeature('suggestions'))) ||
      (aiAuditorRoute && (!aiEnabled || !canUseAiFeature('auditor')))
    ) {
      window.location.href = pathname === '/auditorias' ? '/auditorias' : '/dashboard';
    }
  }, [pathname, entitlementsLoading, aiEnabled, canUseAiFeature]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileSidebarOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-ink)]">
        <div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-7 py-6 shadow-[var(--tcdx-shadow-tecdex-lg)]">
          <div className="text-lg font-semibold">{t('app.validatingAccess')}</div>
          <div className="mt-1 text-sm text-[var(--tcdx-color-text-secondary)]">
            {t('app.checkingPermissions')}
          </div>
        </div>
      </div>
    );
  }

  if (accessDeniedMessage) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--tcdx-color-surface)] text-[var(--tcdx-color-text-ink)]">
        <div className="max-w-md rounded-[var(--tcdx-radius-tecdex-sm)] border border-[rgba(201,91,91,0.3)] bg-white px-7 py-6 shadow-[var(--tcdx-shadow-tecdex-lg)]">
          <div className="text-lg font-semibold">{t('app.restrictedAccess')}</div>
          <div className="mt-2 text-sm text-[var(--tcdx-color-text-secondary)]">{accessDeniedMessage}</div>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('authToken');
              localStorage.removeItem('user');
              localStorage.removeItem('tenant');
              sessionStorage.clear();
              window.location.href = '/login';
            }}
            className="mt-4 rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-primary)] px-4 py-2 text-sm font-semibold uppercase tracking-[var(--tcdx-letter-spacing-button)] text-white shadow-sm transition hover:bg-[var(--tcdx-color-primary-hover)]"
          >
            {t('app.logoutAndSwitch')}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="ml-2 mt-4 rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--tcdx-color-text-primary)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)]"
          >
            {t('sidebar.dashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-shell flex h-[100dvh] overflow-hidden">
      <EnglishVisualTextGuard />
      <EnglishDbDisplayTextGuard />
      {pathname.startsWith('/hallazgos') && <EnglishFindingsTextGuard />}
      {pathname.startsWith('/admin-saas') && <EnglishAdminSaasTextGuard />}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {mobileSidebarOpen && (
        <div id="mobile-sidebar-drawer" className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0 bg-[rgba(43,57,68,0.58)] backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 max-w-[86vw]">
            <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#ffffff_0%,var(--tcdx-color-surface)_48%,var(--tcdx-color-surface-alt)_100%)]">
        <div className="sticky top-0 z-30">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} mobileMenuOpen={mobileSidebarOpen} />
        </div>

        <main className="enterprise-main tcdx-premium-main tcdx-scrollbar min-w-0 flex-1 overflow-auto px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
          <EnterprisePage className="enterprise-page-shell">
            {children}
          </EnterprisePage>
        </main>
      </div>
    </div>
  );
}
