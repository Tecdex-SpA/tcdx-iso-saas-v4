const { google } = require('googleapis')
const { decryptToken } = require('../utils/cryptoTokens')
const { buildOAuthClientFromTokens } = require('./providers/googleDrive.provider')

const MAX_DOWNLOAD_BYTES = Number(process.env.DOCUMENT_ANALYSIS_MAX_DOWNLOAD_BYTES || 15 * 1024 * 1024)
const MAX_TEXT_CHARS = Number(process.env.DOCUMENT_ANALYSIS_MAX_TEXT_CHARS || 60000)

function safeText(value) {
  return String(value || '').trim()
}

function buildTokensFromIntegration(integration) {
  const tokens = {}
  const accessToken = decryptToken(integration.encrypted_access_token)
  const refreshToken = decryptToken(integration.encrypted_refresh_token)

  if (accessToken) tokens.access_token = accessToken
  if (refreshToken) tokens.refresh_token = refreshToken
  if (integration.token_expires_at) tokens.expiry_date = new Date(integration.token_expires_at).getTime()

  return tokens
}

function getExtension(fileName = '', mimeType = '') {
  const name = safeText(fileName).toLowerCase()
  const mime = safeText(mimeType).toLowerCase()

  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf'
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx'
  if (name.endsWith('.doc') || mime === 'application/msword') return 'doc'
  if (name.endsWith('.xlsx') || mime.includes('spreadsheetml')) return 'xlsx'
  if (name.endsWith('.csv') || mime === 'text/csv') return 'csv'
  if (name.endsWith('.txt') || mime.startsWith('text/plain')) return 'txt'
  if (name.endsWith('.json') || mime === 'application/json') return 'json'
  if (mime === 'application/vnd.google-apps.document') return 'gdoc'
  if (mime === 'application/vnd.google-apps.spreadsheet') return 'gsheet'
  if (mime === 'application/vnd.google-apps.presentation') return 'gslides'
  if (mime === 'application/vnd.google-apps.folder') return 'folder'
  return 'unknown'
}

function limitText(text) {
  const clean = safeText(text)
  if (clean.length <= MAX_TEXT_CHARS) return { text: clean, truncated: false }
  return { text: clean.slice(0, MAX_TEXT_CHARS), truncated: true }
}

function bufferFromArrayBuffer(arrayBuffer) {
  return Buffer.from(arrayBuffer)
}

async function downloadGoogleFile({ document, integration }) {
  const oauthClient = buildOAuthClientFromTokens(buildTokensFromIntegration(integration))
  const drive = google.drive({ version: 'v3', auth: oauthClient })
  const ext = getExtension(document.file_name, document.mime_type)
  const fileId = document.provider_file_id

  if (!fileId) {
    return { ok: false, warning: 'Documento sin provider_file_id', buffer: null, contentType: null, exportMimeType: null }
  }

  if (ext === 'folder') {
    return { ok: false, warning: 'El elemento es una carpeta; no se descarga contenido directo', buffer: null, contentType: document.mime_type, exportMimeType: null }
  }

  try {
    let response
    let exportMimeType = null

    if (ext === 'gdoc') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      response = await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'arraybuffer' })
    } else if (ext === 'gsheet') {
      exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      response = await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'arraybuffer' })
    } else if (ext === 'gslides') {
      exportMimeType = 'text/plain'
      response = await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: 'arraybuffer' })
    } else {
      response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
    }

    const buffer = bufferFromArrayBuffer(response.data)
    if (buffer.length > MAX_DOWNLOAD_BYTES) {
      return {
        ok: false,
        warning: `Archivo excede límite de descarga (${buffer.length} bytes > ${MAX_DOWNLOAD_BYTES})`,
        buffer: null,
        contentType: exportMimeType || document.mime_type,
        exportMimeType
      }
    }

    return {
      ok: true,
      warning: null,
      buffer,
      contentType: exportMimeType || document.mime_type,
      exportMimeType
    }
  } catch (err) {
    return {
      ok: false,
      warning: `No fue posible descargar/exportar desde Google Drive: ${err.message}`,
      buffer: null,
      contentType: document.mime_type,
      exportMimeType: null
    }
  }
}

async function extractPdf(buffer) {
  try {
    const pdfParse = require('pdf-parse')
    const parsed = await pdfParse(buffer)
    return { text: parsed.text || '', parser: 'pdf-parse', details: { pages: parsed.numpages || null }, warning: null }
  } catch (err) {
    return { text: '', parser: null, details: {}, warning: `PDF no extraído: ${err.message}` }
  }
}

async function extractDocx(buffer) {
  try {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return {
      text: result.value || '',
      parser: 'mammoth',
      details: { messages: result.messages || [] },
      warning: Array.isArray(result.messages) && result.messages.length ? 'DOCX extraído con advertencias' : null
    }
  } catch (err) {
    return { text: '', parser: null, details: {}, warning: `DOCX no extraído: ${err.message}` }
  }
}

async function extractXlsx(buffer) {
  try {
    const xlsx = require('xlsx')
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const chunks = []

    for (const sheetName of workbook.SheetNames || []) {
      const sheet = workbook.Sheets[sheetName]
      chunks.push(`[HOJA] ${sheetName}`)
      chunks.push(xlsx.utils.sheet_to_csv(sheet))
    }

    return { text: chunks.join('\n'), parser: 'xlsx', details: { sheets: workbook.SheetNames || [] }, warning: null }
  } catch (err) {
    return { text: '', parser: null, details: {}, warning: `XLSX no extraído: ${err.message}` }
  }
}

async function extractPlain(buffer) {
  const encodings = ['utf8', 'latin1']
  for (const encoding of encodings) {
    try {
      return { text: buffer.toString(encoding), parser: `buffer-${encoding}`, details: {}, warning: null }
    } catch (_err) {}
  }
  return { text: '', parser: null, details: {}, warning: 'Texto plano no extraído' }
}

async function extractTextFromBuffer({ buffer, fileName, mimeType, contentType }) {
  const ext = getExtension(fileName, contentType || mimeType)

  if (!buffer || buffer.length === 0) {
    return { ok: false, text: '', truncated: false, parser: null, extraction_type: ext, warning: 'Sin contenido descargado', details: {} }
  }

  let extracted
  if (ext === 'pdf') extracted = await extractPdf(buffer)
  else if (['docx', 'gdoc'].includes(ext)) extracted = await extractDocx(buffer)
  else if (['xlsx', 'gsheet'].includes(ext)) extracted = await extractXlsx(buffer)
  else if (['txt', 'csv', 'json', 'gslides'].includes(ext)) extracted = await extractPlain(buffer)
  else if (ext === 'doc') {
    extracted = { text: '', parser: null, details: {}, warning: 'Formato .doc binario antiguo no soportado aún; convertir a DOCX recomendado' }
  } else {
    extracted = await extractPlain(buffer)
    if (!extracted.text) extracted.warning = 'Tipo no reconocido; extracción limitada'
  }

  const limited = limitText(extracted.text)

  return {
    ok: Boolean(limited.text),
    text: limited.text,
    truncated: limited.truncated,
    parser: extracted.parser,
    extraction_type: ext,
    warning: extracted.warning,
    details: extracted.details || {},
    original_bytes: buffer.length
  }
}

async function extractDocumentContent({ document, integration }) {
  if (!document || document.provider !== 'google_drive') {
    return {
      ok: false,
      text: '',
      extraction: {
        method: 'unsupported_provider',
        warning: 'Proveedor no soportado para extracción de contenido en esta fase'
      }
    }
  }

  const downloaded = await downloadGoogleFile({ document, integration })
  if (!downloaded.ok) {
    return {
      ok: false,
      text: '',
      extraction: {
        method: 'google_drive_download',
        warning: downloaded.warning,
        content_type: downloaded.contentType,
        export_mime_type: downloaded.exportMimeType
      }
    }
  }

  const extracted = await extractTextFromBuffer({
    buffer: downloaded.buffer,
    fileName: document.file_name,
    mimeType: document.mime_type,
    contentType: downloaded.contentType
  })

  return {
    ok: extracted.ok,
    text: extracted.text,
    extraction: {
      method: 'google_drive_download_extract',
      parser: extracted.parser,
      extraction_type: extracted.extraction_type,
      truncated: extracted.truncated,
      original_bytes: extracted.original_bytes,
      warning: extracted.warning,
      details: extracted.details,
      content_type: downloaded.contentType,
      export_mime_type: downloaded.exportMimeType
    }
  }
}

module.exports = {
  extractDocumentContent,
  getExtension
}
