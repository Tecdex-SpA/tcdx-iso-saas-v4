#!/usr/bin/env node
'use strict';

const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const { Client } = require(path.join(root, 'backend/node_modules/pg'));
const { FORMULAS, executeFormula } = require(path.join(root, 'backend/src/services/math-governance/formulaRegistry.service'));
const { persistSourceSnapshot, SOURCE_DATASET_SNAPSHOT_TYPE } = require(path.join(root, 'backend/src/services/math-governance/officialCalculationOrchestrator.service'));

const TENANTS = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Servicios tecnologicos tecdex SPA' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Servicios de Información Credex SPA' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Empresa Demo TCDX Compliance' },
];

async function main() {
  const connectionString = process.env.PHASE5_5_TEST_DATABASE_URL;
  if (!connectionString) throw new Error('PHASE5_5_TEST_DATABASE_URL is required');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query(`
      CREATE TABLE calculation_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        formula_code text NOT NULL,
        source_contract_id uuid,
        source_snapshot_hash char(64)
      );
      CREATE TABLE calculation_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        run_id uuid,
        source_contract_id uuid,
        snapshot_type text NOT NULL,
        snapshot_hash char(64) NOT NULL,
        row_count integer NOT NULL DEFAULT 0,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT calculation_snapshots_snapshot_type_check CHECK (snapshot_type IN ('source_dataset','input','output','explanation','comparison'))
      );
    `);

    let persisted = 0;
    for (const tenant of TENANTS) {
      for (const formula of FORMULAS) {
        const normal = formula.tests.find((test) => test.name === 'normal');
        if (!normal) throw new Error(`Missing normal vector for ${formula.formula_code}`);
        const result = executeFormula(formula.formula_code, normal.inputs);
        if (!['calculated','not_calculable'].includes(result.status)) throw new Error(`Unexpected result for ${formula.formula_code}`);
        const run = await client.query('INSERT INTO calculation_runs (tenant_id, formula_code) VALUES ($1::uuid,$2) RETURNING id', [tenant.id, formula.formula_code]);
        const hash = crypto.createHash('sha256').update(JSON.stringify({ tenant: tenant.id, formula: formula.formula_code, inputs: normal.inputs })).digest('hex');
        const snapshotId = await persistSourceSnapshot(client, tenant.id, {
          source_code: `ci_${formula.formula_code.toLowerCase()}`,
          source_snapshot_hash: hash,
          source_snapshot: { tenant_id: tenant.id, tenant_name: tenant.name, formula_code: formula.formula_code, input_hash: hash },
          physical_sources: ['ci_formula_vectors'],
          counts: { received: 1, usable: 1, excluded: 0 },
          exclusions: [],
        }, { calculation_run_id: run.rows[0].id });
        if (!snapshotId) throw new Error(`Snapshot not persisted for ${tenant.name}/${formula.formula_code}`);
        persisted += 1;
      }
    }

    const formulasPerTenant = FORMULAS.length;
    const expectedPersisted = TENANTS.length * formulasPerTenant;
    const snapshotRows = await client.query('SELECT tenant_id::text, snapshot_type, count(*)::int AS count FROM calculation_snapshots GROUP BY tenant_id,snapshot_type ORDER BY tenant_id');
    for (const tenant of TENANTS) {
      const row = snapshotRows.rows.find((item) => item.tenant_id === tenant.id && item.snapshot_type === SOURCE_DATASET_SNAPSHOT_TYPE);
      if (row?.count !== formulasPerTenant) throw new Error(`Tenant isolation failed for ${tenant.name}: expected ${formulasPerTenant} snapshots, got ${row?.count || 0}`);
    }
    const crossTenant = await client.query(`SELECT count(*)::int AS count FROM calculation_snapshots s JOIN calculation_runs r ON r.id=s.run_id WHERE s.tenant_id<>r.tenant_id`);
    if (crossTenant.rows[0].count !== 0) throw new Error('Cross-tenant snapshot contamination detected');
    if (persisted !== expectedPersisted) throw new Error(`Expected ${expectedPersisted} persisted calculations, got ${persisted}`);
    process.stdout.write(JSON.stringify({ status: 'PHASE5_5_50_FORMULA_SNAPSHOT_POSTGRES_OK', tenants: TENANTS.map((item) => item.name), formulas_per_tenant: formulasPerTenant, snapshots: persisted, snapshot_type: SOURCE_DATASET_SNAPSHOT_TYPE, cross_tenant_rows: 0 }) + '\n');
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
