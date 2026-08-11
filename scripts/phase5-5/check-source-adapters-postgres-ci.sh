#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
CONTAINER_NAME="tcdx-phase5-5-source-ci-$$-$RANDOM"
DATABASE_NAME="phase5_5_source_ci"
TENANT_A="70000000-0000-0000-0000-000000000701"
TENANT_B="70000000-0000-0000-0000-000000000702"

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --detach --name "$CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB="$DATABASE_NAME" \
  -p "127.0.0.1::5432" postgres:16-alpine >/dev/null

PORT="$(docker port "$CONTAINER_NAME" 5432/tcp | awk -F: 'NR == 1 { print $NF }')"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Docker did not publish PostgreSQL port" >&2; exit 1; }

run_psql() { psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE_NAME" "$@"; }
ready=0
for _attempt in {1..45}; do
  if run_psql -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
(( ready == 1 )) || { echo "PostgreSQL 16 did not become ready" >&2; exit 1; }

run_psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE grc_framework_requirements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL
);
CREATE TABLE grc_requirement_control_mappings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  requirement_id uuid NOT NULL,
  tenant_control_id uuid,
  mapping_type text NOT NULL,
  coverage_level numeric,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grc_control_assurance (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  tenant_control_id uuid NOT NULL,
  assurance_status text NOT NULL,
  score numeric NOT NULL,
  design_score numeric,
  implementation_score numeric,
  operation_score numeric,
  evidence_score numeric,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grc_readiness_snapshots (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grc_readiness_results (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  dimension text NOT NULL,
  score numeric NOT NULL,
  weight numeric NOT NULL,
  source_as_of timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE grc_readiness_findings (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  severity text NOT NULL
);
CREATE TABLE grc_quantitative_risk_assessments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  risk_id uuid NOT NULL,
  probability numeric,
  impact numeric,
  exposure numeric,
  occurrence numeric,
  detection numeric,
  status text,
  assessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE action_plans (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  severity text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  due_at timestamptz,
  progress numeric,
  weight numeric
);
CREATE TABLE calculation_runs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  formula_code text NOT NULL,
  run_status text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE calculation_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  output_value jsonb NOT NULL,
  unit text
);
CREATE TABLE data_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trust_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE survey_evaluations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  score numeric,
  weight numeric,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL
);
CREATE TABLE metric_measurements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  metric_id uuid,
  numeric_value numeric,
  measured_at timestamptz NOT NULL DEFAULT now(),
  unit text,
  dimension_values jsonb,
  status text
);

INSERT INTO grc_framework_requirements (id, tenant_id) VALUES
('71000000-0000-0000-0000-000000000001', '$TENANT_A'),
('72000000-0000-0000-0000-000000000001', '$TENANT_B');
INSERT INTO grc_requirement_control_mappings (id, tenant_id, requirement_id, tenant_control_id, mapping_type, coverage_level, status) VALUES
('71000000-0000-0000-0000-000000000011', '$TENANT_A', '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000021', 'exact', 90, 'published'),
('72000000-0000-0000-0000-000000000011', '$TENANT_B', '72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000021', 'exact', 20, 'published');
INSERT INTO grc_control_assurance (id, tenant_id, tenant_control_id, assurance_status, score, design_score, implementation_score, operation_score, evidence_score) VALUES
('71000000-0000-0000-0000-000000000031', '$TENANT_A', '71000000-0000-0000-0000-000000000021', 'effective', 80, 80, 80, 80, 80),
('72000000-0000-0000-0000-000000000031', '$TENANT_B', '72000000-0000-0000-0000-000000000021', 'ineffective', 20, 20, 20, 20, 20);

INSERT INTO grc_readiness_snapshots (id, tenant_id, generated_at) VALUES
('71000000-0000-0000-0000-000000000041', '$TENANT_A', now()),
('72000000-0000-0000-0000-000000000041', '$TENANT_B', now());
INSERT INTO grc_readiness_results (id, tenant_id, snapshot_id, dimension, score, weight) VALUES
('71000000-0000-0000-0000-000000000042', '$TENANT_A', '71000000-0000-0000-0000-000000000041', 'compliance', 80, .35),
('71000000-0000-0000-0000-000000000043', '$TENANT_A', '71000000-0000-0000-0000-000000000041', 'evidence', 70, .25),
('71000000-0000-0000-0000-000000000044', '$TENANT_A', '71000000-0000-0000-0000-000000000041', 'health', 90, .25),
('71000000-0000-0000-0000-000000000045', '$TENANT_A', '71000000-0000-0000-0000-000000000041', 'actions', 60, .15),
('72000000-0000-0000-0000-000000000042', '$TENANT_B', '72000000-0000-0000-0000-000000000041', 'compliance', 10, .35);

INSERT INTO grc_quantitative_risk_assessments (id, tenant_id, risk_id, probability, impact, exposure, occurrence, detection, status) VALUES
('71000000-0000-0000-0000-000000000051', '$TENANT_A', '71000000-0000-0000-0000-000000000052', 4, 5, 20, 4, 3, 'evaluated'),
('71000000-0000-0000-0000-000000000053', '$TENANT_A', '71000000-0000-0000-0000-000000000054', 2, 5, 10, 2, 3, 'evaluated'),
('71000000-0000-0000-0000-000000000055', '$TENANT_A', '71000000-0000-0000-0000-000000000056', 3, 5, 15, 3, 3, 'evaluated'),
('72000000-0000-0000-0000-000000000051', '$TENANT_B', '72000000-0000-0000-0000-000000000052', 1, 5, 5, 1, 1, 'evaluated'),
('72000000-0000-0000-0000-000000000053', '$TENANT_B', '72000000-0000-0000-0000-000000000054', 2, 5, 10, 2, 1, 'evaluated');

INSERT INTO grc_readiness_findings (id, tenant_id, severity) VALUES
('71000000-0000-0000-0000-000000000061', '$TENANT_A', 'critical'),
('72000000-0000-0000-0000-000000000061', '$TENANT_B', 'low');
INSERT INTO action_plans (id, tenant_id, severity, status, progress, weight, due_at) VALUES
('71000000-0000-0000-0000-000000000062', '$TENANT_A', 'high', 'open', .5, 2, now() - interval '1 day'),
('71000000-0000-0000-0000-000000000063', '$TENANT_A', 'medium', 'completed', 1, 1, now() + interval '5 days'),
('72000000-0000-0000-0000-000000000062', '$TENANT_B', 'low', 'open', .1, 1, now() + interval '5 days');

INSERT INTO calculation_runs (id, tenant_id, formula_code, run_status, period_start, period_end) VALUES
('71000000-0000-0000-0000-000000000071', '$TENANT_A', 'F5_5_RESIDUAL_RISK', 'calculated', now()-interval '30 days', now()),
('71000000-0000-0000-0000-000000000072', '$TENANT_A', 'F5_5_COMPLIANCE_WEIGHTED', 'calculated', now()-interval '30 days', now()),
('71000000-0000-0000-0000-000000000073', '$TENANT_A', 'F5_5_WEIGHTED_PROGRESS', 'calculated', now()-interval '30 days', now()),
('71000000-0000-0000-0000-000000000074', '$TENANT_A', 'F5_5_COMPLETENESS', 'calculated', now()-interval '30 days', now());
INSERT INTO calculation_outputs (run_id, tenant_id, output_value, unit) VALUES
('71000000-0000-0000-0000-000000000071', '$TENANT_A', '{"value":20}', 'score'),
('71000000-0000-0000-0000-000000000072', '$TENANT_A', '{"value":80}', '%'),
('71000000-0000-0000-0000-000000000073', '$TENANT_A', '{"value":70}', '%'),
('71000000-0000-0000-0000-000000000074', '$TENANT_A', '{"value":90}', '%');

INSERT INTO survey_evaluations (id, tenant_id, score, weight, status) VALUES
('71000000-0000-0000-0000-000000000081', '$TENANT_A', 2, 1, 'published'),
('71000000-0000-0000-0000-000000000082', '$TENANT_A', 4, 3, 'published'),
('72000000-0000-0000-0000-000000000081', '$TENANT_B', 1, 1, 'published');
SQL

REPO_ROOT="$REPO_ROOT" \
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/$DATABASE_NAME" \
TENANT_A="$TENANT_A" TENANT_B="$TENANT_B" \
NODE_PATH="$REPO_ROOT/backend/node_modules" \
node <<'NODE'
'use strict';
const assert = require('assert');
const { Client } = require('pg');
const { resolveFormulaSource } = require(process.env.REPO_ROOT + '/backend/src/services/math-governance/sourceResolver.service');
const { executeFormula } = require(process.env.REPO_ROOT + '/backend/src/services/math-governance/formulaRegistry.service');

async function resolveAndExecute(client, tenantId, formulaCode) {
  const source = await resolveFormulaSource({ client, tenantId, formulaCode, period: {} });
  assert.notStrictEqual(source.status, 'source_unavailable', `${formulaCode} source unexpectedly unavailable`);
  assert.ok(source.formula_input, `${formulaCode} formula input missing`);
  assert.ok(source.lineage.length > 0, `${formulaCode} lineage missing`);
  const result = executeFormula(formulaCode, source.formula_input);
  assert.strictEqual(result.status, 'calculated', `${formulaCode} not calculated`);
  return { source, result };
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const compliance = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_COMPLIANCE_WEIGHTED');
    assert.strictEqual(compliance.result.value, 100);
    const coverage = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_COVERAGE');
    assert.strictEqual(coverage.result.value, 100);
    const readiness = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_READINESS');
    assert.strictEqual(readiness.result.value, 77);
    const inherent = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_INHERENT_RISK');
    assert.strictEqual(inherent.result.value, 15);
    assert.deepStrictEqual([...inherent.source.formula_input.scores].sort((a, b) => a - b), [10, 15, 20]);
    assert.strictEqual(inherent.source.counts.usable, 3);
    assert.strictEqual(inherent.source.lineage.length, 3);
    const control = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_CONTROL_EFFECTIVENESS');
    assert.strictEqual(control.result.value, 0.8);
    const severity = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_SEVERITY_INDEX');
    assert.ok(severity.result.value > 0);
    const progress = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_WEIGHTED_PROGRESS');
    assert.ok(progress.result.value > 0);
    const maturity = await resolveAndExecute(client, process.env.TENANT_A, 'F5_5_MATURITY');
    assert.strictEqual(maturity.result.value, 3.5);

    const tenantB = await resolveFormulaSource({ client, tenantId: process.env.TENANT_B, formulaCode: 'F5_5_INHERENT_RISK' });
    assert.strictEqual(tenantB.rows.length, 2);
    assert.ok(tenantB.rows.every((row) => row.tenant_id === process.env.TENANT_B));
    assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', tenantB.formula_input).value, 7.5);

    const tenantA = await resolveFormulaSource({ client, tenantId: process.env.TENANT_A, formulaCode: 'F5_5_INHERENT_RISK' });
    assert.ok(tenantA.rows.every((row) => row.tenant_id === process.env.TENANT_A));
    assert.ok(!tenantA.rows.some((row) => row.tenant_id === process.env.TENANT_B));
    assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', tenantA.formula_input).value, 15);

    await client.query(`UPDATE grc_quantitative_risk_assessments SET probability=3, exposure=15 WHERE id='71000000-0000-0000-0000-000000000051' AND tenant_id=$1::uuid`, [process.env.TENANT_A]);
    const tenantAChanged = await resolveFormulaSource({ client, tenantId: process.env.TENANT_A, formulaCode: 'F5_5_INHERENT_RISK' });
    assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', tenantAChanged.formula_input).value, 13.3333);
    assert.deepStrictEqual([...tenantAChanged.formula_input.scores].sort((a, b) => a - b), [10, 15, 15]);
    const tenantBAfterTenantAChange = await resolveFormulaSource({ client, tenantId: process.env.TENANT_B, formulaCode: 'F5_5_INHERENT_RISK' });
    assert.strictEqual(executeFormula('F5_5_INHERENT_RISK', tenantBAfterTenantAChange.formula_input).value, 7.5);

    process.stdout.write(JSON.stringify({
      status: 'PHASE5_5_SOURCE_ADAPTERS_POSTGRES_OK',
      formulas_executed: 8,
      tenant_isolation: 'verified',
      lineage: 'verified',
      external_unavailable: 'external_fx_rates'
    }) + '\n');
  } finally {
    await client.end();
  }
})().catch((error) => { console.error(error); process.exit(1); });
NODE
