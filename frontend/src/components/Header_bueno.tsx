'use client';

import { useEffect, useState } from 'react';
import { getUserFromToken } from '@/utils/auth';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [logo, setLogo] = useState<string>('/logo.png');
  const [open, setOpen] = useState(false);

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

  const avatarUrl = user?.avatar
    ? `http://192.168.100.120:3000/uploads/profiles/${user.avatar}`
    : null;

  const displayName = user?.full_name || user?.name || user?.email || 'Usuario';

  return (
    <div className="h-16 bg-[#243447] text-white flex items-center justify-between px-6 border-b border-[#1b2733]">
      <div className="flex items-center gap-4">
        <img
          src={logo}
          className="h-8 object-contain"
          alt="logo"
        />

        <div className="font-semibold">
          TCDX Compliance 3.0 - Dashboard
        </div>
      </div>

      <div className="relative">
        <div
          className="cursor-pointer font-medium hover:opacity-80 flex items-center gap-3"
          onClick={() => setOpen(!open)}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-9 h-9 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <span>{displayName}</span>
        </div>

        {open && (
          <div className="absolute right-0 mt-3 w-72 bg-white text-black rounded-xl shadow-xl p-4 z-50">
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

              <div>
                <p className="font-semibold">{displayName}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <p className="text-sm text-gray-500">{tenant?.name}</p>
              </div>
            </div>

            <hr className="my-2" />

            <button
              className="w-full text-left text-sm p-2 rounded hover:bg-gray-100"
              onClick={() => {
                setOpen(false);
                window.location.href = '/perfil';
              }}
            >
              Editar perfil
            </button>

            <hr className="my-2" />

            <button
              className="w-full text-left text-sm p-2 rounded hover:bg-red-100 text-red-600"
              onClick={() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
            >
              ⏻ Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
