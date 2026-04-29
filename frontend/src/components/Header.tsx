'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getUserFromToken } from '@/utils/auth';

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
  process.env.NEXT_PUBLIC_API_URL || 'http://192.168.100.120:3000';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [logo, setLogo] = useState<string>('/logo.png');

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
        .then((t) => {
          setTenant(t);
          if (t?.logo) {
            setLogo(`${API_URL}/uploads/logos/${t.logo}`);
          }
        })
        .catch(console.error);

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
  const displayName = user?.full_name || user?.name || user?.email || 'Usuario';

  const lastSync = new Date().toLocaleString('es-CL', {
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
    <div className="border-b border-white/10 bg-[linear-gradient(90deg,#223244_0%,#23395d_42%,#223244_100%)] px-4 py-3 text-white shadow-[0_8px_30px_rgba(2,8,23,0.16)] md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
            <img src={logo} className="h-8 object-contain" alt="logo" />
            <div className="hidden min-w-0 lg:block">
              <div className="truncate text-sm font-semibold tracking-[0.01em] text-white">
                TCDX Compliance 3.0
              </div>
              <div className="truncate text-[11px] text-white/55">
                {tenant?.name || 'Tenant activo'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div ref={searchRef} className="relative hidden lg:block">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/55">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
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
                placeholder="Buscar normas, cláusulas, controles, hallazgos..."
                className="w-[440px] rounded-2xl border border-white/10 bg-white/6 py-3 pl-10 pr-16 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/20 focus:bg-white/10"
              />

              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 xl:block">
                ⌘K
              </span>
            </div>

            {searchOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[560px] overflow-hidden rounded-[24px] border border-slate-200 bg-white text-black shadow-2xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Búsqueda global</div>
                  <div className="text-xs text-slate-500">Usa ↑ ↓ Enter para navegar</div>
                </div>

                {search.trim() === '' ? (
                  <div className="p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Búsquedas recientes
                    </div>

                    {recentSearches.length === 0 ? (
                      <div className="text-sm text-slate-500">No hay historial todavía.</div>
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
                              {item.result_title || item.result_type || 'Resultado reciente'}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : searchLoading ? (
                  <div className="p-4 text-sm text-slate-500">Buscando...</div>
                ) : displayResults.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No se encontraron resultados para <b>{search}</b>.
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

          <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-xs text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-white/60">Última sincronización</div>
              <div className="font-semibold text-white">{lastSync}</div>
            </div>
          </div>

          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/90 transition hover:bg-white/10 hover:text-white"
              title="Notificaciones"
              onClick={() => setNotificationsOpen((prev) => !prev)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>

              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 z-50 mt-3 w-[390px] overflow-hidden rounded-[24px] border border-slate-200 bg-white text-black shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">Notificaciones</div>
                    <div className="text-xs text-slate-500">Persistentes y sincronizadas</div>
                  </div>

                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Marcar todo leído
                  </button>
                </div>

                <div className="max-h-[380px] overflow-auto p-2">
                  {notificationsLoading ? (
                    <div className="p-3 text-sm text-slate-500">Cargando notificaciones...</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">No hay notificaciones.</div>
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
                          {item.level === 'critical' ? 'Crítica' : item.level === 'warning' ? 'Atención' : 'Info'}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{item.description || 'Sin descripción'}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-2.5 py-1.5 text-left transition hover:bg-white/10"
                onClick={() => setOpen(!open)}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-10 w-10 rounded-full border border-white/20 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/15 text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="hidden max-w-[220px] sm:block">
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  <div className="truncate text-xs text-white/65">
                    {tenant?.name || user?.role || 'Usuario'}
                  </div>
                </div>
              </button>

              {open && (
                <div className="absolute right-0 z-50 mt-3 w-80 rounded-[24px] border border-slate-200 bg-white p-4 text-black shadow-2xl">
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
                    Entorno premium TCDX listo para operación diaria.
                  </div>

                  <hr className="my-2 border-slate-200" />

                  <button
                    className="w-full rounded-xl p-3 text-left text-sm transition hover:bg-slate-100"
                    onClick={() => {
                      setOpen(false);
                      window.location.href = '/perfil';
                    }}
                  >
                    Editar perfil
                  </button>
                </div>
              )}
            </div>

            <button
              className="rounded-2xl bg-[linear-gradient(135deg,#5b5cf0_0%,#4f46e5_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] border border-white/10 transition hover:brightness-110"
              onClick={logout}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
