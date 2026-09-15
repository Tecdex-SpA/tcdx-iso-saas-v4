import { expect, request as createRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type ScenarioKey = 'iso9001' | 'iso27001' | 'integrated';

type ProcessSeed = {
  code: string;
  name: string;
  description: string;
  area: string;
  criticality: 'alta' | 'media' | 'baja';
  operations: Array<{
    code: string;
    name: string;
    description: string;
    operation_type: string;
    frequency: string;
  }>;
};

type Scenario = {
  key: ScenarioKey;
  tenantLabel: string;
  adminEmail: string;
  expectedStandards: string[];
  processes: ProcessSeed[];
};

const root = path.resolve(__dirname, '../../..');
const outputRoot = path.resolve(root, process.env.DOC_CAPTURE_DIR || 'artifacts/documentation/screenshots');
const transactionFile = path.resolve(root, 'artifacts/documentation/transactional.json');
const apiBase = String(process.env.DOC_API_BASE_URL || process.env.DOC_WEB_BASE_URL || '').replace(/\/$/, '');
const password = String(process.env.DOC_DEMO_PASSWORD || '');
const writeEnabled = String(process.env.DOC_ENABLE_WRITES || '').toLowerCase() === 'true';

const scenarios: Scenario[] = [
  {
    key: 'iso9001',
    tenantLabel: 'demo.9001',
    adminEmail: 'admin.demo9001@tcdx.demo',
    expectedStandards: ['ISO9001'],
    processes: [
      {
        code: 'DOC-QMS-COM',
        name: 'Gestión comercial y contratos',
        description: 'Proceso documental para revisión de requisitos, contratos y compromisos con clientes.',
        area: 'Comercial',
        criticality: 'media',
        operations: [{ code: 'DOC-QMS-COM-01', name: 'Revisión de requisitos del cliente', description: 'Verificación previa de requisitos y condiciones antes de aceptar un servicio.', operation_type: 'operacion', frequency: 'Por contrato' }],
      },
      {
        code: 'DOC-QMS-OPS',
        name: 'Prestación del servicio',
        description: 'Proceso documental para ejecutar, registrar y verificar servicios técnicos.',
        area: 'Operaciones',
        criticality: 'alta',
        operations: [
          { code: 'DOC-QMS-OPS-01', name: 'Ejecución y registro del servicio', description: 'Ejecución del servicio y registro de evidencia operativa.', operation_type: 'operacion', frequency: 'Diaria' },
          { code: 'DOC-QMS-OPS-02', name: 'Verificación de entrega y cierre', description: 'Verificación del cumplimiento antes del cierre del servicio.', operation_type: 'operacion', frequency: 'Por servicio' },
        ],
      },
      {
        code: 'DOC-QMS-CAL',
        name: 'Gestión de calidad',
        description: 'Proceso documental para no conformidades, acciones y auditorías del SGC.',
        area: 'Calidad',
        criticality: 'alta',
        operations: [
          { code: 'DOC-QMS-CAL-01', name: 'Gestión de no conformidades', description: 'Registro, seguimiento y cierre de no conformidades.', operation_type: 'operacion', frequency: 'Continua' },
          { code: 'DOC-QMS-CAL-02', name: 'Auditoría interna del SGC', description: 'Planificación y ejecución de auditorías internas.', operation_type: 'operacion', frequency: 'Semestral' },
        ],
      },
    ],
  },
  {
    key: 'iso27001',
    tenantLabel: 'demo.27001',
    adminEmail: 'admin.demo27001@tcdx.demo',
    expectedStandards: ['ISO27001'],
    processes: [
      {
        code: 'DOC-ISMS-IAM',
        name: 'Gestión de identidades y accesos',
        description: 'Proceso documental para altas, cambios y revisiones periódicas de accesos.',
        area: 'Seguridad de la Información',
        criticality: 'alta',
        operations: [
          { code: 'DOC-ISMS-IAM-01', name: 'Alta y modificación de accesos', description: 'Gestión autorizada del ciclo de acceso de usuarios.', operation_type: 'operacion', frequency: 'Por solicitud' },
          { code: 'DOC-ISMS-IAM-02', name: 'Revisión periódica de permisos', description: 'Recertificación de privilegios y permisos vigentes.', operation_type: 'operacion', frequency: 'Trimestral' },
        ],
      },
      {
        code: 'DOC-ISMS-OPS',
        name: 'Operación de infraestructura TI',
        description: 'Proceso documental para respaldos y cambios de infraestructura.',
        area: 'Tecnología',
        criticality: 'alta',
        operations: [
          { code: 'DOC-ISMS-OPS-01', name: 'Ejecución y verificación de respaldos', description: 'Ejecución y comprobación de respaldos operativos.', operation_type: 'operacion', frequency: 'Diaria' },
          { code: 'DOC-ISMS-OPS-02', name: 'Gestión de cambios de infraestructura', description: 'Evaluación, autorización y registro de cambios.', operation_type: 'operacion', frequency: 'Por cambio' },
        ],
      },
      {
        code: 'DOC-ISMS-SEC',
        name: 'Gestión de seguridad de la información',
        description: 'Proceso documental para revisión de controles y auditoría interna del SGSI.',
        area: 'Seguridad de la Información',
        criticality: 'alta',
        operations: [
          { code: 'DOC-ISMS-SEC-01', name: 'Revisión de controles de seguridad', description: 'Seguimiento periódico de controles de seguridad.', operation_type: 'operacion', frequency: 'Mensual' },
          { code: 'DOC-ISMS-SEC-02', name: 'Auditoría interna del SGSI', description: 'Planificación y ejecución de auditoría interna.', operation_type: 'operacion', frequency: 'Semestral' },
        ],
      },
    ],
  },
  {
    key: 'integrated',
    tenantLabel: 'demo.isos',
    adminEmail: 'admin.demoisos@tcdx.demo',
    expectedStandards: ['ISO9001', 'ISO27001'],
    processes: [
      {
        code: 'DOC-IMS-COM',
        name: 'Gestión comercial y clientes',
        description: 'Proceso integrado para requisitos comerciales y compromisos con clientes.',
        area: 'Comercial',
        criticality: 'media',
        operations: [{ code: 'DOC-IMS-COM-01', name: 'Revisión contractual', description: 'Revisión de requisitos y condiciones contractuales.', operation_type: 'operacion', frequency: 'Por contrato' }],
      },
      {
        code: 'DOC-IMS-OPS',
        name: 'Prestación de servicios',
        description: 'Proceso integrado de prestación, registro y cambio del servicio.',
        area: 'Operaciones',
        criticality: 'alta',
        operations: [
          { code: 'DOC-IMS-OPS-01', name: 'Prestación y registro del servicio', description: 'Ejecución trazable del servicio contratado.', operation_type: 'operacion', frequency: 'Diaria' },
          { code: 'DOC-IMS-OPS-02', name: 'Gestión de cambios del servicio', description: 'Control y registro de cambios del servicio.', operation_type: 'operacion', frequency: 'Por cambio' },
        ],
      },
      {
        code: 'DOC-IMS-IT',
        name: 'Gestión de tecnología',
        description: 'Proceso integrado para accesos y respaldos de tecnología.',
        area: 'Tecnología',
        criticality: 'alta',
        operations: [
          { code: 'DOC-IMS-IT-01', name: 'Administración de accesos', description: 'Gestión del ciclo de accesos a sistemas.', operation_type: 'operacion', frequency: 'Por solicitud' },
          { code: 'DOC-IMS-IT-02', name: 'Gestión de respaldos', description: 'Ejecución y verificación de respaldos.', operation_type: 'operacion', frequency: 'Diaria' },
        ],
      },
      {
        code: 'DOC-IMS-MGT',
        name: 'Sistema integrado de gestión',
        description: 'Proceso integrado para auditorías y acciones correctivas.',
        area: 'Gestión',
        criticality: 'alta',
        operations: [
          { code: 'DOC-IMS-MGT-01', name: 'Auditoría interna integrada', description: 'Auditoría interna coordinada del sistema integrado.', operation_type: 'operacion', frequency: 'Semestral' },
          { code: 'DOC-IMS-MGT-02', name: 'Gestión de acciones correctivas', description: 'Seguimiento y cierre de acciones correctivas.', operation_type: 'operacion', frequency: 'Continua' },
        ],
      },
    ],
  },
];

const results: Record<string, unknown>[] = [];

function decodeJwtPayload(token: string): Record<string, any> {
  const part = token.split('.')[1] || '';
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(normalized + padding, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

async function login(api: APIRequestContext, email: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  const body = await response.json().catch(() => ({}));
  expect(response.status(), `login ${email}`).toBe(200);
  const token = String(body.token || body.accessToken || body.data?.token || body.data?.accessToken || '');
  expect(token).toBeTruthy();
  const claims = decodeJwtPayload(token);
  const candidates = [body, body.user, body.data, body.data?.user, claims, claims.user];
  let tenantId = '';
  let role = '';
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    tenantId ||= String(item.tenant_id || item.tenantId || item.company_id || item.companyId || item.tenant?.id || '');
    role ||= String(item.role || item.user_role || item.userRole || '').toLowerCase();
  }
  expect(tenantId, `tenant id ${email}`).toBeTruthy();
  expect(role, `role ${email}`).toBe('admin');
  return { token, tenantId };
}

async function jsonRequest(api: APIRequestContext, method: 'GET' | 'POST', url: string, token: string, data?: unknown) {
  const options: any = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (data !== undefined) options.data = data;
  const response = method === 'GET' ? await api.get(url, options) : await api.post(url, options);
  const body = await response.json().catch(() => ({}));
  expect(response.ok(), `${method} ${url}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

async function assertScope(api: APIRequestContext, token: string, tenantId: string, expected: string[]) {
  const scope = await jsonRequest(api, 'GET', `/api/tenant-standards/scope/${tenantId}`, token);
  const active = (Array.isArray(scope?.standards) ? scope.standards : [])
    .filter((item: any) => item?.is_active === true && Number(item?.active_operations_count || 0) > 0)
    .map((item: any) => String(item.code || item.standard_code || ''))
    .filter(Boolean)
    .sort();
  expect(active).toEqual([...expected].sort());
}

async function ensureProcess(api: APIRequestContext, token: string, process: ProcessSeed) {
  const listed = await jsonRequest(api, 'GET', '/api/tenant-processes', token);
  let row = (Array.isArray(listed?.data) ? listed.data : []).find((item: any) => String(item.code || '') === process.code);
  if (!row) {
    const created = await jsonRequest(api, 'POST', '/api/tenant-processes', token, {
      code: process.code,
      name: process.name,
      description: process.description,
      area: process.area,
      criticality: process.criticality,
      is_active: true,
    });
    row = created.data;
  }
  expect(String(row?.code || '')).toBe(process.code);
  for (const operation of process.operations) {
    const operations = await jsonRequest(api, 'GET', `/api/tenant-processes/${row.id}/operations`, token);
    const existing = (Array.isArray(operations?.data) ? operations.data : []).find((item: any) => String(item.code || '') === operation.code);
    if (!existing) {
      await jsonRequest(api, 'POST', `/api/tenant-processes/${row.id}/operations`, token, {
        ...operation,
        is_active: true,
      });
    }
  }
  return row;
}

async function installSession(page: Page, token: string) {
  await page.addInitScript((value) => {
    localStorage.setItem('token', value);
    localStorage.setItem('authToken', value);
  }, token);
}

async function capture(page: Page, scenario: Scenario, name: string) {
  const dir = path.join(outputRoot, scenario.key, 'transactional');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

test.beforeAll(() => {
  expect(apiBase).toBeTruthy();
  expect(password).toBeTruthy();
  fs.mkdirSync(path.dirname(transactionFile), { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(transactionFile, JSON.stringify({ generatedAt: new Date().toISOString(), writeEnabled, results }, null, 2));
});

for (const scenario of scenarios) {
  test(`${scenario.key} creates idempotent DOC processes and operations and captures the UI`, async ({ page }) => {
    test.skip(!writeEnabled, 'Transactional documentation writes require DOC_ENABLE_WRITES=true');
    const api = await createRequest.newContext({ baseURL: apiBase });
    try {
      const { token, tenantId } = await login(api, scenario.adminEmail);
      await assertScope(api, token, tenantId, scenario.expectedStandards);

      for (const process of scenario.processes) {
        expect(process.code.startsWith('DOC-')).toBeTruthy();
        for (const operation of process.operations) expect(operation.code.startsWith('DOC-')).toBeTruthy();
        await ensureProcess(api, token, process);
      }

      await installSession(page, token);
      await page.goto('/configuracion', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Nuevo proceso' })).toBeVisible();
      await capture(page, scenario, '01-configuracion-proceso-formulario-vacio');

      const processName = page.getByLabel('Nombre').nth(0);
      const processCode = page.getByLabel('Código').nth(0);
      const processArea = page.getByLabel('Área').nth(0);
      await processName.fill(scenario.processes[0].name);
      await processCode.fill(scenario.processes[0].code);
      await processArea.fill(scenario.processes[0].area);
      await capture(page, scenario, '02-configuracion-proceso-formulario-completado');

      // No segundo POST por UI: el baseline se creó idempotentemente por API oficial.
      // Abrimos el registro DOC existente y demostramos su formulario editable real.
      const docRow = page.getByText(scenario.processes[0].code, { exact: true }).first();
      await expect(docRow).toBeVisible();
      await docRow.scrollIntoViewIfNeeded();
      await capture(page, scenario, '03-configuracion-procesos-doc-creados');

      results.push({
        scenario: scenario.key,
        tenantLabel: scenario.tenantLabel,
        tenantId,
        status: 'PASS',
        processCodes: scenario.processes.map((item) => item.code),
        operationCodes: scenario.processes.flatMap((item) => item.operations.map((op) => op.code)),
        checkedAt: new Date().toISOString(),
      });
    } finally {
      await api.dispose();
    }
  });
}
