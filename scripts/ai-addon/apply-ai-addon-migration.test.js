#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runnerPath = path.join(__dirname, 'apply-ai-addon-migration.js');
const source = fs.readFileSync(runnerPath, 'utf8');

assert.match(
  source,
  /\('schema_migrations','applied_by'\)/,
  'AI Add-on preflight must require schema_migrations.applied_by',
);

assert.match(
  source,
  /\('schema_migrations','duration_ms'\)/,
  'AI Add-on preflight must require schema_migrations.duration_ms when the ledger insert writes it',
);

assert.match(
  source,
  /CREATE TABLE IF NOT EXISTS public\.schema_migrations[\s\S]*applied_by text NOT NULL/,
  'AI Add-on fallback ledger schema must include applied_by as NOT NULL',
);

assert.match(
  source,
  /INSERT INTO public\.schema_migrations \(migration_id, checksum, applied_at, applied_by, duration_ms, status, details\)[\s\S]*VALUES \(\$1, \$2, now\(\), current_user, \$3, 'applied', \$4::jsonb\)/,
  'AI Add-on applied ledger insert must populate applied_by from current_user',
);

assert.doesNotMatch(
  source,
  /applied_by[^\n;]*(andres|tecdex@|postgres')/i,
  'AI Add-on ledger must not hardcode a personal or fixed PostgreSQL user',
);

process.stdout.write('AI_ADDON_LEDGER_INSERT_TEST_PASS\n');
