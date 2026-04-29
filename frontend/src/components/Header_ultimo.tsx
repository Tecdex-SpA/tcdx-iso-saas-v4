'use client';

import { useEffect, useRef, useState } from 'react';
import { getUserFromToken } from '@/utils/auth';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [logo, setLogo] = useState<string>('/logo.png');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const data = getUserFromToken();
    const token = localStorage.getItem('token');

    if (token) {
      fetch(`http://192.168.100.120:3000/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(setUser)
        .catch(console.error);
    }

    if (data?.tenant_id && token) {
      fetch(`http://192.168.100.120:3000/api/tenants/${data.tenant_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((t) => {
          setTenant(t);

          if (t?.logo) {
            setLogo(`http://192.168.100.120:3000/uploads/logos/${t.logo}`);
          }
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const avatarUrl = user?.avatar
    ? `http://192.168.100.120:3000/uploads/profiles/${user.avatar}`
    : null;

  const displayName = user?.full_name || user?.name || user?.email || 'Usuario';

  const lastSync = new Date().toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="h-16 text-white flex items-center justify-between px-6 border-b border-[#1b2733] bg-[linear-gradient(90deg,#243447_0%,#23395d_45%,#243447_100%)] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={logo}
          className="h-8 object-contain"
          alt="logo"
        />

        <div className="font-semibold tracking-[0.01em] truncate">
          TCDX Compliance 3.0 - Dashboard
        </div>
      </div>

      <div className="flex items-center gap-3" ref={menuRef}>
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

        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 transition hover:bg-white/10 hover:text-white"
          title="Notificaciones"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
            <path d="M9 17a3 3 0 0 0 6 0" />
          </svg>

          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#243447]" />
        </button>

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
  );
}
