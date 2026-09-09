#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const migrationPath = path.join(root, 'database/migrations/20260904_dbn02_health_metrics_lineage_normalization.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');
const withoutComments = sql.replace(/--.*$/gm, '');
const refreshBody = sql.match(/CREATE OR REPLACE FUNCTION refresh_control_health_scores_v2_1[\s\S]*?END \$\$;/)?.[0] || '';
const resolverBody = sql.match(/CREATE OR REPLACE FUNCTION dbn02_resolve_control_standard_code[\s\S]*?\$\$;/)?.[0] || '';

assert.match(sql, /BEGIN;/, 'DB-N02 migration must be transactional');
assert.match(sql, /COMMIT;/, 'DB-N02 migration must be transactional');
assert.match(sql, /pg_try_advisory_xact_lock\(844332,\s*2026090402\)/, 'DB-N02 migration must use advisory lock');
assert.match(sql, /dbn02_resolve_control_standard_code/, 'DB-N02 migration must provide canonical standard-code lineage resolver');
assert.match(resolverBody, /AMBIGUOUS/, 'DB-N02 standard-code resolver must expose active multi-standard ambiguity');
assert.match(sql, /tenant_controls\.control_id->controls_catalog\(_standards\|iso\)->tenant_standards\.active/, 'DB-N02 standard_code source must be canonical lineage');
assert.match(sql, /dbn02_normalize_health_component_state/, 'DB-N02 migration must centralize component state interpretation');
assert.match(sql, /dbn02_grc_health_publication_state/, 'DB-N02 migration must centralize coverage publication behavior');
assert.match(sql, /CREATE OR REPLACE VIEW v_control_health_scores_dbn02_lineage/, 'DB-N02 migration must expose audit lineage projection');
assert.match(sql, /CREATE OR REPLACE FUNCTION refresh_control_health_scores_v2_1/, 'DB-N02 migration must replace refresh function forward-only');
assert.match(refreshBody, /dbn02_resolve_control_standard_code/, 'refresh function must derive standard_code from canonical lineage');
assert.match(refreshBody, /lineage\.lineage_status\s*=\s*'RESOLVED_FROM_CANONICAL_CONTROL_LINEAGE'/, 'refresh function must only update uniquely resolved lineage rows');
assert.doesNotMatch(resolverBody, /ORDER BY[\s\S]{0,160}LIMIT\s+1/i, 'standard-code resolver must not hide ambiguity by ordered LIMIT 1 selection');
assert.doesNotMatch(refreshBody, /control_health_scores\s+[^;]*standard_code[^;]*FROM\s+control_health_scores/i, 'refresh function must not derive standard_code from prior control_health_scores rows');
assert.doesNotMatch(withoutComments, /\bDROP\s+(TABLE|VIEW)\b/i, 'DB-N02 must not drop legacy tables/views');
assert.doesNotMatch(withoutComments, /\bTRUNCATE\b/i, 'DB-N02 must not truncate legacy data');
assert.doesNotMatch(withoutComments, /control_health_scores_backup_history/i, 'DB-N02 must not touch backup history cleanup');
assert.doesNotMatch(withoutComments, /control_health_scores_v2_preview/i, 'DB-N02 must not touch preview cleanup');
assert.doesNotMatch(withoutComments, /\bKPI-HLT-[0-9]/i, 'DB-N02 must not mutate KPI-HLT objects');
assert.doesNotMatch(withoutComments, /\btenant_control_id\s*=\s*[^;\n]+controls_catalog\.id/i, 'DB-N02 must not reinterpret tenant_control_id as catalog identity');

console.log('DB-N02 health metrics lineage migration static checks: OK');
