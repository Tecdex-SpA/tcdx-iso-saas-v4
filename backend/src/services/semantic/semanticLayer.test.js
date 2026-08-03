'use strict';

const assert = require('assert');
const { transformValue, applyMappings, SemanticTransformError } = require('./typedTransformations');
const { stableHash, evaluateQuality, evaluateFreshness, evaluateSufficiency } = require('./semanticEvaluation.service');
const { validateAllowedJoins, SemanticError } = require('./semanticLayer.service');

let assertions = 0;
function equal(actual, expected, message) { assert.deepStrictEqual(actual, expected, message); assertions += 1; }
function ok(value, message) { assert.ok(value, message); assertions += 1; }
function throws(fn, code) {
  assert.throws(fn, (error) => error instanceof SemanticTransformError && error.code === code);
  assertions += 1;
}
function semanticThrows(fn, code) {
  assert.throws(fn, (error) => error instanceof SemanticError && error.code === code);
  assertions += 1;
}

equal(transformValue('trim', '  Control A  '), 'Control A');
equal(transformValue('lowercase', ' ALTO '), 'alto');
equal(transformValue('uppercase', ' riesgo '), 'RIESGO');
equal(transformValue('numeric_parse', '12,5'), 12.5);
equal(transformValue('boolean_map', 'sí'), true);
equal(transformValue('status_map', 'Abierto', { map: { abierto: 'open' } }), 'open');
equal(transformValue('unit_convert', 2, { factor: 1000 }), 2000);
equal(transformValue('coalesce_controlled', null, { fallback: 'unknown' }), 'unknown');
equal(transformValue('direct', null), null);
throws(() => transformValue('coalesce_controlled', null, { fallback: 0 }), 'SEMANTIC_ZERO_FALLBACK_FORBIDDEN');
throws(() => transformValue('eval', '1+1'), 'SEMANTIC_TRANSFORMATION_NOT_ALLOWED');
throws(() => transformValue('numeric_parse', 'not-number'), 'SEMANTIC_NUMERIC_INVALID');

const mapped = applyMappings({ name: '  Proceso  ', score: '80' }, [
  { canonical_field: 'name', physical_column: 'name', transformation_type: 'trim', transformation_config: {} },
  { canonical_field: 'value', physical_column: 'score', transformation_type: 'numeric_parse', transformation_config: {} },
]);
equal(mapped.output, { name: 'Proceso', value: 80 });
equal(mapped.warnings.length, 0);
const joined = applyMappings({ __semantic_0: '  Riesgo unido  ' }, [
  { canonical_field: 'name', physical_column: 'name', source_alias: '__semantic_0', transformation_type: 'trim', transformation_config: {} },
]);
equal(joined.output, { name: 'Riesgo unido' });
equal(joined.warnings.length, 0);

const quality = evaluateQuality([{ id: 'a', value: 1 }, { id: 'b', value: null }], ['id', 'value']);
equal(quality.status, 'attention');
equal(quality.score, 75);
equal(quality.invalid_rows[0].fields, ['value']);
const stale = evaluateFreshness('2026-01-01T00:00:00.000Z', 60, new Date('2026-01-01T00:02:00.000Z'));
equal(stale.status, 'stale');
equal(stale.age_seconds, 120);
const fresh = evaluateFreshness('2026-01-01T00:00:30.000Z', 60, new Date('2026-01-01T00:01:00.000Z'));
equal(fresh.status, 'fresh');
const missing = evaluateFreshness(null, 60);
equal(missing.status, 'unknown');

const sufficient = evaluateSufficiency({ rows: [{ value: 1 }, { value: 2 }], requiredInputs: ['value'], minimumSampleSize: 2, minimumCoverage: 1, quality: { status: 'valid' }, freshness: { status: 'fresh' } });
equal(sufficient.status, 'sufficient');
equal(sufficient.coverage, 1);
const insufficient = evaluateSufficiency({ rows: [{ value: 1 }, { value: null }], requiredInputs: ['value'], minimumSampleSize: 2, minimumCoverage: 1, quality: { status: 'attention' }, freshness: { status: 'fresh' } });
equal(insufficient.status, 'insufficient_data');
const incompatible = evaluateSufficiency({ rows: [{ value: 1 }], requiredInputs: ['value'], quality: { status: 'valid' }, freshness: { status: 'fresh' }, allowedUnits: ['%'], unit: 'USD' });
equal(incompatible.status, 'unit_incompatible');
equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }));
ok(/^[a-f0-9]{64}$/.test(stableHash(mapped.output)));
assert.doesNotThrow(() => validateAllowedJoins({ physical_tables: ['risk_register', 'controls'], allowed_joins: [{ type: 'left', left_table: 'risk_register', left_column: 'id', right_table: 'controls', right_column: 'risk_id' }] }));
assertions += 1;
semanticThrows(() => validateAllowedJoins({ physical_tables: ['risk_register'], allowed_joins: [{ type: 'cross', left_table: 'risk_register', left_column: 'id', right_table: 'controls', right_column: 'risk_id' }] }), 'SEMANTIC_JOIN_INVALID');
semanticThrows(() => validateAllowedJoins({ physical_tables: ['risk_register'], allowed_joins: [{ type: 'left', left_table: 'risk_register', left_column: 'id', right_table: 'outside_table', right_column: 'risk_id' }] }), 'SEMANTIC_JOIN_INVALID');

process.stdout.write(`Phase 5-C2 semantic unit tests passed (${assertions} assertions).\n`);
