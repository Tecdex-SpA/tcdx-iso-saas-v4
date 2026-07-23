import fs from 'node:fs';

const files = {
  panel: 'src/components/grc/GrcPhase1Panel.tsx',
  admin: 'src/app/admin-saas/page.tsx',
};
const sources = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')])
);
const contracts = [
  ['panel', '/api/grc/bootstrap/status'],
  ['panel', '/api/grc/bootstrap'],
  ['panel', '/api/grc/bootstrap/validate'],
  ['panel', '/api/grc/readiness/snapshots'],
  ['panel', '/api/grc/evidence/requests'],
  ['panel', '/api/grc/scheduler/run'],
  ['panel', '/api/grc/workflow-instances'],
  ['panel', '/transitions'],
  ['panel', '/workflows/validate'],
  ['panel', '/draft'],
  ['panel', '/archive'],
  ['panel', '/submissions'],
  ['panel', '/versions'],
  ['panel', '/mappings/${id}/reviews'],
  ['panel', '/operations'],
  ['panel', '/evidence-links'],
  ['panel', 'aria-live="polite"'],
  ['panel', 'Inicializar GRC'],
  ['admin', '/api/admin-saas/tenants/${selectedTenantId}/modules/${moduleKey}'],
  ['admin', 'clearTenantEntitlementsCache()'],
  ['admin', 'aria-live="polite"'],
  ['admin', 'global_active'],
];
const missing = contracts
  .filter(([source, marker]) => !sources[source].includes(marker))
  .map(([source, marker]) => `${files[source]}:${marker}`);
const forbidden = [
  ['panel', /\balert\s*\(/],
  ['panel', /\bTODO\b|\bFIXME\b|coming soon|not implemented/i],
  ['admin', /continue-on-error|\|\|\s*true/],
];
for (const [source, pattern] of forbidden) {
  if (pattern.test(sources[source])) missing.push(`${files[source]}:forbidden:${pattern}`);
}
if (missing.length) {
  console.error(`Phase 1 UI contracts failed:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`Phase 1 UI contracts: OK contracts=${contracts.length}`);
