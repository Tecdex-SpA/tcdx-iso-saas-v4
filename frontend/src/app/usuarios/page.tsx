'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUserFromToken } from '@/utils/auth';

const API_URL = 'http://192.168.100.120:3000';

type TenantItem = {
  id: string;
  name: string;
};

export default function UsuariosPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'auditor',
  });

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin';

  const selectedTenant = useMemo(() => {
    return tenants.find((tenant) => tenant.id === selectedTenantId) || null;
  }, [tenants, selectedTenantId]);

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = getUserFromToken();

    setToken(authToken);
    setUser(u);

    if (u?.role !== 'superadmin') {
      setSelectedTenantId(u?.tenant_id || '');
    }
  }, []);

  const loadTenants = async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin-saas/tenants`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok || json?.ok === false) {
        console.error('ERROR LOAD TENANTS:', json);
        setTenants([]);
        return [];
      }

      const rows = Array.isArray(json?.data) ? json.data : [];

      const normalized = rows.map((tenant: any) => ({
        id: tenant.tenant_id || tenant.id,
        name: tenant.tenant_name || tenant.name,
      }));

      setTenants(normalized);
      return normalized;
    } catch (err) {
      console.error('ERROR LOAD TENANTS:', err);
      setTenants([]);
      return [];
    }
  };

  const loadUsers = async (authToken: string, tenantId: string) => {
    try {
      if (!tenantId) {
        setUsers([]);
        return;
      }

      const url = isSuperAdmin
        ? `${API_URL}/api/users?tenant_id=${encodeURIComponent(tenantId)}`
        : `${API_URL}/api/users`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD USERS:', json);
        setUsers([]);
        return;
      }

      setUsers(
        (json || []).map((u: any) => ({
          ...u,
          newPassword: '',
        }))
      );
    } catch (err) {
      console.error('ERROR LOAD USERS:', err);
      setUsers([]);
    }
  };

  useEffect(() => {
    if (!token || !user) return;

    const run = async () => {
      try {
        setLoading(true);

        if (isSuperAdmin) {
          const tenantRows = await loadTenants(token);

          if (!selectedTenantId && tenantRows.length > 0) {
            setSelectedTenantId(tenantRows[0].id);
          }
        } else {
          const tenantId = user?.tenant_id || '';
          setSelectedTenantId(tenantId);
          await loadUsers(token, tenantId);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role]);

  useEffect(() => {
    if (!token || !selectedTenantId) return;

    void loadUsers(token, selectedTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedTenantId]);

  const createUser = async () => {
    if (!token) return;

    const targetTenantId = isSuperAdmin ? selectedTenantId : user?.tenant_id;

    if (!targetTenantId) {
      alert('Primero selecciona una empresa.');
      return;
    }

    if (!form.name || !form.email || !form.password || !form.role) {
      alert('Completa todos los campos');
      return;
    }

    const res = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tenant_id: targetTenantId,
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || 'Error creando usuario');
      return;
    }

    setForm({
      name: '',
      email: '',
      password: '',
      role: 'auditor',
    });

    await loadUsers(token, targetTenantId);
    alert('Usuario creado correctamente');
  };

  const updateUser = async (row: any) => {
    if (!token) return;

    try {
      setSavingId(row.id);

      const res = await fetch(`${API_URL}/api/users/${row.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: row.name,
          role: row.role,
          password: row.newPassword || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error actualizando usuario');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? {
                ...json,
                newPassword: '',
                tenant_name: row.tenant_name,
              }
            : u
        )
      );

      alert('Usuario actualizado correctamente');
    } catch (err) {
      console.error('ERROR UPDATE USER:', err);
      alert('Error actualizando usuario');
    } finally {
      setSavingId('');
    }
  };

  if (!isAdmin && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="p-6">No autorizado.</div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Cargando usuarios...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>

        <div className="bg-blue-50 p-4 rounded text-sm text-gray-700">
          {isSuperAdmin
            ? 'Selecciona primero una empresa para listar y crear usuarios solo dentro de ese tenant.'
            : 'Solo ves y administras usuarios de tu propia empresa.'}
        </div>

        {isSuperAdmin && (
          <div className="bg-white p-4 rounded shadow space-y-3">
            <div className="font-semibold">Empresa seleccionada</div>

            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">Seleccionar empresa</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>

            {selectedTenant && (
              <div className="text-sm text-gray-600">
                Usuarios listados y nuevos usuarios quedarán asociados a:{' '}
                <b>{selectedTenant.name}</b>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-4 rounded shadow space-y-3">
          <div className="font-semibold">Crear usuario</div>

          <div className="rounded bg-gray-50 border p-3 text-sm text-gray-700">
            Empresa:{' '}
            <b>
              {isSuperAdmin
                ? selectedTenant?.name || 'Selecciona una empresa'
                : 'Empresa actual'}
            </b>
          </div>

          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border p-2 rounded w-full"
          />

          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border p-2 rounded w-full"
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border p-2 rounded w-full"
          />

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border p-2 rounded w-full"
          >
            {!isSuperAdmin && <option value="admin">Admin</option>}
            <option value="auditor">Auditor</option>
            {isSuperAdmin && <option value="admin">Admin</option>}
            {isSuperAdmin && <option value="superadmin">Superadmin</option>}
          </select>

          <button
            onClick={createUser}
            disabled={isSuperAdmin && !selectedTenantId}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Crear usuario
          </button>
        </div>

        <div className="bg-white rounded shadow overflow-hidden">
          <div className="border-b p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Usuarios</div>
              <div className="text-xs text-gray-500">
                {isSuperAdmin
                  ? selectedTenant
                    ? `Mostrando solo usuarios de ${selectedTenant.name}`
                    : 'Selecciona una empresa para listar usuarios'
                  : 'Mostrando usuarios de tu empresa'}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Total: {users.length}
            </div>
          </div>

          {users.length === 0 ? (
            <div className="p-6 text-gray-500">
              {selectedTenantId
                ? 'No hay usuarios para mostrar en esta empresa.'
                : 'Selecciona una empresa para listar usuarios.'}
            </div>
          ) : (
            users.map((row) => (
              <div key={row.id} className="border-b p-4 space-y-3">
                <div className="grid md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Nombre</label>
                    <input
                      value={row.name || ''}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === row.id ? { ...u, name: e.target.value } : u
                          )
                        )
                      }
                      className="border p-2 rounded w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Email</label>
                    <div className="border p-2 rounded bg-gray-50">{row.email}</div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Empresa</label>
                    <div className="border p-2 rounded bg-gray-50">
                      {row.tenant_name || selectedTenant?.name || row.tenant_id || 'Empresa actual'}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">Rol</label>
                    <select
                      value={row.role}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === row.id ? { ...u, role: e.target.value } : u
                          )
                        )
                      }
                      className="border p-2 rounded w-full"
                    >
                      {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                      <option value="admin">Admin</option>
                      <option value="auditor">Auditor</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Dejar vacío para no cambiar"
                      value={row.newPassword || ''}
                      onChange={(e) =>
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === row.id
                              ? { ...u, newPassword: e.target.value }
                              : u
                          )
                        )
                      }
                      className="border p-2 rounded w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Creado: {row.created_at ? String(row.created_at).slice(0, 10) : '-'}
                  </div>

                  <button
                    onClick={() => updateUser(row)}
                    disabled={savingId === row.id}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {savingId === row.id ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
