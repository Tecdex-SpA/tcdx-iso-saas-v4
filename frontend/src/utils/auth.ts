export function decodeJwtPayload(token: string) {
  try {
    const base64Url = token.split('.')[1];

    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}

export function getUserFromToken() {
  if (typeof window === 'undefined') return null;

  const token = getToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return payload;
}

export function normalizeRole(role?: string | null) {
  return String(role || '').toLowerCase().trim();
}

export function getUserRoleFromToken() {
  const user = getUserFromToken();

  return normalizeRole(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      ''
  );
}

export function getTenantIdFromToken() {
  const user = getUserFromToken();

  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  );
}

export function getUserIdFromToken() {
  const user = getUserFromToken();

  return user?.user_id || user?.userId || user?.id || null;
}

export function getHomePathByRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);

  if (
    normalizedRole === 'superadmin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'platform_admin' ||
    normalizedRole === 'admin_global' ||
    normalizedRole === 'global_admin' ||
    normalizedRole === 'owner'
  ) {
    return '/admin-saas';
  }

  if (normalizedRole === 'dealer') {
    return '/dealer';
  }

  return '/dashboard';
}

export function getHomePathFromToken() {
  const user = getUserFromToken();

  return getHomePathByRole(
    user?.role ||
      user?.user_role ||
      user?.userRole ||
      null
  );
}

export function isTokenExpired(token?: string | null) {
  if (!token) return true;

  const payload = decodeJwtPayload(token);

  if (!payload?.exp) return false;

  const nowInSeconds = Math.floor(Date.now() / 1000);

  return Number(payload.exp) <= nowInSeconds;
}

export function getStoredValidToken() {
  const token = getToken();

  if (!token) return null;

  if (isTokenExpired(token)) {
    clearToken();
    return null;
  }

  return token;
}

export function logout(redirectTo = '/login') {
  if (typeof window === 'undefined') return;

  clearToken();
  window.location.href = redirectTo;
}
