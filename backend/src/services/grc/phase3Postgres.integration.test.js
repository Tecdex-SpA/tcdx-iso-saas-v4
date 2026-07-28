const assert = require('assert');
const { Pool } = require('pg');
const { createPhase3Service, Phase3Error } = require('./phase3.service');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const service = createPhase3Service(pool);

const tenantA = '83000000-0000-4000-8000-000000000001';
const tenantB = '83000000-0000-4000-8000-000000000002';
const userA = '83000000-0000-4000-8000-000000000011';
const userB = '83000000-0000-4000-8000-000000000012';
const tenantAdminB = '83000000-0000-4000-8000-000000000013';
const riskA = '83000000-0000-4000-8000-000000000021';

async function seed() {
  await pool.query(
    `INSERT INTO tenants (id,name) VALUES ($1,'Phase 3 Tenant A'),($2,'Phase 3 Tenant B')`,
    [tenantA, tenantB]
  );
  await pool.query(
    `INSERT INTO users (id,tenant_id,email,full_name)
     VALUES ($3,$1,'owner-a@example.test','Owner A'),
            ($4,$2,'owner-b@example.test','Owner B'),
            ($5,$2,'admin-b@example.test','Admin B')`,
    [tenantA, tenantB, userA, userB, tenantAdminB]
  );
  await pool.query(
    `INSERT INTO test_user_role_assignments (user_id,role_key)
     VALUES ($1,'tenant_admin'),($2,'auditor'),($3,'tenant_admin')`,
    [userA, userB, tenantAdminB]
  );
  await pool.query(
    `INSERT INTO tenant_module_settings (tenant_id,module_key,is_enabled,enabled_by)
     VALUES ($1,'grc_phase3_operations',TRUE,$3),
            ($2,'grc_phase3_operations',TRUE,$4)`,
    [tenantA, tenantB, userA, tenantAdminB]
  );
  await pool.query(
    `INSERT INTO iso_risk_matrix_items (id,tenant_id,risk_code,risk_title)
     VALUES ($1,$2,'RISK-001','Riesgo operacional controlado')`,
    [riskA, tenantA]
  );
}

async function transition(entityType, entityId, toStatus) {
  return service.transitionEntity({
    tenantId: tenantA,
    userId: userA,
    correlationId: `phase3-postgres:${entityType}:${toStatus}`,
    entityType,
    entityId,
    body: { to_status: toStatus, reason: `Validación humana a ${toStatus}` },
    idempotencyKey: `phase3-postgres:${entityType}:${entityId}:${toStatus}`,
  });
}

async function assertTenantIsolation(entityType, entityId) {
  await assert.rejects(
    service.getEntity360(tenantB, entityType, entityId),
    error => error instanceof Phase3Error && error.code === 'PHASE3_ENTITY_NOT_FOUND'
  );
}

async function run() {
  await seed();
  await service.assertModuleEnabled(tenantA);

  const organization = await service.createOrganization({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:organization',
    body: {
      code: 'TI',
      name: 'Tecnología',
      unit_type: 'department',
      owner_user_id: userA,
      next_review_at: '2027-07-28T12:00:00Z',
    },
  });
  const process = await service.createProcess({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:process',
    body: {
      code: 'PROC-001',
      name: 'Operación tecnológica',
      process_type: 'operational',
      organizational_unit_id: organization.entity.id,
      owner_user_id: userA,
      criticality: 'high',
      criticality_score: 80,
      objective: 'Mantener la operación',
      scope: 'Servicios tecnológicos',
    },
  });
  const serviceEntity = await service.createService({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:service',
    body: {
      code: 'SRV-001',
      name: 'Servicio principal',
      organizational_unit_id: organization.entity.id,
      primary_process_id: process.entity.id,
      owner_user_id: userA,
      minimum_service_level: '80%',
      criticality: 'high',
      rto_minutes: 240,
      rpo_minutes: 60,
      mtpd_minutes: 480,
    },
  });
  const bia = await service.createBia({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:bia',
    body: {
      code: 'BIA-001',
      organizational_unit_id: organization.entity.id,
      process_id: process.entity.id,
      service_id: serviceEntity.entity.id,
      owner_user_id: userA,
      assumptions: 'Operación normal controlada',
      mtpd_minutes: 480,
      rto_minutes: 240,
      rpo_minutes: 60,
      next_review_at: '2027-07-28T12:00:00Z',
    },
  });
  await transition('bia', bia.entity.id, 'under_review');
  await transition('bia', bia.entity.id, 'approved');
  await transition('bia', bia.entity.id, 'current');

  const plan = await service.createContinuityPlan({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:plan',
    body: {
      code: 'PCN-001',
      name: 'Plan principal',
      scope: 'Servicio principal',
      organizational_unit_id: organization.entity.id,
      process_id: process.entity.id,
      service_id: serviceEntity.entity.id,
      bia_id: bia.entity.id,
      activation_authority_user_id: userA,
      activation_criteria: 'Interrupción mayor',
      procedures: 'Aplicar recuperación controlada',
      recovery_sequence: 'Servicio prioritario primero',
      return_to_operation_criteria: 'Estabilidad verificada',
      next_review_at: '2027-07-28T12:00:00Z',
    },
  });
  const continuityTest = await service.createContinuityTest({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:test',
    body: {
      plan_id: plan.entity.id,
      test_type: 'tabletop',
      objective: 'Validar el plan',
      scenario: 'Interrupción controlada',
      scope: 'Servicio principal',
      scheduled_at: '2026-08-15T12:00:00Z',
      expected_result: 'Recuperación dentro de objetivos',
      target_rto_minutes: 240,
      target_rpo_minutes: 60,
    },
  });
  const metric = await service.createMetric({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:metric',
    body: {
      code: 'KPI-001',
      name: 'Disponibilidad',
      metric_type: 'kpi',
      entity_type: 'service',
      entity_id: serviceEntity.entity.id,
      owner_user_id: userA,
      formula_definition: 'Horas disponibles / horas totales',
      source_description: 'Monitoreo controlado',
      frequency: 'monthly',
      unit: '%',
      expected_direction: 'higher_is_better',
      target_value: 99.9,
      warning_threshold: 99.5,
      critical_threshold: 99,
      measurement_window: 'month',
    },
  });
  const measurement = await service.recordMeasurement({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:measurement',
    metricId: metric.entity.id,
    idempotencyKey: 'phase3-postgres:measurement:1',
    body: {
      period_start: '2026-07-01T00:00:00Z',
      period_end: '2026-07-31T23:59:59Z',
      numeric_value: 99.8,
      source_description: 'Monitoreo controlado',
      provenance: { source: 'postgres_integration' },
      quality: 'valid',
    },
  });
  const quantitative = await service.createQuantitativeRisk({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:quantitative',
    body: {
      code: 'QR-001',
      risk_id: riskA,
      process_id: process.entity.id,
      service_id: serviceEntity.entity.id,
      scenario: 'Interrupción del servicio',
      minimum_impact: 1000,
      most_likely_impact: 5000,
      maximum_impact: 10000,
      estimated_frequency: 0.5,
      control_cost: 500,
      expected_reduction: 3000,
      assumptions: 'Estimación controlada',
      source_description: 'Taller de riesgo',
    },
  });
  const crisis = await service.createCrisis({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:crisis',
    body: {
      code: 'CRISIS-001',
      plan_id: plan.entity.id,
      organizational_unit_id: organization.entity.id,
      process_id: process.entity.id,
      service_id: serviceEntity.entity.id,
      crisis_level: 'level_1',
      activation_reason: 'Simulación validada por una persona',
    },
  });
  await service.createRelation({
    tenantId: tenantA,
    userId: userA,
    body: {
      source_type: 'service',
      source_id: serviceEntity.entity.id,
      target_type: 'risk',
      target_id: riskA,
      relation_type: 'service_exposed_to_risk',
      provenance: { source: 'postgres_integration' },
    },
  });
  await service.createDependency({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:dependency',
    body: {
      source_type: 'organization',
      source_id: organization.entity.id,
      target_type: 'process',
      target_id: process.entity.id,
      dependency_type: 'unit_to_process',
      criticality: 'high',
      source_reference: 'Mapa operacional validado',
    },
  });
  for (const [entityType, entityId, statuses] of [
    ['organization', organization.entity.id, ['under_review', 'approved', 'active']],
    ['process', process.entity.id, ['under_review', 'approved', 'active']],
    ['service', serviceEntity.entity.id, ['under_review', 'approved', 'active']],
    ['continuity_plan', plan.entity.id, ['under_review', 'approved', 'active']],
    ['continuity_test', continuityTest.entity.id, ['ready', 'in_progress', 'passed']],
    ['metric', metric.entity.id, ['under_review', 'approved', 'active']],
    ['quantitative_risk', quantitative.entity.id, ['under_review', 'approved', 'current']],
  ]) {
    for (const status of statuses) {
      await transition(entityType, entityId, status);
    }
  }

  const updated = await service.updateEntity({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:update',
    entityType: 'service',
    entityId: serviceEntity.entity.id,
    body: { description: 'Descripción persistida después de editar' },
    idempotencyKey: 'phase3-postgres:update:service:1',
  });
  assert.strictEqual(updated.entity.version, 2);
  assert.strictEqual(updated.entity.description, 'Descripción persistida después de editar');
  const updateCases = [
    ['organization', organization.entity.id, { description: 'Unidad editada' }, 'description', 'Unidad editada'],
    ['process', process.entity.id, { objective: 'Objetivo editado' }, 'objective', 'Objetivo editado'],
    ['bia', bia.entity.id, { assumptions: 'Supuestos editados' }, 'assumptions', 'Supuestos editados'],
    ['continuity_plan', plan.entity.id, { communication_plan: 'Comunicaciones editadas' }, 'communication_plan', 'Comunicaciones editadas'],
    ['continuity_test', continuityTest.entity.id, { actual_result: 'Resultado editado' }, 'actual_result', 'Resultado editado'],
    ['metric', metric.entity.id, { description: 'Indicador editado' }, 'description', 'Indicador editado'],
    ['quantitative_risk', quantitative.entity.id, { sensitivity_notes: 'Sensibilidad editada' }, 'sensitivity_notes', 'Sensibilidad editada'],
    ['crisis', crisis.entity.id, { lessons_learned: 'Lecciones editadas' }, 'lessons_learned', 'Lecciones editadas'],
  ];
  for (const [entityType, entityId, body, field, expected] of updateCases) {
    const result = await service.updateEntity({
      tenantId: tenantA,
      userId: userA,
      correlationId: `phase3-postgres:update:${entityType}`,
      entityType,
      entityId,
      body,
      idempotencyKey: `phase3-postgres:update:${entityType}:1`,
    });
    assert.strictEqual(result.entity[field], expected);
  }

  const overview = await service.operationsOverview(tenantA);
  assert.strictEqual(Number(overview.summary.units), 1);
  assert.strictEqual(Number(overview.summary.processes), 1);
  assert.strictEqual(Number(overview.summary.services), 1);
  const readiness = await service.activationReadiness(tenantA);
  assert.strictEqual(readiness.ready_to_operate, true);
  const view360 = await service.getEntity360(tenantA, 'service', serviceEntity.entity.id);
  assert.strictEqual(view360.linked_context.processes[0].id, process.entity.id);
  assert.strictEqual(view360.linked_context.bia[0].id, bia.entity.id);
  assert.strictEqual(view360.linked_context.plans[0].id, plan.entity.id);
  assert.strictEqual(view360.linked_context.quantitative_risks[0].id, quantitative.entity.id);
  assert.strictEqual(view360.linked_context.crises[0].id, crisis.entity.id);
  assert.strictEqual(view360.linked_context.risks.length, 1);
  assert(view360.linked_context.metrics.some(item => item.id === metric.entity.id));
  assert(measurement.measurement.id);

  for (const [entityType, entityId] of [
    ['organization', organization.entity.id],
    ['process', process.entity.id],
    ['service', serviceEntity.entity.id],
    ['bia', bia.entity.id],
    ['continuity_plan', plan.entity.id],
    ['continuity_test', continuityTest.entity.id],
    ['metric', metric.entity.id],
    ['quantitative_risk', quantitative.entity.id],
    ['crisis', crisis.entity.id],
  ]) {
    await assertTenantIsolation(entityType, entityId);
  }
  await assert.rejects(
    service.createRelation({
      tenantId: tenantB,
      userId: userB,
      body: {
        source_type: 'service',
        source_id: serviceEntity.entity.id,
        target_type: 'risk',
        target_id: riskA,
        relation_type: 'cross_tenant_forbidden',
      },
    }),
    error => error instanceof Phase3Error && error.code === 'PHASE3_ENTITY_NOT_FOUND'
  );
  assert.strictEqual((await service.listOrganizations(tenantB)).length, 0);

  const validPreview = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'organizations',
      template_version: 'phase3-operational-v1',
      file_name: 'units.csv',
      rows: [{
        code: ' OPS ',
        name: ' Operaciones ',
        unit_type: 'department',
        owner_email: 'owner-a@example.test',
      }],
    },
  });
  assert.strictEqual(validPreview.batch.valid_rows, 1);
  assert.strictEqual(validPreview.rows[0].normalized_data.owner_user_id, userA);
  await assert.rejects(
    service.getImportBatch(tenantB, validPreview.batch.id),
    error => error instanceof Phase3Error && error.code === 'PHASE3_IMPORT_NOT_FOUND'
  );
  await assert.rejects(
    service.rollbackImport({
      tenantId: tenantB,
      userId: tenantAdminB,
      batchId: validPreview.batch.id,
    }),
    error => error instanceof Phase3Error && error.code === 'PHASE3_IMPORT_NOT_FOUND'
  );
  await assert.rejects(
    service.confirmImport({
      tenantId: tenantA,
      userId: userA,
      correlationId: 'phase3-postgres:import-without-confirmation',
      batchId: validPreview.batch.id,
      confirmed: false,
    }),
    error => error instanceof Phase3Error
      && error.code === 'PHASE3_IMPORT_CONFIRMATION_REQUIRED'
  );
  const confirmed = await service.confirmImport({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:import-confirm',
    batchId: validPreview.batch.id,
    confirmed: true,
  });
  assert.strictEqual(confirmed.batch.imported_rows, 1);
  const importedId = confirmed.rows[0].created_entity_id;
  assert((await service.getEntity360(tenantA, 'organization', importedId)).entity);

  const duplicatePreview = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'organizations',
      template_version: 'phase3-operational-v1',
      file_name: 'duplicate.csv',
      rows: [{ code: 'OPS', name: 'Duplicada', unit_type: 'department' }],
    },
  });
  assert.strictEqual(duplicatePreview.batch.invalid_rows, 1);
  assert(duplicatePreview.rows[0].errors.some(error => error.code === 'DUPLICATE'));

  const headerRegression = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'processes',
      template_version: 'universal-excel-v1',
      duplicate_policy: 'create_only',
      file_name: 'header-regression.csv',
      rows: [
        {
          code: 'code',
          name: 'name',
          process_type: 'process_type',
          criticality_score: 'criticality_score',
          unit_code: 'unit_code',
          owner_email: 'owner_email',
        },
        {
          code: 'HEADER-REGRESSION',
          name: 'Regresión encabezado',
          process_type: 'operational',
          criticality_score: '60',
          unit_code: 'TI',
          owner_email: 'owner-a@example.test',
        },
      ],
    },
  });
  assert.strictEqual(headerRegression.batch.total_rows, 1);
  assert.strictEqual(headerRegression.batch.valid_rows, 1);
  assert(!headerRegression.rows.some(row => (
    row.raw_data.owner_email === 'owner_email' || row.raw_data.unit_code === 'unit_code'
  )));

  const updatePreview = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'organizations',
      template_version: 'universal-excel-v1',
      duplicate_policy: 'update_existing',
      file_name: 'units-update.xlsx',
      rows: [{
        code: 'TI',
        name: 'Tecnología actualizada',
        unit_type: 'department',
        owner_email: 'owner-a@example.test',
      }],
    },
  });
  assert.strictEqual(updatePreview.rows[0].operation, 'update');
  const updatedImport = await service.confirmImport({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:import-update',
    batchId: updatePreview.batch.id,
    confirmed: true,
  });
  assert.strictEqual(updatedImport.batch.imported_rows, 1);
  assert.strictEqual(
    (await service.getEntity360(tenantA, 'organization', organization.entity.id)).entity.name,
    'Tecnología actualizada'
  );
  const updateRollback = await service.rollbackImport({
    tenantId: tenantA,
    userId: userA,
    batchId: updatePreview.batch.id,
  });
  assert.strictEqual(updateRollback.batch.status, 'rolled_back');
  assert.strictEqual(
    (await service.getEntity360(tenantA, 'organization', organization.entity.id)).entity.name,
    'Tecnología'
  );

  const invalidDate = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'organizations',
      template_version: 'phase3-operational-v1',
      file_name: 'invalid-date.csv',
      rows: [{
        code: 'DATE-INVALID',
        name: 'Fecha inválida',
        unit_type: 'department',
        next_review_at: '2026-02-31T12:00:00Z',
      }],
    },
  });
  assert.strictEqual(invalidDate.batch.invalid_rows, 1);
  assert(invalidDate.rows[0].errors.some(error => error.code === 'DATE_INVALID'));

  const invalidRelation = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'services',
      template_version: 'phase3-operational-v1',
      file_name: 'invalid-relation.csv',
      rows: [{
        code: 'SRV-IMPORT',
        name: 'Servicio importado',
        process_code: 'NO-EXISTE',
        minimum_service_level: '80%',
        criticality: 'high',
      }],
    },
  });
  assert.strictEqual(invalidRelation.batch.invalid_rows, 1);
  assert(invalidRelation.rows[0].errors.some(error => error.code === 'REFERENCE_NOT_FOUND'));

  const importCases = [
    ['processes', {
      code: 'IMP-PROC',
      name: 'Proceso importado',
      process_type: 'operational',
      unit_code: 'TI',
      owner_email: 'owner-a@example.test',
      criticality: 'medium',
      criticality_score: '40',
    }],
    ['services', {
      code: 'IMP-SRV',
      name: 'Servicio importado',
      unit_code: 'TI',
      process_code: 'PROC-001',
      owner_email: 'owner-a@example.test',
      minimum_service_level: '70%',
      criticality: 'medium',
      rto_minutes: '360',
      rpo_minutes: '120',
      mtpd_minutes: '720',
    }],
    ['bia', {
      code: 'IMP-BIA',
      process_code: 'PROC-001',
      service_code: 'SRV-001',
      owner_email: 'owner-a@example.test',
      assumptions: 'Supuestos importados',
      mtpd_minutes: '480',
      rto_minutes: '240',
      rpo_minutes: '60',
      next_review_at: '2027-07-28T12:00:00Z',
    }],
    ['continuity_plans', {
      code: 'IMP-PLAN',
      name: 'Plan importado',
      scope: 'Servicio principal',
      process_code: 'PROC-001',
      service_code: 'SRV-001',
      bia_code: 'BIA-001',
      activation_authority_email: 'owner-a@example.test',
      activation_criteria: 'Interrupción mayor',
      procedures: 'Aplicar procedimientos',
      recovery_sequence: 'Recuperar servicio',
      return_to_operation_criteria: 'Validar estabilidad',
      next_review_at: '2027-07-28T12:00:00Z',
    }],
    ['metrics', {
      code: 'IMP-KPI',
      name: 'KPI importado',
      metric_type: 'kpi',
      entity_type: 'service',
      entity_code: 'SRV-001',
      owner_email: 'owner-a@example.test',
      formula_definition: 'Valor observado',
      source_description: 'Fuente importada',
      frequency: 'monthly',
      unit: '%',
      expected_direction: 'higher_is_better',
      target_value: '99',
      warning_threshold: '95',
      critical_threshold: '90',
      measurement_window: 'month',
    }],
    ['suppliers', {
      code: 'IMP-SUP',
      legal_name: 'Proveedor importado SpA',
      trade_name: 'Proveedor importado',
      criticality: 'medium',
      owner_email: 'owner-a@example.test',
      data_access_level: 'none',
    }],
    ['continuity_tests', {
      plan_code: 'PCN-001',
      test_type: 'tabletop',
      objective: 'Prueba importada',
      scenario: 'Escenario importado',
      scope: 'Servicio principal',
      scheduled_at: '2027-02-01T12:00:00Z',
      expected_result: 'Coordinación validada',
      target_rto_minutes: '240',
      target_rpo_minutes: '60',
    }],
    ['metric_measurements', {
      metric_code: 'KPI-001',
      period_start: '2027-01-01T00:00:00Z',
      period_end: '2027-01-31T23:59:59Z',
      numeric_value: '99.7',
      source_description: 'Medición importada',
      quality: 'valid',
    }],
    ['quantitative_risks', {
      code: 'IMP-QR',
      risk_code: 'RISK-001',
      process_code: 'PROC-001',
      service_code: 'SRV-001',
      scenario: 'Escenario cuantitativo importado',
      minimum_impact: '500',
      most_likely_impact: '1500',
      maximum_impact: '5000',
      estimated_frequency: '0.2',
      assumptions: 'Supuestos importados',
      source_description: 'Taller importado',
    }],
  ];
  for (const [entityType, row] of importCases) {
    const preview = await service.createImportPreview({
      tenantId: tenantA,
      userId: userA,
      body: {
        entity_type: entityType,
        template_version: 'phase3-operational-v1',
        file_name: `${entityType}.csv`,
        rows: [row],
      },
    });
    assert.strictEqual(
      preview.batch.valid_rows,
      1,
      `${entityType}: ${JSON.stringify(preview.rows[0]?.errors || [])}`
    );
    const imported = await service.confirmImport({
      tenantId: tenantA,
      userId: userA,
      correlationId: `phase3-postgres:import:${entityType}`,
      batchId: preview.batch.id,
      confirmed: true,
    });
    assert.strictEqual(imported.batch.imported_rows, 1, entityType);
  }

  const protectedPreview = await service.createImportPreview({
    tenantId: tenantA,
    userId: userA,
    body: {
      entity_type: 'organizations',
      template_version: 'phase3-operational-v1',
      file_name: 'protected-rollback.csv',
      rows: [{ code: 'ROLLBACK-LOCK', name: 'Unidad protegida', unit_type: 'department' }],
    },
  });
  const protectedImport = await service.confirmImport({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:protected-import',
    batchId: protectedPreview.batch.id,
    confirmed: true,
  });
  const protectedId = protectedImport.rows[0].created_entity_id;
  await service.updateEntity({
    tenantId: tenantA,
    userId: userA,
    correlationId: 'phase3-postgres:protected-update',
    entityType: 'organization',
    entityId: protectedId,
    body: { description: 'Modificada después de importar' },
    idempotencyKey: 'phase3-postgres:protected-update:1',
  });
  const protectedRollback = await service.rollbackImport({
    tenantId: tenantA,
    userId: userA,
    batchId: protectedPreview.batch.id,
  });
  assert.strictEqual(protectedRollback.batch.status, 'rollback_partial');
  assert.strictEqual(protectedRollback.batch.rollback_blocked_rows, 1);
  assert((await service.getEntity360(tenantA, 'organization', protectedId)).entity);

  const rolledBack = await service.rollbackImport({
    tenantId: tenantA,
    userId: userA,
    batchId: validPreview.batch.id,
  });
  assert.strictEqual(rolledBack.batch.status, 'rolled_back');
  await assert.rejects(
    service.getEntity360(tenantA, 'organization', importedId),
    error => error instanceof Phase3Error && error.code === 'PHASE3_ENTITY_NOT_FOUND'
  );

  await service.assertPermission({
    userId: userA,
    role: 'tenant_admin',
    permission: 'operations.import',
  });
  await service.assertPermission({
    userId: tenantAdminB,
    role: 'tenant_admin',
    permission: 'operations.import',
  });
  await service.assertPermission({
    userId: userB,
    role: 'auditor',
    permission: 'operations.dashboard.read',
  });
  await assert.rejects(
    service.assertPermission({
      userId: userB,
      role: 'auditor',
      permission: 'operations.import',
    }),
    error => error instanceof Phase3Error && error.code === 'PHASE3_PERMISSION_DENIED'
  );
  await service.createOrganization({
    tenantId: tenantB,
    userId: userB,
    correlationId: 'phase3-postgres:demo-data',
    body: {
      code: 'DEMO',
      name: 'Datos demostrativos',
      unit_type: 'department',
      provenance: { source: 'demo' },
    },
  });
  await assert.rejects(
    service.createImportPreview({
      tenantId: tenantB,
      userId: userB,
      body: {
        entity_type: 'organizations',
        template_version: 'phase3-operational-v1',
        file_name: 'real-data.csv',
        rows: [{ code: 'REAL', name: 'Dato real', unit_type: 'department' }],
      },
    }),
    error => error instanceof Phase3Error
      && error.code === 'PHASE3_IMPORT_DEMO_DATA_PRESENT'
  );

  console.log(JSON.stringify({
    status: 'VERIFIED_PHASE3_POSTGRES',
    chain: [
      organization.entity.id,
      process.entity.id,
      serviceEntity.entity.id,
      bia.entity.id,
      plan.entity.id,
      continuityTest.entity.id,
      metric.entity.id,
      quantitative.entity.id,
      crisis.entity.id,
    ].length,
    tenant_isolation_findings: 0,
    readiness: readiness.state,
    imports: {
      preview: true,
      all_supported_entities: true,
      readable_codes_and_email: true,
      duplicates: true,
      invalid_dates: true,
      invalid_relation: true,
      rollback: true,
      rollback_protects_modified_records: true,
      demo_real_separation: true,
    },
    human_review_preserved: true,
  }));
}

run()
  .then(() => pool.end())
  .catch(async error => {
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  });
