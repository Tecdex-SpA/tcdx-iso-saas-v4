import { expect, test, type Page } from '@playwright/test';

const tenantA = process.env.PHASE5_5_TENANT_A_ID || '70000000-0000-0000-0000-000000000701';
const tenantB = process.env.PHASE5_5_TENANT_B_ID || '70000000-0000-0000-0000-000000000702';
const password = process.env.PHASE5_5_PASSWORD || 'Phase55E2E!2026';
const apiBaseUrl = String(process.env.API_BASE_URL || '').replace(/\/+$/, '');
const nonce = Date.now();

async function login(page: Page, email: string) {
  if (page.url() !== 'about:blank') {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
  await page.context().clearCookies();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const response = await Promise.all([
    page.waitForResponse((item) => item.url().includes('/api/auth/login')),
    page.getByRole('button', { name: /ingresar/i }).click(),
  ]).then(([item]) => item);
  expect(response.status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login$/);
  await page.waitForLoadState('domcontentloaded');
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  return token || '';
}

function headers(token: string, tenantId: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' };
}

test('contrato semántico se configura, publica, ingiere y queda aislado por tenant', async ({ page }) => {
  const tokenA = await login(page, 'phase55.admin@tcdx.local');
  await page.goto('/datos/semantica');
  await expect(page.getByRole('heading', { name: 'Capa semántica GRC' })).toBeVisible();

  const displayName = `Fuente semántica QA ${nonce}`;
  await page.getByLabel('Código').fill(`qa.browser.${nonce}`);
  await page.getByLabel('Nombre visible').fill(displayName);
  await page.getByLabel('Entidad').fill('qa_metric');
  await page.getByLabel('Adaptador autorizado').fill('official_formula_source');
  const createContract = await Promise.all([
    page.waitForResponse((item) => item.url().includes('/api/data/semantic/source-contracts') && item.request().method() === 'POST'),
    page.getByRole('button', { name: 'Crear contrato' }).click(),
  ]).then(([item]) => item);
  expect(createContract.ok(), await createContract.text()).toBeTruthy();
  const contractPayload = await createContract.json();
  const contractId = contractPayload.data.id as string;
  await expect(page.getByRole('heading', { name: displayName })).toBeVisible();

  const versionForm = page.getByRole('heading', { name: 'Nueva versión' }).locator('..');
  await versionForm.getByLabel('Tabla permitida').fill('semantic_browser_source');
  await versionForm.getByLabel('Timestamp').fill('observed_at');
  await versionForm.getByLabel('Campos obligatorios').fill('value, observed_at');
  const createVersion = await Promise.all([
    page.waitForResponse((item) => item.url().includes(`/source-contracts/${contractId}/versions`) && item.request().method() === 'POST'),
    page.getByRole('button', { name: 'Crear versión' }).click(),
  ]).then(([item]) => item);
  expect(createVersion.ok(), await createVersion.text()).toBeTruthy();
  const versionPayload = await createVersion.json();
  const versionId = versionPayload.data.id as string;

  for (const mapping of [
    { column: 'value_numeric', field: 'value', transform: 'numeric_parse' },
    { column: 'observed_at', field: 'observed_at', transform: 'timezone_normalize' },
  ]) {
    const technicalSection = page.getByRole('heading', { name: 'Configuración técnica autorizada' }).locator('..');
    const saveMapping = technicalSection.getByRole('button', { name: 'Guardar mapping' });
    await expect(saveMapping).toBeEnabled();
    await technicalSection.getByLabel('Tabla permitida').fill('semantic_browser_source');
    await technicalSection.getByLabel('Columna').fill(mapping.column);
    await technicalSection.getByLabel('Campo canónico').fill(mapping.field);
    await technicalSection.getByLabel('Transformación').selectOption(mapping.transform);
    const response = await Promise.all([
      page.waitForResponse((item) => item.url().includes(`/versions/${versionId}/mappings`) && item.request().method() === 'POST'),
      saveMapping.click(),
    ]).then(([item]) => item);
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(page.getByRole('status')).toHaveText('Mapping guardado.');
    await expect(saveMapping).toBeEnabled();
  }

  const preview = await Promise.all([
    page.waitForResponse((item) => item.url().includes(`/versions/${versionId}/preview`)),
    page.getByRole('button', { name: 'Validar y previsualizar' }).click(),
  ]).then(([item]) => item);
  expect(preview.ok(), await preview.text()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Resultado de validación' })).toBeVisible();
  await expect(page.getByText(/Fuente disponible|Disponible con observaciones/).first()).toBeVisible();

  for (const transition of ['Enviar a revisión', 'Aprobar', 'Publicar']) {
    const response = await Promise.all([
      page.waitForResponse((item) => item.url().includes(`/versions/${versionId}/`) && item.request().method() === 'POST'),
      page.getByRole('button', { name: transition }).click(),
    ]).then(([item]) => item);
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  const ingest = await Promise.all([
    page.waitForResponse((item) => item.url().includes(`/versions/${versionId}/ingest`)),
    page.getByRole('button', { name: 'Ingerir observaciones' }).click(),
  ]).then(([item]) => item);
  expect(ingest.ok(), await ingest.text()).toBeTruthy();
  const ingestPayload = await ingest.json();
  const observationId = ingestPayload.data.observations[0].id as string;
  await expect(page.getByRole('cell', { name: 'qa_metric' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver lineage' }).first()).toBeVisible();

  const assessment = await page.request.get(`${apiBaseUrl}/api/data/semantic/versions/${versionId}/assessment`, { headers: headers(tokenA, tenantA) });
  expect(assessment.ok(), await assessment.text()).toBeTruthy();
  expect((await assessment.json()).data.sufficiency.status).toBe('sufficient');

  const relation = await page.request.post(`${apiBaseUrl}/api/data/semantic/observations/${observationId}/relations`, {
    headers: headers(tokenA, tenantA),
    data: { related_entity_type: 'data_source_contract', related_entity_id: contractId, relation_type: 'derived_from', confidence: 1 },
  });
  expect(relation.ok(), await relation.text()).toBeTruthy();

  const immutableVersion = await page.request.patch(`${apiBaseUrl}/api/data/semantic/versions/${versionId}`, {
    headers: headers(tokenA, tenantA), data: { minimum_coverage: 0.5 },
  });
  expect(immutableVersion.status()).toBe(409);

  const ruleCreate = await page.request.post(`${apiBaseUrl}/api/data/semantic/sufficiency-rules`, {
    headers: headers(tokenA, tenantA),
    data: { formula_code: 'F5_5_COMPLIANCE_WEIGHTED', rule_code: `qa.sufficiency.${nonce}`, required_inputs: ['value'], minimum_sample_size: 1, minimum_coverage: 1 },
  });
  expect(ruleCreate.ok(), await ruleCreate.text()).toBeTruthy();
  const ruleId = (await ruleCreate.json()).data.id as string;
  for (const transition of ['review', 'approve', 'publish']) {
    const response = await page.request.post(`${apiBaseUrl}/api/data/semantic/sufficiency-rules/${ruleId}/${transition}`, { headers: headers(tokenA, tenantA), data: {} });
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  const queuedJob = await page.request.post(`${apiBaseUrl}/api/data/semantic/jobs/semantic_source.reconcile`, {
    headers: headers(tokenA, tenantA), data: { idempotency_key: `qa-reconcile-${nonce}`, max_attempts: 2, timeout_ms: 10000 },
  });
  expect(queuedJob.ok(), await queuedJob.text()).toBeTruthy();
  const jobId = (await queuedJob.json()).data.id as string;
  const executedJob = await page.request.post(`${apiBaseUrl}/api/data/semantic/jobs/id/${jobId}/execute`, { headers: headers(tokenA, tenantA), data: {} });
  expect(executedJob.ok(), await executedJob.text()).toBeTruthy();
  const executedJobData = (await executedJob.json()).data;
  expect(executedJobData.status).toBe('completed');
  expect(executedJobData.result_json.status).toBe('compatible_with_adapters');
  expect(executedJobData.result_json.adapted).toBeGreaterThan(0);

  const restrictedToken = await login(page, 'phase55.viewer@tcdx.local');
  const restricted = await page.request.get(`${apiBaseUrl}/api/data/semantic/source-contracts`, { headers: headers(restrictedToken, tenantA) });
  expect(restricted.status()).toBe(403);

  const tenantBToken = await login(page, 'phase55.admin.b@tcdx.local');
  const crossTenant = await page.request.get(`${apiBaseUrl}/api/data/semantic/source-contracts/${contractId}`, { headers: headers(tenantBToken, tenantB) });
  expect(crossTenant.status()).toBe(404);
  const tenantBList = await page.request.get(`${apiBaseUrl}/api/data/semantic/source-contracts`, { headers: headers(tenantBToken, tenantB) });
  expect(tenantBList.ok(), await tenantBList.text()).toBeTruthy();
  const tenantBData = await tenantBList.json();
  expect((tenantBData.data as Array<{ id: string }>).some((item) => item.id === contractId)).toBeFalsy();

  const lineage = await page.request.get(`${apiBaseUrl}/api/data/semantic/observations`, { headers: headers(tokenA, tenantA) });
  expect(lineage.ok(), await lineage.text()).toBeTruthy();
});
