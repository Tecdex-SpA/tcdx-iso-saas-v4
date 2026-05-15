const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function dosDateTimeToIso(dosDate, dosTime) {
  const day = dosDate & 0x1f;
  const month = (dosDate >> 5) & 0x0f;
  const year = ((dosDate >> 9) & 0x7f) + 1980;
  const seconds = (dosTime & 0x1f) * 2;
  const minutes = (dosTime >> 5) & 0x3f;
  const hours = (dosTime >> 11) & 0x1f;
  const date = new Date(Date.UTC(year, Math.max(0, month - 1), day || 1, hours, minutes, seconds));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isUnsafeZipPath(name) {
  return !name || name.includes('..') || path.isAbsolute(name) || /^[a-zA-Z]:/.test(name);
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0 && offset >= buffer.length - 70000; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntriesFromBuffer(buffer, { includeContent = true, maxContentBytes = 8 * 1024 * 1024 } = {}) {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    return {
      entries: [],
      warnings: ['No se encontró directorio central ZIP; inventario no disponible.'],
    };
  }

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  const warnings = [];
  let offset = centralOffset;

  for (let index = 0; index < totalEntries && offset < buffer.length - 46; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      warnings.push(`Entrada central ZIP inesperada en offset ${offset}`);
      break;
    }

    const method = buffer.readUInt16LE(offset + 10);
    const dosTime = buffer.readUInt16LE(offset + 12);
    const dosDate = buffer.readUInt16LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const rawName = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8').replace(/\\/g, '/');

    const entry = {
      full_path: rawName,
      file_name: rawName.split('/').filter(Boolean).pop() || '',
      folder_path: rawName.split('/').slice(0, -1).join('/'),
      extension: path.extname(rawName).toLowerCase(),
      is_directory: rawName.endsWith('/'),
      unsafe_path: isUnsafeZipPath(rawName),
      compressed_size: compressedSize,
      uncompressed_size: uncompressedSize,
      modified_at: dosDateTimeToIso(dosDate, dosTime),
      compression_method: method,
      content: null,
      extraction_warning: null,
    };

    if (entry.unsafe_path) {
      entry.extraction_warning = 'Ruta insegura omitida.';
      warnings.push(`Entrada omitida por ruta insegura: ${rawName}`);
    } else if (includeContent && !entry.is_directory && uncompressedSize <= maxContentBytes) {
      try {
        const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
        const contentStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const compressed = buffer.slice(contentStart, contentStart + compressedSize);
        if (method === 0) {
          entry.content = compressed;
        } else if (method === 8) {
          entry.content = zlib.inflateRawSync(compressed);
        } else {
          entry.extraction_warning = `Método de compresión no soportado: ${method}`;
        }
      } catch (error) {
        entry.extraction_warning = `No se pudo extraer contenido: ${error.message}`;
      }
    } else if (uncompressedSize > maxContentBytes) {
      entry.extraction_warning = 'Archivo omitido por tamaño para análisis textual.';
    }

    entries.push(entry);
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return { entries, warnings };
}

function xmlText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractEntryText(entry) {
  const buffer = entry.content;
  if (!buffer || entry.is_directory) return { text: '', parser: null, details: {}, warning: entry.extraction_warning || null };

  try {
    if (entry.extension === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: String(result.value || '').slice(0, 50000),
        parser: 'mammoth',
        details: { messages: Array.isArray(result.messages) ? result.messages.length : 0 },
        warning: Array.isArray(result.messages) && result.messages.length ? 'DOCX extraído con advertencias.' : null,
      };
    }

    if (entry.extension === '.pdf') {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      return {
        text: String(result.text || '').slice(0, 50000),
        parser: 'pdf-parse',
        details: { pages: result.numpages || null },
        warning: null,
      };
    }

    if (['.xlsx', '.xls'].includes(entry.extension)) {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheets = workbook.SheetNames || [];
      const chunks = [];
      for (const sheetName of sheets.slice(0, 10)) {
        chunks.push(`## ${sheetName}`);
        chunks.push(xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName] || {}, { FS: ';' }).slice(0, 10000));
      }
      return {
        text: chunks.join('\n').slice(0, 50000),
        parser: 'xlsx',
        details: { sheets },
        warning: null,
      };
    }

    if (entry.extension === '.pptx') {
      const nested = readZipEntriesFromBuffer(buffer, { includeContent: true, maxContentBytes: 1024 * 1024 });
      const slideTexts = nested.entries
        .filter((item) => /^ppt\/slides\/slide\d+\.xml$/i.test(item.full_path) && item.content)
        .map((item, index) => `Slide ${index + 1}: ${xmlText(item.content.toString('utf8'))}`)
        .filter(Boolean);
      return {
        text: slideTexts.join('\n').slice(0, 50000),
        parser: 'pptx-xml',
        details: { slides: slideTexts.length },
        warning: nested.warnings.length ? nested.warnings.join('; ') : null,
      };
    }

    if (['.txt', '.csv', '.md'].includes(entry.extension)) {
      return {
        text: buffer.toString('utf8').slice(0, 50000),
        parser: 'plain-text',
        details: {},
        warning: null,
      };
    }
  } catch (error) {
    return {
      text: '',
      parser: null,
      details: {},
      warning: `No se pudo extraer texto: ${error.message}`,
    };
  }

  return { text: '', parser: null, details: {}, warning: entry.extraction_warning || 'Formato no analizado textualmente.' };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function classifyDocument(entry, text) {
  const haystack = normalizeText(`${entry.full_path} ${text.slice(0, 5000)}`);
  const checks = [
    ['policy', ['politica', 'policy']],
    ['objective_plan', ['objetivo', 'kpi', 'indicador']],
    ['scope', ['alcance', 'scope']],
    ['context', ['contexto', 'foda', 'swot']],
    ['interested_parties', ['partes interesadas', 'stakeholder']],
    ['process_map', ['mapa de procesos', 'proceso']],
    ['procedure', ['procedimiento', 'instructivo']],
    ['record', ['registro', 'lista maestra']],
    ['risk_matrix', ['riesgo', 'matriz de riesgos']],
    ['evidence_index', ['indice de evidencias', 'evidencia']],
    ['management_review', ['revision por la direccion', 'management review']],
    ['audit_interview_guide', ['entrevista', 'preguntas auditoria']],
    ['audit', ['auditoria', 'hallazgo']],
  ];
  const match = checks.find(([, words]) => words.some((word) => haystack.includes(word)));
  return match ? match[0] : 'desconocido';
}

function classifyValidity(entry, text) {
  const haystack = normalizeText(`${entry.full_path} ${text.slice(0, 3000)}`);
  if (/(obsoleto|obsolete|historico|hist[oó]rico|no presentar como vigente)/i.test(haystack)) return 'obsoleto';
  if (/(borrador|draft|pendiente)/i.test(haystack)) return 'borrador';
  if (/(vigente|aprobado|approved|publicado)/i.test(haystack)) return 'vigente';
  if (!/\b20\d{2}\b/.test(haystack) && !entry.modified_at) return 'requiere_validacion';
  return 'requiere_validacion';
}

function matchTemplate(entry, text, templates) {
  const haystack = normalizeText(`${entry.full_path} ${text.slice(0, 3000)}`);
  let best = null;
  for (const template of templates || []) {
    const key = normalizeText(template.template_key);
    const name = normalizeText(template.document_name);
    const folder = normalizeText(template.folder_path);
    let score = 0;
    if (key && haystack.includes(key.replace(/_/g, ' '))) score += 4;
    if (name && haystack.includes(name)) score += 5;
    if (name && name.split(/\s+/).slice(0, 3).every((part) => haystack.includes(part))) score += 3;
    if (folder && normalizeText(entry.folder_path).includes(folder.split(/\s+/)[0] || '')) score += 1;
    if (!best || score > best.score) best = { template, score };
  }
  return best && best.score > 0 ? {
    template_key: best.template.template_key,
    document_name: best.template.document_name,
    folder_path: best.template.folder_path,
    confidence: best.score >= 5 ? 'high' : 'medium',
  } : null;
}

function detectConflicts(documents) {
  const byKey = new Map();
  for (const doc of documents) {
    const key = `${doc.document_type}:${normalizeText(doc.file_name).replace(/\W+/g, '')}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(doc);
  }

  const duplicates = [];
  const conflicts = [];
  for (const [, group] of byKey) {
    if (group.length > 1) {
      duplicates.push({
        file_names: group.map((item) => item.full_path),
        reason: 'nombre/tipo documental similar',
      });
    }
    const currentLike = group.filter((item) => item.validity_status === 'vigente');
    if (currentLike.length > 1) {
      conflicts.push({
        type: 'multiple_current_versions',
        files: currentLike.map((item) => item.full_path),
        message: 'Se detectaron múltiples documentos probablemente vigentes para el mismo tipo.',
      });
    }
  }

  for (const doc of documents) {
    if (doc.validity_status === 'requiere_validacion') {
      conflicts.push({
        type: 'missing_validity_metadata',
        files: [doc.full_path],
        message: 'No se pudo confirmar fecha, versión o vigencia documental.',
      });
    }
  }

  return { duplicates, conflicts };
}

async function analyzeUploadedZip({ filePath, templates = [] }) {
  const buffer = fs.readFileSync(filePath);
  const { entries, warnings } = readZipEntriesFromBuffer(buffer, { includeContent: true });
  const files = entries.filter((entry) => !entry.is_directory && !entry.unsafe_path);
  const folders = Array.from(new Set(entries.map((entry) => entry.folder_path).filter(Boolean))).sort();
  const detectedDocuments = [];

  for (const entry of files) {
    const extracted = await extractEntryText(entry);
    const documentType = classifyDocument(entry, extracted.text);
    const matchedTemplate = matchTemplate(entry, extracted.text, templates);
    detectedDocuments.push({
      file_name: entry.file_name,
      folder_path: entry.folder_path,
      full_path: entry.full_path,
      extension: entry.extension,
      compressed_size: entry.compressed_size,
      uncompressed_size: entry.uncompressed_size,
      modified_at: entry.modified_at,
      text_excerpt: extracted.text.slice(0, 1200),
      parser: extracted.parser,
      extraction_warning: extracted.warning,
      parser_details: extracted.details,
      document_type: matchedTemplate?.template_key || documentType,
      probable_document_category: documentType,
      validity_status: classifyValidity(entry, extracted.text),
      matched_template: matchedTemplate,
      suggested_folder_path: matchedTemplate?.folder_path || entry.folder_path,
    });
  }

  const matchedTemplates = detectedDocuments
    .filter((doc) => doc.matched_template)
    .map((doc) => ({
      template_key: doc.matched_template.template_key,
      document_name: doc.matched_template.document_name,
      matched_file: doc.full_path,
      confidence: doc.matched_template.confidence,
    }));

  const unmatchedFiles = detectedDocuments
    .filter((doc) => !doc.matched_template)
    .map((doc) => doc.full_path);

  const { duplicates, conflicts } = detectConflicts(detectedDocuments);

  return {
    file_count: files.length,
    folder_count: folders.length,
    folders,
    detected_documents: detectedDocuments,
    matched_templates: matchedTemplates,
    unmatched_files: unmatchedFiles,
    duplicates,
    conflicts,
    warnings: [
      ...warnings,
      ...detectedDocuments.filter((doc) => doc.extraction_warning).map((doc) => `${doc.full_path}: ${doc.extraction_warning}`),
    ],
  };
}

module.exports = {
  analyzeUploadedZip,
  readZipEntriesFromBuffer,
};
