const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { runPdfOcr } = require('./auditOcr.service');

function mimeForExtension(ext) {
  return {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
  }[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

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
    const crc32 = buffer.readUInt32LE(offset + 16).toString(16).padStart(8, '0');
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
      crc32,
      sha256: null,
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
      if (entry.content) {
        entry.sha256 = crypto.createHash('sha256').update(entry.content).digest('hex');
      }
    } else if (uncompressedSize > maxContentBytes) {
      entry.extraction_warning = 'Archivo omitido por tamaño para análisis textual.';
    }

    entries.push(entry);
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return { entries, warnings };
}

function xmlTextsByTag(xml, tagPattern) {
  const chunks = [];
  const regex = new RegExp(tagPattern, 'gis');
  let match;
  while ((match = regex.exec(xml))) {
    const text = xmlText(match[0]);
    if (text) chunks.push(text);
  }
  return chunks;
}

function extractDocxStructure(buffer) {
  const nested = readZipEntriesFromBuffer(buffer, { includeContent: true, maxContentBytes: 4 * 1024 * 1024 });
  const documentXml = nested.entries.find((item) => item.full_path === 'word/document.xml' && item.content);
  if (!documentXml) return { headings: [], tables: [], warnings: nested.warnings };

  const xml = documentXml.content.toString('utf8');
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const headings = [];
  for (const paragraph of paragraphs) {
    if (/w:pStyle[^>]+w:val="Heading/i.test(paragraph)) {
      const text = xmlText(paragraph);
      if (text) headings.push(text);
    }
  }

  const tables = (xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || []).slice(0, 8).map((tableXml) => {
    const rows = (tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []).slice(0, 8).map((rowXml) =>
      (rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).map((cellXml) => xmlText(cellXml)).filter(Boolean)
    );
    return rows.filter((row) => row.length);
  }).filter((table) => table.length);

  return { headings: headings.slice(0, 20), tables, warnings: nested.warnings };
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
      const structure = extractDocxStructure(buffer);
      return {
        text: String(result.value || '').slice(0, 50000),
        parser: 'mammoth',
        details: {
          messages: Array.isArray(result.messages) ? result.messages.length : 0,
          headings: structure.headings,
          tables: structure.tables,
        },
        warning: [Array.isArray(result.messages) && result.messages.length ? 'DOCX extraído con advertencias.' : null, ...(structure.warnings || [])].filter(Boolean).join('; ') || null,
      };
    }

    if (entry.extension === '.pdf') {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      const text = String(result.text || '').trim();
      if (text.length < 80) {
        const ocr = await runPdfOcr(buffer);
        const mergedText = [text, ocr.text].filter(Boolean).join('\n\n').trim();
        return {
          text: mergedText.slice(0, 50000),
          parser: ocr.ocr_success ? 'pdf-parse+ocr' : 'pdf-parse',
          details: {
            pages: result.numpages || null,
            ocr_attempted: ocr.ocr_attempted,
            ocr_success: ocr.ocr_success,
            ocr_pages_processed: ocr.ocr_pages_processed,
            ocr_error: ocr.ocr_error,
            extraction_method: ocr.ocr_success ? (text ? 'mixed' : 'ocr') : 'failed',
          },
          warning: ocr.warning || 'pdf_scanned_or_low_text: PDF sin texto suficiente; requiere revisión humana.',
        };
      }
      return {
        text: text.slice(0, 50000),
        parser: 'pdf-parse',
        details: {
          pages: result.numpages || null,
          ocr_attempted: false,
          ocr_success: false,
          ocr_pages_processed: 0,
          extraction_method: 'text',
        },
        warning: null,
      };
    }

    if (['.xlsx', '.xls'].includes(entry.extension)) {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheets = workbook.SheetNames || [];
      const chunks = [];
      const previews = [];
      for (const sheetName of sheets.slice(0, 10)) {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName] || {}, { header: 1, defval: '' }).slice(0, 8);
        previews.push({
          sheet_name: sheetName,
          headers: Array.isArray(rows[0]) ? rows[0].slice(0, 12) : [],
          sample_rows: rows.slice(1, 6),
        });
        chunks.push(`## ${sheetName}`);
        chunks.push(xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName] || {}, { FS: ';' }).slice(0, 10000));
      }
      return {
        text: chunks.join('\n').slice(0, 50000),
        parser: 'xlsx',
        details: { sheets, previews },
        warning: null,
      };
    }

    if (entry.extension === '.pptx') {
      const nested = readZipEntriesFromBuffer(buffer, { includeContent: true, maxContentBytes: 1024 * 1024 });
      const slideTexts = nested.entries
        .filter((item) => /^ppt\/slides\/slide\d+\.xml$/i.test(item.full_path) && item.content)
        .map((item, index) => `Slide ${index + 1}: ${xmlText(item.content.toString('utf8'))}`)
        .filter(Boolean);
      const notesTexts = nested.entries
        .filter((item) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(item.full_path) && item.content)
        .map((item, index) => `Notas ${index + 1}: ${xmlText(item.content.toString('utf8'))}`)
        .filter(Boolean);
      return {
        text: [...slideTexts, ...notesTexts].join('\n').slice(0, 50000),
        parser: 'pptx-xml',
        details: { slides: slideTexts.length, notes: notesTexts.length },
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
    ['template', ['plantilla', 'template', 'formato']],
    ['risk_matrix', ['riesgo', 'matriz de riesgos']],
    ['evidence_index', ['indice de evidencias', 'evidencia']],
    ['management_review', ['revision por la direccion', 'management review']],
    ['audit_interview_guide', ['entrevista', 'preguntas auditoria']],
    ['audit', ['auditoria', 'hallazgo']],
    ['historical', ['historico', 'histórico', 'obsoleto', 'no presentar como vigente']],
  ];
  const match = checks.find(([, words]) => words.some((word) => haystack.includes(word)));
  return match ? match[0] : 'desconocido';
}

function classifyValidity(entry, text) {
  const haystack = normalizeText(`${entry.full_path} ${text.slice(0, 3000)}`);
  if (/(obsoleto|obsolete|historico|hist[oó]rico|no presentar como vigente)/i.test(haystack)) return haystack.includes('histor') ? 'historico_probable' : 'obsoleto_probable';
  if (/(borrador|draft|pendiente)/i.test(haystack)) return 'borrador';
  if (/(vigente|aprobado|approved|publicado)/i.test(haystack)) return 'vigente';
  if (!/\b20\d{2}\b/.test(haystack) && !entry.modified_at) return 'requiere_validacion';
  return 'vigencia_no_confirmada';
}

function detectVersion(entry, text) {
  const haystack = `${entry.file_name} ${text.slice(0, 3000)}`;
  const versionMatch = haystack.match(/\b(?:v|versi[oó]n|version|rev(?:isi[oó]n)?)\s*[:._-]?\s*(\d+(?:\.\d+){0,3})\b/i);
  const dateMatch = haystack.match(/\b(20\d{2})[-_/ ]?(0?[1-9]|1[0-2])?[-_/ ]?(0?[1-9]|[12]\d|3[01])?\b/);
  return {
    version: versionMatch ? versionMatch[1] : null,
    year: dateMatch ? Number(dateMatch[1]) : null,
    has_version: Boolean(versionMatch),
  };
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
  const byHash = new Map();
  const currentYear = new Date().getFullYear();
  for (const doc of documents) {
    const key = `${doc.probable_document_category}:${normalizeText(doc.file_name).replace(/\bv\d+(?:\.\d+)*\b/g, '').replace(/\b20\d{2}\b/g, '').replace(/\W+/g, '')}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(doc);
    if (doc.sha256) {
      if (!byHash.has(doc.sha256)) byHash.set(doc.sha256, []);
      byHash.get(doc.sha256).push(doc);
    }
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

  for (const [, group] of byHash) {
    if (group.length > 1) {
      duplicates.push({
        file_names: group.map((item) => item.full_path),
        reason: 'hash idéntico en múltiples rutas',
      });
      conflicts.push({
        type: 'duplicate_hash',
        files: group.map((item) => item.full_path),
        message: 'Documento duplicado por hash en carpetas distintas.',
      });
    }
  }

  for (const doc of documents) {
    if (['requiere_validacion', 'vigencia_no_confirmada'].includes(doc.validity_status)) {
      conflicts.push({
        type: 'missing_validity_metadata',
        files: [doc.full_path],
        message: 'No se pudo confirmar fecha, versión o vigencia documental.',
      });
    }
    if (!doc.version_info?.has_version && ['.docx', '.pdf', '.xlsx'].includes(doc.extension)) {
      conflicts.push({
        type: 'missing_version',
        files: [doc.full_path],
        message: 'Documento sin versión explícita detectada.',
      });
    }
    if (doc.version_info?.year && doc.version_info.year < currentYear - 2 && doc.validity_status === 'vigente') {
      conflicts.push({
        type: 'old_document_marked_current',
        files: [doc.full_path],
        message: 'Documento con fecha antigua aparece como vigente probable.',
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
    const versionInfo = detectVersion(entry, extracted.text);
    detectedDocuments.push({
      file_name: entry.file_name,
      folder_path: entry.folder_path,
      full_path: entry.full_path,
      extension: entry.extension,
      mime_type: mimeForExtension(entry.extension),
      compressed_size: entry.compressed_size,
      uncompressed_size: entry.uncompressed_size,
      crc32: entry.crc32,
      sha256: entry.sha256,
      modified_at: entry.modified_at,
      text_excerpt: extracted.text.slice(0, 1200),
      parser: extracted.parser,
      extraction_warning: extracted.warning,
      parser_details: extracted.details,
      document_type: matchedTemplate?.template_key || documentType,
      probable_document_category: documentType,
      validity_status: classifyValidity(entry, extracted.text),
      version_info: versionInfo,
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
