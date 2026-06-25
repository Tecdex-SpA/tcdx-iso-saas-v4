'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { EnterpriseScrollPanel } from '@/components/ui/enterprise';
import { useTranslation } from '@/hooks/useTranslation';
import { getUserFromToken } from '@/utils/auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

const passwordPolicyMessage =
  'Mínimo 8 caracteres, con mayúsculas, minúsculas, números y símbolos.';

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

type TenantItem = {
  id: string;
  name: string;
};

type UnknownRecord = Record<string, unknown>;

type AuthUser = {
  role?: string;
  tenant_id?: string;
  tenantId?: string;
  tenant?: string;
  company_id?: string;
  companyId?: string;
};

type EditableUser = {
  id: string;
  name?: string;
  email?: string;
  role: string;
  tenant_id?: string;
  tenant_name?: string;
  created_at?: string;
  newPassword: string;
};

type RoleOption = {
  value: string;
  label: string;
};

const ui = {
  es: {
    roles: {
      admin: 'Admin empresa',
      auditor: 'Auditor',
      operativo: 'Operativo',
      viewer: 'Solo lectura / Ejecutivo',
      superadmin: 'Superadmin',
      dealer: 'Dealer',
    },
    unauthorized: 'No autorizado.',
    loading: 'Cargando usuarios...',
    title: 'Gestión de Usuarios',
    subtitle: 'Administra usuarios por empresa, manteniendo roles controlados para el SaaS.',
    currentRole: 'Rol actual',
    notAvailable: 'N/D',
    superadminHelp:
      'Selecciona primero una empresa para listar y crear usuarios dentro de ese tenant. Los roles Superadmin y Dealer solo puede gestionarlos un Superadmin.',
    adminHelp:
      'Solo ves y administras usuarios de tu propia empresa. No puedes crear Superadmin ni Dealer.',
    selectedCompany: 'Empresa seleccionada',
    selectCompany: 'Seleccionar empresa',
    listedUsersHelp: 'Usuarios listados y nuevos usuarios quedarán asociados a:',
    createUser: 'Crear usuario',
    company: 'Empresa',
    currentCompany: 'Empresa actual',
    name: 'Nombre',
    email: 'Email',
    password: 'Password',
    passwordPolicy: passwordPolicyMessage,
    role: 'Rol',
    users: 'Usuarios',
    total: 'Total',
    showingCompany: (name: string) => `Mostrando solo usuarios de ${name}`,
    selectCompanyToList: 'Selecciona una empresa para listar usuarios',
    showingOwnCompany: 'Mostrando usuarios de tu empresa',
    noUsers: 'No hay usuarios para mostrar en esta empresa.',
    newPassword: 'Nueva contraseña',
    passwordHint: 'Dejar vacío para no cambiar',
    created: 'Creado',
    saving: 'Guardando...',
    saveChanges: 'Guardar cambios',
    chooseCompany: 'Primero selecciona una empresa.',
    completeFields: 'Completa todos los campos',
    cannotCreateRole: 'No tienes permisos para crear ese tipo de usuario.',
    cannotAssignRole: 'No tienes permisos para asignar ese rol.',
    createError: 'Error creando usuario',
    updateError: 'Error actualizando usuario',
    createSuccess: 'Usuario creado correctamente',
    updateSuccess: 'Usuario actualizado correctamente',
  },
  en: {
    roles: {
      admin: 'Company admin',
      auditor: 'Auditor',
      operativo: 'Operator',
      viewer: 'Read-only / Executive',
      superadmin: 'Superadmin',
      dealer: 'Dealer',
    },
    unauthorized: 'Unauthorized.',
    loading: 'Loading users...',
    title: 'User Management',
    subtitle: 'Manage users by company while keeping controlled SaaS roles.',
    currentRole: 'Current role',
    notAvailable: 'N/A',
    superadminHelp:
      'Select a company first to list and create users within that tenant. Superadmin and Dealer roles can only be managed by a Superadmin.',
    adminHelp:
      'You only see and manage users from your own company. You cannot create Superadmin or Dealer users.',
    selectedCompany: 'Selected company',
    selectCompany: 'Select company',
    listedUsersHelp: 'Listed users and new users will be associated with:',
    createUser: 'Create user',
    company: 'Company',
    currentCompany: 'Current company',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    passwordPolicy: passwordPolicyMessage,
    role: 'Role',
    users: 'Users',
    total: 'Total',
    showingCompany: (name: string) => `Showing only users from ${name}`,
    selectCompanyToList: 'Select a company to list users',
    showingOwnCompany: 'Showing users from your company',
    noUsers: 'There are no users to show for this company.',
    newPassword: 'New password',
    passwordHint: 'Leave blank to keep unchanged',
    created: 'Created',
    saving: 'Saving...',
    saveChanges: 'Save changes',
    chooseCompany: 'Select a company first.',
    completeFields: 'Complete all fields',
    cannotCreateRole: 'You do not have permission to create this user type.',
    cannotAssignRole: 'You do not have permission to assign this role.',
    createError: 'Error creating user',
    updateError: 'Error updating user',
    createSuccess: 'User created successfully',
    updateSuccess: 'User updated successfully',
  },
} as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: UnknownRecord, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function normalizeRole(role: unknown) {
  return String(role || '').toLowerCase().trim();
}

function isSuperAdminRole(role: unknown) {
  const normalized = normalizeRole(role);

  return [
    'superadmin',
    'super_admin',
    'platform_admin',
    'admin_global',
    'global_admin',
    'owner',
  ].includes(normalized);
}

function isAdminRole(role: unknown) {
  const normalized = normalizeRole(role);

  return [
    'admin',
    'tenant_admin', // compatibilidad temporal con tokens antiguos
  ].includes(normalized);
}

function normalizeAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null;

  return {
    role: stringField(value, 'role'),
    tenant_id: stringField(value, 'tenant_id'),
    tenantId: stringField(value, 'tenantId'),
    tenant: stringField(value, 'tenant'),
    company_id: stringField(value, 'company_id'),
    companyId: stringField(value, 'companyId'),
  };
}

function normalizeTenantItem(value: unknown): TenantItem | null {
  if (!isRecord(value)) return null;

  const id = stringField(value, 'tenant_id') || stringField(value, 'id');
  const name = stringField(value, 'tenant_name') || stringField(value, 'name');

  if (!id || !name) return null;
  return { id, name };
}

function normalizeEditableUser(value: unknown): EditableUser | null {
  if (!isRecord(value)) return null;

  const id = stringField(value, 'id');
  if (!id) return null;

  return {
    id,
    name: stringField(value, 'name'),
    email: stringField(value, 'email'),
    role: stringField(value, 'role') || 'viewer',
    tenant_id: stringField(value, 'tenant_id'),
    tenant_name: stringField(value, 'tenant_name'),
    created_at: stringField(value, 'created_at'),
    newPassword: '',
  };
}

function resolveTenantId(user: AuthUser | null) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    ''
  );
}

function getRoleOptions(copy: typeof ui.es | typeof ui.en, isSuperAdmin: boolean): RoleOption[] {
  const adminOptions: RoleOption[] = [
    { value: 'admin', label: copy.roles.admin },
    { value: 'auditor', label: copy.roles.auditor },
    { value: 'operativo', label: copy.roles.operativo },
    { value: 'viewer', label: copy.roles.viewer },
  ];

  if (!isSuperAdmin) return adminOptions;

  return [
    { value: 'superadmin', label: copy.roles.superadmin },
    { value: 'dealer', label: copy.roles.dealer },
    ...adminOptions,
  ];
}

function getRoleLabel(role: unknown, copy: typeof ui.es | typeof ui.en) {
  const normalized = normalizeRole(role);
  const options = getRoleOptions(copy, true);

  return options.find((option) => option.value === normalized)?.label || String(role || copy.notAvailable);
}

export default function UsuariosPage() {
  const { locale } = useTranslation();
  const lang = locale === 'en' ? 'en' : 'es';
  const copy = ui[lang];

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const [users, setUsers] = useState<EditableUser[]>([]);
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

  const normalizedRole = normalizeRole(user?.role);
  const isSuperAdmin = isSuperAdminRole(normalizedRole);
  const isAdmin = isAdminRole(normalizedRole);

  const roleOptions = getRoleOptions(copy, isSuperAdmin);

  const selectedTenant = useMemo(() => {
    return tenants.find((tenant) => tenant.id === selectedTenantId) || null;
  }, [tenants, selectedTenantId]);

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    const u = normalizeAuthUser(getUserFromToken());

    setToken(authToken);
    setUser(u);

    if (!isSuperAdminRole(u?.role)) {
      setSelectedTenantId(resolveTenantId(u));
    }
  }, []);

  const loadTenants = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin-saas/tenants`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json: unknown = await res.json();
      const parsed = isRecord(json) ? json : {};

      if (!res.ok || parsed.ok === false) {
        console.error('ERROR LOAD TENANTS:', parsed);
        setTenants([]);
        return [];
      }

      const rows = Array.isArray(parsed.data) ? parsed.data : [];

      const normalized = rows
        .map(normalizeTenantItem)
        .filter((tenant): tenant is TenantItem => tenant !== null);

      setTenants(normalized);
      return normalized;
    } catch (err) {
      console.error('ERROR LOAD TENANTS:', err);
      setTenants([]);
      return [];
    }
  }, []);

  const loadUsers = useCallback(async (
    authToken: string,
    tenantId: string,
    canQueryTenant: boolean
  ) => {
    try {
      if (!tenantId) {
        setUsers([]);
        return;
      }

      const url = canQueryTenant
        ? `${API_URL}/api/users?tenant_id=${encodeURIComponent(tenantId)}`
        : `${API_URL}/api/users`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json: unknown = await res.json();

      if (!res.ok) {
        console.error('ERROR LOAD USERS:', json);
        setUsers([]);
        return;
      }

      const rows = Array.isArray(json) ? json : [];
      setUsers(
        rows
          .map(normalizeEditableUser)
          .filter((u): u is EditableUser => u !== null)
      );
    } catch (err) {
      console.error('ERROR LOAD USERS:', err);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (!token || !user) return;

    const run = async () => {
      try {
        setLoading(true);

        if (isSuperAdmin) {
          const tenantRows = await loadTenants(token);

          setSelectedTenantId((currentTenantId) =>
            currentTenantId || tenantRows[0]?.id || ''
          );
        } else {
          const tenantId = resolveTenantId(user);
          setSelectedTenantId(tenantId);
          await loadUsers(token, tenantId, isSuperAdmin);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [isSuperAdmin, loadTenants, loadUsers, token, user]);

  useEffect(() => {
    if (!token || !selectedTenantId) return;

    void loadUsers(token, selectedTenantId, isSuperAdmin);
  }, [isSuperAdmin, loadUsers, selectedTenantId, token]);

  const createUser = async () => {
    if (!token) return;

    const targetTenantId = isSuperAdmin ? selectedTenantId : resolveTenantId(user);

    if (!targetTenantId && form.role !== 'dealer' && form.role !== 'superadmin') {
      alert(copy.chooseCompany);
      return;
    }

    if (!form.name || !form.email || !form.password || !form.role) {
      alert(copy.completeFields);
      return;
    }

    if (!isStrongPassword(form.password)) {
      alert(copy.passwordPolicy);
      return;
    }

    if (!isSuperAdmin && ['superadmin', 'dealer'].includes(form.role)) {
      alert(copy.cannotCreateRole);
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

    const json: unknown = await res.json();
    const parsed = isRecord(json) ? json : {};

    if (!res.ok) {
      alert(typeof parsed.error === 'string' ? parsed.error : copy.createError);
      return;
    }

    setForm({
      name: '',
      email: '',
      password: '',
      role: 'auditor',
    });

    await loadUsers(token, targetTenantId, isSuperAdmin);
    alert(copy.createSuccess);
  };

  const updateUser = async (row: EditableUser) => {
    if (!token) return;

    if (!isSuperAdmin && ['superadmin', 'dealer'].includes(row.role)) {
      alert(copy.cannotAssignRole);
      return;
    }

    if (row.newPassword && !isStrongPassword(row.newPassword)) {
      alert(copy.passwordPolicy);
      return;
    }

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

      const json: unknown = await res.json();
      const parsed = isRecord(json) ? json : {};

      if (!res.ok) {
        alert(typeof parsed.error === 'string' ? parsed.error : copy.updateError);
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === row.id
            ? {
                ...row,
                ...(normalizeEditableUser(json) || {}),
                newPassword: '',
                tenant_name: row.tenant_name,
              }
            : u
        )
      );

      alert(copy.updateSuccess);
    } catch (err) {
      console.error('ERROR UPDATE USER:', err);
      alert(copy.updateError);
    } finally {
      setSavingId('');
    }
  };

  if (!isAdmin && !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-6">{copy.unauthorized}</div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="px-3 py-4 sm:p-6">{copy.loading}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-3 py-4 sm:p-6">
        <section className="rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#edf4ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Administración segura</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {copy.subtitle}
            </p>
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            {copy.currentRole}: {getRoleLabel(user?.role, copy)}
          </div>
        </div>
        </section>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          {isSuperAdmin ? copy.superadminHelp : copy.adminHelp}
        </div>

        {isSuperAdmin && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] space-y-3">
            <div className="font-semibold">{copy.selectedCompany}</div>

            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2"
            >
              <option value="">{copy.selectCompany}</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>

            {selectedTenant && (
              <div className="text-sm text-gray-600">
                {copy.listedUsersHelp}{' '}
                <b>{selectedTenant.name}</b>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] space-y-3">
          <div className="font-semibold">{copy.createUser}</div>

          <div className="rounded bg-gray-50 border p-3 text-sm text-gray-700">
            {copy.company}:{' '}
            <b>
              {isSuperAdmin
                ? selectedTenant?.name || copy.selectCompany
                : copy.currentCompany}
            </b>
          </div>

          <input
            placeholder={copy.name}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border p-2 rounded w-full"
          />

          <input
            placeholder={copy.email}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border p-2 rounded w-full"
          />

          <input
            type="password"
            placeholder={copy.password}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border p-2 rounded w-full"
          />
          <p className="text-xs text-slate-500">{copy.passwordPolicy}</p>

          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border p-2 rounded w-full"
          >
            {roleOptions.map((option) => (
              <option key={`create-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={createUser}
            disabled={isSuperAdmin && !selectedTenantId && !['superadmin', 'dealer'].includes(form.role)}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {copy.createUser}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="border-b p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{copy.users}</div>
              <div className="text-xs text-gray-500">
                {isSuperAdmin
                  ? selectedTenant
                    ? copy.showingCompany(selectedTenant.name)
                    : copy.selectCompanyToList
                  : copy.showingOwnCompany}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              {copy.total}: {users.length}
            </div>
          </div>

          {users.length === 0 ? (
            <div className="p-6 text-gray-500">
              {selectedTenantId
                ? copy.noUsers
                : copy.selectCompanyToList}
            </div>
          ) : (
            <EnterpriseScrollPanel maxHeight="560px">
              {users.map((row) => (
                <div key={row.id} className="border-b p-4 space-y-3">
                  <div className="grid md:grid-cols-5 gap-3">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{copy.name}</label>
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
                    <label className="text-sm text-gray-600 block mb-1">{copy.email}</label>
                    <div className="border p-2 rounded bg-gray-50">{row.email}</div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">{copy.company}</label>
                    <div className="border p-2 rounded bg-gray-50">
                      {row.tenant_name || selectedTenant?.name || row.tenant_id || copy.currentCompany}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">{copy.role}</label>
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
                      {roleOptions.map((option) => (
                        <option key={`${row.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 block mb-1">
                      {copy.newPassword}
                    </label>
                    <input
                      type="password"
                      placeholder={copy.passwordHint}
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
                    <p className="mt-1 text-xs text-slate-500">{copy.passwordPolicy}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {copy.created}: {row.created_at ? String(row.created_at).slice(0, 10) : '-'}
                  </div>

                  <button
                    onClick={() => updateUser(row)}
                    disabled={savingId === row.id}
                    className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {savingId === row.id ? copy.saving : copy.saveChanges}
                  </button>
                </div>
                </div>
              ))}
            </EnterpriseScrollPanel>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
