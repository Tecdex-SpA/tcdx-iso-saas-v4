'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import AppLayout from '@/components/AppLayout';
import {
  EnterpriseButton,
  EnterpriseCard,
  EnterprisePageHeader,
} from '@/components/ui/enterprise';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

type ProfileUser = {
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  avatar?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toProfileUser(value: unknown): ProfileUser | null {
  return isRecord(value) ? value as ProfileUser : null;
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  const record = isRecord(payload) ? payload : {};
  return String(record.error || fallback);
}

export default function PerfilPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarCacheKey, setAvatarCacheKey] = useState('');

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

      const json: unknown = await res.json();

      if (!res.ok) {
        alert(getApiErrorMessage(json, 'Error cargando perfil'));
        return;
      }

      const profile = toProfileUser(json);
      setUser(profile);
      setAvatarCacheKey(String(Date.now()));
      setProfileForm({
        full_name: profile?.full_name || profile?.name || '',
        phone: profile?.phone || '',
        job_title: profile?.job_title || ''
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

      const json: unknown = await res.json();

      if (!res.ok) {
        alert(getApiErrorMessage(json, 'Error actualizando perfil'));
        return;
      }

      setUser(toProfileUser(json));
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

      const json: unknown = await res.json();

      if (!res.ok) {
        alert(getApiErrorMessage(json, 'Error cambiando contraseña'));
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

  const handleAvatarSelection = (file?: File | null) => {
    setAvatarError('');

    if (!file) {
      setAvatarFile(null);
      setAvatarPreviewUrl('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecciona un archivo de imagen válido.');
      setAvatarFile(null);
      setAvatarPreviewUrl('');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('La imagen no debe superar 5 MB.');
      setAvatarFile(null);
      setAvatarPreviewUrl('');
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextPreview;
    });
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const uploadAvatar = async () => {
    if (!token || !avatarFile) return;

    try {
      setUploadingAvatar(true);
      setAvatarError('');

      const fd = new FormData();
      fd.append('avatar', avatarFile);

      const res = await fetch(`${API_URL}/api/user/me/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: fd
      });

      const json: unknown = await res.json();

      if (!res.ok) {
        setAvatarError(getApiErrorMessage(json, 'Error subiendo foto'));
        return;
      }

      setUser(toProfileUser(json));
      setAvatarFile(null);
      setAvatarPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      setAvatarCacheKey(String(Date.now()));
      window.dispatchEvent(new Event('profile-avatar-updated'));
    } catch (err) {
      console.error('ERROR UPLOAD AVATAR:', err);
      setAvatarError('Error subiendo foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarUrl = useMemo(() => {
    if (avatarPreviewUrl) return avatarPreviewUrl;
    if (!user?.avatar) return null;
    return `${API_URL}/uploads/profiles/${user.avatar}${avatarCacheKey ? `?t=${avatarCacheKey}` : ''}`;
  }, [avatarCacheKey, avatarPreviewUrl, user?.avatar]);

  if (loading) {
    return (
      <AppLayout>
        <div className="enterprise-card">Cargando perfil...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <EnterprisePageHeader
          title="Mi perfil"
          subtitle="Actualiza tus datos personales, foto y contraseña."
        />

        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
          <EnterpriseCard title="Foto de perfil" subtitle="La imagen se previsualiza antes de guardarla." bodyClassName="space-y-4">

            <div className="flex justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Foto de perfil"
                  width={144}
                  height={144}
                  unoptimized
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
                handleAvatarSelection(e.target.files?.[0] || null);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />

            {avatarError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {avatarError}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                {avatarFile ? 'Revisa la previsualización antes de guardar.' : 'Puedes subir JPG, PNG o WebP hasta 5 MB.'}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <EnterpriseButton
                type="button"
                onClick={uploadAvatar}
                disabled={!avatarFile || uploadingAvatar}
              >
                {uploadingAvatar ? 'Subiendo...' : 'Guardar foto'}
              </EnterpriseButton>

              {avatarFile && (
                <EnterpriseButton
                  type="button"
                  variant="secondary"
                  onClick={() => handleAvatarSelection(null)}
                  disabled={uploadingAvatar}
                >
                  Cancelar
                </EnterpriseButton>
              )}
            </div>
          </EnterpriseCard>

          <div className="space-y-6">
            <EnterpriseCard title="Datos personales" bodyClassName="space-y-4">

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

              <EnterpriseButton
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Guardando...' : 'Guardar perfil'}
              </EnterpriseButton>
            </EnterpriseCard>

            <EnterpriseCard title="Cambiar contraseña" bodyClassName="space-y-4">

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

              <EnterpriseButton
                type="button"
                onClick={changePassword}
                disabled={savingPassword}
              >
                {savingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
              </EnterpriseButton>
            </EnterpriseCard>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
