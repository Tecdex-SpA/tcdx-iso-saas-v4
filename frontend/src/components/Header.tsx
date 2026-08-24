'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getUserFromToken } from '@/utils/auth';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';
import { getEnterpriseNavigationContext } from '@/config/enterpriseNavigation';

type SearchResult = {
  id: string;
  type:
    | 'norma'
    | 'clausula'
    | 'control'
    | 'hallazgo'
    | 'auditoria'
    | 'riesgo'
    | 'plan'
    | 'evidencia'
    | 'activo';
  title: string;
  subtitle: string;
  href: string;
};

type SearchHistoryItem = {
  id: string;
  query: string;
  result_type?: string;
  result_title?: string;
  result_href?: string;
  clicked_at: string;
};

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  href: string;
  level: 'critical' | 'warning' | 'info';
  is_read?: boolean;
};

type UnknownRecord = Record<string, unknown>;

type HeaderUser = {
  id?: string | null;
  userId?: string | null;
  tenant_id?: string | null;
  avatar?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type TenantInfo = {
  name?: string | null;
  company_name?: string | null;
  legal_name?: string | null;
  plan_name?: string | null;
  plan?: string | null;
  logo_public_url?: string | null;
  report_logo_url?: string | null;
  logo_url?: string | null;
  brand_logo_url?: string | null;
  logo?: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

const SERVICE_LOGO_SRC =
  process.env.NEXT_PUBLIC_TCDX_LOGO_URL || '/logo.png';

function encodeAssetPath(value: string) {
  return String(value || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeHeaderUser(value: unknown): HeaderUser | null {
  if (!isRecord(value)) return null;

  return {
    id: stringField(value, 'id'),
    userId: stringField(value, 'userId'),
    tenant_id: stringField(value, 'tenant_id'),
    avatar: stringField(value, 'avatar'),
    full_name: stringField(value, 'full_name'),
    name: stringField(value, 'name'),
    email: stringField(value, 'email'),
    role: stringField(value, 'role'),
  };
}

function normalizeTenant(value: unknown): TenantInfo | null {
  if (!isRecord(value)) return null;

  return {
    name: stringField(value, 'name'),
    company_name: stringField(value, 'company_name'),
    legal_name: stringField(value, 'legal_name'),
    plan_name: stringField(value, 'plan_name'),
    plan: stringField(value, 'plan'),
    logo_public_url: stringField(value, 'logo_public_url'),
    report_logo_url: stringField(value, 'report_logo_url'),
    logo_url: stringField(value, 'logo_url'),
    brand_logo_url: stringField(value, 'brand_logo_url'),
    logo: stringField(value, 'logo'),
  };
}

function buildAssetCandidates(value?: string | null) {
  const raw = String(value || '').trim();

  if (!raw) return [];

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:')
  ) {
    return [raw];
  }

  if (raw.startsWith('/')) {
    return uniqueStrings([
      `${API_URL}${raw}`,
      raw,
    ]);
  }

  const encoded = encodeAssetPath(raw);

  return uniqueStrings([
    `${API_URL}/uploads/logos/${encoded}`,
    `${API_URL}/uploads/tenants/${encoded}`,
    `${API_URL}/uploads/tenant-logos/${encoded}`,
    `${API_URL}/uploads/${encoded}`,
    `${API_URL}/${encoded}`,
  ]);
}

function unwrapTenantPayload(payload: unknown): TenantInfo | null {
  if (!isRecord(payload)) return null;
  return normalizeTenant(payload.data || payload.tenant || payload.item || payload);
}

function buildTenantLogoCandidates(tenant: TenantInfo | null) {
  const candidates = [
    ...buildAssetCandidates(tenant?.logo_public_url),
    ...buildAssetCandidates(tenant?.report_logo_url),
    ...buildAssetCandidates(tenant?.logo_url),
    ...buildAssetCandidates(tenant?.brand_logo_url),
    ...buildAssetCandidates(tenant?.logo),
  ];

  return uniqueStrings(candidates);
}

type HeaderProps = {
  onMenuClick?: () => void;
  mobileMenuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
};

export default function Header({ onMenuClick, mobileMenuOpen = false, menuButtonRef }: HeaderProps) {
  const { locale, t } = useTranslation();
  const pathname = usePathname();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [logoCandidates, setLogoCandidates] = useState<string[]>([SERVICE_LOGO_SRC]);
  const [logoIndex, setLogoIndex] = useState(0);
  const logo = logoCandidates[logoIndex] || SERVICE_LOGO_SRC;

  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const tokenRef = useRef<string | null>(null);
  const tenantIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const data = normalizeHeaderUser(getUserFromToken());
    const token = localStorage.getItem('token');

    tokenRef.current = token;
    tenantIdRef.current = data?.tenant_id || null;
    userIdRef.current = data?.userId || data?.id || null;

    if (token) {
      fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((payload) => setUser(normalizeHeaderUser(payload)))
        .catch(console.error);
    }

    if (data?.tenant_id && token) {
      fetch(`${API_URL}/api/tenants/${data.tenant_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((payload) => {
          const t = unwrapTenantPayload(payload);

          setTenant(t);

          const candidates = buildTenantLogoCandidates(t);

          if (candidates.length > 0) {
            setLogoCandidates(candidates);
            setLogoIndex(0);
          } else {
            setLogoCandidates([SERVICE_LOGO_SRC]);
            setLogoIndex(0);
          }
        })
        .catch((err) => {
          console.error(err);
          setLogoCandidates([SERVICE_LOGO_SRC]);
          setLogoIndex(0);
        });

      loadNotifications(data.tenant_id, token);
      loadRecentSearches(data.tenant_id, token, data?.userId || data?.id || null);
    }
  }, []);

  useEffect(() => {
    const handleProfileAvatarUpdated = () => {
      const token = tokenRef.current || localStorage.getItem('token');
      if (!token) return;

      fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((payload) => setUser(normalizeHeaderUser(payload)))
        .catch(console.error);
    };

    window.addEventListener('profile-avatar-updated', handleProfileAvatarUpdated);
    return () => window.removeEventListener('profile-avatar-updated', handleProfileAvatarUpdated);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCmdK) {
        event.preventDefault();
        setSearchOpen(true);
        const el = document.getElementById('global-header-search');
        if (el) {
          setTimeout(() => (el as HTMLInputElement).focus(), 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const tenantId = tenantIdRef.current;
    const token = tokenRef.current;
    const q = search.trim();

    if (!tenantId || !token) return;

    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setActiveIndex(-1);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        setSearchLoading(true);

        const res = await fetch(
          `${API_URL}/api/search/global/${tenantId}?q=${encodeURIComponent(q)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const json = await res.json();
        setSearchResults(Array.isArray(json) ? json : []);
        setActiveIndex(-1);
      } catch (err: unknown) {
        if (!(err instanceof Error) || err.name !== 'AbortError') {
          console.error(err);
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const loadRecentSearches = async (
    tenantId: string,
    token: string,
    userId?: string | null
  ) => {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_URL}/api/search/history/${tenantId}${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setRecentSearches(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error('RECENT SEARCHES ERROR:', err);
      setRecentSearches([]);
    }
  };

  const loadNotifications = async (tenantId: string, token: string) => {
    try {
      setNotificationsLoading(true);
      const res = await fetch(`${API_URL}/api/notifications/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setNotifications(Array.isArray(json?.items) ? json.items : []);
    } catch (err) {
      console.error('NOTIFICATIONS ERROR:', err);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const trackSearchClick = async (result: SearchResult) => {
    try {
      const tenantId = tenantIdRef.current;
      const token = tokenRef.current;
      if (!tenantId || !token) return;

      await fetch(`${API_URL}/api/search/history/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId,
          userId: userIdRef.current,
          query: search.trim(),
          resultType: result.type,
          resultTitle: result.title,
          resultHref: result.href,
        }),
      });

      await loadRecentSearches(tenantId, token, userIdRef.current);
    } catch (err) {
      console.error('TRACK SEARCH CLICK ERROR:', err);
    }
  };

  const handleResultNavigate = async (result: SearchResult) => {
    await trackSearchClick(result);
    window.location.href = result.href;
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = search.trim().length >= 2 ? searchResults : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!list.length) return;
      setActiveIndex((prev) => (prev + 1) % list.length);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!list.length) return;
      setActiveIndex((prev) => (prev <= 0 ? list.length - 1 : prev - 1));
    }

    if (e.key === 'Enter') {
      if (list.length && activeIndex >= 0 && list[activeIndex]) {
        e.preventDefault();
        await handleResultNavigate(list[activeIndex]);
      }
    }

    if (e.key === 'Escape') {
      setSearchOpen(false);
      setActiveIndex(-1);
    }
  };

  const markNotificationRead = async (notification: NotificationItem) => {
    try {
      const token = tokenRef.current;
      if (!token) return;

      await fetch(`${API_URL}/api/notifications/${notification.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );

      window.location.href = notification.href;
    } catch (err) {
      console.error('MARK NOTIFICATION READ ERROR:', err);
      window.location.href = notification.href;
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const token = tokenRef.current;
      const tenantId = tenantIdRef.current;
      if (!token || !tenantId) return;

      await fetch(`${API_URL}/api/notifications/tenant/${tenantId}/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('MARK ALL READ ERROR:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const avatarUrl = user?.avatar ? `${API_URL}/uploads/profiles/${user.avatar}` : null;
  const displayName = user?.full_name || user?.name || user?.email || t('header.userFallback');
  const tenantDisplayName =
    tenant?.name ||
    tenant?.company_name ||
    tenant?.legal_name ||
    t('header.tenantActive');
  const tenantSubtext = tenant?.plan_name || tenant?.plan || t('header.tenantActive');
  const hasTenantLogo = Boolean(logo && logo !== SERVICE_LOGO_SRC);
  const tenantLogoSource = hasTenantLogo ? logo : SERVICE_LOGO_SRC;

  const lastSync = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const getTypeClasses = (type: SearchResult['type']) => {
    switch (type) {
      case 'norma':
        return 'bg-blue-100 text-blue-700';
      case 'clausula':
        return 'bg-cyan-100 text-cyan-700';
      case 'control':
        return 'bg-violet-100 text-violet-700';
      case 'hallazgo':
        return 'bg-red-100 text-red-700';
      case 'auditoria':
        return 'bg-amber-100 text-amber-700';
      case 'riesgo':
        return 'bg-orange-100 text-orange-700';
      case 'plan':
        return 'bg-emerald-100 text-emerald-700';
      case 'evidencia':
        return 'bg-indigo-100 text-indigo-700';
      case 'activo':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getNotificationClasses = (level: NotificationItem['level']) => {
    if (level === 'critical') return 'bg-red-100 text-red-700';
    if (level === 'warning') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  const displayResults = search.trim().length >= 2 ? searchResults : [];
  const navigationContext = useMemo(
    () => getEnterpriseNavigationContext(pathname),
    [pathname]
  );
  const breadcrumbSegments = useMemo(() => {
    const homeLabel = t('navigation.domains.home');
    const segments = [{ key: 'home', label: homeLabel, href: '/dashboard' }];

    if (navigationContext.domain) {
      const domainLabel = t(navigationContext.domain.labelKey);

      if (
        navigationContext.domain.id !== 'home' &&
        domainLabel !== segments[segments.length - 1].label
      ) {
        segments.push({
          key: `domain-${navigationContext.domain.id}`,
          label: domainLabel,
          href: navigationContext.domain.href,
        });
      }
    }

    if (navigationContext.item) {
      const itemLabel = navigationContext.item.labelKey
        ? t(navigationContext.item.labelKey)
        : navigationContext.item.label;

      if (itemLabel && itemLabel !== segments[segments.length - 1].label) {
        segments.push({
          key: `item-${navigationContext.item.href}`,
          label: itemLabel,
          href: navigationContext.item.href,
        });
      }
    }

    return segments.map((segment, index) => ({
      ...segment,
      current: index === segments.length - 1,
    }));
  }, [navigationContext, t]);

  const visibleBreadcrumbSegments = useMemo(() => {
    if (breadcrumbSegments.length <= 2) return breadcrumbSegments;

    const middleLabels = breadcrumbSegments
      .slice(1, -1)
      .map((segment) => segment.label)
      .join(' / ');

    return [
      breadcrumbSegments[0],
      {
        key: 'breadcrumb-ellipsis',
        label: '…',
        href: '',
        current: false,
        ellipsis: true,
        title: middleLabels,
      },
      breadcrumbSegments[breadcrumbSegments.length - 1],
    ];
  }, [breadcrumbSegments]);

  return (
    <header className="enterprise-topbar tcdx-shell-header relative px-3 py-2.5 text-[var(--tcdx-color-text-ink)] sm:px-4 md:px-5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[minmax(0,1.45fr)_minmax(170px,0.85fr)_auto] xl:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.9fr)_auto] xl:gap-3">
        <div className="flex min-w-0 items-center gap-2 xl:gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            ref={menuButtonRef}
            aria-label={t('header.openMenu')}
            aria-controls="mobile-sidebar-drawer"
            aria-expanded={mobileMenuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-navy)] shadow-[var(--tcdx-shadow-tecdex-sm)] transition hover:bg-[var(--tcdx-color-surface)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)] lg:hidden"
            title={t('header.openMenu')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <nav className="hidden min-w-[190px] max-w-[440px] flex-1 items-center gap-1.5 overflow-hidden text-xs lg:flex" aria-label={t('navigation.breadcrumb')}>
            {visibleBreadcrumbSegments.map((segment, index) => {
              const showSeparator = index < visibleBreadcrumbSegments.length - 1;
              const isLast = index === visibleBreadcrumbSegments.length - 1;
              const title = 'title' in segment && segment.title ? segment.title : segment.label;

              return (
                <span key={segment.key} className={['flex min-w-0 items-center gap-1.5', isLast ? 'flex-1' : 'shrink-0'].join(' ')}>
                  {'ellipsis' in segment && segment.ellipsis ? (
                    <span className="shrink-0 rounded px-1 font-semibold text-[var(--tcdx-color-text-secondary)]" title={title} aria-label={title}>
                      …
                    </span>
                  ) : segment.current ? (
                    <span
                      aria-current="page"
                      title={segment.label}
                      className="min-w-0 truncate font-semibold text-[var(--tcdx-color-text-ink)]"
                    >
                      {segment.label}
                    </span>
                  ) : (
                    <a
                      href={segment.href}
                      title={segment.label}
                      className="shrink-0 whitespace-nowrap font-medium text-[var(--tcdx-color-text-secondary)] transition hover:text-[var(--tcdx-color-primary)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]"
                    >
                      {segment.label}
                    </a>
                  )}
                  {showSeparator ? (
                    <span className="shrink-0 text-[var(--tcdx-color-text-secondary)]">/</span>
                  ) : null}
                </span>
              );
            })}
          </nav>

          <div className="flex min-w-[142px] max-w-[240px] shrink-0 items-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-2.5 py-1.5 shadow-[var(--tcdx-shadow-tecdex-sm)] lg:min-w-[168px] xl:max-w-[300px] xl:gap-3 xl:px-3" title={`${tenantDisplayName} · ${tenantSubtext}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-0.5 shadow-sm xl:h-11 xl:w-11">
              <Image
                src={tenantLogoSource}
                width={56}
                height={56}
                unoptimized
                className="h-full w-full object-contain"
                alt={tenant?.name ? `Logo ${tenant.name}` : t('header.clientLogoAlt')}
                onError={() => {
                  setLogoIndex((prev) => {
                    const next = prev + 1;

                    if (next < logoCandidates.length) {
                      return next;
                    }

                    if (logo !== SERVICE_LOGO_SRC) {
                      setLogoCandidates([SERVICE_LOGO_SRC]);
                      return 0;
                    }

                    return prev;
                  });
                }}
              />
            </span>

            <div className="hidden min-w-0 sm:block">
              <div className="max-w-[92px] truncate text-[13px] font-semibold leading-tight tracking-normal text-[var(--tcdx-color-text-ink)] lg:max-w-[120px] xl:max-w-[190px] 2xl:max-w-[240px]">
                {tenantDisplayName}
              </div>
              <div className="mt-0.5 hidden max-w-[190px] truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--tcdx-color-text-secondary)] xl:block 2xl:max-w-[240px]">
                {tenantSubtext}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 md:block">
          <div ref={searchRef} className="relative min-w-0">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <TcdxIcon name="search" className="h-4 w-4" />
              </span>

              <input
                id="global-header-search"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('header.searchPlaceholder') || 'Buscar controles, evidencias, riesgos...'}
                role="combobox"
                aria-expanded={searchOpen}
                aria-controls="global-header-search-results"
                className="w-full min-w-0 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white py-2.5 pl-10 pr-4 text-sm text-[var(--tcdx-color-text-ink)] placeholder:text-[var(--tcdx-color-text-secondary)] transition focus:border-[var(--tcdx-color-primary)] focus:bg-white focus:shadow-[var(--tcdx-shadow-tecdex-focus)] xl:pr-16"
              />

              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-2 py-0.5 text-[10px] text-[var(--tcdx-color-text-secondary)] xl:block">
                ⌘K
              </span>
            </div>

            {searchOpen && (
              <div id="global-header-search-results" className="absolute right-0 z-50 mt-3 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-ink)] shadow-[var(--tcdx-shadow-tecdex-lg)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{t('header.searchTitle')}</div>
                  <div className="text-xs text-slate-500">{t('header.searchHelp')}</div>
                </div>

                {search.trim() === '' ? (
                  <div className="p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {t('header.recentSearches')}
                    </div>

                    {recentSearches.length === 0 ? (
                      <div className="text-sm text-slate-500">{t('header.noSearchHistory')}</div>
                    ) : (
                      <div className="space-y-2">
                        {recentSearches.map((item) => (
                          <a
                            key={item.id}
                            href={item.result_href || '#'}
                            className="block rounded-xl px-3 py-2 hover:bg-slate-50"
                          >
                            <div className="font-medium text-slate-900">{item.query}</div>
                            <div className="text-sm text-slate-500">
                              {item.result_title || item.result_type || t('header.recentResult')}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : searchLoading ? (
                  <div className="p-4 text-sm text-slate-500">{t('header.searching')}</div>
                ) : displayResults.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    {t('header.noSearchResults')} <b>{search}</b>.
                  </div>
                ) : (
                  <div className="max-h-[430px] overflow-auto p-2">
                    {displayResults.map((result, index) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        type="button"
                        onClick={() => handleResultNavigate(result)}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                          activeIndex === index ? 'bg-[rgba(240,114,29,0.08)]' : 'hover:bg-[var(--tcdx-color-surface)]'
                        }`}
                      >
                        <span className={`mt-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${getTypeClasses(result.type)}`}>
                          {result.type}
                        </span>

                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{result.title}</div>
                          <div className="truncate text-sm text-slate-500">{result.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5 xl:gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-primary)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)] md:hidden"
            aria-label={t('header.searchTitle')}
            aria-expanded={searchOpen}
            aria-controls="global-header-search-mobile"
            onClick={() => {
              setSearchOpen((prev) => !prev);
              setTimeout(() => document.getElementById('global-header-search-mobile')?.focus(), 50);
            }}
          >
            <TcdxIcon name="search" className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-secondary)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)] xl:flex 2xl:hidden"
            aria-label={`${t('header.lastSync')}: ${lastSync}`}
            title={`${t('header.lastSync')}: ${lastSync}`}
          >
            <TcdxIcon name="calendar" className="h-4 w-4" />
          </button>

          <div className="hidden 2xl:flex items-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] px-3 py-2 text-xs text-[var(--tcdx-color-text-primary)] shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] bg-white text-[var(--tcdx-color-secondary)] shadow-sm">
              <TcdxIcon name="calendar" className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-[var(--tcdx-color-text-secondary)]">{t('header.lastSync')}</div>
              <div className="font-semibold text-[var(--tcdx-color-text-ink)]">{lastSync}</div>
            </div>
          </div>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              aria-label={t('header.notifications')}
              aria-haspopup="menu"
              aria-expanded={notificationsOpen}
              className="relative flex h-10 w-10 items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-primary)] shadow-sm transition hover:bg-[var(--tcdx-color-surface)] hover:text-[var(--tcdx-color-text-ink)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)]"
              title={t('header.notifications')}
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <TcdxIcon name="bell" className="h-5 w-5" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--tcdx-color-primary)] px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-ink)] shadow-[var(--tcdx-shadow-tecdex-lg)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">{t('header.notifications')}</div>
                    <div className="text-xs text-slate-500">{t('header.notificationsSubtitle')}</div>
                  </div>

                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-[var(--tcdx-color-primary)] hover:text-[var(--tcdx-color-primary-hover)]"
                  >
                    {t('header.markAllRead')}
                  </button>
                </div>

                <div className="max-h-[380px] overflow-auto p-2">
                  {notificationsLoading ? (
                    <div className="p-3 text-sm text-slate-500">{t('header.loadingNotifications')}</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">{t('header.noNotifications')}</div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markNotificationRead(item)}
                        className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 ${
                          item.is_read ? 'opacity-70' : ''
                        }`}
                      >
                        <span className={`mt-1 rounded-full px-2 py-1 text-[10px] font-semibold ${getNotificationClasses(item.level)}`}>
                          {item.level === 'critical' ? t('header.critical') : item.level === 'warning' ? t('header.warning') : t('header.info')}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{item.description || t('header.noDescription')}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-1.5 xl:gap-2" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                className="flex min-w-0 items-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-1.5 py-1 text-left shadow-sm transition hover:bg-[var(--tcdx-color-surface)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)] xl:px-2"
                onClick={() => setOpen(!open)}
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="avatar"
                    width={40}
                    height={40}
                    unoptimized
                    className="h-9 w-9 rounded-full border border-[var(--tcdx-color-border)] object-cover shadow-md xl:h-10 xl:w-10"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(81,171,168,0.35)] bg-[var(--tcdx-color-secondary)] text-sm font-bold text-white xl:h-10 xl:w-10">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden min-w-0 max-w-[120px] 2xl:block">
                  <div className="truncate text-sm font-semibold text-[var(--tcdx-color-text-ink)]">{displayName}</div>
                  <div className="truncate text-xs text-[var(--tcdx-color-text-secondary)]">
                    {tenant?.name || user?.role || t('header.userFallback')}
                  </div>
                </div>
              </button>

              {open && (
                <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-4 text-[var(--tcdx-color-text-ink)] shadow-[var(--tcdx-shadow-tecdex-lg)]" role="menu">
                  <div className="flex items-center gap-3 mb-3">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="avatar"
                        width={56}
                        height={56}
                        unoptimized
                        className="h-14 w-14 rounded-full border border-[var(--tcdx-color-border)] object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--tcdx-color-secondary)] text-lg font-bold text-white">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--tcdx-color-text-ink)]">{displayName}</p>
                      <p className="truncate text-sm text-[var(--tcdx-color-text-secondary)]">{user?.email}</p>
                      <p className="truncate text-sm text-[var(--tcdx-color-text-secondary)]">{tenant?.name}</p>
                    </div>
                  </div>

                  <div className="mb-3 rounded-[var(--tcdx-radius-tecdex-sm)] bg-[var(--tcdx-color-surface)] px-3 py-3 text-xs text-[var(--tcdx-color-text-secondary)]">
                    {t('header.profileHint')}
                  </div>

                  <div className="mb-3 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white px-3 py-2 text-xs text-[var(--tcdx-color-text-secondary)]">
                    <div className="font-semibold uppercase tracking-[0.08em] text-[var(--tcdx-color-text-muted)]">
                      {t('header.lastSync')}
                    </div>
                    <div className="mt-1 text-[var(--tcdx-color-text-ink)]">{lastSync}</div>
                  </div>

                  <hr className="my-2 border-slate-200" />

                  <button
                    role="menuitem"
                    className="w-full rounded-[var(--tcdx-radius-tecdex-sm)] p-3 text-left text-sm transition hover:bg-[rgba(240,114,29,0.08)] hover:text-[var(--tcdx-color-primary)]"
                    onClick={() => {
                      setOpen(false);
                      window.location.href = '/perfil';
                    }}
                  >
                    {t('header.profile')}
                  </button>

                  <button
                    role="menuitem"
                    className="mt-1 flex w-full items-center gap-2 rounded-[var(--tcdx-radius-tecdex-sm)] p-3 text-left text-sm font-semibold text-[var(--tcdx-color-primary)] transition hover:bg-[rgba(240,114,29,0.08)]"
                    onClick={logout}
                  >
                    <TcdxIcon name="logout" className="h-4 w-4" />
                    {t('header.logout')}
                  </button>
                </div>
              )}
            </div>

            <button
              className="hidden h-10 items-center gap-2 rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white px-3 text-sm font-semibold text-[var(--tcdx-color-text-primary)] shadow-sm transition hover:border-[var(--tcdx-color-primary)] hover:bg-[rgba(240,114,29,0.08)] hover:text-[var(--tcdx-color-primary)] focus-visible:shadow-[var(--tcdx-shadow-tecdex-focus)] 2xl:inline-flex"
              onClick={logout}
              title={t('header.logout')}
            >
              <TcdxIcon name="logout" className="h-4 w-4" />
              <span>{t('header.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="absolute left-3 right-3 top-[calc(100%+8px)] z-50 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white p-3 text-[var(--tcdx-color-text-ink)] shadow-[var(--tcdx-shadow-tecdex-lg)] md:hidden">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <TcdxIcon name="search" className="h-4 w-4" />
            </span>
            <input
              id="global-header-search-mobile"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('header.searchPlaceholder') || 'Buscar controles, evidencias, riesgos...'}
              role="combobox"
              aria-expanded={searchOpen}
              aria-controls="global-header-search-mobile-results"
              className="w-full min-w-0 rounded-[var(--tcdx-radius-tecdex-sm)] border border-[var(--tcdx-color-border)] bg-white py-2.5 pl-10 pr-3 text-sm text-[var(--tcdx-color-text-ink)] placeholder:text-[var(--tcdx-color-text-secondary)] transition focus:border-[var(--tcdx-color-primary)] focus:shadow-[var(--tcdx-shadow-tecdex-focus)]"
            />
          </div>

          <div id="global-header-search-mobile-results" className="mt-3 max-h-[60vh] overflow-auto">
            {search.trim() === '' ? (
              <div className="text-sm text-slate-500">{t('header.searchHelp')}</div>
            ) : searchLoading ? (
              <div className="text-sm text-slate-500">{t('header.searching')}</div>
            ) : displayResults.length === 0 ? (
              <div className="text-sm text-slate-500">
                {t('header.noSearchResults')} <b>{search}</b>.
              </div>
            ) : (
              <div className="space-y-1">
                {displayResults.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}-mobile`}
                    type="button"
                    onClick={() => handleResultNavigate(result)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                      activeIndex === index ? 'bg-[rgba(240,114,29,0.08)]' : 'hover:bg-[var(--tcdx-color-surface)]'
                    }`}
                  >
                    <span className={`mt-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${getTypeClasses(result.type)}`}>
                      {result.type}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{result.title}</div>
                      <div className="truncate text-sm text-slate-500">{result.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
