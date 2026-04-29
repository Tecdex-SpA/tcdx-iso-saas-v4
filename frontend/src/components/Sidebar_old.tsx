'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

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
        'group flex items-center rounded-xl text-sm font-medium transition-all duration-200',
        collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-[#32485f] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'text-white/90 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </a>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();

  const [role, setRole] = useState<string | null>(null);
  const [standards, setStandards] = useState<string[]>([]);
  const [moduleMap, setModuleMap] = useState<ModuleMap | null>(null);

  useEffect(() => {
    const user = getUserFromToken();
    setRole(user?.role || null);

    const loadStandards = async () => {
      const token = localStorage.getItem('token');

      if (!user?.tenant_id || !token) return;

      try {
        const res = await fetch(
          `${API_URL}/api/tenant-standards/${user.tenant_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const json = await res.json();

        if (!res.ok) {
          console.error('ERROR LOAD SIDEBAR STANDARDS:', json);
          setStandards([]);
          return;
        }

        const activeCodes = (json || [])
          .filter((s: any) => s.is_active === true)
          .map((s: any) => s.code);

        setStandards(activeCodes);
      } catch (err) {
        console.error('ERROR LOAD SIDEBAR STANDARDS:', err);
        setStandards([]);
      }
    };

    const loadModules = async () => {
      const token = localStorage.getItem('token');

      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/api/me/modules`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          console.error('ERROR LOAD SIDEBAR MODULES:', json);
          setModuleMap(null);
          return;
        }

        setModuleMap(json?.module_map || {});
      } catch (err) {
        console.error('ERROR LOAD SIDEBAR MODULES:', err);
        setModuleMap(null);
      }
    };

    loadStandards();
    loadModules();
  }, []);

  const normalizedRole = String(role || '').toLowerCase();

  const isDealer = normalizedRole === 'dealer';

  const isPlatformAdmin =
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin';

  const isAdmin = normalizedRole === 'admin';
  const isAuditor = normalizedRole === 'auditor';

  const soaStandards = [
    'ISO27001',
    'ISO/IEC27701',
    'ISO/IEC27017',
    'ISO/IEC27018',
  ];

  const hasActiveStandards = standards.length > 0;
  const showSoA = standards.some((code) => soaStandards.includes(code));
  const iconClass = 'w-5 h-5';

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  function hasModule(moduleKey: string) {
    /*
      Blindaje comercial:
      - Si todavía no cargó moduleMap, mostramos el menú para no romper UX.
      - Si el módulo no existe en el mapa, también mostramos para evitar falsos bloqueos.
      - Solo ocultamos cuando el backend informa explícitamente is_enabled: false.
    */
    if (!moduleMap) return true;

    if (!Object.prototype.hasOwnProperty.call(moduleMap, moduleKey)) {
      return true;
    }

    return moduleMap[moduleKey]?.is_enabled === true;
  }

  const healthIcon = (
    <svg
      className={iconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      <path d="M3.5 12h4l1.5-3 3 6 2-4h6.5" />
    </svg>
  );

  const adminSaasIcon = (
    <svg
      className={iconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 8h2a2 2 0 0 1 2 2v11" />
      <path d="M3 21h18" />
      <path d="M8 7h2" />
      <path d="M8 11h2" />
      <path d="M8 15h2" />
      <path d="M16 13h1" />
      <path d="M16 17h1" />
      <circle cx="19" cy="5" r="2" />
      <path d="M19 3v-1" />
      <path d="M19 8v-1" />
      <path d="M17.3 3.7l-.7-.7" />
      <path d="M21.4 7l-.7-.7" />
    </svg>
  );

  const dealerIcon = (
    <svg
      className={iconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-7h6v7" />
      <path d="M9 9h.01" />
      <path d="M12 9h.01" />
      <path d="M15 9h.01" />
      <circle cx="18" cy="5" r="2" />
      <path d="M20 7l1.5 1.5" />
    </svg>
  );

  const reportsIcon = (
    <svg
      className={iconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h3" />
    </svg>
  );

  return (
    <aside
      className={[
        'relative h-screen bg-[#243447] text-white flex flex-col border-r border-white/10 shadow-2xl transition-all duration-300',
        collapsed ? 'w-[88px] px-3 pt-3 pb-5' : 'w-64 px-5 pt-3 pb-5',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-6 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-[#31485f] bg-[#243447] text-white shadow-lg hover:bg-[#2d4156]"
        title={collapsed ? 'Expandir menú' : 'Contraer menú'}
      >
        <svg
          className={`h-4 w-4 transition-transform duration-300 ${
            collapsed ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div
        className={`flex items-center h-16 mb-5 ${
          collapsed ? 'justify-center' : 'justify-start pl-1'
        }`}
      >
        <img
          src="/logo.png"
          alt="Logo"
          className={
            collapsed
              ? 'w-10 h-10 object-contain'
              : 'w-28 h-auto object-contain scale-150 origin-left'
          }
        />
      </div>

      <nav className="flex-1 space-y-2 text-sm overflow-y-auto pr-1">
        {isPlatformAdmin && (
          <>
            <NavItem
              href="/empresas"
              label="Empresas"
              collapsed={collapsed}
              active={isActive('/empresas')}
              icon={
                <svg
                  className={iconClass}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 21h18M9 21V9h6v12M5 21V5h14v16" />
                </svg>
              }
            />

            <NavItem
              href="/admin-saas"
              label="Administración SaaS"
              collapsed={collapsed}
              active={isActive('/admin-saas')}
              icon={adminSaasIcon}
            />

            <NavItem
              href="/usuarios"
              label="Usuarios"
              collapsed={collapsed}
              active={isActive('/usuarios')}
              icon={
                <svg
                  className={iconClass}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />

            <NavItem
              href="/health"
              label="Salud ISO"
              collapsed={collapsed}
              active={isActive('/health')}
              icon={healthIcon}
            />

            <NavItem
              href="/exportes"
              label="Reportes"
              collapsed={collapsed}
              active={isActive('/exportes')}
              icon={reportsIcon}
            />
          </>
        )}

        {isDealer && !isPlatformAdmin && (
          <>
            <NavItem
              href="/dealer"
              label="Portal Dealer"
              collapsed={collapsed}
              active={isActive('/dealer')}
              icon={dealerIcon}
            />

            <NavItem
              href="/exportes"
              label="Reportes"
              collapsed={collapsed}
              active={isActive('/exportes')}
              icon={reportsIcon}
            />
          </>
        )}

        {!isPlatformAdmin && !isDealer && (
          <>
            <NavItem
              href="/dashboard"
              label="Dashboard"
              collapsed={collapsed}
              active={isActive('/dashboard')}
              icon={
                <svg
                  className={iconClass}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 12l9-9 9 9" />
                  <path d="M9 21V9h6v12" />
                </svg>
              }
            />

            <NavItem
              href="/health"
              label="Salud ISO"
              collapsed={collapsed}
              active={isActive('/health')}
              icon={healthIcon}
            />

            <NavItem
              href="/exportes"
              label="Reportes"
              collapsed={collapsed}
              active={isActive('/exportes')}
              icon={reportsIcon}
            />

            {hasModule('kpis') && (
              <NavItem
                href="/administrar-kpis"
                label="Administración de KPI"
                collapsed={collapsed}
                active={isActive('/administrar-kpis')}
                icon={
                  <svg
                    className={iconClass}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M7 14l3-3 3 2 4-5" />
                    <circle cx="7" cy="14" r="1" />
                    <circle cx="10" cy="11" r="1" />
                    <circle cx="13" cy="13" r="1" />
                    <circle cx="17" cy="8" r="1" />
                  </svg>
                }
              />
            )}

            {hasActiveStandards && (
              <>
                <NavItem
                  href="/diagnostico"
                  label="Diagnóstico"
                  collapsed={collapsed}
                  active={isActive('/diagnostico')}
                  icon={
                    <svg
                      className={iconClass}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  }
                />

                {!isAuditor && (
                  <NavItem
                    href="/controles"
                    label="Controles"
                    collapsed={collapsed}
                    active={isActive('/controles')}
                    icon={
                      <svg
                        className={iconClass}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 3H5a2 2 0 0 0-2 2v4" />
                        <path d="M15 3h4a2 2 0 0 1 2 2v4" />
                        <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
                        <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
                        <rect x="8" y="8" width="8" height="8" rx="1" />
                      </svg>
                    }
                  />
                )}

                {hasModule('risks') && (
                  <>
                    <NavItem
                      href="/matriz-riesgo"
                      label="Matriz de Riesgo"
                      collapsed={collapsed}
                      active={isActive('/matriz-riesgo')}
                      icon={
                        <svg
                          className={iconClass}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10.29 3.86l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      }
                    />

                    <NavItem
                      href="/activos"
                      label="Activos"
                      collapsed={collapsed}
                      active={isActive('/activos')}
                      icon={
                        <svg
                          className={iconClass}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                      }
                    />
                  </>
                )}

                {showSoA && (
                  <NavItem
                    href="/soa"
                    label="SoA"
                    collapsed={collapsed}
                    active={isActive('/soa')}
                    icon={
                      <svg
                        className={iconClass}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
                      </svg>
                    }
                  />
                )}

                <NavItem
                  href="/plan-accion"
                  label="Plan de Acción"
                  collapsed={collapsed}
                  active={isActive('/plan-accion')}
                  icon={
                    <svg
                      className={iconClass}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    </svg>
                  }
                />

                <NavItem
                  href="/no-conformidades"
                  label="No Conformidades"
                  collapsed={collapsed}
                  active={isActive('/no-conformidades')}
                  icon={
                    <svg
                      className={iconClass}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  }
                />

                {hasModule('audits') && (
                  <NavItem
                    href="/auditorias"
                    label="Auditorías"
                    collapsed={collapsed}
                    active={isActive('/auditorias')}
                    icon={
                      <svg
                        className={iconClass}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16" />
                        <path d="M14 2v6h6" />
                        <circle cx="11" cy="13" r="3" />
                        <line x1="16" y1="18" x2="14.5" y2="16.5" />
                      </svg>
                    }
                  />
                )}

                {hasModule('evidences') && (
                  <NavItem
                    href="/evidencias"
                    label="Evidencias"
                    collapsed={collapsed}
                    active={isActive('/evidencias')}
                    icon={
                      <svg
                        className={iconClass}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 7h5l2 3h11v10H3z" />
                      </svg>
                    }
                  />
                )}

                <NavItem
                  href="/hallazgos"
                  label="Hallazgos"
                  collapsed={collapsed}
                  active={isActive('/hallazgos')}
                  icon={
                    <svg
                      className={iconClass}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M4 22V4" />
                      <path d="M4 4h12l-2 3 2 3H4" />
                    </svg>
                  }
                />

                {!isAuditor && hasModule('ai') && (
                  <NavItem
                    href="/ia-compliance"
                    label="IA Compliance"
                    collapsed={collapsed}
                    active={isActive('/ia-compliance')}
                    icon={
                      <svg
                        className={iconClass}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 3a4 4 0 0 0-4 4v1" />
                        <path d="M15 3a4 4 0 0 1 4 4v1" />
                        <path d="M9 21a4 4 0 0 1-4-4v-1" />
                        <path d="M15 21a4 4 0 0 0 4-4v-1" />
                      </svg>
                    }
                  />
                )}
              </>
            )}

            {isAdmin && (
              <NavItem
                href="/usuarios"
                label="Usuarios"
                collapsed={collapsed}
                active={isActive('/usuarios')}
                icon={
                  <svg
                    className={iconClass}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="7" r="4" />
                    <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
                  </svg>
                }
              />
            )}
          </>
        )}
      </nav>

      <div
        className={[
          'mt-4 border-t border-white/10 pt-4',
          collapsed ? 'flex justify-center' : '',
        ].join(' ')}
      >
        {collapsed ? (
          <div
            title="Powered by Tecdex"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5"
          >
            <img
              src="/logo.png"
              alt="Tecdex"
              className="h-7 w-7 object-contain"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
              Powered by
            </p>
            <div className="flex items-center gap-3">
              <img
                src="/tecdex.png"
                alt="Tecdex"
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
