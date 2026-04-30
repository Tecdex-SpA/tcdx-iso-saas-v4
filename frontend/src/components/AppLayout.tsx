'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import {
  getHomePathByRole,
  getUserFromToken,
  isTokenExpired,
} from '@/utils/auth';

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
      dealerOnly: ['/dealer', '/cotizador'],
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
          label: 'Riesgos y activos',
        },
        {
          module_key: 'audits',
          routes: ['/auditorias'],
          fallback: '/dashboard',
          label: 'Auditorías',
        },
        {
          module_key: 'evidences',
          routes: ['/evidencias'],
          fallback: '/dashboard',
          label: 'Evidencias',
        },
        {
          module_key: 'kpis',
          routes: ['/administrar-kpis'],
          fallback: '/dashboard',
          label: 'Administración de KPI',
        },
      ],
    };
  }, []);

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
      throw new Error(`Respuesta inválida del backend en /api/me/modules. HTTP ${res.status}.`);
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || 'Error consultando módulos contratados');
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
          '/ciclo-vida',
          '/health',
          '/exportes',
          '/auditorias',
          '/perfil',
        ];

        const operativeBlockedRoutes = [
          '/usuarios',
          '/administrar-kpis',
          '/auditorias',
          '/admin-saas',
          '/empresas',
          '/dealer',
          '/cotizador',
        ];

        const auditorBlockedRoutes = [
          '/usuarios',
          '/administrar-kpis',
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
            moduleAccess?.scope?.tenant_name || 'esta empresa';

          if (
            serviceStatus === 'suspended' ||
            serviceStatus === 'suspended_non_payment'
          ) {
            if (!cancelled) {
              setAccessDeniedMessage(
                `El servicio de ${tenantName} está suspendido por no pago. Contacta al administrador comercial de TCDX para regularizar la cuenta.`
              );
              setCheckingAccess(false);
            }
            return;
          }

          if (serviceStatus === 'deleted') {
            if (!cancelled) {
              setAccessDeniedMessage(
                `El servicio de ${tenantName} ya no se encuentra activo. La empresa fue dada de baja administrativamente.`
              );
              setCheckingAccess(false);
            }
            return;
          }

          const requiredModule = getRequiredModuleForPath();

          if (requiredModule) {

            if (!moduleIsEnabled(moduleAccess.module_map, requiredModule.module_key)) {
              sessionStorage.setItem(
                'module-access-denied-message',
                `El módulo "${requiredModule.label}" no está habilitado para esta empresa.`
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
          setAccessDeniedMessage(error.message || 'Error validando permisos de acceso.');
          setCheckingAccess(false);
        }
      }
    };

    validateAccess();

    return () => {
      cancelled = true;
    };
  }, [pathname, routeRules]);

  if (checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(135deg,#112033_0%,#1b2733_55%,#243447_100%)] text-white">
        <div className="rounded-[28px] border border-white/10 bg-white/8 px-7 py-6 shadow-[0_18px_48px_rgba(2,8,23,0.3)] backdrop-blur-sm">
          <div className="text-lg font-semibold">Validando acceso...</div>
          <div className="mt-1 text-sm text-white/60">
            Revisando permisos de usuario y módulos contratados.
          </div>
        </div>
      </div>
    );
  }

  if (accessDeniedMessage) {
    return (
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(135deg,#112033_0%,#1b2733_55%,#243447_100%)] text-white">
        <div className="max-w-md rounded-[28px] border border-red-300/20 bg-red-500/10 px-7 py-6 shadow-[0_18px_48px_rgba(2,8,23,0.32)] backdrop-blur-sm">
          <div className="text-lg font-semibold">Acceso restringido</div>
          <div className="mt-2 text-sm text-white/75">{accessDeniedMessage}</div>

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
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1b2733]"
          >
            Cerrar sesión e ingresar con otra cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#1b2733]">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,#eff4ff_0%,#f5f7fb_36%,#eef2f7_100%)]">
        <div className="sticky top-0 z-30">
          <Header />
        </div>

        <main className="flex-1 overflow-auto px-4 py-4 md:px-6 md:py-5 lg:px-7 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
