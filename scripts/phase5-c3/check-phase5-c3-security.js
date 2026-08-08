#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const routes = read('backend/src/routes/phase5.routes.js');
const service = read('backend/src/services/indicators/indicatorGovernance.service.js');
const migration = read('database/migrations/20260807_phase5_c3_indicators_trust_snapshots.sql');

for (const capability of ['metrics.indicators.read','metrics.indicators.technical','metrics.methodology.manage','metrics.methodology.review','metrics.methodology.publish','metrics.snapshots.publish','metrics.comparisons.read','metrics.actions.propose','metrics.actions.review','metrics.jobs.run']) {
  assert(migration.includes(`'${capability}'`), `Missing separated capability ${capability}`);
}
assert(routes.includes("metricsRouter.use(requireTenant)"), 'Official indicator routes lack authenticated tenant middleware');
assert(routes.includes("indicatorPermission('metrics.indicators.read'"), 'Business read capability is not enforced');
assert(routes.includes("indicatorPermission('metrics.indicators.technical'"), 'Technical detail capability is not enforced');
assert(routes.includes("indicatorPermission('metrics.snapshots.publish'"), 'Snapshot publication capability is not enforced');
assert(routes.includes("indicatorPermission('metrics.methodology.manage'") && routes.includes("indicatorPermission('metrics.methodology.review'") && routes.includes("indicatorPermission('metrics.methodology.publish'"), 'Methodology create/review/publish capabilities are not separated');
assert(routes.includes("indicatorPermission('metrics.actions.review'"), 'Action review capability is not enforced');
assert((service.match(/tenant_id=\$1::uuid/g)||[]).length >= 15, 'Tenant scope is not consistently present in indicator queries');
assert(service.includes('INDICATOR_LIMIT_EXHAUSTED') && migration.includes('indicator_snapshots_monthly') && migration.includes('indicator_jobs_concurrent'), 'Backend commercial limits are incomplete');
assert(service.includes("execution:'not_automatic'"), 'Governed proposals must not execute irreversible actions automatically');
assert(!routes.includes('public_auth_login') && !migration.includes('public_auth_login'), 'Phase 5-C3 must not alter public login rate limiting');
process.stdout.write(JSON.stringify({status:'VERIFIED_PHASE5_C3_SECURITY',tenant_scope:'verified',capabilities:'separated',limits:'backend',anti_bruteforce:'unaltered'})+'\n');
