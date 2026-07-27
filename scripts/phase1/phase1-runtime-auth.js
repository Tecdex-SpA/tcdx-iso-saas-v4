function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function resolveRuntimeToken(tokenName, apiBaseUrl) {
  const configured = String(process.env[tokenName] || '').trim();
  if (configured) return configured;
  const email = required('E2E_ADMIN_EMAIL');
  const password = required('E2E_ADMIN_PASSWORD');
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  const token = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
  if (!response.ok || !token) throw new Error(`Unable to obtain ${tokenName} from the controlled admin account (HTTP ${response.status})`);
  return token;
}

module.exports = { resolveRuntimeToken };
