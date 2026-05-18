'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://181.212.166.187:8443';

export default function PerfilPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    job_title: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const loadProfile = async (authToken: string) => {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error cargando perfil');
        return;
      }

      setUser(json);
      setProfileForm({
        full_name: json.full_name || json.name || '',
        phone: json.phone || '',
        job_title: json.job_title || ''
      });
    } catch (err) {
      console.error('ERROR LOAD PROFILE:', err);
      alert('Error cargando perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      window.location.href = '/login';
      return;
    }

    setToken(authToken);
    loadProfile(authToken);
  }, []);

  const saveProfile = async () => {
    if (!token) return;

    try {
      setSavingProfile(true);

      const res = await fetch(`${API_URL}/api/user/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error actualizando perfil');
        return;
      }

      setUser(json);
      alert('Perfil actualizado correctamente');
    } catch (err) {
      console.error('ERROR SAVE PROFILE:', err);
      alert('Error actualizando perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!token) return;

    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      alert('Completa todos los campos de contraseña');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('La confirmación no coincide con la nueva contraseña');
      return;
    }

    try {
      setSavingPassword(true);

      const res = await fetch(`${API_URL}/api/user/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error cambiando contraseña');
        return;
      }

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      alert('Contraseña actualizada correctamente');
    } catch (err) {
      console.error('ERROR CHANGE PASSWORD:', err);
      alert('Error cambiando contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!token) return;

    try {
      setUploadingAvatar(true);

      const fd = new FormData();
      fd.append('avatar', file);

      const res = await fetch(`${API_URL}/api/user/me/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: fd
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || 'Error subiendo foto');
        return;
      }

      setUser(json);
      alert('Foto de perfil actualizada');
    } catch (err) {
      console.error('ERROR UPLOAD AVATAR:', err);
      alert('Error subiendo foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarUrl = user?.avatar
    ? `${API_URL}/uploads/profiles/${user.avatar}?t=${Date.now()}`
    : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Cargando perfil...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 bg-[#f3f4f6] min-h-screen">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-gray-500 mt-2">
            Actualiza tus datos personales, foto y contraseña.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Foto de perfil</h2>

            <div className="flex justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-36 h-36 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-600">
                  {(user?.full_name || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
              className="w-full"
            />

            <div className="text-sm text-gray-500">
              {uploadingAvatar ? 'Subiendo foto...' : 'Puedes subir una imagen de perfil.'}
            </div>
          </section>

          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Datos personales</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Nombre</label>
                  <input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Correo</label>
                  <input
                    value={user?.email || ''}
                    disabled
                    className="border p-2.5 rounded-xl w-full bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Teléfono de contacto</label>
                  <input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Cargo</label>
                  <input
                    value={profileForm.job_title}
                    onChange={(e) => setProfileForm({ ...profileForm, job_title: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {savingProfile ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Cambiar contraseña</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Contraseña actual</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Nueva contraseña</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="border p-2.5 rounded-xl w-full"
                  />
                </div>
              </div>

              <button
                onClick={changePassword}
                disabled={savingPassword}
                className="bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {savingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
