const pool = require('../config/db')

function toText(value) {
  return String(value || '').trim()
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function inferDocumentType({ fileName, mimeType }) {
  const name = toText(fileName).toLowerCase()
  const mime = toText(mimeType).toLowerCase()

  if (name.includes('politica') || name.includes('política') || name.includes('policy')) return 'policy'
  if (name.includes('procedimiento') || name.includes('procedure')) return 'procedure'
  if (name.includes('registro') || name.includes('record')) return 'record'
  if (name.includes('auditoria') || name.includes('auditoría') || name.includes('audit')) return 'audit_report'
  if (name.includes('riesgo') || name.includes('risk')) return 'risk_document'
  if (name.includes('accion correctiva') || name.includes('acción correctiva') || name.includes('corrective')) return 'evidence'
  if (mime.includes('folder')) return 'folder'
  return 'unknown'
}

function inferStandardCode({ fileName, metadataText }) {
  const text = `${fileName || ''} ${metadataText || ''}`.toLowerCase()

  if (text.includes('iso27001') || text.includes('27001')) return 'ISO27001:2022'
  if (text.includes('iso9001') || text.includes('9001')) return 'ISO9001:2015'
  if (text.includes('iso42001') || text.includes('42001')) return 'ISO42001:2023'
  if (text.includes('bcp') || text.includes('drp') || text.includes('continuidad')) return 'ISO22301:2019'

  return null
}

function inferEvidenceQuality({ documentType, mimeType, fileName }) {
  const mime = toText(mimeType).toLowerCase()
  const name = toText(fileName).toLowerCase()

  if (documentType === 'folder') return 'insufficient'
  if (documentType === 'unknown') return 'low'
  if (mime.includes('pdf') || mime.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) return 'medium'
  if (mime.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.csv')) return 'medium'
  return 'low'
}

function buildMetadataText(document) {
  const metadata = document?.metadata_json || {}
  const owners = Array.isArray(metadata?.google?.owners)
    ? metadata.google.owners.map((owner) => owner.emailAddress || owner.displayName).filter(Boolean).join(', ')
    : ''

  return [
    `Archivo: ${document.file_name || ''}`,
    `MIME: ${document.mime_type || ''}`,
    `Fuente: ${document.source_name || ''}`,
    `Proveedor: ${document.provider || ''}`,
    `Modificado: ${document.modified_at || ''}`,
    `Owner: ${owners}`
  ].filter(Boolean).join('\n')
}

function localHeuristicAnalysis(document) {
  const metadataText = buildMetadataText(document)
  const documentType = inferDocumentType({ fileName: document.file_name, mimeType: document.mime_type })
  const standardCode = inferStandardCode({ fileName: document.file_name, metadataText })
  const evidenceQuality = inferEvidenceQuality({ documentType, mimeType: document.mime_type, fileName: document.file_name })

  const confidence = documentType === 'unknown' ? 0.35 : standardCode ? 0.68 : 0.52
  const missing = []

  if (!standardCode) missing.push('No se detecta norma ISO probable desde nombre o metadata.')
  if (documentType === 'unknown') missing.push('No se pudo clasificar el tipo documental con confianza suficiente.')
  if (!document.modified_at) missing.push('No se detecta fecha de modificación en metadata.')
  if (document.mime_type === 'application/vnd.google-apps.folder') missing.push('La carpeta no es una evidencia documental directa; requiere analizar sus archivos internos.')

  return {
    document_type: documentType,
    standards: standardCode ? [standardCode] : [],
    suggested_controls: [],
    suggested_targets: [],
    summary: `Análisis preliminar basado en metadata. Documento "${document.file_name}" clasificado como ${documentType}.`,
    evidence_quality: evidenceQuality,
    missing_elements: missing,
    recommended_actions: [
      'Revisar manualmente antes de asociar a controles o evidencias formales.',
      'Ejecutar extracción de texto en la siguiente subfase para mejorar precisión.',
      standardCode ? `Validar si corresponde a ${standardCode}.` : 'Confirmar la norma ISO aplicable.'
    ],
    confidence_score: confidence,
    requires_review: true,
    analysis_source: 'backend_metadata_fallback'
  }
}

function normalizeAiResponse(raw, document) {
  const fallback = localHeuristicAnalysis(document)
  const response = raw && typeof raw === 'object' ? raw : {}

  const standards = Array.isArray(response.standards)
    ? response.standards.filter(Boolean).map(String)
    : response.detected_standard_code
      ? [String(response.detected_standard_code)]
      : fallback.standards

  return {
    document_type: toText(response.document_type || response.detected_document_type || fallback.document_type),
    standards,
    suggested_controls: Array.isArray(response.suggested_controls) ? response.suggested_controls : [],
    suggested_targets: Array.isArray(response.suggested_targets) ? response.suggested_targets : [],
    summary: toText(response.summary || fallback.summary),
    evidence_quality: toText(response.evidence_quality || fallback.evidence_quality),
    missing_elements: Array.isArray(response.missing_elements) ? response.missing_elements : fallback.missing_elements,
    recommended_actions: Array.isArray(response.recommended_actions) ? response.recommended_actions : fallback.recommended_actions,
    confidence_score: clamp01(response.confidence_score ?? response.confidence ?? fallback.confidence_score),
    requires_review: response.requires_review !== false,
    analysis_source: response.analysis_source || response.source || fallback.analysis_source,
    raw_response: response
  }
}

async function callAiEngine(payload, document) {
  const aiEngineUrl = toText(process.env.AI_ENGINE_URL || process.env.AI_ENGINE_BASE_URL)
  const token = process.env.AI_INTERNAL_TOKEN || process.env.OWN_AI_SHARED_SECRET || process.env.AI_TOKEN || ''

  if (!aiEngineUrl) {
    return normalizeAiResponse({ ...localHeuristicAnalysis(document), ai_engine_skipped: true }, document)
  }

  try {
    const res = await fetch(`${aiEngineUrl.replace(/\/$/, '')}/api/ai-compliance/analyze-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-AI-Token': token } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    if (!res.ok) {
      return normalizeAiResponse({
        ...localHeuristicAnalysis(document),
        ai_engine_status: res.status,
        ai_engine_error: 'AI engine analyze-document unavailable'
      }, document)
    }

    const json = await res.json()
    return normalizeAiResponse({ ...json, analysis_source: 'ai_engine' }, document)
  } catch (err) {
    return normalizeAiResponse({
      ...localHeuristicAnalysis(document),
      ai_engine_error: err.message,
      analysis_source: 'backend_metadata_fallback_after_ai_error'
    }, document)
  }
}

async function getActiveStandards(tenantId) {
  try {
    const result = await pool.query(
      `
      SELECT standard_code
      FROM tenant_standards
      WHERE tenant_id = $1
        AND COALESCE(is_active, true) = true
      ORDER BY standard_code
      `,
      [tenantId]
    )
    return result.rows.map((row) => row.standard_code).filter(Boolean)
  } catch (_err) {
    return []
  }
}

async function analyzeDocument({ tenantId, documentId, userId = null }) {
  const docResult = await pool.query(
    `
    SELECT d.*, s.source_name, i.provider_account_email
    FROM document_index d
    LEFT JOIN tenant_document_sources s
      ON s.id = d.source_id
     AND s.tenant_id = d.tenant_id
    LEFT JOIN tenant_integrations i
      ON i.id = d.integration_id
     AND i.tenant_id = d.tenant_id
    WHERE d.id = $1
      AND d.tenant_id = $2
    LIMIT 1
    `,
    [documentId, tenantId]
  )

  if (docResult.rowCount === 0) {
    const err = new Error('Documento indexado no encontrado')
    err.statusCode = 404
    throw err
  }

  const document = docResult.rows[0]
  const metadataText = buildMetadataText(document)
  const activeStandards = await getActiveStandards(tenantId)

  const payload = {
    tenant_id: tenantId,
    document_id: document.id,
    file_name: document.file_name,
    mime_type: document.mime_type,
    text: metadataText,
    metadata: {
      provider: document.provider,
      source_id: document.source_id,
      source_name: document.source_name,
      provider_file_id: document.provider_file_id,
      modified_at: document.modified_at,
      size_bytes: safeNumber(document.size_bytes, null),
      metadata_json: document.metadata_json || {},
      extraction_stage: 'metadata_only'
    },
    active_standards: activeStandards,
    available_controls: []
  }

  const normalized = await callAiEngine(payload, document)
  const detectedStandard = normalized.standards[0] || inferStandardCode({ fileName: document.file_name, metadataText })
  const detectedControls = normalized.suggested_controls
    .map((item) => item?.control_ref || item?.control_id || item?.ref || null)
    .filter(Boolean)

  const insert = await pool.query(
    `
    INSERT INTO document_ai_analysis (
      tenant_id,
      document_id,
      detected_document_type,
      detected_standard_code,
      detected_control_refs,
      summary,
      extracted_keywords,
      confidence_score,
      evidence_quality,
      missing_elements,
      recommended_actions,
      analysis_json,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5::text[],$6,$7::text[],$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,NOW())
    RETURNING *
    `,
    [
      tenantId,
      document.id,
      normalized.document_type,
      detectedStandard || null,
      detectedControls,
      normalized.summary,
      [document.file_extension, document.mime_type, document.source_name, detectedStandard].filter(Boolean).map(String),
      normalized.confidence_score,
      normalized.evidence_quality,
      JSON.stringify(normalized.missing_elements || []),
      JSON.stringify(normalized.recommended_actions || []),
      JSON.stringify({
        stage: 'etapa_3_1_metadata_analysis',
        created_by_user_id: userId,
        requires_review: true,
        no_auto_approval: true,
        no_evidence_created: true,
        payload_summary: payload,
        normalized,
        raw_response: normalized.raw_response || null
      })
    ]
  )

  return {
    ok: true,
    document,
    analysis: insert.rows[0]
  }
}

async function listDocumentAnalysis({ tenantId, documentId, limit = 20 }) {
  const result = await pool.query(
    `
    SELECT *
    FROM document_ai_analysis
    WHERE tenant_id = $1
      AND document_id = $2
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [tenantId, documentId, Math.max(1, Math.min(50, Number(limit || 20)))]
  )

  return result.rows
}

module.exports = {
  analyzeDocument,
  listDocumentAnalysis
}
