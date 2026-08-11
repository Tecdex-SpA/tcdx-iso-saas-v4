'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { useTenantEntitlements } from '@/hooks/useTenantEntitlements';
import {
  CLIENT_MVP_NAV_ITEMS,
  PLATFORM_ROLES,
  canAccessMvpFeature,
  getMvpRouteCapability,
  isPathInRoutes,
} from '@/utils/mvpPermissions';

const TECDEX_LOGO_FALLBACK = '/tecdex.png';
const SERVICE_LOGO_SRC = process.env.NEXT_PUBLIC_TECDX_LOGO_URL || TECDEX_LOGO_FALLBACK;
const PLATFORM_WORDMARK_SRC = process.env.NEXT_PUBLIC_TECDX_WORDMARK_URL || TECDEX_LOGO_FALLBACK;
const POWERED_BY_LOGO_SRC = process.env.NEXT_PUBLIC_TECDX_POWERED_LOGO_URL || TECDEX_LOGO_FALLBACK;

type SidebarProps = { collapsed?: boolean; onToggle?: () => void; moduleMap?: ModuleMap; role?: string };
type NavItemProps = { href: string; label: string; icon: ReactNode; collapsed?: boolean; active?: boolean };
type ModuleMap = Record<string, { module_key: string; module_name?: string; is_enabled: boolean }>;

function NavItem({ href, label, icon, collapsed, active }: NavItemProps) {
  return <a href={href} title={label} aria-current={active ? 'page' : undefined} className={[
    'enterprise-sidebar-item group flex w-full items-center rounded-[var(--tcdx-radius-tecdex-sm)] text-sm font-medium transition-all duration-150 focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]',
    collapsed ? 'justify-center px-2 py-3' : 'justify-start gap-3 px-3 py-3 text-left',
    active ? 'bg-[var(--tcdx-color-primary)] text-white shadow-[var(--shadow-sidebar-active)] ring-1 ring-white/12' : 'text-white/76 hover:bg-white/10 hover:text-white hover:ring-1 hover:ring-white/10',
  ].join(' ')}><span className={['shrink-0 transition-colors', active ? 'text-white' : 'text-white/64 group-hover:text-white'].join(' ')}>{icon}</span>{!collapsed && <span className="block min-w-0 flex-1 truncate text-left">{label}</span>}</a>;
}

function NavIcon({ kind, className }: { kind: 'platform'|'metrics'|'dealer'|'quote'|'billing'|'generic'; className: string }) {
  if (kind === 'platform') return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 8h2a2 2 0 0 1 2 2v11"/><path d="M3 21h18"/><circle cx="19" cy="5" r="2"/></svg>;
  if (kind === 'metrics') return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/><path d="M2 19h22"/></svg>;
  if (kind === 'dealer') return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-7h6v7"/></svg>;
  if (kind === 'quote') return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 11h6M10 15h6M10 19h3"/></svg>;
  if (kind === 'billing') return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>;
}

function MvpIcon({ href, className }: { href: string; className: string }) { return href === '/metricas' ? <NavIcon kind="metrics" className={className}/> : <NavIcon kind="generic" className={className}/>; }

export default function Sidebar({ collapsed = false, onToggle, moduleMap = {}, role = '' }: SidebarProps) {
  const pathname = usePathname(); const { t } = useTranslation();
  const { loading: entitlementsLoading, aiEnabled, canUseAiFeature, hasCapability } = useTenantEntitlements();
  const normalizedRole=String(role||'').toLowerCase(); const isDealer=normalizedRole==='dealer'; const isPlatformAdmin=PLATFORM_ROLES.includes(normalizedRole); const canSeeAiCompliance=!entitlementsLoading&&aiEnabled&&canUseAiFeature('suggestions'); const iconClass='h-5 w-5';
  const isActive=(href:string)=>{if(href==='/cumplimiento-auditoria')return isPathInRoutes(pathname,['/cumplimiento-auditoria','/diagnostico','/iso-health','/health','/controles','/soa','/ciclo-vida','/auditorias','/hallazgos','/no-conformidades']);if(href==='/riesgos')return isPathInRoutes(pathname,['/riesgos','/matriz-riesgo','/activos']);if(href==='/planes-accion')return isPathInRoutes(pathname,['/planes-accion','/plan-accion','/acciones-recomendadas']);if(href==='/configuracion')return isPathInRoutes(pathname,['/configuracion','/usuarios','/perfil','/perfil-empresa']);return pathname===href||pathname.startsWith(`${href}/`);};
  const hasModule=useCallback((moduleKey:string)=>{if(isPlatformAdmin||isDealer)return true;if(!Object.prototype.hasOwnProperty.call(moduleMap,moduleKey))return true;return moduleMap[moduleKey]?.is_enabled===true;},[isDealer,isPlatformAdmin,moduleMap]);
  const hasRouteCapability=useCallback((href:string)=>{if(isPlatformAdmin)return true;const capability=getMvpRouteCapability(href);return !capability || (!entitlementsLoading && hasCapability(capability));},[entitlementsLoading,hasCapability,isPlatformAdmin]);

  const generalItems=useMemo(()=>CLIENT_MVP_NAV_ITEMS.filter((item)=>{if(!canAccessMvpFeature(normalizedRole,item.feature))return false;if(item.href==='/ia-compliance'&&!canSeeAiCompliance)return false;if(item.moduleKey&&!hasModule(item.moduleKey))return false;if(!hasRouteCapability(item.href))return false;return true;}).map((item)=>({...item,icon:<MvpIcon href={item.href} className={iconClass}/> })),[canSeeAiCompliance,hasModule,hasRouteCapability,normalizedRole]);
  const navigationGroups=useMemo(()=>[
    {label:t('sidebar.general'),hrefs:['/dashboard','/cumplimiento-auditoria','/evidencias','/riesgos','/planes-accion','/exportes']},
    {label:'GRC integrado',hrefs:['/grc-global','/operaciones-grc','/grc','/datos']},
    {label:'Analítica y reportes',hrefs:['/metricas','/bi','/reportes/studio']},
    {label:'Evaluación y assurance',hrefs:['/encuestas','/tests','/eventos-perdida']},
    {label:'Sistema',hrefs:['/ia-compliance','/configuracion']},
  ].map((section)=>({...section,items:section.hrefs.map((href)=>generalItems.find((item)=>item.href===href)).filter(Boolean) as typeof generalItems})).filter((section)=>section.items.length>0),[generalItems,t]);

  const platformItems=[{href:'/admin-saas',label:t('sidebar.saasAdmin'),icon:<NavIcon kind="platform" className={iconClass}/>},{href:'/metricas',label:'Métricas y fórmulas',icon:<NavIcon kind="metrics" className={iconClass}/>}];
  const dealerItems=[{href:'/dealer',label:t('sidebar.dealerPortal'),icon:<NavIcon kind="dealer" className={iconClass}/>},{href:'/cotizador',label:t('sidebar.quoteBuilder'),icon:<NavIcon kind="quote" className={iconClass}/>},{href:'/prefacturacion',label:t('sidebar.prebilling'),icon:<NavIcon kind="billing" className={iconClass}/>}];
  const sectionLabel=(label:string)=>collapsed?null:<div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">{label}</div>;

  return <aside className={['enterprise-sidebar tcdx-shell-sidebar relative flex h-screen flex-col border-r border-[var(--tcdx-color-header-border)]/40 text-white shadow-[18px_0_42px_rgba(22,22,22,0.20)] transition-all duration-300',collapsed?'w-[76px] px-2.5 pt-4 pb-5':'w-[260px] px-4 pt-4 pb-5'].join(' ')}>
    <button type="button" onClick={onToggle} aria-label={collapsed?t('sidebar.expandMenu'):t('sidebar.collapseMenu')} aria-expanded={!collapsed} className="absolute -right-3 top-7 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-navy)] shadow-lg transition hover:bg-[var(--tcdx-color-surface)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]" title={collapsed?t('sidebar.expandMenu'):t('sidebar.collapseMenu')}><svg className={`h-4 w-4 transition-transform duration-300 ${collapsed?'rotate-180':''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div className="relative z-10 mb-6 flex min-h-20 items-center justify-center border-b border-white/10 pb-5">{collapsed?<span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/15 bg-white/10 p-1.5"><Image src={SERVICE_LOGO_SRC} alt="TECDEX" width={88} height={88} unoptimized className="h-full w-full object-contain"/></span>:<div className="flex min-h-[124px] w-full items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/12 bg-white/10 px-3 py-3"><Image src={PLATFORM_WORDMARK_SRC} alt="TECDEX" width={260} height={72} unoptimized className="max-h-[78px] w-full object-contain"/></div>}</div>
    <nav className="tcdx-scrollbar relative z-10 flex-1 overflow-y-auto pr-1 text-sm" aria-label="Navegación principal">{isPlatformAdmin&&<>{sectionLabel(t('sidebar.platform'))}<div className="space-y-1.5">{platformItems.map((item)=><NavItem key={item.href} {...item} collapsed={collapsed} active={isActive(item.href)}/>)}</div></>}{isDealer&&!isPlatformAdmin&&<>{sectionLabel(t('sidebar.dealer'))}<div className="space-y-1.5">{dealerItems.map((item)=><NavItem key={item.href} {...item} collapsed={collapsed} active={isActive(item.href)}/>)}</div></>}{!isPlatformAdmin&&!isDealer&&<>{navigationGroups.map((group)=><div key={group.label}>{sectionLabel(group.label)}<div className="space-y-1.5">{group.items.map((item)=><NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} collapsed={collapsed} active={isActive(item.href)}/>)}</div></div>)}</>}</nav>
    <div className={['relative z-10 mt-4 border-t border-white/10 pt-4',collapsed?'flex justify-center':''].join(' ')}>{collapsed?<div title={t('sidebar.poweredBy')} className="flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-white/8 ring-1 ring-white/10"><Image src={SERVICE_LOGO_SRC} alt="Tecdex" width={28} height={28} unoptimized className="h-7 w-7 object-contain"/></div>:<div className="rounded-[var(--tcdx-radius-tecdex-sm)] border border-white/10 bg-white/8 px-3 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-[rgba(240,114,29,0.16)] text-[var(--tcdx-color-primary)]"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z"/><path d="M9 12l2 2 4-5"/></svg></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Sistema</p><p className="mt-1 truncate text-sm font-bold text-white">v2.4.1</p></div></div><Image src={POWERED_BY_LOGO_SRC} alt="Tecdex" width={112} height={32} unoptimized className="mt-3 h-8 w-auto object-contain opacity-80"/></div>}</div>
  </aside>;
}
