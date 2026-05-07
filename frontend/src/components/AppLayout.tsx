'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import EnglishVisualTextGuard from './EnglishVisualTextGuard';
import EnglishDbDisplayTextGuard from '@/components/EnglishDbDisplayTextGuard';
import EnglishFindingsTextGuard from './EnglishFindingsTextGuard';
import EnglishAdminSaasTextGuard from './EnglishAdminSaasTextGuard';
import {
  getHomePathByRole,
  getUserFromToken,
  isTokenExpired,
} from '@/utils/auth';
import { useTranslation } from '@/hooks/useTranslation';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const routeRules = useMemo(() => {
    return {
      platformOnly: ['/admin-saas', '/empresas'],
      dealerOnly: ['/dealer', '/cotizador', '/prefacturacion'],
      adminOrPlatform: ['/usuarios'],
      moduleProtected: [
        {
          module_key: 'ai',
          routes: ['/ia-compliance'],
          fallback: '/dashboard',
          label: 'IA Compliance',
        },
        {
          module_key: 'risks',
          routes: ['/matriz-riesgo', '/activos'],
          fallback: '/dashboard',
          label: t('sidebar.riskMatrix'),
        },
        {
          module_key: 'audits',
          routes: ['/auditorias', '/ia-auditor'],
          fallback: '/dashboard',
          label: t('sidebar.audits'),
        },
        {
          module_key: 'evidences',
          routes: ['/evidencias'],
          fallback: '/dashboard',
          label: t('sidebar.evidence'),
        },
        {
          module_key: 'kpis',
          routes: ['/administrar-kpis'],
          fallback: '/dashboard',
          label: t('sidebar.kpis'),
        },
      ],
    };
  }, [t]);

  function isRoute(routes: string[]) {
    return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }

  function getRequiredModuleForPath() {
    return routeRules.moduleProtected.find((item) => isRoute(item.routes)) || null;
  }

  async function getModuleAccess(token: string): Promise<ModuleAccessResponse> {
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
  }

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

        const isPlatform =
          role === 'superadmin' ||
          role === 'super_admin' ||
          role === 'platform_admin' ||
          role === 'admin_global' ||
          role === 'global_admin';

        const isDealer = role === 'dealer';

        const isAdmin =
          role === 'admin' ||
          role === 'tenant_admin';

        const isAuditor = role === 'auditor';
        const isOperativo = role === 'operativo';

        const isViewer =
          role === 'viewer' ||
          role === 'cliente' ||
          role === 'client' ||
          role === 'solo_lectura' ||
          role === 'read_only' ||
          role === 'readonly' ||
          role === 'ejecutivo';

        const homePath = getHomePathByRole(role);

        if (isDealer && !isRoute(routeRules.dealerOnly)) {
          window.location.href = '/dealer';
          return;
        }

        if (!isDealer && !isPlatform && isRoute(routeRules.dealerOnly)) {
          window.location.href = homePath;
          return;
        }

        if (!isPlatform && isRoute(routeRules.platformOnly)) {
          window.location.href = homePath;
          return;
        }

        if (!isPlatform && !isAdmin && isRoute(routeRules.adminOrPlatform)) {
          window.location.href = homePath;
          return;
        }

        const viewerAllowedRoutes = [
          '/dashboard',
          '/dashboard-v2',
          '/command-center-iso',
          '/centro-control-iso',
          '/ciclo-vida',
          '/health',
          '/exportes',
          '/auditorias',
          '/auditor-iso',
          '/acciones-recomendadas',
          '/perfil',
        ];

        const operativeBlockedRoutes = [
          '/usuarios',
          '/administrar-kpis',
          '/prefacturacion',
          '/admin-saas',
          '/empresas',
          '/dealer',
          '/cotizador',
        ];

        const auditorBlockedRoutes = [
          '/usuarios',
          '/administrar-kpis',
          '/prefacturacion',
          '/admin-saas',
          '/empresas',
          '/dealer',
          '/cotizador',
          '/ia-compliance',
          '/ia',
        ];

        if (isViewer && !isRoute(viewerAllowedRoutes)) {
          window.location.href = '/dashboard';
          return;
        }

        if (isOperativo && isRoute(operativeBlockedRoutes)) {
          window.location.href = '/dashboard';
          return;
        }

        if (isAuditor && isRoute(auditorBlockedRoutes)) {
          window.location.href = '/dashboard';
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
              sessionStorage.setItem(
                'module-access-denied-message',
                t('app.moduleDisabled', { module: requiredModule.label })
              );

              window.location.href = requiredModule.fallback;
              return;
            }
          }
        }

        if (!cancelled) {
          setAccessDeniedMessage('');
          setCheckingAccess(false);
        }
      } catch (error: any) {
        console.error('ERROR VALIDATING APP ACCESS:', error);

        if (!cancelled) {
          setAccessDeniedMessage(error.message || t('app.permissionsError'));
          setCheckingAccess(false);
        }
      }
    };

    validateAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname, routeRules, t]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f8fb] text-[#162033]">
        <div className="tcdx-card rounded-lg px-7 py-6">
          <div className="text-lg font-semibold">{t('app.validatingAccess')}</div>
          <div className="mt-1 text-sm text-slate-500">
            {t('app.checkingPermissions')}
          </div>
        </div>
      </div>
    );
  }

  if (accessDeniedMessage) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f8fb] text-[#162033]">
        <div className="max-w-md rounded-lg border border-red-200 bg-white px-7 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="text-lg font-semibold">{t('app.restrictedAccess')}</div>
          <div className="mt-2 text-sm text-slate-600">{accessDeniedMessage}</div>

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
            className="mt-4 rounded-lg bg-[#1f6feb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#195fc9]"
          >
            {t('app.logoutAndSwitch')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#06173a]">
      <EnglishVisualTextGuard />
      <EnglishDbDisplayTextGuard />
      {pathname.startsWith('/hallazgos') && <EnglishFindingsTextGuard />}
      {pathname.startsWith('/admin-saas') && <EnglishAdminSaasTextGuard />}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 max-w-[86vw]">
            <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_48%,#eef3f8_100%)]">
        <div className="sticky top-0 z-30">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} />
        </div>

        <main className="tcdx-premium-main tcdx-scrollbar min-w-0 flex-1 overflow-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <div className="tcdx-premium-view">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
