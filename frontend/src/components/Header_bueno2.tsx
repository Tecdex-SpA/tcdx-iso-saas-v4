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

  return (
    <div className="h-16 bg-[#243447] text-white flex items-center justify-between px-6 border-b border-[#1b2733] shadow-[0_8px_24px_rgba(0,0,0,0.15)]">
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
        <div className="relative">
          <div
            className="cursor-pointer font-medium hover:opacity-90 flex items-center gap-3 rounded-xl px-2 py-1.5 transition"
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

            <span className="hidden sm:inline max-w-[220px] truncate">{displayName}</span>
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
          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-red-600 transition"
          onClick={logout}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
