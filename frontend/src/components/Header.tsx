'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getUserFromToken } from '@/utils/auth';
import TcdxIcon from '@/components/icons/TcdxIcon';
import { useTranslation } from '@/hooks/useTranslation';

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

function getInitials(value?: string | null) {
  const normalized = String(value || '').trim();

  if (!normalized) return 'TC';

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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

function unwrapTenantPayload(payload: any) {
  return payload?.data || payload?.tenant || payload?.item || payload;
}

function buildTenantLogoCandidates(tenant: any) {
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
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { locale, t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
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
    const data = getUserFromToken();
    const token = localStorage.getItem('token');

    tokenRef.current = token;
    tenantIdRef.current = data?.tenant_id || null;
    userIdRef.current = data?.userId || data?.id || null;

    if (token) {
      fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then(setUser)
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
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
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
  const tenantInitials = getInitials(tenantDisplayName);

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

  return (
    <div className="enterprise-topbar tcdx-shell-header px-4 py-3 text-slate-900 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            title={t('header.openMenu')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            {hasTenantLogo ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                <img
                  src={logo}
                  className="max-h-full max-w-full object-contain"
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
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-700 text-sm font-black text-white shadow-sm">
                {tenantInitials}
              </span>
            )}

            <div className="hidden min-w-0 lg:block">
              <div className="max-w-[220px] truncate text-[15px] font-black leading-tight tracking-tight text-slate-950 xl:max-w-[280px]">
                {tenantDisplayName}
              </div>
              <div className="mt-0.5 max-w-[220px] truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 xl:max-w-[280px]">
                {tenantSubtext}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div ref={searchRef} className="relative hidden lg:block">
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
                className="w-[440px] rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-16 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,111,219,0.12)]"
              />

              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 xl:block">
                ⌘K
              </span>
            </div>

            {searchOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white text-black shadow-2xl">
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
                          activeIndex === index ? 'bg-indigo-50' : 'hover:bg-slate-50'
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

          <div className="hidden xl:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
              <TcdxIcon name="calendar" className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{t('header.lastSync')}</div>
              <div className="font-semibold text-slate-900">{lastSync}</div>
            </div>
          </div>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
              title={t('header.notifications')}
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <TcdxIcon name="bell" className="h-5 w-5" />

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-slate-200 bg-white text-black shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">{t('header.notifications')}</div>
                    <div className="text-xs text-slate-500">{t('header.notificationsSubtitle')}</div>
                  </div>

                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
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

          <div className="flex items-center gap-2 sm:gap-3" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm transition hover:bg-slate-50"
                onClick={() => setOpen(!open)}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-blue-700 text-sm font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden max-w-[220px] sm:block">
                  <div className="truncate text-sm font-semibold text-slate-950">{displayName}</div>
                  <div className="truncate text-xs text-slate-500">
                    {tenant?.name || user?.role || t('header.userFallback')}
                  </div>
                </div>
              </button>

              {open && (
                <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white p-4 text-black shadow-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-lg font-bold text-slate-700">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{displayName}</p>
                      <p className="truncate text-sm text-slate-500">{user?.email}</p>
                      <p className="truncate text-sm text-slate-500">{tenant?.name}</p>
                    </div>
                  </div>

                  <div className="mb-3 rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    {t('header.profileHint')}
                  </div>

                  <hr className="my-2 border-slate-200" />

                  <button
                    className="w-full rounded-xl p-3 text-left text-sm transition hover:bg-slate-100"
                    onClick={() => {
                      setOpen(false);
                      window.location.href = '/perfil';
                    }}
                  >
                    {t('header.profile')}
                  </button>
                </div>
              )}
            </div>

            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white px-3 text-sm font-semibold text-[#06173a] shadow-sm transition hover:bg-slate-100 sm:px-4"
              onClick={logout}
              title={t('header.logout')}
            >
              <TcdxIcon name="logout" className="h-4 w-4" />
              <span className="hidden md:inline">{t('header.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
