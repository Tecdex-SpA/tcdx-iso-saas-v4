const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const pool = require('../config/db');
const aiEngineClient = require('./aiEngineClient.service');
const { analyzeUploadedZip, readZipEntriesFromBuffer } = require('./auditZipExtraction.service');
const { renderDocumentArtifact, ensureGeneratedDir } = require('./auditDocumentRenderer.service');
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
  const zipMatches = new Map(
    ((context.uploaded_zip?.detected_structure_json?.matched_templates) || [])
      .filter((item) => item && item.template_key)
      .map((item) => [item.template_key, item])
  );

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
      const documentId = crypto.randomUUID();
      const generatedFileUrl = `/api/audit-preparation/documents/${documentId}/download`;
      const zipMatch = zipMatches.get(template.template_key);
      const originalFileUrl = zipMatch && context.uploaded_zip?.file_url
        ? `${context.uploaded_zip.file_url}#${zipMatch.matched_file}`
        : null;
      const originalCandidate = getOriginalCandidateFromZip(context.uploaded_zip, zipMatch?.matched_file);
      const artifact = await renderDocumentArtifact({ pkg, template, document: doc, originalCandidate });
      const status = artifact.preservation?.mode === 'updated_original_docx_with_markers'
        ? (doc.pending_items.length ? 'requires_validation' : 'updated_from_platform')
        : (doc.pending_items.length || originalFileUrl ? 'requires_validation' : 'generated');
      const changeSummary = {
        strategy: artifact.preservation?.mode || (originalFileUrl ? 'generated_tcdx_with_original_preserved' : 'generated_tcdx_new_document'),
        original_file_reference: originalFileUrl,
        preservation_note: artifact.preservation?.mode === 'updated_original_docx_with_markers'
          ? 'Se actualizó una copia DOCX del cliente usando marcadores TCDX compatibles; el original del ZIP se conserva intacto.'
          : originalFileUrl
            ? `El original del cliente se conserva intacto. No se hizo actualización in-place segura (${artifact.preservation?.reason || 'sin marcador compatible'}); se generó versión TCDX.`
            : 'No se encontró original compatible en ZIP; se generó documento nuevo con formato TCDX.',
      };
      const generatedJson = {
        ...(doc.content_json || {}),
        rendered_artifact: {
          filename: artifact.filename,
          output_format: artifact.output_format,
          mime_type: artifact.mime_type,
          file_size_bytes: artifact.file_size_bytes,
          file_hash: artifact.file_hash,
          generated_at: new Date().toISOString(),
        },
        original_zip_match: zipMatch || null,
        preservation: artifact.preservation,
      };

      const inserted = await pool.query(
        `
        INSERT INTO audit_package_documents (
          id,
          package_id,
          audit_id,
          template_id,
          tenant_id,
          standard_code,
          document_name,
          folder_path,
          document_status,
          original_file_url,
          generated_file_url,
          output_format,
          mime_type,
          file_size_bytes,
          file_hash,
          version,
          revision_number,
          prepared_by,
          generated_content,
          generated_json,
          pending_items_json,
          evidence_links_json,
          source_trace_json,
          change_summary_json,
          created_by
        )
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::uuid,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25::uuid)
        RETURNING *
        `,
        [
          documentId,
          pkg.id,
          pkg.audit_id,
          template.id,
          pkg.tenant_id,
          pkg.standard_code,
          doc.title,
          template.folder_path,
          status,
          originalFileUrl,
          generatedFileUrl,
          artifact.output_format,
          artifact.mime_type,
          artifact.file_size_bytes,
          artifact.file_hash,
          doc.version || template.version || '1.0',
          1,
          userId,
          doc.content_markdown,
          JSON.stringify(generatedJson),
          JSON.stringify(doc.pending_items),
          JSON.stringify(doc.evidence_suggestions),
          JSON.stringify(doc.source_trace),
          JSON.stringify(changeSummary),
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
  const allowed = ['draft', 'imported', 'analyzed', 'generated', 'updated_from_platform', 'requires_validation', 'in_review', 'approved', 'rejected', 'obsolete', 'superseded', 'published', 'exported'];
  const status = normalizeStatus(documentStatus, allowed, '');
  if (!status) throw publicError(400, 'INVALID_DOCUMENT_STATUS', 'Estado documental inválido');

  const current = await pool.query(`SELECT * FROM audit_package_documents WHERE id = $1::uuid LIMIT 1`, [documentId]);
  const doc = current.rows[0];
  if (!doc) throw publicError(404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado');
  assertTenantAccess(user, doc.tenant_id);

  const result = await pool.query(
    `
    UPDATE audit_package_documents
    SET
      document_status = $2,
      reviewed_by = CASE WHEN $2 IN ('in_review', 'rejected') THEN $3::uuid ELSE reviewed_by END,
      approved_by = CASE WHEN $2 IN ('approved', 'published') THEN $3::uuid ELSE approved_by END,
      approved_at = CASE WHEN $2 IN ('approved', 'published') THEN now() ELSE approved_at END,
      is_current = CASE WHEN $2 IN ('obsolete', 'superseded') THEN false ELSE is_current END,
      updated_at = now()
    WHERE id = $1::uuid
    RETURNING *
    `,
    [documentId, status, getUserId(user)]
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

function ensureExportDir() {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'audit-preparation-exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitizeFileName(value, fallback = 'documento') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_')
    .slice(0, 140) || fallback;
}

function replacePeriodFolder(folderPath, periodYear) {
  return String(folderPath || '').replace(/\{\{period_year\}\}/g, String(periodYear || ''));
}

function getOriginalCandidateFromZip(uploadedZip, matchedFile) {
  if (!uploadedZip?.file_url || !matchedFile) return null;
  const zipPath = path.join(ensureUploadDir(), path.basename(uploadedZip.file_url));
  if (!fs.existsSync(zipPath)) return null;
  const buffer = fs.readFileSync(zipPath);
  const entries = readZipEntriesFromBuffer(buffer, { includeContent: true, maxContentBytes: 25 * 1024 * 1024 }).entries;
  const match = entries.find((entry) => entry.full_path === matchedFile && entry.content && entry.extension === '.docx');
  if (!match) return null;
  return {
    buffer: match.content,
    full_path: match.full_path,
    file_name: match.file_name,
  };
}

const crcTable = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { dosTime, dosDate };
}

function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  const now = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.path.replace(/^\/+/, ''), 'utf8');
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content || ''), 'utf8');
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);

    offset += local.length + name.length + content.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuffer, end]);
}

function parseZipInventory(filePath) {
  const buffer = fs.readFileSync(filePath);
  const entries = [];
  const folders = new Set();
  const warnings = [];
  let offset = 0;

  while (offset < buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const flags = buffer.readUInt16LE(offset + 6);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const rawName = buffer.slice(nameStart, nameEnd).toString('utf8').replace(/\\/g, '/');

    if (rawName.includes('..') || path.isAbsolute(rawName)) {
      warnings.push(`Entrada omitida por ruta insegura: ${rawName}`);
    } else if (rawName.endsWith('/')) {
      folders.add(rawName.replace(/\/$/, ''));
    } else {
      const parts = rawName.split('/');
      parts.slice(0, -1).forEach((_, index) => {
        folders.add(parts.slice(0, index + 1).join('/'));
      });
      entries.push({
        file_name: parts[parts.length - 1],
        folder_path: parts.slice(0, -1).join('/'),
        full_path: rawName,
        extension: path.extname(rawName).toLowerCase(),
        compressed_size: compressedSize,
      });
    }

    if (flags & 0x08) {
      warnings.push('ZIP usa data descriptors; el inventario puede ser parcial.');
      break;
    }

    offset = nameEnd + extraLength + compressedSize;
  }

  return {
    files: entries,
    folders: Array.from(folders).filter(Boolean).sort(),
    warnings,
  };
}

function normalizeMatchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function analyzeZipAgainstTemplates(inventory, templates) {
  const detectedDocuments = inventory.files.map((file) => ({
    file_name: file.file_name,
    folder_path: file.folder_path,
    full_path: file.full_path,
    extension: file.extension,
  }));

  const matchedTemplates = [];
  const matchedFiles = new Set();
  for (const template of templates) {
    const keyText = normalizeMatchText(template.template_key);
    const nameText = normalizeMatchText(template.document_name);
    const folderText = normalizeMatchText(template.folder_path);
    const match = inventory.files.find((file) => {
      const full = normalizeMatchText(`${file.full_path} ${file.file_name}`);
      return (
        (keyText && full.includes(keyText)) ||
        (nameText && full.includes(nameText.split(' ').slice(0, 3).join(' '))) ||
        (folderText && normalizeMatchText(file.folder_path).includes(folderText.split(' ').slice(0, 2).join(' ')))
      );
    });

    if (match) {
      matchedFiles.add(match.full_path);
      matchedTemplates.push({
        template_key: template.template_key,
        document_name: template.document_name,
        matched_file: match.full_path,
        confidence: 'medium',
      });
    }
  }

  const unmatchedFiles = inventory.files
    .filter((file) => !matchedFiles.has(file.full_path))
    .map((file) => file.full_path);

  return {
    file_count: inventory.files.length,
    folder_count: inventory.folders.length,
    detected_documents: detectedDocuments,
    matched_templates: matchedTemplates,
    unmatched_files: unmatchedFiles,
    warnings: inventory.warnings,
  };
}

function buildReadme(pkg, detail) {
  const summary = detail.completion_summary || {};
  const score = summary.estimated_readiness_score ?? 'pendiente';
  const status = summary.readiness_status || 'pending';
  const documents = detail.documents || [];
  const pendingDocuments = documents.filter((doc) => doc.document_status === 'requires_validation');

  return `# ${pkg.package_name}

Norma: ${pkg.standard_code}
Periodo: ${pkg.period_year}
Estado del paquete: ${pkg.status}
Readiness: ${status} (${score})
Fecha de exportación: ${new Date().toISOString()}

## Advertencia de uso

Este paquete es un borrador de preparación documental. Los documentos con estado requires_validation deben ser revisados y aprobados antes de presentarse en auditoría externa.

## Documentos incluidos

${documents.map((doc) => `- ${doc.document_name} (${doc.document_status})`).join('\n') || '- Sin documentos generados'}

## Documentos pendientes de validación

${pendingDocuments.map((doc) => `- ${doc.document_name}`).join('\n') || '- No hay documentos pendientes de validación'}
`;
}

function buildEvidenceIndexMarkdown(evidences) {
  const rows = evidences || [];
  return [
    '# Índice de evidencias',
    '',
    '| Evidencia | Fuente | Estado | Carpeta | Observación |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((item) => `| ${String(item.evidence_name || '').replace(/\|/g, '/')} | ${item.source_module || '-'} | ${item.status || '-'} | ${String(item.folder_path || '').replace(/\|/g, '/')} | ${String(item.notes || '').replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
}

function buildMasterListXlsx({ pkg, docs }) {
  const rows = [
    [
      'Código documental',
      'Nombre',
      'Tipo',
      'Norma',
      'Proceso/carpeta',
      'Versión',
      'Revisión',
      'Estado',
      'Fecha emisión',
      'Fecha revisión',
      'Vigencia',
      'Responsable',
      'Aprobador',
      'Fuente',
      'Hash',
      'Archivo original',
      'Archivo generado',
      'Observaciones',
      'Evidencias',
      'Requiere validación',
    ],
    ...(docs || []).map((doc, index) => [
      `${pkg.standard_code}-${String(index + 1).padStart(3, '0')}`,
      doc.document_name,
      doc.output_format || 'md',
      pkg.standard_code,
      replacePeriodFolder(doc.folder_path, pkg.period_year),
      doc.version || '1.0',
      doc.revision_number || 1,
      doc.document_status,
      doc.created_at || '',
      doc.updated_at || '',
      doc.expires_at || '',
      doc.prepared_by || doc.created_by || '',
      doc.approved_by || '',
      doc.original_file_url ? 'actualizado desde original cliente' : 'generado TCDX',
      doc.file_hash || '',
      doc.original_file_url || '',
      doc.generated_file_url || '',
      doc.change_summary_json?.preservation_note || doc.change_summary_json?.strategy || '',
      Array.isArray(doc.evidence_links_json) ? doc.evidence_links_json.length : 0,
      Array.isArray(doc.pending_items_json) ? doc.pending_items_json.length : 0,
    ]),
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = rows[0].map((_, index) => ({ wch: index === 1 || index === 4 || index === 17 ? 42 : 18 }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Lista maestra');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildGapsMarkdown(detail) {
  const summary = detail.completion_summary || {};
  const gaps = summary.gaps || [];
  return [
    '# Brechas finales para cierre',
    '',
    `Readiness: ${summary.readiness_status || 'pending'} (${summary.estimated_readiness_score ?? 'pendiente'})`,
    '',
    '| Severidad | Fuente | Mensaje |',
    '| --- | --- | --- |',
    ...(Array.isArray(gaps) ? gaps : []).map((gap) => `| ${gap.severity || '-'} | ${gap.source || '-'} | ${String(gap.message || '').replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
}

async function getPackageSummary({ packageId, user }) {
  const detail = await getPackageDetail({ packageId, user });
  const summary = detail.completion_summary || {};
  const docs = detail.documents || [];
  const evidences = detail.evidences || [];

  return {
    package: detail.package,
    completion_summary: summary,
    counters: {
      total_documents: docs.length,
      generated_documents: docs.filter((doc) => ['generated', 'requires_validation', 'approved', 'exported'].includes(doc.document_status)).length,
      approved_documents: docs.filter((doc) => doc.document_status === 'approved').length,
      requires_validation_documents: docs.filter((doc) => doc.document_status === 'requires_validation').length,
      total_evidences: evidences.length,
      complete_evidences: evidences.filter((item) => item.status === 'complete').length,
      pending_evidences: evidences.filter((item) => ['pending', 'requires_validation'].includes(item.status)).length,
    },
    latest_run: (detail.generation_runs || [])[0] || null,
    latest_zip: (detail.uploaded_zips || [])[0] || null,
  };
}

async function listPackageDocuments({ packageId, user }) {
  await getPackageForUser(packageId, user);
  const result = await pool.query(
    `
    SELECT id, package_id, template_id, document_name, folder_path, document_status,
      generated_file_url, output_format, mime_type, file_size_bytes, file_hash,
      version, revision_number, is_current, pending_items_json, evidence_links_json,
      original_file_url, change_summary_json,
      created_at, updated_at, approved_at
    FROM audit_package_documents
    WHERE package_id = $1::uuid
    ORDER BY folder_path, document_name
    `,
    [packageId]
  );
  return result.rows;
}

async function getDocumentDetail({ documentId, user }) {
  const current = await pool.query(`SELECT * FROM audit_package_documents WHERE id = $1::uuid LIMIT 1`, [documentId]);
  const doc = current.rows[0];
  if (!doc) throw publicError(404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado');
  assertTenantAccess(user, doc.tenant_id);
  return doc;
}

async function getDocumentFile({ documentId, user }) {
  const doc = await getDocumentDetail({ documentId, user });
  const artifact = doc.generated_json?.rendered_artifact || {};
  if (!artifact.filename) throw publicError(404, 'DOCUMENT_FILE_NOT_FOUND', 'El documento no tiene archivo generado');
  const filePath = path.join(ensureGeneratedDir(), path.basename(artifact.filename));
  if (!fs.existsSync(filePath)) throw publicError(404, 'DOCUMENT_FILE_NOT_FOUND', 'Archivo generado no encontrado en disco');
  return {
    path: filePath,
    filename: `${sanitizeFileName(doc.document_name)}.${doc.output_format || artifact.output_format || 'docx'}`,
    mime_type: doc.mime_type || artifact.mime_type || 'application/octet-stream',
  };
}

async function getDocumentHistory({ documentId, user }) {
  const doc = await getDocumentDetail({ documentId, user });
  const result = await pool.query(
    `
    SELECT id, document_name, document_status, version, revision_number, is_current,
      created_at, updated_at, approved_at, supersedes_document_id
    FROM audit_package_documents
    WHERE package_id = $1::uuid
      AND COALESCE(template_id::text, '') = COALESCE($2::text, '')
      AND document_name = $3
    ORDER BY revision_number DESC, created_at DESC
    `,
    [doc.package_id, doc.template_id, doc.document_name]
  );
  return result.rows;
}

async function listUploadedZips({ packageId, user }) {
  await getPackageForUser(packageId, user);
  const result = await pool.query(
    `
    SELECT *
    FROM audit_uploaded_zip_files
    WHERE package_id = $1::uuid
    ORDER BY created_at DESC
    `,
    [packageId]
  );
  return result.rows;
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
  const templates = await listTemplates({ standardCode });
  const analysis = await analyzeUploadedZip({ filePath: file.path, templates });
  const gaps = [
    ...(analysis.warnings || []).map((message) => ({ severity: 'media', source: 'uploaded_zip', message })),
    ...(analysis.conflicts || []).map((conflict) => ({ severity: 'alta', source: 'uploaded_zip', message: conflict.message, files: conflict.files })),
  ];

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
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,'analyzed',$9::jsonb,$10::jsonb,$11::jsonb,$12::uuid)
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
      JSON.stringify(analysis.detected_documents),
      JSON.stringify(analysis),
      JSON.stringify(gaps),
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
    analysis,
  };
}

async function exportPackage({ packageId, user }) {
  const detail = await getPackageDetail({ packageId, user });
  const pkg = detail.package;
  const docs = detail.documents || [];
  const evidences = detail.evidences || [];
  const zips = detail.uploaded_zips || [];

  const root = sanitizeFileName(`Auditoria_${pkg.package_name}_${pkg.standard_code}_${pkg.period_year}`, 'Auditoria_ISO9001');
  const entries = [
    {
      path: `${root}/00_INDICE_Y_GUIA_DE_USO/README.md`,
      content: buildReadme(pkg, detail),
    },
    {
      path: `${root}/07_REPORTES_TCDX/00_LISTA_MAESTRA_DOCUMENTAL.xlsx`,
      content: buildMasterListXlsx({ pkg, docs }),
    },
    {
      path: `${root}/03_EVIDENCIAS_PARA_VALIDAR/00_INDICE_EVIDENCIAS.md`,
      content: buildEvidenceIndexMarkdown(evidences),
    },
    {
      path: `${root}/07_REPORTES_TCDX/00_BRECHAS_FINALES_PARA_CIERRE.md`,
      content: buildGapsMarkdown(detail),
    },
    {
      path: `${root}/07_REPORTES_TCDX/00_TRAZABILIDAD_TCDX.json`,
      content: JSON.stringify({
        package: pkg,
        completion_summary: detail.completion_summary,
        exported_at: new Date().toISOString(),
        documents: docs.map((doc) => ({
          document_name: doc.document_name,
          folder_path: replacePeriodFolder(doc.folder_path, pkg.period_year),
          status: doc.document_status,
          output_format: doc.output_format,
          file_hash: doc.file_hash,
          source_trace: doc.source_trace_json,
        })),
        uploaded_zips: zips.map((zip) => ({
          original_filename: zip.original_filename,
          analysis_status: zip.analysis_status,
          file_hash: zip.file_hash,
        })),
      }, null, 2),
    },
    {
      path: `${root}/00_INDICE_Y_GUIA_DE_USO/00_PENDIENTES_PARA_AUDITORIA.md`,
      content: [
        '# Pendientes para auditoría',
        '',
        ...docs.flatMap((doc) => {
          const pending = Array.isArray(doc.pending_items_json) ? doc.pending_items_json : [];
          return pending.length ? [`## ${doc.document_name}`, '', ...pending.map((item) => `- ${item}`), ''] : [];
        }),
        docs.every((doc) => !Array.isArray(doc.pending_items_json) || doc.pending_items_json.length === 0)
          ? 'No hay pendientes registrados en documentos generados.'
          : '',
      ].join('\n'),
    },
  ];

  for (const doc of docs) {
    const folder = replacePeriodFolder(doc.folder_path, pkg.period_year) || '01_DOCUMENTOS_VIGENTES';
    const artifact = doc.generated_json?.rendered_artifact || {};
    const artifactPath = artifact.filename ? path.join(ensureGeneratedDir(), path.basename(artifact.filename)) : null;
    const format = doc.output_format || artifact.output_format || 'md';
    const fileName = `${sanitizeFileName(doc.document_name)}.${format}`;
    entries.push({
      path: `${root}/${folder}/${fileName}`,
      content: artifactPath && fs.existsSync(artifactPath)
        ? fs.readFileSync(artifactPath)
        : (doc.generated_content || `# ${doc.document_name}\n\n[PENDIENTE DE VALIDACIÓN]\n`),
    });

    if (doc.generated_content) {
      entries.push({
        path: `${root}/99_RESPALDO_GENERACIONES/${sanitizeFileName(doc.document_name)}.preview.md`,
        content: doc.generated_content,
      });
    }
  }

  for (const zip of zips) {
    const sourcePath = zip.file_url ? path.join(ensureUploadDir(), path.basename(zip.file_url)) : null;
    if (sourcePath && fs.existsSync(sourcePath)) {
      entries.push({
        path: `${root}/06_ORIGINALES_CLIENTE_NO_MODIFICADOS/${sanitizeFileName(zip.original_filename, 'original.zip')}`,
        content: fs.readFileSync(sourcePath),
      });
    }
  }

  const exportDir = ensureExportDir();
  const exportFileName = `${Date.now()}-${pkg.id}-${sanitizeFileName(pkg.standard_code)}-${pkg.period_year}.zip`;
  const exportPath = path.join(exportDir, exportFileName);
  fs.writeFileSync(exportPath, buildZip(entries));
  const exportFileUrl = `/api/audit-preparation/packages/${pkg.id}/download-export`;

  await pool.query(
    `
    UPDATE audit_preparation_packages
    SET latest_export_file_url = $2, status = 'exported', updated_at = now()
    WHERE id = $1::uuid
    `,
    [pkg.id, exportFileUrl]
  );

  return {
    export_file_url: exportFileUrl,
    export_path: exportPath,
    file_count: entries.length,
  };
}

async function getExportFile({ packageId, user }) {
  const pkg = await getPackageForUser(packageId, user);
  if (!pkg.latest_export_file_url) {
    throw publicError(404, 'EXPORT_NOT_FOUND', 'El paquete aún no tiene export generado');
  }

  const exportDir = ensureExportDir();
  const files = fs.readdirSync(exportDir)
    .filter((file) => file.includes(String(pkg.id)))
    .map((file) => ({
      file,
      path: path.join(exportDir, file),
      mtimeMs: fs.statSync(path.join(exportDir, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const match = files[0];
  if (!match) throw publicError(404, 'EXPORT_FILE_NOT_FOUND', 'Archivo exportado no encontrado en disco');

  return {
    path: match.path,
    filename: `${sanitizeFileName(pkg.package_name)}.zip`,
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
  getPackageSummary,
  listPackageDocuments,
  getDocumentDetail,
  getDocumentFile,
  getDocumentHistory,
  listUploadedZips,
  updateDocumentStatus,
  updateEvidenceStatus,
  registerUploadedZip,
  exportPackage,
  getExportFile,
  ensureUploadDir,
  publicError,
};
