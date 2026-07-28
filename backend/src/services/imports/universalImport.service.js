'use strict';

const crypto = require('crypto');
const path = require('path');
const {
  ImportFileError,
  generateCatalogWorkbook,
  generateTemplate,
  parseCsv,
  parseXlsx,
} = require('./excelWorkbook');
const {
  getImportDefinition,
  listImportDefinitions,
} = require('./importDefinitions');
const {
  Phase3Error,
  createPhase3Service,
} = require('../grc/phase3.service');

function createUniversalImportService(pool) {
  const phase3 = createPhase3Service(pool);

  function requireDefinition(entityType, { operational = false } = {}) {
    const definition = getImportDefinition(entityType);
    if (!definition) {
      throw new ImportFileError('IMPORT_DEFINITION_NOT_FOUND', 'Definición de importación no encontrada.', 404);
    }
    if (operational && definition.availability !== 'importable_now') {
      throw new ImportFileError(
        'IMPORT_DEFINITION_BLOCKED',
        definition.blockedReason || 'La entidad no admite importación responsable.',
        409,
        { classification: definition.classification || 'blocked' }
      );
    }
    return definition;
  }

  async function authorize({ tenantId, userId, role }) {
    await phase3.assertModuleEnabled(tenantId);
    await phase3.assertPermission({ userId, role, permission: 'operations.import' });
  }

  async function definitions(context) {
    await authorize(context);
    return listImportDefinitions();
  }

  async function definition(context, entityType) {
    await authorize(context);
    return requireDefinition(entityType);
  }

  async function registerTemplateVersion(importDefinition) {
    const serialized = JSON.stringify(importDefinition);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const inserted = await pool.query(
      `INSERT INTO grc_import_template_versions (
         entity_type,version,definition_checksum,definition,status
       ) VALUES ($1,$2,$3,$4::jsonb,'active')
       ON CONFLICT (entity_type,version) DO NOTHING
       RETURNING definition_checksum`,
      [importDefinition.entityType, importDefinition.version, checksum, serialized]
    );
    if (!inserted.rowCount) {
      const existing = await pool.query(
        `SELECT definition_checksum FROM grc_import_template_versions
         WHERE entity_type=$1 AND version=$2`,
        [importDefinition.entityType, importDefinition.version]
      );
      if (!existing.rowCount || existing.rows[0].definition_checksum !== checksum) {
        throw new ImportFileError(
          'IMPORT_TEMPLATE_CHECKSUM_MISMATCH',
          'La versión de la plantilla no coincide con su definición registrada.',
          409
        );
      }
    }
    return checksum;
  }

  async function catalogs(context, entityType) {
    await authorize(context);
    const importDefinition = requireDefinition(entityType, { operational: true });
    const currentCatalogs = await phase3.getLookups(context.tenantId);
    const definitionChecksum = await registerTemplateVersion(importDefinition);
    return {
      buffer: generateCatalogWorkbook(importDefinition, currentCatalogs),
      fileName: `tcdx-catalogos-${entityType}-${importDefinition.version}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      checksum: definitionChecksum,
    };
  }

  async function template(context, entityType, options = {}) {
    await authorize(context);
    const importDefinition = requireDefinition(entityType, { operational: true });
    const currentCatalogs = await phase3.getLookups(context.tenantId);
    const buffer = await generateTemplate(importDefinition, currentCatalogs, options);
    const definitionChecksum = await registerTemplateVersion(importDefinition);
    return {
      buffer,
      fileName: `tcdx-${entityType}-${importDefinition.version}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      checksum: definitionChecksum,
    };
  }

  async function parseFile(file, importDefinition) {
    const extension = path.extname(String(file?.originalname || '')).toLowerCase();
    if (extension === '.csv') {
      const parsed = parseCsv(file.buffer, importDefinition);
      return {
        ...parsed,
        checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
        sourceFormat: 'csv',
      };
    }
    const parsed = await parseXlsx(file, importDefinition);
    return { ...parsed, sourceFormat: 'xlsx' };
  }

  async function preview(context, { entityType, file, duplicatePolicy }) {
    await authorize(context);
    const importDefinition = requireDefinition(entityType, { operational: true });
    if (!file) {
      throw new ImportFileError('IMPORT_FILE_REQUIRED', 'Selecciona un archivo .xlsx.', 400);
    }
    const policy = String(duplicatePolicy || importDefinition.duplicatePolicy);
    if (!importDefinition.duplicatePolicies.includes(policy)) {
      throw new ImportFileError('IMPORT_DUPLICATE_POLICY_INVALID', 'Política de duplicados inválida.', 400);
    }
    const parsed = await parseFile(file, importDefinition);
    const replay = await pool.query(
      `SELECT id FROM grc_phase3_import_batches
       WHERE tenant_id=$1::uuid AND entity_type=$2 AND file_checksum=$3
         AND status IN ('preview_ready','confirmed','partial')
       ORDER BY created_at DESC LIMIT 1`,
      [context.tenantId, entityType, parsed.checksum]
    );
    if (replay.rowCount) {
      return phase3.getImportBatch(context.tenantId, replay.rows[0].id);
    }
    const result = await phase3.createImportPreview({
      tenantId: context.tenantId,
      userId: context.userId,
      body: {
        entity_type: entityType,
        template_version: importDefinition.version,
        duplicate_policy: policy,
        file_name: path.basename(String(file.originalname || `import-${entityType}.xlsx`)),
        rows: parsed.rows.map(row => ({
          ...row.data,
          __source_row: row.rowNumber,
        })),
      },
    });
    await pool.query(
      `UPDATE grc_phase3_import_batches
       SET source_format=$3,file_checksum=$4,definition_version=$5,
           duplicate_policy=$6,request_id=$7,upload_metadata=$8::jsonb,
           summary=summary || $9::jsonb,updated_at=now()
       WHERE tenant_id=$1::uuid AND id=$2::uuid`,
      [
        context.tenantId,
        result.batch.id,
        parsed.sourceFormat,
        parsed.checksum,
        importDefinition.version,
        policy,
        context.correlationId || null,
        JSON.stringify({
          original_name: path.basename(String(file.originalname || '')),
          mime_type: file.mimetype,
          size_bytes: file.size,
        }),
        JSON.stringify({
          unknown_columns: parsed.unknownColumns,
          warnings: parsed.unknownColumns.length,
          source_format: parsed.sourceFormat,
        }),
      ]
    );
    await pool.query(
      `INSERT INTO grc_import_files (
         tenant_id,batch_id,file_name,mime_type,size_bytes,sha256,storage_status,created_by
       ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,'discarded_after_parse',$7::uuid)`,
      [
        context.tenantId,
        result.batch.id,
        path.basename(String(file.originalname || '')),
        file.mimetype,
        file.size,
        parsed.checksum,
        context.userId || null,
      ]
    );
    for (const row of result.rows) {
      for (const issue of row.errors || []) {
        await pool.query(
          `INSERT INTO grc_import_cell_errors (
             tenant_id,batch_id,row_number,column_name,received_value,error_code,
             message,suggestion,valid_values
           ) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [
            context.tenantId,
            result.batch.id,
            row.row_number,
            issue.column || '',
            issue.column ? String(row.raw_data?.[issue.column] ?? '') : '',
            issue.code,
            issue.message,
            issue.suggestion || null,
            JSON.stringify(issue.valid_values || []),
          ]
        );
      }
    }
    await recordAudit(context, result.batch.id, 'preview.created', {
      entity_type: entityType,
      source_format: parsed.sourceFormat,
      total_rows: result.batch.total_rows,
      valid_rows: result.batch.valid_rows,
      invalid_rows: result.batch.invalid_rows,
      file_checksum: parsed.checksum,
    });
    return phase3.getImportBatch(context.tenantId, result.batch.id);
  }

  async function recordAudit(context, batchId, eventType, details = {}) {
    await pool.query(
      `INSERT INTO grc_import_audit_events (
         tenant_id,batch_id,event_type,actor_user_id,request_id,details
       ) VALUES ($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb)`,
      [
        context.tenantId,
        batchId,
        eventType,
        context.userId || null,
        context.correlationId || null,
        JSON.stringify(details),
      ]
    );
  }

  async function batch(context, batchId) {
    await authorize(context);
    return phase3.getImportBatch(context.tenantId, batchId);
  }

  async function confirm(context, batchId, confirmed) {
    await authorize(context);
    const result = await phase3.confirmImport({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      batchId,
      confirmed,
    });
    await recordAudit(context, batchId, 'batch.confirmed', {
      status: result.batch.status,
      imported_rows: result.batch.imported_rows,
      failed_rows: result.batch.failed_rows,
    });
    return result;
  }

  async function rollback(context, batchId) {
    await authorize(context);
    const result = await phase3.rollbackImport({
      tenantId: context.tenantId,
      userId: context.userId,
      batchId,
    });
    await recordAudit(context, batchId, 'batch.rolled_back', {
      status: result.batch.status,
      rolled_back_rows: result.batch.rolled_back_rows,
      rollback_blocked_rows: result.batch.rollback_blocked_rows,
    });
    return result;
  }

  async function history(context, { limit = 50, entityType = null } = {}) {
    await authorize(context);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const values = [context.tenantId, safeLimit];
    const clause = entityType ? `AND entity_type=$${values.push(entityType)}` : '';
    const result = await pool.query(
      `SELECT id,entity_type,definition_version,source_format,file_name,file_checksum,
              duplicate_policy,status,total_rows,valid_rows,invalid_rows,imported_rows,
              failed_rows,rolled_back_rows,rollback_blocked_rows,summary,created_by,
              confirmed_by,rolled_back_by,created_at,confirmed_at,rolled_back_at,request_id
       FROM grc_phase3_import_batches
       WHERE tenant_id=$1::uuid ${clause}
       ORDER BY created_at DESC LIMIT $2`,
      values
    );
    return result.rows;
  }

  async function errorsWorkbook(context, batchId) {
    await authorize(context);
    const loaded = await phase3.getImportBatch(context.tenantId, batchId);
    const importDefinition = requireDefinition(loaded.batch.entity_type);
    const errors = loaded.rows.flatMap(row => (row.errors || []).map(issue => ({
      row: row.row_number,
      column: issue.column || '',
      value: issue.column ? row.raw_data?.[issue.column] : '',
      code: issue.code,
      message: issue.message,
      suggestion: issue.suggestion || 'Corrija el valor y vuelva a cargar el archivo.',
      validValues: issue.valid_values || [],
    })));
    return template(context, loaded.batch.entity_type, { errors }).then(result => ({
      ...result,
      fileName: `tcdx-errores-${loaded.batch.entity_type}-${batchId}.xlsx`,
    }));
  }

  return {
    batch,
    catalogs,
    confirm,
    definition,
    definitions,
    errorsWorkbook,
    history,
    preview,
    rollback,
    template,
  };
}

module.exports = {
  ImportFileError,
  Phase3Error,
  createUniversalImportService,
};
