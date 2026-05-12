const pool = require('../config/db')
const { extractDocumentContent } = require('./documentContentExtraction.service')

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

function sanitizeDocumentForResponse(document) {
  if (!document || typeof document !== 'object') return document

  const clone = { ...document }
  delete clone.encrypted_access_token
  delete clone.encrypted_refresh_token
  delete clone.token_expires_at

  return clone
}


function normalizeStandardCode(value) {
  const raw = toText(value)
  const compact = raw.toUpperCase().replace(/[\s_:-]/g, '')

  if (compact.includes('27001')) return 'ISO27001:2022'
  if (compact.includes('9001')) return 'ISO9001:2015'
  if (compact.includes('42001')) return 'ISO42001:2023'
  if (compact.includes('22301')) return 'ISO22301:2019'
  if (compact.includes('14001')) return 'ISO14001:2015'
  if (compact.includes('37001')) return 'ISO37001:2016'
  if (compact.includes('50001')) return 'ISO50001:2018'

  return raw || null
}

function expandStandardCodes(standards = []) {
  const expanded = new Set()

  for (const item of standards || []) {
    const raw = toText(item)
    const normalized = normalizeStandardCode(raw)

    if (raw) expanded.add(raw)
    if (normalized) expanded.add(normalized)

    if (normalized === 'ISO9001:2015') {
      expanded.add('ISO9001')
      expanded.add('ISO 9001')
      expanded.add('9001')
    }

    if (normalized === 'ISO27001:2022') {
      expanded.add('ISO27001')
      expanded.add('ISO 27001')
      expanded.add('27001')
    }

    if (normalized === 'ISO42001:2023') {
      expanded.add('ISO42001')
      expanded.add('ISO 42001')
      expanded.add('42001')
    }
  }

  return Array.from(expanded).filter(Boolean)
}

function normalizeControlRef(value) {
  return toText(value)
    .replace(/^control\s+/i, '')
    .replace(/^cl[aá]usula\s+/i, '')
    .trim()
}

function normalizeConfidence(value, fallback = 0.5) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n > 1) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

function buildControlSuggestionCandidates(normalized) {
  const candidates = []
  const seen = new Set()

  const pushCandidate = (item = {}, source = 'unknown') => {
    const targetType = toText(item.target_type || 'control') || 'control'
    if (targetType !== 'control') return

    const standardCode = normalizeStandardCode(
      item.standard_code ||
      item.suggested_standard_code ||
      item.iso ||
      item.standard ||
      (Array.isArray(normalized?.standards) ? normalized.standards[0] : null)
    )

    const controlRef = normalizeControlRef(
      item.control_ref ||
      item.suggested_control_ref ||
      item.control_id ||
      item.ref ||
      item.clause ||
      item.control_code
    )

    if (!standardCode || !controlRef) return

    const key = `${standardCode}::${controlRef}`
    if (seen.has(key)) return
    seen.add(key)

    candidates.push({
      target_type: 'control',
      target_id: item.target_id || null,
      suggested_standard_code: standardCode,
      suggested_control_ref: controlRef,
      suggested_reason:
        toText(item.reason || item.suggested_reason || item.title || item.description) ||
        'Sugerencia generada por análisis documental IA.',
      confidence_score: normalizeConfidence(item.confidence ?? item.confidence_score, normalized?.confidence_score || 0.5),
      source
    })
  }

  if (Array.isArray(normalized?.suggested_controls)) {
    for (const item of normalized.suggested_controls) {
      pushCandidate(item, 'suggested_controls')
    }
  }

  if (Array.isArray(normalized?.suggested_targets)) {
    for (const item of normalized.suggested_targets) {
      pushCandidate(item, 'suggested_targets')
    }
  }

  return candidates
}

async function createPendingControlSuggestions({ tenantId, documentId, analysisId, normalized, userId = null }) {
  const candidates = buildControlSuggestionCandidates(normalized)

  if (candidates.length === 0) {
    return []
  }

  const created = []

  for (const candidate of candidates) {
    const result = await pool.query(
      `
      INSERT INTO document_association_suggestions (
        tenant_id,
        document_id,
        target_type,
        target_id,
        suggested_standard_code,
        suggested_control_ref,
        suggested_reason,
        confidence_score,
        status,
        reviewed_by_user_id,
        reviewed_at,
        created_at
      )
      SELECT
        $1,
        $2,
        'control',
        $3,
        $4,
        $5,
        $6,
        $7,
        'pending',
        NULL,
        NULL,
        NOW()
      WHERE NOT EXISTS (
        SELECT 1
        FROM document_association_suggestions
        WHERE tenant_id = $1
          AND document_id = $2
          AND target_type = 'control'
          AND status = 'pending'
          AND COALESCE(suggested_standard_code, '') = COALESCE($4, '')
          AND COALESCE(suggested_control_ref, '') = COALESCE($5, '')
      )
      RETURNING *
      `,
      [
        tenantId,
        documentId,
        candidate.target_id,
        candidate.suggested_standard_code,
        candidate.suggested_control_ref,
        candidate.suggested_reason,
        candidate.confidence_score
      ]
    )

    if (result.rows[0]) {
      created.push({
        ...result.rows[0],
        analysis_id: analysisId,
        source: candidate.source,
        created_by_user_id: userId
      })
    }
  }

  return created
}

function inferDocumentType({ fileName, mimeType, text = '' }) {
  const haystack = `${fileName || ''} ${mimeType || ''} ${text || ''}`.toLowerCase()

  if (haystack.includes('política') || haystack.includes('politica') || haystack.includes('policy')) return 'policy'
  if (haystack.includes('procedimiento') || haystack.includes('procedure')) return 'procedure'
  if (haystack.includes('registro') || haystack.includes('record') || haystack.includes('listado')) return 'record'
  if (haystack.includes('auditoria') || haystack.includes('auditoría') || haystack.includes('audit')) return 'audit_report'
  if (haystack.includes('riesgo') || haystack.includes('risk')) return 'risk_document'
  if (haystack.includes('accion correctiva') || haystack.includes('acción correctiva') || haystack.includes('corrective')) return 'evidence'
  if (haystack.includes('folder')) return 'folder'
  return 'unknown'
}

function inferStandardCode({ fileName, metadataText, extractedText = '' }) {
  const text = `${fileName || ''} ${metadataText || ''} ${extractedText || ''}`.toLowerCase()

  if (text.includes('iso27001') || text.includes('27001')) return 'ISO27001:2022'
  if (text.includes('iso9001') || text.includes('9001')) return 'ISO9001:2015'
  if (text.includes('iso42001') || text.includes('42001')) return 'ISO42001:2023'
  if (text.includes('bcp') || text.includes('drp') || text.includes('continuidad')) return 'ISO22301:2019'

  return null
}

function inferEvidenceQuality({ documentType, mimeType, fileName, extractedText = '' }) {
  const mime = toText(mimeType).toLowerCase()
  const name = toText(fileName).toLowerCase()
  const textLen = toText(extractedText).length

  if (documentType === 'folder') return 'insufficient'
  if (textLen > 2500 && documentType !== 'unknown') return 'high'
  if (textLen > 400) return 'medium'
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

function localHeuristicAnalysis(document, extractedText = '', extraction = {}) {
  const metadataText = buildMetadataText(document)
  const documentType = inferDocumentType({ fileName: document.file_name, mimeType: document.mime_type, text: extractedText })
  const standardCode = inferStandardCode({ fileName: document.file_name, metadataText, extractedText })
  const evidenceQuality = inferEvidenceQuality({ documentType, mimeType: document.mime_type, fileName: document.file_name, extractedText })

  const hasContent = toText(extractedText).length > 250
  const confidence = hasContent && standardCode ? 0.76 : documentType === 'unknown' ? 0.35 : standardCode ? 0.68 : 0.52
  const missing = []

  if (!standardCode) missing.push('No se detecta norma ISO probable desde nombre, metadata o contenido extraído.')
  if (documentType === 'unknown') missing.push('No se pudo clasificar el tipo documental con confianza suficiente.')
  if (!document.modified_at) missing.push('No se detecta fecha de modificación en metadata.')
  if (document.mime_type === 'application/vnd.google-apps.folder') missing.push('La carpeta no es una evidencia documental directa; requiere analizar sus archivos internos.')
  if (!hasContent) missing.push('No hay texto extraído suficiente; el análisis se mantiene preliminar.')
  if (extraction?.warning) missing.push(`Advertencia de extracción: ${extraction.warning}`)

  return {
    document_type: documentType,
    standards: standardCode ? [standardCode] : [],
    suggested_controls: [],
    suggested_targets: [],
    summary: hasContent
      ? `Análisis preliminar con contenido extraído. Documento "${document.file_name}" clasificado como ${documentType}.`
      : `Análisis preliminar basado en metadata. Documento "${document.file_name}" clasificado como ${documentType}.`,
    evidence_quality: evidenceQuality,
    missing_elements: missing,
    recommended_actions: [
      'Revisar manualmente antes de asociar a controles o evidencias formales.',
      hasContent ? 'Validar si el contenido extraído representa la versión vigente del documento.' : 'Adjuntar o convertir el documento a un formato con texto extraíble.',
      standardCode ? `Validar si corresponde a ${standardCode}.` : 'Confirmar la norma ISO aplicable.',
      'No aprobar cumplimiento automáticamente con este análisis.'
    ],
    confidence_score: confidence,
    requires_review: true,
    analysis_source: hasContent ? 'backend_content_fallback' : 'backend_metadata_fallback'
  }
}

function normalizeAiResponse(raw, document, extractedText = '', extraction = {}) {
  const fallback = localHeuristicAnalysis(document, extractedText, extraction)
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

async function tryAiEngineEndpoint({ baseUrl, path, token, payload }) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-AI-Token': token } : {})
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.AI_ENGINE_ANALYZE_TIMEOUT_MS || 45000))
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`AI engine ${path} HTTP ${res.status}: ${body.slice(0, 200)}`)
    err.status = res.status
    throw err
  }

  return res.json()
}

async function callAiEngine(payload, document, extractedText = '', extraction = {}) {
  const aiEngineUrl = toText(process.env.AI_ENGINE_URL || process.env.AI_ENGINE_BASE_URL)
  const token = process.env.AI_INTERNAL_TOKEN || process.env.OWN_AI_SHARED_SECRET || process.env.AI_TOKEN || ''

  if (!aiEngineUrl) {
    return normalizeAiResponse({ ...localHeuristicAnalysis(document, extractedText, extraction), ai_engine_skipped: true }, document, extractedText, extraction)
  }

  const baseUrl = aiEngineUrl.replace(/\/$/, '')
  const paths = [
    '/api/ai-compliance/analyze-document',
    '/api/ai/analyze-document'
  ]

  const errors = []

  for (const path of paths) {
    try {
      const json = await tryAiEngineEndpoint({ baseUrl, path, token, payload })
      return normalizeAiResponse({ ...json, analysis_source: `ai_engine:${path}` }, document, extractedText, extraction)
    } catch (err) {
      errors.push(err.message)
    }
  }

  return normalizeAiResponse({
    ...localHeuristicAnalysis(document, extractedText, extraction),
    ai_engine_errors: errors,
    analysis_source: 'backend_fallback_after_ai_error'
  }, document, extractedText, extraction)
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

    const rawStandards = result.rows.map((row) => row.standard_code).filter(Boolean)
    return expandStandardCodes(rawStandards)
  } catch (_err) {
    return []
  }
}

async function getAvailableControls(tenantId, standards) {
  const expandedStandards = expandStandardCodes(
    standards && standards.length ? standards : ['ISO9001:2015', 'ISO27001:2022', 'ISO42001:2023']
  )

  try {
    const result = await pool.query(
      `
      SELECT DISTINCT
        COALESCE(ccs.standard_code, cc.standard_code) AS standard_code,
        COALESCE(ccs.clause, cc.clause) AS clause,
        COALESCE(cc.control_code, cc.code, cc.control_ref, COALESCE(ccs.clause, cc.clause)) AS control_code,
        COALESCE(cc.title, cc.name, cc.control_name, '') AS title,
        COALESCE(cc.description, cc.control_description, '') AS description
      FROM controls_catalog cc
      LEFT JOIN controls_catalog_standards ccs
        ON ccs.control_id = cc.id
      WHERE
        COALESCE(ccs.standard_code, cc.standard_code) = ANY($1::text[])
        OR REPLACE(REPLACE(REPLACE(UPPER(COALESCE(ccs.standard_code, cc.standard_code, '')), ':', ''), '-', ''), ' ', '')
           = ANY(
             SELECT REPLACE(REPLACE(REPLACE(UPPER(x), ':', ''), '-', ''), ' ', '')
             FROM unnest($1::text[]) AS x
           )
      ORDER BY
        COALESCE(ccs.standard_code, cc.standard_code),
        COALESCE(ccs.clause, cc.clause),
        COALESCE(cc.control_code, cc.code, cc.control_ref, COALESCE(ccs.clause, cc.clause))
      LIMIT 300
      `,
      [expandedStandards]
    )

    return result.rows.map((row) => ({
      ...row,
      standard_code: normalizeStandardCode(row.standard_code) || row.standard_code,
      control_ref: normalizeControlRef(row.control_code || row.clause)
    }))
  } catch (err) {
    console.error('ERROR LOAD AVAILABLE CONTROLS FOR DOCUMENT AI:', err.message)
    return []
  }
}

async function analyzeDocument({ tenantId, documentId, userId = null }) {
  const docResult = await pool.query(
    `
    SELECT d.*, s.source_name, i.provider_account_email,
           i.encrypted_access_token, i.encrypted_refresh_token, i.token_expires_at
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
  const safeDocument = sanitizeDocumentForResponse(document)
  const metadataText = buildMetadataText(document)
  const activeStandards = await getActiveStandards(tenantId)
  const availableControls = await getAvailableControls(tenantId, activeStandards)

  const extractionResult = await extractDocumentContent({
    document,
    integration: document
  }).catch((err) => ({
    ok: false,
    text: '',
    extraction: {
      method: 'backend_extraction_error',
      warning: err.message
    }
  }))

  const extractedText = toText(extractionResult.text)
  const analysisText = extractedText || metadataText
  const extractionStage = extractedText ? 'content_extracted' : 'metadata_only_fallback'

  const payload = {
    tenant_id: tenantId,
    document_id: document.id,
    file_name: document.file_name,
    mime_type: document.mime_type,
    text: analysisText,
    metadata: {
      provider: document.provider,
      source_id: document.source_id,
      source_name: document.source_name,
      provider_file_id: document.provider_file_id,
      modified_at: document.modified_at,
      size_bytes: safeNumber(document.size_bytes, null),
      metadata_json: document.metadata_json || {},
      extraction_stage: extractionStage,
      extraction: extractionResult.extraction || {}
    },
    active_standards: activeStandards,
    available_controls: availableControls,
    instructions: {
      role: 'senior_iso_auditor',
      requires_review: true,
      no_auto_approval: true,
      no_evidence_created: true,
      use_external_lookup_if_available: true,
      compare_against_iso_best_practices: true,
      detect_probable_document_errors: true,
      return_strict_json: true
    }
  }

  const normalized = await callAiEngine(payload, document, extractedText, extractionResult.extraction || {})
  const detectedStandard = normalized.standards[0] || inferStandardCode({ fileName: document.file_name, metadataText, extractedText })
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
      [document.file_extension, document.mime_type, document.source_name, detectedStandard, extractionStage].filter(Boolean).map(String),
      normalized.confidence_score,
      normalized.evidence_quality,
      JSON.stringify(normalized.missing_elements || []),
      JSON.stringify(normalized.recommended_actions || []),
      JSON.stringify({
        stage: 'etapa_3_4_content_ai_analysis',
        created_by_user_id: userId,
        requires_review: true,
        no_auto_approval: true,
        no_evidence_created: true,
        extraction_stage: extractionStage,
        extraction: extractionResult.extraction || {},
        text_char_count_sent_to_ai: analysisText.length,
        payload_summary: {
          ...payload,
          text: `[omitted ${analysisText.length} chars]`
        },
        normalized,
        raw_response: normalized.raw_response || null
      })
    ]
  )

  const controlSuggestions = await createPendingControlSuggestions({
    tenantId,
    documentId: document.id,
    analysisId: insert.rows[0].id,
    normalized,
    userId
  }).catch((err) => {
    console.error('ERROR CREATE DOCUMENT CONTROL SUGGESTIONS:', err.message)
    return []
  })

  return {
    ok: true,
    document: safeDocument,
    extraction: extractionResult.extraction || {},
    analysis: insert.rows[0],
    suggestions_created: controlSuggestions.length,
    suggestions: controlSuggestions
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
