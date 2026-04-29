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
    | 'activo'
    | 'modulo';
  title: string;
  subtitle: string;
  href: string;
};

type NotificationItem = {
  id?: string;
  title: string;
  description?: string;
  href: string;
  level: 'critical' | 'warning' | 'info';
};

type NotificationsResponse =
  | NotificationItem[]
  | {
      unreadCount?: number;
      items?: NotificationItem[];
    };

const API_URL = 'http://192.168.100.120:3000';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [logo, setLogo] = useState<string>('/logo.png');

  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const tokenRef = useRef<string | null>(null);
  const tenantIdRef = useRef<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const data = getUserFromToken();
    const token = localStorage.getItem('token');

    tokenRef.current = token;
    tenantIdRef.current = data?.tenant_id || null;

    if (token) {
      fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(setUser)
        .catch(console.error);
    }

    if (data?.tenant_id && token) {
      fetch(`${API_URL}/api/tenants/${data.tenant_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((t) => {
          setTenant(t);

          if (t?.logo) {
            setLogo(`${API_URL}/uploads/logos/${t.logo}`);
          }
        })
        .catch(console.error);

      loadNotifications(data.tenant_id, token);
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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

      if (isCmdK) {
        event.preventDefault();
        setSearchOpen(true);

        const el = document.getElementById('global-header-search');
        if (el) {
          setTimeout(() => {
            (el as HTMLInputElement).focus();
          }, 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const tenantId = tenantIdRef.current;
    const token = tokenRef.current;
    const query = search.trim();

    if (!tenantId || !token) return;

    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
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
          `${API_URL}/api/search/global/${tenantId}?q=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const json = await res.json();
        setSearchResults(Array.isArray(json) ? json : []);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('SEARCH HEADER ERROR:', error);
          setSearchResults([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const loadNotifications = async (tenantId: string, token: string) => {
    try {
      setNotificationsLoading(true);
      setNotificationsError(false);

      const res = await fetch(`${API_URL}/api/notifications/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Notifications failed: ${res.status}`);
      }

      const json: NotificationsResponse = await res.json();

      if (Array.isArray(json)) {
        setNotifications(json);
      } else {
        setNotifications(Array.isArray(json?.items) ? json.items : []);
      }
    } catch (error) {
      console.error('NOTIFICATIONS HEADER ERROR:', error);
      setNotificationsError(true);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleOpenNotifications = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);

    if (next && tenantIdRef.current && tokenRef.current) {
      loadNotifications(tenantIdRef.current, tokenRef.current);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const avatarUrl = user?.avatar
    ? `${API_URL}/uploads/profiles/${user.avatar}`
    : null;

  const displayName = user?.full_name || user?.name || user?.email || 'Usuario';

  const lastSync = new Date().toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (n) => n.level === 'critical' || n.level === 'warning'
    ).length;
  }, [notifications]);

  const getNotificationBadgeClasses = (level: NotificationItem['level']) => {
    if (level === 'critical') return 'bg-red-100 text-red-700';
    if (level === 'warning') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getNotificationDotClasses = (level: NotificationItem['level']) => {
    if (level === 'critical') return 'bg-red-500';
    if (level === 'warning') return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const getSearchTypeClasses = (type: SearchResult['type']) => {
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
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="h-16 text-white flex items-center justify-between px-6 border-b border-[#1b2733] bg-[linear-gradient(90deg,#243447_0%,#23395d_45%,#243447_100%)] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={logo}
          className="h-8 object-contain"
          alt="logo"
        />

        <div className="font-semibold tracking-[0.01em] truncate whitespace-nowrap">
          TCDX Compliance 3.0 - Plataforma de Gestión Normativa
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          ref={searchRef}
          className="relative hidden lg:block"
        >
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
              placeholder="Buscar normas, cláusulas, controles, hallazgos..."
              className="w-[420px] rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-16 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/20 focus:bg-white/10"
            />

            <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 xl:block">
              ⌘K
            </span>
          </div>

          {searchOpen && (
            <div className="absolute right-0 mt-3 w-[520px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-black shadow-2xl z-50">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="text-sm font-semibold text-gray-900">
                  Búsqueda global
                </div>
                <div className="text-xs text-gray-500">
                  Busca módulos, normas, cláusulas, controles y más
                </div>
              </div>

              {search.trim() === '' ? (
                <div className="p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Sugerencias rápidas
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <QuickSearchLink href="/controles" label="Controles" />
                    <QuickSearchLink href="/hallazgos" label="Hallazgos" />
                    <QuickSearchLink href="/plan-accion" label="Planes de Acción" />
                    <QuickSearchLink href="/auditorias" label="Auditorías" />
                    <QuickSearchLink href="/matriz-riesgo" label="Matriz de Riesgo" />
                    <QuickSearchLink href="/evidencias" label="Evidencias" />
                  </div>
                </div>
              ) : searchLoading ? (
                <div className="p-4 text-sm text-gray-500">
                  Buscando...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  No se encontraron resultados para <b>{search}</b>.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto p-2">
                  {searchResults.map((result) => (
                    <a
                      key={`${result.type}-${result.id}`}
                      href={result.href}
                      className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-gray-50"
                    >
                      <span className={`mt-0.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${getSearchTypeClasses(result.type)}`}>
                        {result.type}
                      </span>

                      <div className="min-w-0">
                        <div className="truncate font-semibold text-gray-900">
                          {result.title}
                        </div>
                        <div className="truncate text-sm text-gray-500">
                          {result.subtitle}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Última sincronización
            </div>
            <div className="font-semibold text-white">
              {lastSync}
            </div>
          </div>
        </div>

        <div
          className="relative"
          ref={notificationsRef}
        >
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 transition hover:bg-white/10 hover:text-white"
            title="Notificaciones"
            onClick={handleOpenNotifications}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>

            {unreadCount > 0 && (
              <>
                <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#243447]" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              </>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-3 w-[380px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-black shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <div className="font-semibold text-gray-900">Notificaciones</div>
                  <div className="text-xs text-gray-500">
                    Alertas relevantes del sistema
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {notifications.length}
                </span>
              </div>

              <div className="max-h-[380px] overflow-auto p-2">
                {notificationsLoading ? (
                  <div className="p-3 text-sm text-gray-500">Cargando notificaciones...</div>
                ) : notificationsError ? (
                  <div className="p-3 text-sm text-red-500">
                    No se pudieron cargar las notificaciones.
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    No hay notificaciones por ahora.
                  </div>
                ) : (
                  notifications.map((item, idx) => (
                    <a
                      key={item.id || `${item.title}-${idx}`}
                      href={item.href}
                      className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-gray-50"
                    >
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${getNotificationDotClasses(item.level)}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate font-semibold text-gray-900">
                            {item.title}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getNotificationBadgeClasses(item.level)}`}>
                            {item.level === 'critical'
                              ? 'Crítica'
                              : item.level === 'warning'
                              ? 'Atención'
                              : 'Info'}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          {item.description || 'Sin descripción'}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>

              <div className="border-t border-gray-100 p-3">
                <a
                  href="/dashboard"
                  className="block rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Ver resumen completo
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3" ref={menuRef}>
          <div className="relative">
            <div
              className="cursor-pointer font-medium hover:opacity-95 flex items-center gap-3 rounded-xl px-2 py-1.5 transition"
              onClick={() => setOpen(!open)}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-md"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold border border-white/10">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="hidden sm:block text-left leading-tight max-w-[220px]">
                <div className="truncate text-sm font-semibold text-white">
                  {displayName}
                </div>
                <div className="truncate text-xs text-white/65">
                  {tenant?.name || user?.role || 'Usuario'}
                </div>
              </div>
            </div>

            {open && (
              <div className="absolute right-0 mt-3 w-80 bg-white text-black rounded-2xl shadow-2xl border border-gray-200 p-4 z-50">
                <div className="flex items-center gap-3 mb-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-14 h-14 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-700">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold truncate">{displayName}</p>
                    <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    <p className="text-sm text-gray-500 truncate">{tenant?.name}</p>
                  </div>
                </div>

                <hr className="my-2 border-gray-200" />

                <button
                  className="w-full text-left text-sm p-3 rounded-xl hover:bg-gray-100 transition"
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
            className="rounded-xl bg-[linear-gradient(135deg,#5b5cf0_0%,#4f46e5_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] border border-white/10 hover:brightness-110 transition"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickSearchLink({
  href,
  label
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {label}
    </a>
  );
}
