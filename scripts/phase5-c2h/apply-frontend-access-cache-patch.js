'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const appLayoutPath = path.join(
  repoRoot,
  'frontend',
  'src',
  'components',
  'AppLayout.tsx'
);
let source = fs.readFileSync(appLayoutPath, 'utf8');

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`No se encontró bloque esperado: ${label}`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  'access bootstrap import',
  "import { getApiBaseUrl } from '@/utils/apiClient';\n",
  "import { getApiBaseUrl } from '@/utils/apiClient';\n" +
    "import { fetchAccessBootstrap } from '@/utils/accessBootstrap';\n"
);

replaceOnce(
  'module access fetch',
  `  const getModuleAccess = useCallback(async (token: string): Promise<ModuleAccessResponse> => {
    const res = await fetch(\`${'${API_URL}'}/api/me/modules\`, {
      headers: {
        Authorization: \`Bearer ${'${token}'}\`,
      },
    });

    const text = await res.text();

    let json: ModuleAccessResponse | null = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(t('app.invalidModulesResponse', { status: res.status }));
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || t('app.modulesError'));
    }

    return json;
  }, [t]);
`,
  `  const getModuleAccess = useCallback(
    async (token: string): Promise<ModuleAccessResponse> =>
      fetchAccessBootstrap<ModuleAccessResponse>({
        token,
        url: \`${'${API_URL}'}/api/me/modules\`,
        fallbackError: t('app.modulesError'),
        invalidResponseError: (status) =>
          t('app.invalidModulesResponse', { status }),
      }),
    [t]
  );
`
);

replaceOnce(
  'permissions fetch',
  `  const getPermissions = useCallback(async (token: string): Promise<PermissionsResponse> => {
    const res = await fetch(\`${'${API_URL}'}/api/me/permissions\`, {
      headers: {
        Authorization: \`Bearer ${'${token}'}\`,
      },
    });

    const text = await res.text();

    let json: PermissionsResponse | null = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(t('app.invalidModulesResponse', { status: res.status }));
    }

    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || t('app.permissionsError'));
    }

    return json;
  }, [t]);
`,
  `  const getPermissions = useCallback(
    async (token: string): Promise<PermissionsResponse> =>
      fetchAccessBootstrap<PermissionsResponse>({
        token,
        url: \`${'${API_URL}'}/api/me/permissions\`,
        fallbackError: t('app.permissionsError'),
        invalidResponseError: (status) =>
          t('app.invalidModulesResponse', { status }),
      }),
    [t]
  );
`
);

fs.writeFileSync(appLayoutPath, source, 'utf8');
console.log(`AppLayout actualizado: ${appLayoutPath}`);
