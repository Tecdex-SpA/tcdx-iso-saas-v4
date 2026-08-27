import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function getNestedValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertValue(dictionary, key, expected, locale) {
  const actual = getNestedValue(dictionary, key);
  assert(
    actual === expected,
    `${locale}.${key} must be "${expected}"; found "${actual}".`
  );
}

function assertManifestTextClean({ locale, bodyText, breadcrumbText }) {
  const visible = `${bodyText || ''}\n${breadcrumbText || ''}`;
  const forbiddenPatterns = [
    /La sesión no contiene un tenant válido/i,
    /invalid tenant/i,
    /unauthorized/i,
    /error de autenticación/i,
    /Risk matrixs/i,
    /Inicio\s*\/\s*Inicio/i,
    /Home\s*\/\s*Home/i,
  ];

  forbiddenPatterns.forEach((pattern) => {
    assert(!pattern.test(visible), `Manifest must reject forbidden visible pattern: ${pattern}`);
  });

  if (locale === 'es') {
    const spanishSignals = [
      /Inicio/i,
      /Centro ejecutivo/i,
      /Bienvenido a Tecdex GRC Compliance/i,
      /Vista operacional/i,
      /Resumen ejecutivo GRC/i,
    ];
    const englishSignals = [
      /Welcome to Tecdex GRC Compliance/i,
      /Operational View/i,
      /Executive Center/i,
      /Risk Register/i,
      /System Health/i,
    ];

    assert(
      spanishSignals.some((pattern) => pattern.test(visible)),
      'Spanish manifest checks must see Spanish UI signals.'
    );
    assert(
      !englishSignals.some((pattern) => pattern.test(visible)),
      'Spanish manifest checks must reject known English UI labels.'
    );
  }

  if (locale === 'en') {
    const englishSignals = [
      /Home/i,
      /Executive Center/i,
      /Welcome to Tecdex GRC Compliance/i,
      /Operational View/i,
      /Executive GRC Summary/i,
    ];
    const spanishSignals = [
      /Inicio/i,
      /Centro ejecutivo/i,
      /Vista operacional/i,
      /Registro de riesgos/i,
      /Salud del sistema/i,
    ];

    assert(
      englishSignals.some((pattern) => pattern.test(visible)),
      'English manifest checks must see English UI signals.'
    );
    assert(
      !spanishSignals.some((pattern) => pattern.test(visible)),
      'English manifest checks must reject known Spanish UI labels.'
    );
  }
}

const es = readJson(path.join(srcRoot, 'i18n/dictionaries/es.json'));
const en = readJson(path.join(srcRoot, 'i18n/dictionaries/en.json'));
const header = read(path.join(srcRoot, 'components/Header.tsx'));
const displayText = read(path.join(srcRoot, 'i18n/displayText.ts'));
const enterpriseNavigation = read(path.join(srcRoot, 'config/enterpriseNavigation.ts'));
const captureScriptPath = path.join(root, 'scripts/capture-ui02-stage2-2-localization-closeout.mjs');

[
  ['navigation.domains.home', 'Inicio'],
  ['navigation.destinations.executiveCenter', 'Centro ejecutivo'],
  ['navigation.destinations.grcPortfolio', 'Portafolio GRC'],
  ['navigation.domains.compliance', 'Cumplimiento'],
  ['navigation.domains.riskControl', 'Riesgo y Control'],
  ['navigation.domains.auditImprovement', 'Auditoría y Mejora'],
  ['navigation.domains.operationsResilience', 'Operación y Resiliencia'],
  ['navigation.domains.dataEvidence', 'Datos y Evidencia'],
  ['navigation.domains.intelligence', 'Inteligencia'],
  ['navigation.domains.reports', 'Reportes'],
  ['navigation.domains.administration', 'Administración'],
  ['navigation.destinations.riskRegister', 'Registro de riesgos'],
  ['navigation.destinations.riskMatrix', 'Matriz de riesgos'],
  ['navigation.destinations.controls', 'Controles'],
  ['navigation.destinations.assets', 'Activos'],
  ['navigation.destinations.quantitativeRisk', 'Riesgo cuantitativo'],
  ['dashboard.title', 'Bienvenido a Tecdex GRC Compliance'],
  ['dashboard.executiveView', 'Vista operacional'],
  ['dashboard.kpiView', 'Vista KPI'],
  ['dashboard.systemHealthView', 'Salud del sistema'],
  ['common.today', 'Hoy'],
  ['common.refresh', 'Actualizar'],
  ['grcDecisionCenter.summaryTitle', 'Resumen ejecutivo GRC'],
].forEach(([key, expected]) => assertValue(es, key, expected, 'es'));

[
  ['navigation.domains.home', 'Home'],
  ['navigation.destinations.executiveCenter', 'Executive Center'],
  ['navigation.destinations.riskRegister', 'Risk Register'],
  ['navigation.destinations.riskMatrix', 'Risk Matrix'],
  ['navigation.destinations.quantitativeRisk', 'Quantitative Risk'],
  ['dashboard.title', 'Welcome to Tecdex GRC Compliance'],
  ['dashboard.executiveView', 'Operational View'],
  ['dashboard.kpiView', 'KPI View'],
  ['dashboard.systemHealthView', 'System Health'],
  ['common.today', 'Today'],
  ['common.refresh', 'Refresh'],
  ['grcDecisionCenter.summaryTitle', 'Executive GRC Summary'],
].forEach(([key, expected]) => assertValue(en, key, expected, 'en'));

assert(
  /breadcrumbSegments/.test(header) &&
    /visibleBreadcrumbSegments/.test(header) &&
    /aria-current="page"/.test(header) &&
    /breadcrumb-ellipsis/.test(header),
  'Header must preserve UI-02 Stage 2.1 breadcrumb structure.'
);

assert(
  /Matriz de riesgos\/gi,\s*'Risk Matrix'/.test(displayText),
  'Display text translation must handle the plural risk matrix phrase before singular replacement.'
);

assert(
  !/Risk matrixs/i.test(`${displayText}\n${enterpriseNavigation}`),
  'Source localization contracts must not contain "Risk matrixs".'
);

assert(
  fs.existsSync(captureScriptPath),
  'UI-02 Stage 2.2 capture script must exist so visual evidence is reproducible.'
);

let rejectedTenantError = false;
try {
  assertManifestTextClean({
    locale: 'es',
    bodyText: 'Inicio / Centro ejecutivo\nLa sesión no contiene un tenant válido',
    breadcrumbText: 'Inicio / Centro ejecutivo',
  });
} catch {
  rejectedTenantError = true;
}

assert(
  rejectedTenantError,
  'Manifest validation must reject visible invalid-tenant errors.'
);

let rejectedMixedLocale = false;
try {
  assertManifestTextClean({
    locale: 'es',
    bodyText: 'Bienvenido a Tecdex GRC Compliance\nOperational View\nResumen ejecutivo GRC',
    breadcrumbText: 'Inicio / Centro ejecutivo',
  });
} catch {
  rejectedMixedLocale = true;
}

assert(
  rejectedMixedLocale,
  'Manifest validation must reject known mixed English/Spanish labels.'
);

assertManifestTextClean({
  locale: 'es',
  bodyText: 'Inicio / Centro ejecutivo\nBienvenido a Tecdex GRC Compliance\nVista operacional\nResumen ejecutivo GRC',
  breadcrumbText: 'Inicio / Centro ejecutivo',
});

assertManifestTextClean({
  locale: 'en',
  bodyText: 'Home / Executive Center\nWelcome to Tecdex GRC Compliance\nOperational View\nExecutive GRC Summary',
  breadcrumbText: 'Home / Executive Center',
});

console.log('UI02_STAGE2_2_LOCALIZATION_CONTRACT_PASS');
