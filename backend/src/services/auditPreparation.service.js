const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const {
  buildAuditPreparationContext,
  getUserTenantId,
  getUserId,
  isPlatform,
  normalizeStandardCode,
  tableExists,
  getExistingColumns,
} = require('./auditPreparationContext.service');

function publicError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeStatus(value, allowed, fallback) {
  const status = String(value || fallback || '').trim();
  return allowed.includes(status) ? status : fallback;
}

function assertTenantAccess(user, tenantId) {
  if (isPlatform(user)) return;
  if (String(getUserTenantId(user) || '') !== String(tenantId || '')) {
    throw publicError(403, 'TENANT_ACCESS_DENIED', 'No autorizado para este tenant');
  }
}

function normalizeYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw publicError(400, 'INVALID_PERIOD_YEAR', 'period_year debe estar entre 2000 y 2100');
  }
  return year;
}

async function assertStandardActiveIfPossible({ tenantId, standardCode }) {
  if (!(await tableExists('tenant_standards'))) {
    return {
      checked: false,
      warning: 'tenant_standards no disponible; no se pudo validar norma activa.',
    };
  }

  const columns = await getExistingColumns('tenant_standards');
  const standardColumn = ['standard_code', 'iso', 'iso_code'].find((column) => columns.has(column));
  const activeColumn = ['is_active', 'active'].find((column) => columns.has(column));

  if (!standardColumn) {
    return {
      checked: false,
      warning: 'tenant_standards no tiene columna de norma reconocible.',
    };
  }

  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM tenant_standards
    WHERE tenant_id = $1::uuid
      AND UPPER(REPLACE(COALESCE(${standardColumn}::text, ''), ' ', '')) = $2
      ${activeColumn ? `AND COALESCE(${activeColumn}, true) = true` : ''}
    `,
    [tenantId, standardCode]
  );

  if (Number(result.rows[0]?.total || 0) === 0) {
    throw publicError(400, 'STANDARD_NOT_ACTIVE', `La norma ${standardCode} no está activa para este tenant`);
  }

  return { checked: true, warning: null };
}

async function assertAuditBelongsToTenant({ tenantId, auditId }) {
  if (!auditId) return;
  if (!(await tableExists('audits'))) return;

  const result = await pool.query(
    `
    SELECT id
    FROM audits
    WHERE id = $1::uuid
      AND tenant_id = $2::uuid
    LIMIT 1
    `,
    [auditId, tenantId]
  );

  if (result.rowCount === 0) {
    throw publicError(404, 'AUDIT_NOT_FOUND', 'La auditoría no existe o no pertenece al tenant');
  }
}

async function getPackageForUser(packageId, user) {
  const result = await pool.query(
    `
    SELECT *
    FROM audit_preparation_packages
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [packageId]
  );

  const row = result.rows[0];
  if (!row) throw publicError(404, 'PACKAGE_NOT_FOUND', 'Paquete documental no encontrado');
  assertTenantAccess(user, row.tenant_id);
  return row;
}

async function listTemplates({ standardCode = 'ISO9001' }) {
  const result = await pool.query(
    `
    SELECT *
    FROM audit_document_templates
    WHERE standard_code = $1
      AND is_active = true
    ORDER BY folder_path, document_name
    `,
    [normalizeStandardCode(standardCode)]
  );

  return result.rows;
}

async function createPackage({ user, payload }) {
  const tenantId = isPlatform(user) && payload.tenant_id ? payload.tenant_id : getUserTenantId(user);
  const standardCode = normalizeStandardCode(payload.standard_code);
  const periodYear = normalizeYear(payload.period_year);
  const packageName = String(payload.package_name || '').trim();
  const auditId = payload.audit_id || null;
  const userId = getUserId(user);

  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'tenant_id no disponible');
  if (!standardCode) throw publicError(400, 'STANDARD_REQUIRED', 'standard_code es obligatorio');
  if (!packageName) throw publicError(400, 'PACKAGE_NAME_REQUIRED', 'package_name es obligatorio');

  assertTenantAccess(user, tenantId);
  await assertAuditBelongsToTenant({ tenantId, auditId });
  const standardCheck = await assertStandardActiveIfPossible({ tenantId, standardCode });

  const result = await pool.query(
    `
    INSERT INTO audit_preparation_packages (
      tenant_id,
      audit_id,
      standard_code,
      period_year,
      package_name,
      package_source,
      generated_by,
      summary_json
    )
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'generated', $6::uuid, $7::jsonb)
    RETURNING *
    `,
    [
      tenantId,
      auditId,
      standardCode,
      periodYear,
      packageName,
      userId,
      JSON.stringify({
        standard_check: standardCheck,
        created_from: 'audit_preparation_api',
      }),
    ]
  );

  return result.rows[0];
}

async function listPackages({ user, filters = {} }) {
  const params = [];
  const where = [];

  if (isPlatform(user) && filters.tenant_id) {
    params.push(filters.tenant_id);
    where.push(`tenant_id = $${params.length}::uuid`);
  } else {
    const tenantId = getUserTenantId(user);
    if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'tenant_id no disponible');
    params.push(tenantId);
    where.push(`tenant_id = $${params.length}::uuid`);
  }

  if (filters.standard_code) {
    params.push(normalizeStandardCode(filters.standard_code));
    where.push(`standard_code = $${params.length}`);
  }
  if (filters.period_year) {
    params.push(normalizeYear(filters.period_year));
    where.push(`period_year = $${params.length}`);
  }
  if (filters.audit_id) {
    params.push(filters.audit_id);
    where.push(`audit_id = $${params.length}::uuid`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT *
    FROM audit_preparation_packages
    WHERE ${where.join(' AND ')}
    ORDER BY updated_at DESC, generated_at DESC
    LIMIT 100
    `,
    params
  );

  return result.rows;
}

async function getPackageDetail({ packageId, user }) {
  const pkg = await getPackageForUser(packageId, user);
  const [documents, evidences, runs, zips] = await Promise.all([
    pool.query(`SELECT * FROM audit_package_documents WHERE package_id = $1::uuid ORDER BY folder_path, document_name`, [packageId]),
    pool.query(`SELECT * FROM audit_evidence_index WHERE package_id = $1::uuid ORDER BY folder_path, evidence_name`, [packageId]),
    pool.query(`SELECT * FROM audit_document_generation_runs WHERE package_id = $1::uuid ORDER BY created_at DESC LIMIT 50`, [packageId]),
    pool.query(`SELECT * FROM audit_uploaded_zip_files WHERE package_id = $1::uuid ORDER BY created_at DESC`, [packageId]),
  ]);

  return {
    package: pkg,
    documents: documents.rows,
    evidences: evidences.rows,
    generation_runs: runs.rows,
    uploaded_zips: zips.rows,
    completion_summary: pkg.summary_json?.completion_summary || pkg.summary_json || {},
  };
}

async function buildContextForPackage({ packageId, user }) {
  const pkg = await getPackageForUser(packageId, user);
  const context = await buildAuditPreparationContext({
    tenantId: pkg.tenant_id,
    standardCode: pkg.standard_code,
    periodYear: pkg.period_year,
    auditId: pkg.audit_id,
    userId: getUserId(user),
  });

  await pool.query(
    `
    UPDATE audit_preparation_packages
    SET
      source_context_json = $2::jsonb,
      summary_json = COALESCE(summary_json, '{}'::jsonb) || $3::jsonb,
      updated_at = now()
    WHERE id = $1::uuid
    `,
    [
      packageId,
      JSON.stringify({
        source_trace: context.source_trace,
        gaps: context.gaps,
        pending_items: context.pending_items,
        completion_summary: context.completion_summary,
        built_at: context.built_at,
      }),
      JSON.stringify({
        completion_summary: context.completion_summary,
        last_context_built_at: context.built_at,
      }),
    ]
  );

  return context;
}

function normalizeAiDocument(aiResult, template, periodYear) {
  const document = aiResult?.document || {};
  return {
    title: document.title || template.document_name,
    version: document.version || template.version || '1.0',
    period_year: document.period_year || periodYear,
    sections: Array.isArray(document.sections) ? document.sections : [],
    content_markdown: document.content_markdown || `# ${template.document_name}\n\n[PENDIENTE DE VALIDACIÓN]\n`,
    content_json: document.content_json || {},
    pending_items: Array.isArray(document.pending_items) ? document.pending_items : [],
    evidence_suggestions: Array.isArray(document.evidence_suggestions) ? document.evidence_suggestions : [],
    source_trace: document.source_trace || {},
  };
}

async function generateDocuments({ packageId, user, payload = {} }) {
  const pkg = await getPackageForUser(packageId, user);
  const context = await buildContextForPackage({ packageId, user });
  const templateKeys = Array.isArray(payload.template_keys) ? payload.template_keys.filter(Boolean) : [];
  const generationScope = payload.generation_scope || (pkg.audit_id ? 'audit_specific' : 'general_preparation');
  const userId = getUserId(user);

  const templateParams = [pkg.standard_code];
  let templateFilter = '';
  if (templateKeys.length) {
    templateParams.push(templateKeys);
    templateFilter = `AND template_key = ANY($${templateParams.length}::text[])`;
  }

  const templates = await pool.query(
    `
    SELECT *
    FROM audit_document_templates
    WHERE standard_code = $1
      AND is_active = true
      ${templateFilter}
    ORDER BY folder_path, document_name
    `,
    templateParams
  );

  const summary = {
    generated_count: 0,
    failed_count: 0,
    requires_validation_count: 0,
    errors: [],
    documents: [],
  };

  for (const template of templates.rows) {
    const requestPayload = {
      tenant_id: pkg.tenant_id,
      audit_id: pkg.audit_id,
      standard_code: pkg.standard_code,
      period_year: pkg.period_year,
      generation_scope: generationScope,
      document_template: {
        template_key: template.template_key,
        document_name: template.document_name,
        document_type: template.document_type,
        template_schema_json: template.template_schema_json || {},
        ai_prompt_template: template.ai_prompt_template || '',
      },
      context,
      generation_rules: {
        do_not_invent: true,
        mark_missing_information: true,
        formal_audit_language: true,
        iso9001_focus: true,
        include_source_trace: true,
      },
    };

    try {
      const aiResult = await aiEngineClient.generateAuditDocument(requestPayload);
      const doc = normalizeAiDocument(aiResult, template, pkg.period_year);
      const status = doc.pending_items.length ? 'requires_validation' : 'generated';

      const inserted = await pool.query(
        `
        INSERT INTO audit_package_documents (
          package_id,
          audit_id,
          template_id,
          tenant_id,
          standard_code,
          document_name,
          folder_path,
          document_status,
          generated_content,
          generated_json,
          pending_items_json,
          evidence_links_json,
          source_trace_json,
          created_by
        )
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::uuid)
        RETURNING *
        `,
        [
          pkg.id,
          pkg.audit_id,
          template.id,
          pkg.tenant_id,
          pkg.standard_code,
          doc.title,
          template.folder_path,
          status,
          doc.content_markdown,
          JSON.stringify(doc.content_json),
          JSON.stringify(doc.pending_items),
          JSON.stringify(doc.evidence_suggestions),
          JSON.stringify(doc.source_trace),
          userId,
        ]
      );

      await pool.query(
        `
        INSERT INTO audit_document_generation_runs (
          package_id,
          audit_id,
          tenant_id,
          standard_code,
          run_type,
          ai_engine_request_json,
          ai_engine_response_json,
          status,
          created_by
        )
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'document_generation',$5::jsonb,$6::jsonb,'completed',$7::uuid)
        `,
        [pkg.id, pkg.audit_id, pkg.tenant_id, pkg.standard_code, JSON.stringify(requestPayload), JSON.stringify(aiResult), userId]
      );

      summary.generated_count += 1;
      if (status === 'requires_validation') summary.requires_validation_count += 1;
      summary.documents.push(inserted.rows[0]);
    } catch (error) {
      summary.failed_count += 1;
      summary.errors.push({
        template_key: template.template_key,
        error: 'No fue posible generar este documento. Revise trazas internas del backend.',
      });

      await pool.query(
        `
        INSERT INTO audit_document_generation_runs (
          package_id,
          audit_id,
          tenant_id,
          standard_code,
          run_type,
          ai_engine_request_json,
          status,
          error_message,
          created_by
        )
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'document_generation',$5::jsonb,'failed',$6,$7::uuid)
        `,
        [pkg.id, pkg.audit_id, pkg.tenant_id, pkg.standard_code, JSON.stringify({ template_key: template.template_key }), String(error.message || '').slice(0, 500), userId]
      );
    }
  }

  return summary;
}

async function generateEvidenceIndex({ packageId, user }) {
  const pkg = await getPackageForUser(packageId, user);
  const context = await buildContextForPackage({ packageId, user });
  const userId = getUserId(user);

  const rows = [];
  for (const evidence of context.evidences || []) {
    const name = evidence.title || evidence.name || evidence.file_name || evidence.file_url || evidence.file_path || evidence.description || `Evidencia ${evidence.id}`;
    rows.push({
      evidence_name: String(name || '').slice(0, 255),
      evidence_type: evidence.evidence_type || null,
      folder_path: '03_EVIDENCIAS_PARA_VALIDAR',
      source_module: 'evidences',
      source_id: evidence.id || null,
      source_reference: evidence.file_url || evidence.file_path || evidence.description || null,
      status: 'requires_validation',
      notes: 'Evidencia encontrada en plataforma; requiere validación de aplicabilidad al paquete.',
      file_url: evidence.file_url || evidence.file_path || null,
    });
  }

  for (const gap of context.gaps || []) {
    rows.push({
      evidence_name: `Pendiente: ${String(gap.message || gap.source || 'evidencia requerida').slice(0, 220)}`,
      evidence_type: 'pending',
      folder_path: '03_EVIDENCIAS_PARA_VALIDAR',
      source_module: gap.source || 'context_builder',
      source_id: null,
      source_reference: gap.message || null,
      status: gap.severity === 'alta' || gap.severity === 'critica' ? 'pending' : 'requires_validation',
      notes: 'Pendiente generado desde brecha de contexto documental.',
      file_url: null,
    });
  }

  const inserted = [];
  for (const row of rows.slice(0, 200)) {
    const result = await pool.query(
      `
      INSERT INTO audit_evidence_index (
        package_id,
        audit_id,
        tenant_id,
        standard_code,
        evidence_name,
        evidence_type,
        folder_path,
        source_module,
        source_id,
        source_reference,
        status,
        notes,
        file_url
      )
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::uuid,$10,$11,$12,$13)
      RETURNING *
      `,
      [pkg.id, pkg.audit_id, pkg.tenant_id, pkg.standard_code, row.evidence_name, row.evidence_type, row.folder_path, row.source_module, row.source_id, row.source_reference, row.status, row.notes, row.file_url]
    );
    inserted.push(result.rows[0]);
  }

  await pool.query(
    `
    INSERT INTO audit_document_generation_runs (
      package_id,
      audit_id,
      tenant_id,
      standard_code,
      run_type,
      ai_engine_request_json,
      ai_engine_response_json,
      status,
      created_by
    )
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4,'evidence_index_generation',$5::jsonb,$6::jsonb,'completed',$7::uuid)
    `,
    [
      pkg.id,
      pkg.audit_id,
      pkg.tenant_id,
      pkg.standard_code,
      JSON.stringify({ source: 'auditPreparationContext' }),
      JSON.stringify({ inserted_count: inserted.length }),
      userId,
    ]
  );

  return {
    inserted_count: inserted.length,
    evidences: inserted,
  };
}

async function getGaps({ packageId, user }) {
  const context = await buildContextForPackage({ packageId, user });
  const gaps = context.gaps || [];
  return {
    critical: gaps.filter((gap) => ['alta', 'critica'].includes(gap.severity)),
    medium: gaps.filter((gap) => gap.severity === 'media'),
    minor: gaps.filter((gap) => gap.severity === 'baja'),
    unavailable_sources: Object.entries(context.source_trace || {})
      .filter(([, item]) => item && item.available === false)
      .map(([source, item]) => ({ source, ...item })),
    missing_evidence: context.pending_items || [],
  };
}

async function updateDocumentStatus({ documentId, documentStatus, user }) {
  const allowed = ['draft', 'imported', 'analyzed', 'generated', 'updated_from_platform', 'requires_validation', 'approved', 'exported'];
  const status = normalizeStatus(documentStatus, allowed, '');
  if (!status) throw publicError(400, 'INVALID_DOCUMENT_STATUS', 'Estado documental inválido');

  const current = await pool.query(`SELECT * FROM audit_package_documents WHERE id = $1::uuid LIMIT 1`, [documentId]);
  const doc = current.rows[0];
  if (!doc) throw publicError(404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado');
  assertTenantAccess(user, doc.tenant_id);

  const result = await pool.query(
    `
    UPDATE audit_package_documents
    SET document_status = $2, updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [documentId, status]
  );
  return result.rows[0];
}

async function updateEvidenceStatus({ evidenceId, status, notes, user }) {
  const allowed = ['complete', 'partial', 'pending', 'requires_validation'];
  const nextStatus = normalizeStatus(status, allowed, '');
  if (!nextStatus) throw publicError(400, 'INVALID_EVIDENCE_STATUS', 'Estado de evidencia inválido');

  const current = await pool.query(`SELECT * FROM audit_evidence_index WHERE id = $1::uuid LIMIT 1`, [evidenceId]);
  const evidence = current.rows[0];
  if (!evidence) throw publicError(404, 'EVIDENCE_NOT_FOUND', 'Evidencia no encontrada');
  assertTenantAccess(user, evidence.tenant_id);

  const result = await pool.query(
    `
    UPDATE audit_evidence_index
    SET status = $2, notes = COALESCE($3, notes), updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [evidenceId, nextStatus, notes || null]
  );
  return result.rows[0];
}

function ensureUploadDir() {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'audit-preparation-zips');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function registerUploadedZip({ user, file, payload }) {
  if (!file) throw publicError(400, 'ZIP_FILE_REQUIRED', 'Archivo ZIP requerido');

  const tenantId = isPlatform(user) && payload.tenant_id ? payload.tenant_id : getUserTenantId(user);
  const standardCode = normalizeStandardCode(payload.standard_code || 'ISO9001');
  const periodYear = normalizeYear(payload.period_year || new Date().getFullYear());
  const auditId = payload.audit_id || null;
  const userId = getUserId(user);

  if (!tenantId) throw publicError(400, 'TENANT_REQUIRED', 'tenant_id no disponible');
  assertTenantAccess(user, tenantId);
  await assertAuditBelongsToTenant({ tenantId, auditId });

  let packageId = payload.package_id || null;
  if (packageId) {
    await getPackageForUser(packageId, user);
  } else {
    const created = await createPackage({
      user,
      payload: {
        tenant_id: tenantId,
        standard_code: standardCode,
        period_year: periodYear,
        package_name: payload.package_name || `Preparación documental ${standardCode} ${periodYear}`,
        audit_id: auditId,
      },
    });
    packageId = created.id;
  }

  const hash = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
  const fileUrl = `/uploads/audit-preparation-zips/${path.basename(file.path)}`;

  const result = await pool.query(
    `
    INSERT INTO audit_uploaded_zip_files (
      package_id,
      audit_id,
      tenant_id,
      standard_code,
      period_year,
      original_filename,
      file_url,
      file_hash,
      analysis_status,
      inventory_json,
      detected_structure_json,
      gaps_json,
      created_by
    )
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,'pending',$9::jsonb,$10::jsonb,$11::jsonb,$12::uuid)
    RETURNING *
    `,
    [
      packageId,
      auditId,
      tenantId,
      standardCode,
      periodYear,
      file.originalname,
      fileUrl,
      hash,
      JSON.stringify([{ file_name: file.originalname, status: 'uploaded_pending_analysis' }]),
      JSON.stringify({ original_filename: file.originalname, deep_analysis_pending: true }),
      JSON.stringify(['[PENDIENTE DE VALIDACIÓN] ZIP registrado; análisis profundo queda para siguiente fase.']),
      userId,
    ]
  );

  await pool.query(
    `
    UPDATE audit_preparation_packages
    SET
      package_source = 'uploaded_zip',
      original_zip_file_url = COALESCE(original_zip_file_url, $2),
      updated_at = now()
    WHERE id = $1::uuid
    `,
    [packageId, fileUrl]
  );

  return {
    package_id: packageId,
    uploaded_zip: result.rows[0],
  };
}

module.exports = {
  listTemplates,
  createPackage,
  listPackages,
  getPackageDetail,
  buildContextForPackage,
  generateDocuments,
  generateEvidenceIndex,
  getGaps,
  updateDocumentStatus,
  updateEvidenceStatus,
  registerUploadedZip,
  ensureUploadDir,
  publicError,
};
