const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const auth = require('../middleware/auth')
const multer = require('multer')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  enqueueEvidenceAiJob,
  cancelActiveJobsForEvidence,
  processEvidenceAiJobs
} = require('../services/evidence-ai.service')
const aiContextBuilder = require('../services/aiContextBuilder.service')
const { runOperationalAiReview } = require('../services/aiOperationalReview.service')

const AI_RECOMMENDATION_THRESHOLD = Number(
  process.env.EVIDENCE_AI_RECOMMENDATION_THRESHOLD ||
    process.env.EVIDENCE_AI_AUTO_APPROVAL_THRESHOLD ||
    80
)

function getUserTenantId(user) {
  return (
    user?.tenant_id ||
    user?.tenantId ||
    user?.tenant ||
    user?.company_id ||
    user?.companyId ||
    null
  )
}

function getUserId(user) {
  return user?.user_id || user?.userId || user?.id || null
}

function normalizeRole(user) {
  return String(
    user?.role || user?.user_role || user?.userRole || ''
  ).toLowerCase().trim()
}

function isSuperAdmin(user) {
  const role = normalizeRole(user)

  return [
    'superadmin',
    'super_admin',
    'admin_global',
    'global_admin',
    'platform_admin',
    'owner'
  ].includes(role)
}

function isAuditor(user) {
  return normalizeRole(user) === 'auditor'
}

function isTenantAdmin(user) {
  const role = normalizeRole(user)
  return ['tenant_admin', 'admin'].includes(role)
}

const ensureTenantAccess = (req, tenantId) => {
  if (isSuperAdmin(req.user)) return true
  return String(getUserTenantId(req.user)) === String(tenantId)
}

const canReviewEvidence = (req, tenantId) => {
  if (!ensureTenantAccess(req, tenantId)) return false
  return isSuperAdmin(req.user) || isAuditor(req.user) || isTenantAdmin(req.user)
}

const canProcessAiJobs = (req) => {
  return isSuperAdmin(req.user) || isTenantAdmin(req.user)
}

// =============================
// STORAGE
// =============================
const evidenceUploadDir = path.join(__dirname, '..', '..', 'uploads', 'evidences')
fs.mkdirSync(evidenceUploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, evidenceUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || '')).toLowerCase()
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.EVIDENCE_UPLOAD_MAX_BYTES || 25 * 1024 * 1024)
  }
})

function evidenceUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()

    const isSizeError = err.code === 'LIMIT_FILE_SIZE'
    return res.status(400).json({
      error: isSizeError
        ? 'La evidencia excede el tamaño máximo permitido'
        : err.message || 'No fue posible procesar el archivo de evidencia'
    })
  })
}

// =============================
// Helpers
// =============================
function normalizeEvidenceStatus(status) {
  const value = String(status || '').toLowerCase().trim()

  if (['aprobado', 'aprobada', 'approved'].includes(value)) {
    return 'aprobada'
  }

  if (['rechazado', 'rechazada', 'rejected'].includes(value)) {
    return 'rechazada'
  }

  return 'pendiente'
}

function safeObject(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function deepMerge(base, patch) {
  const output = { ...(safeObject(base) || {}) }
  const source = safeObject(patch)

  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value)
    } else {
      output[key] = value
    }
  }

  return output
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(value) {
  return Number(toNumber(value).toFixed(2))
}

function buildAiAcceptancePct(row) {
  return round2(
    toNumber(row.pertinence_score) * 0.15 +
      toNumber(row.sufficiency_score) * 0.25 +
      toNumber(row.freshness_score) * 0.1 +
      toNumber(row.traceability_score) * 0.2 +
      toNumber(row.consistency_score) * 0.1 +
      toNumber(row.compliance_impact_score) * 0.2
  )
}

function isAiRecommendationEligible(row) {
  const normalizedStatus = normalizeEvidenceStatus(row.status)
  const analysisStatus = String(row.analysis_status || '').toLowerCase()
  const validityResult = String(row.validity_result || '').toLowerCase()
  const acceptancePct = buildAiAcceptancePct(row)
  const appearsComplete = row.appears_complete === true
  const appearsExpired = row.appears_expired === true

  return (
    normalizedStatus === 'pendiente' &&
    analysisStatus.startsWith('completed') &&
    validityResult === 'valida' &&
    appearsComplete &&
    !appearsExpired &&
    acceptancePct >= AI_RECOMMENDATION_THRESHOLD
  )
}

function resolveEvidenceFilePath(filePath) {
  const safeName = path.basename(String(filePath || ''))

  if (!safeName) return null

  const candidates = [
    path.join(evidenceUploadDir, safeName),
    path.join(__dirname, '..', '..', 'uploads', safeName)
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function buildAiRecommendationPayload(row, acceptancePct) {
  const recommendedAt = new Date().toISOString()

  return {
    ai_recommendation: {
      recommendation: 'approve',
      acceptance_pct: acceptancePct,
      threshold_pct: AI_RECOMMENDATION_THRESHOLD,
      recommended_at: recommendedAt,
      human_approval_required: true,
      reason: `IA recomienda aprobación humana: ${acceptancePct}% de aceptación.`,
      validity_result: row.validity_result || null,
      contribution_level: row.contribution_level || null,
      assessment_id: row.assessment_id || null,
      model_name: row.model_name || 'own_ai_140',
      model_version: row.model_version || null
    },
    reviewed_from: 'human_required_ai_recommendation',
    last_review_status: 'pendiente'
  }
}

async function refreshHealthForTenant(client, tenantId) {
  try {
    await client.query(
      `SELECT * FROM refresh_control_health_scores_v2_1($1::uuid)`,
      [tenantId]
    )

    await client.query(
      `SELECT * FROM refresh_kpi_health_snapshots($1::uuid)`,
      [tenantId]
    )
  } catch (err) {
    console.error('ERROR REFRESH HEALTH FROM EVIDENCES:', err.message)
  }
}

const getEvidenceById = async (db, id) => {
  return db.query(
    `
    SELECT *
    FROM evidences
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  )
}

// =============================
// Resolver control_id a catálogo
// =============================
const resolveCatalogControlId = async (db, rawControlId) => {
  if (!rawControlId) return null

  const catalogCheck = await db.query(
    `SELECT id FROM controls_catalog WHERE id = $1 LIMIT 1`,
    [rawControlId]
  )

  if (catalogCheck.rowCount > 0) {
    return catalogCheck.rows[0].id
  }

  const tenantControlCheck = await db.query(
    `
    SELECT control_id
    FROM tenant_controls
    WHERE id = $1
    LIMIT 1
    `,
    [rawControlId]
  )

  if (
    tenantControlCheck.rowCount > 0 &&
    tenantControlCheck.rows[0].control_id
  ) {
    return tenantControlCheck.rows[0].control_id
  }

  const controlCheck = await db.query(
    `
    SELECT catalog_control_id
    FROM controls
    WHERE id = $1
    LIMIT 1
    `,
    [rawControlId]
  )

  if (controlCheck.rowCount > 0 && controlCheck.rows[0].catalog_control_id) {
    return controlCheck.rows[0].catalog_control_id
  }

  return null
}

async function getOperationalTenantControlContext(
  db,
  {
    tenantId,
    tenantControlId = null,
    catalogControlId = null,
    expectedIso = null
  }
) {
  const result = await db.query(
    `
    SELECT
      tc.id AS tenant_control_id,
      tc.tenant_id,
      tc.control_id AS catalog_control_id,
      tc.operation_id,
      tc.status AS tenant_control_status,
      cc.iso,
      cc.clause,
      cc.description AS control_description,
      cc.category,
      op.name AS operation_name,
      op.code AS operation_code,
      op.operation_type
    FROM tenant_controls tc
    JOIN controls_catalog cc
      ON cc.id = tc.control_id
     AND cc.is_active = TRUE
    JOIN tenant_operations op
      ON op.id = tc.operation_id
     AND op.tenant_id = tc.tenant_id
     AND op.is_active = TRUE
    JOIN tenant_standard_operations tso
      ON tso.tenant_id = tc.tenant_id
     AND tso.standard_code = cc.iso
     AND tso.operation_id = tc.operation_id
     AND tso.is_active = TRUE
    JOIN tenant_standards ts
      ON ts.tenant_id = tc.tenant_id
     AND ts.standard_code = cc.iso
     AND ts.is_active = TRUE
    WHERE tc.tenant_id = $1
      AND (
        ($2::uuid IS NOT NULL AND tc.id = $2::uuid)
        OR
        ($2::uuid IS NULL AND $3::uuid IS NOT NULL AND tc.control_id = $3::uuid)
      )
      AND ($4::text IS NULL OR cc.iso = $4::text)
    ORDER BY
      op.is_default DESC,
      op.sort_order ASC,
      op.name ASC,
      tc.created_at ASC,
      tc.id ASC
    LIMIT 1
    `,
    [tenantId, tenantControlId, catalogControlId, expectedIso]
  )

  return result.rows[0] || null
}

async function touchLinkedActionPlanForEvidence(client, evidenceRow) {
  const metadata = safeObject(evidenceRow.metadata)
  const directActionPlanId = metadata.action_plan_id || null

  let linkedPlan = null

  if (directActionPlanId) {
    const direct = await client.query(
      `
      SELECT id
      FROM action_plans
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [directActionPlanId, evidenceRow.tenant_id]
    )

    if (direct.rowCount > 0) {
      linkedPlan = direct.rows[0]
    }
  }

  if (!linkedPlan && evidenceRow.tenant_control_id) {
    const fallback = await client.query(
      `
      SELECT id
      FROM action_plans
      WHERE tenant_id = $1
        AND tenant_control_id = $2
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
      `,
      [evidenceRow.tenant_id, evidenceRow.tenant_control_id]
    )

    if (fallback.rowCount > 0) {
      linkedPlan = fallback.rows[0]
    }
  }

  if (!linkedPlan) return null

  await client.query(
    `
    UPDATE action_plans
    SET updated_at = NOW()
    WHERE id = $1
    `,
    [linkedPlan.id]
  )

  return linkedPlan.id
}

async function recommendEligibleEvidences(client, tenantId, filters = {}) {
  const params = [tenantId]
  let idx = 2

  let query = `
    SELECT
      e.id,
      e.tenant_id,
      e.status,
      e.metadata,
        e.metadata->>'web_view_url' AS web_view_url,
        e.metadata->>'source_document_id' AS source_document_id,
        e.metadata->>'source_suggestion_id' AS source_suggestion_id,
        e.metadata->>'suggested_standard_code' AS suggested_standard_code,
        e.metadata->>'suggested_control_ref' AS suggested_control_ref,
      ai.id AS assessment_id,
      ai.analysis_status,
      ai.validity_result,
      ai.contribution_level,
      ai.pertinence_score,
      ai.sufficiency_score,
      ai.freshness_score,
      ai.traceability_score,
      ai.consistency_score,
      ai.compliance_impact_score,
      ai.appears_expired,
      ai.appears_complete,
      ai.model_name,
      ai.model_version
    FROM evidences e
    LEFT JOIN LATERAL (
      SELECT
        tc.id AS tenant_control_id,
        tc.control_id AS catalog_control_id,
        cc.iso
      FROM tenant_controls tc
      JOIN controls_catalog cc
        ON cc.id = tc.control_id
       AND cc.is_active = TRUE
      JOIN tenant_operations op
        ON op.id = tc.operation_id
       AND op.tenant_id = tc.tenant_id
       AND op.is_active = TRUE
      JOIN tenant_standard_operations tso
        ON tso.tenant_id = tc.tenant_id
       AND tso.standard_code = cc.iso
       AND tso.operation_id = tc.operation_id
       AND tso.is_active = TRUE
      JOIN tenant_standards ts
        ON ts.tenant_id = tc.tenant_id
       AND ts.standard_code = cc.iso
       AND ts.is_active = TRUE
      WHERE tc.tenant_id = e.tenant_id
        AND (
          tc.id = e.tenant_control_id
          OR (
            e.tenant_control_id IS NULL
            AND e.control_id IS NOT NULL
            AND tc.control_id = e.control_id
          )
        )
      ORDER BY
        CASE WHEN tc.id = e.tenant_control_id THEN 0 ELSE 1 END,
        op.is_default DESC,
        op.sort_order ASC,
        tc.created_at ASC
      LIMIT 1
    ) ctx ON TRUE
    LEFT JOIN vw_evidence_current_ai_assessments ai
      ON ai.evidence_id = e.id
    WHERE e.tenant_id = $1
      AND ctx.catalog_control_id IS NOT NULL
  `

  if (filters.iso) {
    query += ` AND ctx.iso = $${idx}`
    params.push(filters.iso)
    idx += 1
  }

  if (filters.evidenceId) {
    query += ` AND e.id = $${idx}`
    params.push(filters.evidenceId)
    idx += 1
  }

  if (filters.tenantControlId) {
    query += ` AND e.tenant_control_id = $${idx}`
    params.push(filters.tenantControlId)
    idx += 1
  }

  if (filters.actionPlanId) {
    query += ` AND e.metadata->>'action_plan_id' = $${idx}`
    params.push(filters.actionPlanId)
    idx += 1
  }

  const result = await client.query(query, params)

  const updatedIds = []

  for (const row of result.rows) {
    if (!isAiRecommendationEligible(row)) continue

    const acceptancePct = buildAiAcceptancePct(row)
    const mergedMetadata = deepMerge(
      safeObject(row.metadata),
      buildAiRecommendationPayload(row, acceptancePct)
    )

    const update = await client.query(
      `
      UPDATE evidences
      SET
        metadata = $2::jsonb
      WHERE id = $1
        AND LOWER(COALESCE(status, '')) IN ('pendiente', 'pending', 'uploaded', 'subida', '')
      RETURNING *
      `,
      [row.id, JSON.stringify(mergedMetadata)]
    )

    if (update.rowCount > 0) {
      updatedIds.push(row.id)
    }
  }

  return {
    updated_count: updatedIds.length,
    updated_ids: updatedIds
  }
}

// =============================
// Resolver contexto de carga
// =============================
const resolveUploadContext = async ({
  db,
  tenantId,
  controlId,
  tenantControlId,
  actionPlanId
}) => {
  let finalTenantControlId = tenantControlId || null
  let finalCatalogControlId = null
  let finalActionPlanId = actionPlanId || null

  if (finalTenantControlId) {
    const tc = await db.query(
      `
      SELECT
        tc.id,
        tc.tenant_id,
        tc.control_id
      FROM tenant_controls tc
      WHERE tc.id = $1
      LIMIT 1
      `,
      [finalTenantControlId]
    )

    if (tc.rowCount === 0) {
      throw new Error('tenant_control_id no existe')
    }

    if (String(tc.rows[0].tenant_id) !== String(tenantId)) {
      throw new Error('tenant_control_id no pertenece al tenant')
    }

    finalCatalogControlId = tc.rows[0].control_id || null
  }

  if (!finalCatalogControlId && finalActionPlanId) {
    const ap = await db.query(
      `
      SELECT
        ap.id,
        ap.tenant_id,
        ap.iso_code,
        ap.tenant_control_id,
        ap.source_type,
        ap.source_id,
        COALESCE(
          ap.tenant_control_id,
          CASE
            WHEN ap.source_type = 'control' THEN ap.source_id
            ELSE NULL
          END
        ) AS resolved_tenant_control_id
      FROM action_plans ap
      WHERE ap.id = $1
      LIMIT 1
      `,
      [finalActionPlanId]
    )

    if (ap.rowCount === 0) {
      throw new Error('action_plan_id no existe')
    }

    if (String(ap.rows[0].tenant_id) !== String(tenantId)) {
      throw new Error('action_plan_id no pertenece al tenant')
    }

    finalTenantControlId = ap.rows[0].resolved_tenant_control_id || null

    if (finalTenantControlId) {
      const tc = await db.query(
        `
        SELECT
          tc.id,
          tc.tenant_id,
          tc.control_id
        FROM tenant_controls tc
        WHERE tc.id = $1
        LIMIT 1
        `,
        [finalTenantControlId]
      )

      if (
        tc.rowCount > 0 &&
        String(tc.rows[0].tenant_id) === String(tenantId)
      ) {
        finalCatalogControlId = tc.rows[0].control_id || null
      }
    }
  }

  if (!finalCatalogControlId && controlId) {
    finalCatalogControlId = await resolveCatalogControlId(db, controlId)
  }

  const operationalContext = await getOperationalTenantControlContext(db, {
    tenantId,
    tenantControlId: finalTenantControlId,
    catalogControlId: finalCatalogControlId,
    expectedIso: null
  })

  if (!operationalContext) {
    throw new Error(
      'No se pudo resolver un control operativo activo para la evidencia'
    )
  }

  return {
    tenantControlId: operationalContext.tenant_control_id,
    catalogControlId: operationalContext.catalog_control_id,
    actionPlanId: finalActionPlanId,
    iso: operationalContext.iso,
    clause: operationalContext.clause,
    controlDescription: operationalContext.control_description,
    operationId: operationalContext.operation_id,
    operationName: operationalContext.operation_name,
    operationCode: operationalContext.operation_code,
    operationType: operationalContext.operation_type
  }
}

async function queueEvidencePipeline(
  client,
  {
    tenantId,
    evidenceId,
    createdBy,
    source = 'manual',
    force = false,
    priority = 90
  }
) {
  if (force) {
    await cancelActiveJobsForEvidence(client, evidenceId, 'force reprocess')
  }

  return enqueueEvidenceAiJob(
    client,
    tenantId,
    evidenceId,
    'extract_document',
    { source, force },
    priority,
    createdBy || null
  )
}

// =============================
// Subir evidencia
// =============================
router.post('/upload', auth, evidenceUpload, async (req, res) => {
  const client = await pool.connect()

  try {
    const {
      tenant_id,
      control_id,
      tenant_control_id,
      action_plan_id,
      description,
      evidence_type,
      expires_at
    } = req.body

    if (!tenant_id) {
      return res.status(400).json({
        error: 'tenant_id es obligatorio'
      })
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Debes seleccionar un archivo'
      })
    }

    if (!tenant_control_id && !control_id && !action_plan_id) {
      return res.status(400).json({
        error: 'Debes enviar tenant_control_id, control_id o action_plan_id'
      })
    }

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({
        error: 'No autorizado para este tenant'
      })
    }

    await client.query('BEGIN')

    const resolved = await resolveUploadContext({
      db: client,
      tenantId: tenant_id,
      controlId: control_id,
      tenantControlId: tenant_control_id,
      actionPlanId: action_plan_id
    })

    const metadata = {
      action_plan_id: resolved.actionPlanId || null,
      uploaded_from: resolved.actionPlanId ? 'action_plan' : 'evidences',
      iso: resolved.iso || null,
      clause: resolved.clause || null,
      control_description: resolved.controlDescription || null,
      operation_id: resolved.operationId || null,
      operation_name: resolved.operationName || null,
      operation_code: resolved.operationCode || null,
      operation_type: resolved.operationType || null
    }

    const result = await client.query(
      `
      INSERT INTO evidences (
        tenant_id,
        control_id,
        tenant_control_id,
        description,
        file_name,
        file_path,
        file_mime_type,
        file_size_bytes,
        status,
        validated,
        expires_at,
        evidence_type,
        metadata,
        content_fingerprint,
        document_extraction_status,
        ai_analysis_status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,'pendiente',false,$9,$10,$11::jsonb,
        md5(COALESCE($6,'') || '|' || COALESCE($5,'') || '|' || COALESCE($4,'')),
        'pending',
        'pending'
      )
      RETURNING *
      `,
      [
        tenant_id,
        resolved.catalogControlId,
        resolved.tenantControlId,
        description || 'Evidencia subida',
        req.file.originalname || null,
        req.file.filename || null,
        req.file.mimetype || null,
        req.file.size || null,
        expires_at || null,
        evidence_type || 'documento',
        JSON.stringify(metadata)
      ]
    )

    const created = result.rows[0]

    await touchLinkedActionPlanForEvidence(client, created)

    const jobId = await queueEvidencePipeline(client, {
      tenantId: tenant_id,
      evidenceId: created.id,
      createdBy: getUserId(req.user),
      source: resolved.actionPlanId ? 'action_plan_upload' : 'evidence_upload',
      force: false,
      priority: 95
    })

    await client.query('COMMIT')

    return res.json({
      ...created,
      ai_queue_job_id: jobId
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('UPLOAD ERROR:', err)
    return res.status(500).json({
      error: 'Error subiendo evidencia'
    })
  } finally {
    client.release()
  }
})

// =============================
// Validar / marcar para reanálisis
// =============================
router.put('/validate/:id', auth, async (req, res) => {
  const client = await pool.connect()

  try {
    const current = await getEvidenceById(client, req.params.id)

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Evidencia no encontrada' })
    }

    const evidence = current.rows[0]

    if (!ensureTenantAccess(req, evidence.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    await client.query('BEGIN')

    await client.query(
      `
      UPDATE evidences
      SET
        validated = true,
        ai_analysis_status = 'pending',
        ai_last_error = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE id = $1
      `,
      [
        req.params.id,
        JSON.stringify({
          ai_reprocess_reason: 'manual_validate'
        })
      ]
    )

    const jobId = await enqueueEvidenceAiJob(
      client,
      evidence.tenant_id,
      evidence.id,
      'analyze_evidence',
      { source: 'validate', force: true },
      85,
      getUserId(req.user)
    )

    await client.query('COMMIT')

    return res.json({
      success: true,
      evidence_id: evidence.id,
      ai_queue_job_id: jobId
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR VALIDATE EVIDENCE:', err)
    return res.status(500).json({ error: 'Error validando evidencia' })
  } finally {
    client.release()
  }
})

// =============================
// Reprocesar IA
// =============================
router.post('/reprocess-ai/:id', auth, async (req, res) => {
  const client = await pool.connect()

  try {
    const current = await getEvidenceById(client, req.params.id)

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Evidencia no encontrada' })
    }

    const evidence = current.rows[0]

    if (!ensureTenantAccess(req, evidence.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    await client.query('BEGIN')

    await client.query(
      `
      UPDATE evidences
      SET
        document_extraction_status = 'pending',
        ai_analysis_status = 'pending',
        ai_last_error = NULL
      WHERE id = $1
      `,
      [evidence.id]
    )

    const jobId = await queueEvidencePipeline(client, {
      tenantId: evidence.tenant_id,
      evidenceId: evidence.id,
      createdBy: getUserId(req.user),
      source: 'manual_reprocess',
      force: true,
      priority: 100
    })

    await client.query('COMMIT')

    return res.json({
      success: true,
      evidence_id: evidence.id,
      ai_queue_job_id: jobId
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR REPROCESS EVIDENCE AI:', err)
    return res.status(500).json({
      error: 'Error reprocesando evidencia en IA'
    })
  } finally {
    client.release()
  }
})

// =============================
// Procesar jobs IA manualmente
// =============================
router.post('/jobs/process-next', auth, async (req, res) => {
  try {
    if (!canProcessAiJobs(req)) {
      return res.status(403).json({ error: 'No autorizado para procesar jobs IA' })
    }

    const limit = Math.max(1, Math.min(20, Number(req.body?.limit || 1)))
    const processed = await processEvidenceAiJobs(
      limit,
      `manual-api-${getUserId(req.user) || 'unknown'}`
    )

    return res.json({
      ok: true,
      processed_count: processed.length,
      processed
    })
  } catch (err) {
    console.error('ERROR PROCESS EVIDENCE AI JOBS:', err)
    return res.status(500).json({
      error: 'Error procesando jobs IA'
    })
  }
})

router.get('/jobs/:tenant_id', auth, async (req, res) => {
  try {
    const { tenant_id } = req.params

    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    const result = await pool.query(
      `
      SELECT
        j.*,
        e.file_name,
        e.description
      FROM evidence_ai_jobs j
      JOIN evidences e
        ON e.id = j.evidence_id
      WHERE j.tenant_id = $1
      ORDER BY j.created_at DESC
      LIMIT 100
      `,
      [tenant_id]
    )

    return res.json(result.rows)
  } catch (err) {
    console.error('ERROR LIST EVIDENCE AI JOBS:', err)
    return res.status(500).json({
      error: 'Error listando jobs IA'
    })
  }
})

// =============================
// Aprobar / rechazar
// =============================
router.put('/approve/:id', auth, async (req, res) => {
  const client = await pool.connect()

  try {
    const { status, rejection_reason } = req.body || {}
    const normalizedStatus = normalizeEvidenceStatus(status)

    const current = await getEvidenceById(client, req.params.id)

    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Evidencia no encontrada' })
    }

    const evidence = current.rows[0]

    if (!canReviewEvidence(req, evidence.tenant_id)) {
      return res.status(403).json({
        error: 'No autorizado para aprobar o rechazar esta evidencia'
      })
    }

    await client.query('BEGIN')

    const mergedMetadata = deepMerge(safeObject(evidence.metadata), {
      reviewed_from: 'evidences',
      last_review_status: normalizedStatus,
      manual_review: {
        review_mode: 'manual',
        reviewed_by: getUserId(req.user),
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejection_reason || null
      }
    })

    const update = await client.query(
      `
      UPDATE evidences
      SET
        status = $1,
        validated = CASE WHEN $1 = 'aprobada' THEN true ELSE validated END,
        reviewed_by = $2,
        reviewed_at = NOW(),
        rejection_reason = CASE
          WHEN $1 = 'rechazada' THEN $3
          ELSE NULL
        END,
        ai_analysis_status = 'pending',
        ai_last_error = NULL,
        metadata = $4::jsonb
      WHERE id = $5
      RETURNING *
      `,
      [
        normalizedStatus,
        getUserId(req.user),
        rejection_reason || null,
        JSON.stringify(mergedMetadata),
        req.params.id
      ]
    )

    await touchLinkedActionPlanForEvidence(client, update.rows[0])
    await refreshHealthForTenant(client, evidence.tenant_id)

    const jobId = await enqueueEvidenceAiJob(
      client,
      evidence.tenant_id,
      evidence.id,
      'analyze_evidence',
      {
        source: 'review',
        reviewed_status: normalizedStatus
      },
      90,
      getUserId(req.user)
    )

    await client.query('COMMIT')

    return res.json({
      success: true,
      evidence_id: evidence.id,
      ai_queue_job_id: jobId
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('ERROR APPROVE EVIDENCE:', err)
    return res.status(500).json({ error: 'Error revisando evidencia' })
  } finally {
    client.release()
  }
})

// =============================
// Descargar archivo de evidencia con autorización tenant
// =============================
router.get('/file/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, tenant_id, file_name, file_path, file_mime_type
      FROM evidences
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [req.params.id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Evidencia no encontrada' })
    }

    const evidence = result.rows[0]

    if (!ensureTenantAccess(req, evidence.tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    const resolvedPath = resolveEvidenceFilePath(evidence.file_path)

    if (!resolvedPath) {
      return res.status(404).json({ error: 'Archivo de evidencia no encontrado' })
    }

    if (evidence.file_mime_type) {
      res.setHeader('Content-Type', evidence.file_mime_type)
    }

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(evidence.file_name || path.basename(resolvedPath)).replace(/"/g, '')}"`
    )

    return res.sendFile(resolvedPath)
  } catch (err) {
    console.error('ERROR DOWNLOAD EVIDENCE FILE:', err)
    return res.status(500).json({ error: 'Error descargando evidencia' })
  }
})

// =============================
// Listar evidencias
// filtros:
// - iso
// - status
// - tenant_control_id
// - action_plan_id
// =============================


// =====================================================
// Marcar evidencia integrada como evidencia oficial
// =====================================================
router.post('/:id/mark-official', auth, async (req, res) => {
  const client = await pool.connect();

  try {
    const evidenceId = req.params.id;
    const tenantId = req.body?.tenant_id || req.query?.tenant_id || getUserTenantId(req.user);
    const userId = getUserId(req.user);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id requerido' });
    }

    if (!ensureTenantAccess(req, tenantId)) {
      return res.status(403).json({ error: 'Sin acceso al tenant indicado' });
    }

    if (!canReviewEvidence(req, tenantId)) {
      return res.status(403).json({ error: 'Usuario no autorizado para oficializar evidencias' });
    }

    await client.query('BEGIN');

    const evidenceResult = await client.query(
      `
      SELECT
        e.*
      FROM evidences e
      WHERE e.id = $1
        AND e.tenant_id = $2
      FOR UPDATE OF e
      `,
      [evidenceId, tenantId]
    );

    if (evidenceResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Evidencia no encontrada' });
    }

    const evidence = evidenceResult.rows[0];

    if (String(evidence.evidence_type || '').toLowerCase() !== 'documento_integrado') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Solo las evidencias integradas pueden marcarse como oficiales por este flujo'
      });
    }

    if (!evidence.tenant_control_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'La evidencia no tiene tenant_control_id asociado'
      });
    }

    const controlResult = await client.query(
      `
      SELECT id
      FROM tenant_controls
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [evidence.tenant_control_id, tenantId]
    );

    if (controlResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'El control asociado no pertenece al tenant indicado'
      });
    }

    if (String(evidence.status || '').toLowerCase() !== 'aprobada' || evidence.validated !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'La evidencia debe estar aprobada y validada antes de oficializarse'
      });
    }

    const metadata = safeObject(evidence.metadata);
    const now = new Date().toISOString();

    const updatedMetadata = deepMerge(metadata, {
      official_evidence: true,
      officialized_at: now,
      officialized_by_user_id: userId,
      official_source: 'control_workbench',
      official_scope: {
        tenant_control_id: evidence.tenant_control_id,
        control_id: evidence.control_id || null,
        source_document_id: metadata.source_document_id || null,
        source_suggestion_id: metadata.source_suggestion_id || null,
        suggested_standard_code: metadata.suggested_standard_code || null,
        suggested_control_ref: metadata.suggested_control_ref || null
      }
    });

    const updatedEvidenceResult = await client.query(
      `
      UPDATE evidences
      SET
        metadata = $1::jsonb,
        reviewed_by = COALESCE(reviewed_by, $2),
        reviewed_at = COALESCE(reviewed_at, NOW()),
        status = 'aprobada',
        validated = true
      WHERE id = $3
        AND tenant_id = $4
      RETURNING *
      `,
      [JSON.stringify(updatedMetadata), userId, evidenceId, tenantId]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      evidence: updatedEvidenceResult.rows[0],
      message: 'Evidencia marcada como oficial del control'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR MARK EVIDENCE OFFICIAL:', err);
    return res.status(500).json({
      error: 'No fue posible marcar la evidencia como oficial',
      detail: err.message
    });
  } finally {
    client.release();
  }
});


router.post('/:id/ai-review', auth, async (req, res) => {
  try {
    const evidenceId = req.params.id
    const requestedTenantId = req.body?.tenant_id || req.query?.tenant_id || getUserTenantId(req.user)

    if (!requestedTenantId) {
      return res.status(400).json({ ok: false, error: 'tenant_id requerido' })
    }

    if (!ensureTenantAccess(req, requestedTenantId)) {
      return res.status(403).json({ ok: false, error: 'Sin acceso al tenant indicado' })
    }

    const evidenceResult = await pool.query(
      `
      SELECT *
      FROM evidences
      WHERE id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [evidenceId, requestedTenantId]
    )

    if (evidenceResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Evidencia no encontrada' })
    }

    const evidence = evidenceResult.rows[0]
    const tenantId = requestedTenantId

    const context = evidence.tenant_control_id
      ? await aiContextBuilder.buildAiControlContext({
          tenantId,
          tenantControlId: evidence.tenant_control_id,
          standardCode: req.body?.standard_code || null,
          operationId: req.body?.operation_id || null
        })
      : await aiContextBuilder.buildAiEvidenceContext({ tenantId, evidenceId })

    context.scope.evidence_id = evidenceId
    context.recent_evidences = [evidence, ...(context.recent_evidences || [])].slice(0, 10)

    const aiResult = await runOperationalAiReview({
      tenantId,
      moduleOrigin: 'evidencias',
      taskType: 'evidence_review',
      context,
      body: req.body || {},
      entityLabel: `evidencia ${evidence.file_name || evidence.title || evidenceId}`,
      defaultQuestion: 'Evalúa si esta evidencia sustenta cumplimiento, si puede oficializarse y qué le falta para auditoría.'
    })

    return res.json({
      ...aiResult,
      tenant_id: tenantId,
      evidence_id: evidenceId
    })
  } catch (err) {
    console.error('ERROR EVIDENCE AI REVIEW:', err)
    return res.status(500).json({ ok: false, error: 'Error ejecutando revisión IA de evidencia' })
  }
})


router.get('/:tenant_id', auth, async (req, res) => {
  const client = await pool.connect()

  try {
    const { tenant_id } = req.params
    const { iso, status, tenant_control_id, action_plan_id } = req.query
    // Bypass seguro para vista Controles:
    // cuando se solicita por tenant_control_id, devolver evidencias asociadas directamente
    // sin depender de joins legacy por control_id.
    if (tenant_control_id) {
      if (!ensureTenantAccess(req, tenant_id)) {
        return res.status(403).json({ error: 'No autorizado para este tenant' })
      }

      const directParams = [tenant_id, tenant_control_id]
      let directWhere = `
        WHERE e.tenant_id = $1
          AND e.tenant_control_id = $2
      `

      if (status) {
        directParams.push(status)
        directWhere += ` AND LOWER(COALESCE(e.status, 'pendiente')) = LOWER($${directParams.length})`
      }

      const directResult = await pool.query(
        `
        SELECT
          e.*,
          e.metadata->>'web_view_url' AS web_view_url,
          e.metadata->>'source_document_id' AS source_document_id,
          e.metadata->>'source_suggestion_id' AS source_suggestion_id,
          e.metadata->>'suggested_standard_code' AS suggested_standard_code,
          e.metadata->>'suggested_control_ref' AS suggested_control_ref,
          e.metadata->>'control_description' AS metadata_control_description,
          e.metadata->>'source_name' AS source_name,
          e.metadata->>'folder_path' AS folder_path,
          NULL AS reviewed_by_label,
          NULL AS action_plan_title
        FROM evidences e
        ${directWhere}
        ORDER BY e.created_at DESC
        `,
        directParams
      )

      return res.json(directResult.rows)
    }


    if (!ensureTenantAccess(req, tenant_id)) {
      return res.status(403).json({ error: 'No autorizado para este tenant' })
    }

    await client.query('BEGIN')

    await recommendEligibleEvidences(client, tenant_id, {
      iso: iso || null,
      tenantControlId: tenant_control_id || null,
      actionPlanId: action_plan_id || null
    })

    let query = `
      SELECT
        e.*,
        ctx.iso,
        ctx.clause,
        ctx.category,
        ctx.control_description,
        ctx.operation_id,
        ctx.operation_name,
        ctx.operation_code,
        ctx.operation_type,
        ap_link.id AS action_plan_id,
        ap_link.title AS action_plan_title,
        ap_link.status AS action_plan_status,
        ap_link.priority AS action_plan_priority,
        CASE
          WHEN e.metadata->>'action_plan_id' = ap_link.id::text THEN TRUE
          ELSE FALSE
        END AS linked_to_this_plan,
        ext.id AS extract_id,
        ext.extraction_status,
        ext.file_type,
        ext.mime_type,
        ext.text_char_count,
        ext.ocr_used,
        ext.detected_language,
        ext.page_count,
        ext.sheet_count,
        ext.image_count,
        ai.id AS assessment_id,
        ai.analysis_status,
        ai.validity_result,
        ai.contribution_level,
        ai.pertinence_score,
        ai.sufficiency_score,
        ai.freshness_score,
        ai.traceability_score,
        ai.consistency_score,
        ai.compliance_impact_score,
        ai.recommended_standard_code,
        ai.recommended_clause,
        ai.recommended_control_id,
        ai.headline AS ai_headline,
        ai.narrative AS ai_narrative,
        ai.risks_json AS ai_risks,
        ai.next_steps_json AS ai_next_steps,
        ai.extracted_entities_json AS ai_entities,
        ai.control_fit,
        ai.gap_summary,
        ai.appears_expired,
        ai.appears_complete,
        ai.appears_authentic,
        ai.ai_trace_id,
        ai.ai_source_level,
        ai.ai_source_label,
        ai.ai_confidence,
        ai.ai_confidence_score,
        ai.ai_orchestration_json,
        ai.ai_enhanced_answer_json,
        ai.analyzed_at,
        COALESCE(
          NULLIF(e.metadata->'ai_auto_review'->>'acceptance_pct', '')::numeric,
          ROUND(
            (
              COALESCE(ai.pertinence_score, 0)::numeric * 0.15 +
              COALESCE(ai.sufficiency_score, 0)::numeric * 0.25 +
              COALESCE(ai.freshness_score, 0)::numeric * 0.10 +
              COALESCE(ai.traceability_score, 0)::numeric * 0.20 +
              COALESCE(ai.consistency_score, 0)::numeric * 0.10 +
              COALESCE(ai.compliance_impact_score, 0)::numeric * 0.20
            ),
            2
          )
        ) AS ai_acceptance_pct,
        COALESCE(
          (e.metadata->'ai_auto_review'->>'auto_approved')::boolean,
          FALSE
        ) AS auto_approved_by_ai,
        COALESCE(
          e.metadata->'ai_recommendation'->>'recommendation' = 'approve',
          FALSE
        ) AS ai_recommended_by_ai,
        e.metadata->'ai_auto_review'->>'reason' AS ai_auto_review_reason,
        e.metadata->'ai_auto_review'->>'approved_at' AS ai_auto_approved_at,
        e.metadata->'ai_recommendation'->>'reason' AS ai_recommendation_reason,
        e.metadata->'ai_recommendation'->>'recommended_at' AS ai_recommended_at,
        COALESCE(
          NULLIF(TRIM(u.full_name), ''),
          NULLIF(TRIM(u.name), ''),
          u.email,
          CASE
            WHEN COALESCE((e.metadata->'ai_auto_review'->>'auto_approved')::boolean, FALSE)
              THEN 'IA automática'
            ELSE NULL
          END
        ) AS reviewed_by_label
      FROM evidences e
      LEFT JOIN LATERAL (
        SELECT
          tc.id AS tenant_control_id,
          tc.control_id AS catalog_control_id,
          tc.operation_id,
          tc.status AS tenant_control_status,
          cc.iso,
          cc.clause,
          cc.category,
          cc.description AS control_description,
          op.name AS operation_name,
          op.code AS operation_code,
          op.operation_type
        FROM tenant_controls tc
        JOIN controls_catalog cc
          ON cc.id = tc.control_id
         AND cc.is_active = TRUE
        JOIN tenant_operations op
          ON op.id = tc.operation_id
         AND op.tenant_id = tc.tenant_id
         AND op.is_active = TRUE
        JOIN tenant_standard_operations tso
          ON tso.tenant_id = tc.tenant_id
         AND tso.standard_code = cc.iso
         AND tso.operation_id = tc.operation_id
         AND tso.is_active = TRUE
        JOIN tenant_standards ts
          ON ts.tenant_id = tc.tenant_id
         AND ts.standard_code = cc.iso
         AND ts.is_active = TRUE
        WHERE tc.tenant_id = e.tenant_id
          AND (
            tc.id = e.tenant_control_id
            OR (
              e.tenant_control_id IS NULL
              AND e.control_id IS NOT NULL
              AND tc.control_id = e.control_id
            )
          )
        ORDER BY
          CASE WHEN tc.id = e.tenant_control_id THEN 0 ELSE 1 END,
          op.is_default DESC,
          op.sort_order ASC,
          tc.created_at ASC
        LIMIT 1
      ) ctx ON TRUE
      LEFT JOIN vw_evidence_current_extracts ext
        ON ext.evidence_id = e.id
      LEFT JOIN vw_evidence_current_ai_assessments ai
        ON ai.evidence_id = e.id
      LEFT JOIN users u
        ON u.id = e.reviewed_by
      LEFT JOIN LATERAL (
        SELECT
          ap.id,
          ap.title,
          ap.status,
          ap.priority
        FROM action_plans ap
        WHERE ap.tenant_id = e.tenant_id
          AND (
            ap.id::text = e.metadata->>'action_plan_id'
            OR (
              e.tenant_control_id IS NOT NULL
              AND ap.tenant_control_id = e.tenant_control_id
            )
          )
        ORDER BY
          CASE
            WHEN ap.id::text = e.metadata->>'action_plan_id' THEN 0
            ELSE 1
          END,
          ap.updated_at DESC,
          ap.created_at DESC
        LIMIT 1
      ) ap_link ON TRUE
      WHERE e.tenant_id = $1
        AND ctx.catalog_control_id IS NOT NULL
    `

    const params = [tenant_id]
    let idx = 2

    if (iso) {
      query += ` AND ctx.iso = $${idx}`
      params.push(iso)
      idx += 1
    }

    if (status) {
      query += ` AND LOWER(COALESCE(e.status, '')) = LOWER($${idx})`
      params.push(normalizeEvidenceStatus(status))
      idx += 1
    }

    if (tenant_control_id) {
      query += ` AND e.tenant_control_id = $${idx}`
      params.push(tenant_control_id)
      idx += 1
    }

    if (action_plan_id) {
      query += `
        AND (
          e.metadata->>'action_plan_id' = $${idx}
          OR ap_link.id::text = $${idx}
        )
      `
      params.push(action_plan_id)
      idx += 1
    }

    query += ` ORDER BY e.created_at DESC`

    const result = await client.query(query, params)

    await client.query('COMMIT')

    return res.json(result.rows)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('GET ERROR:', err)
    return res.status(500).json({
      error: 'Error listando evidencias'
    })
  } finally {
    client.release()
  }
})

module.exports = router
