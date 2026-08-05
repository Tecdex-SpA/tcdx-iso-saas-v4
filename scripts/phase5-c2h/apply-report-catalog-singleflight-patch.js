'use strict';

const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '../../frontend/src/app/exportes/page.tsx');
let source = fs.readFileSync(target, 'utf8');

const importAnchor = "import PremiumReportsPanel from '@/components/reports/PremiumReportsPanel';\n";
const importLine = "import { fetchReportCatalogBootstrap } from '@/utils/reportCatalogBootstrap';\n";

if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) {
    throw new Error('No se encontró el ancla de importación en exportes/page.tsx');
  }
  source = source.replace(importAnchor, `${importAnchor}${importLine}`);
}

const oldBlock = `        const [typesRes, clientsRes] = await Promise.all([\n          fetch(\`${'${API_URL}'}/api/reports/types?locale=${'${encodeURIComponent(locale)}'}\`, {\n            headers: buildLocaleHeaders(token, locale),\n          }),\n          fetch(\`${'${API_URL}'}/api/reports/clients?locale=${'${encodeURIComponent(locale)}'}\`, {\n            headers: buildLocaleHeaders(token, locale),\n          }),\n        ]);\n\n        const typesJson = await typesRes.json();\n        const clientsJson = await clientsRes.json();\n\n        if (!typesRes.ok || typesJson?.ok === false) {\n          throw new Error(\n            typesJson?.error || t('exports.loadTypesError')\n          );\n        }\n\n        if (!clientsRes.ok || clientsJson?.ok === false) {\n          throw new Error(\n            clientsJson?.error || t('exports.loadClientsError')\n          );\n        }`;

const newBlock = `        const { typesJson, clientsJson, typesStatus, clientsStatus } =\n          await fetchReportCatalogBootstrap({\n            apiUrl: API_URL,\n            token,\n            locale,\n          });\n\n        if (typesStatus < 200 || typesStatus >= 300 || (typesJson as { ok?: boolean; error?: string })?.ok === false) {\n          throw new Error(\n            (typesJson as { error?: string })?.error || t('exports.loadTypesError')\n          );\n        }\n\n        if (clientsStatus < 200 || clientsStatus >= 300 || (clientsJson as { ok?: boolean; error?: string })?.ok === false) {\n          throw new Error(\n            (clientsJson as { error?: string })?.error || t('exports.loadClientsError')\n          );\n        }`;

if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) {
    throw new Error('No se encontró el bloque de carga inicial esperado en exportes/page.tsx');
  }
  source = source.replace(oldBlock, newBlock);
}

fs.writeFileSync(target, source);
console.log('exportes/page.tsx actualizado con single-flight de catálogos.');
