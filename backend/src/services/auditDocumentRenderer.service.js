const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { readZipEntriesFromBuffer } = require('./auditZipExtraction.service');
const { convertDocxBufferToPdf } = require('./auditDocumentConversion.service');
const { renderHtmlToPdf } = require('../reports/services/htmlPdfRenderer.service');
const { renderBaseTemplate } = require('../reports/templates/common/baseTemplate');
const { escapeHtml } = require('../reports/templates/common/sanitize');

function ensureGeneratedDir() {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'audit-preparation-generated');
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

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
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
    local.writeUInt16LE(0, 6);
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
    centralHeader.writeUInt16LE(0, 8);
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

function markdownLines(markdown) {
  return String(markdown || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd());
}

function docxParagraph(line) {
  const text = escapeXml(line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, ''));
  const isHeading = /^#{1,3}\s/.test(line);
  const isBullet = /^[-*]\s/.test(line);
  const style = isHeading ? '<w:pStyle w:val="Heading1"/>' : '';
  const bullet = isBullet ? '<w:ind w:left="720" w:hanging="360"/>' : '';
  const boldStart = isHeading ? '<w:b/>' : '';
  return `<w:p><w:pPr>${style}${bullet}</w:pPr><w:r><w:rPr>${boldStart}</w:rPr><w:t xml:space="preserve">${text || ' '}</w:t></w:r></w:p>`;
}

function docxParagraphXml(line) {
  return docxParagraph(line);
}

function markdownToDocxXml(markdown) {
  return markdownLines(markdown).slice(0, 240).map(docxParagraphXml).join('');
}

function findTcdxMarkers(xml) {
  const markers = [];
  const markerRegex = /\{\{TCDX_(SECTION|FIELD|TABLE):([A-Za-z0-9_.-]+)\}\}/g;
  let match;
  while ((match = markerRegex.exec(xml))) {
    markers.push({
      raw: match[0],
      type: match[1].toLowerCase(),
      key: match[2],
    });
  }
  return markers;
}

function tryBuildPreservedDocxBuffer({ originalBuffer, markdown }) {
  if (!originalBuffer) return { buffer: null, reason: 'original_docx_not_available' };
  const nested = readZipEntriesFromBuffer(originalBuffer, { includeContent: true, maxContentBytes: 20 * 1024 * 1024 });
  const documentEntry = nested.entries.find((entry) => entry.full_path === 'word/document.xml' && entry.content);
  if (!documentEntry) return { buffer: null, reason: 'docx_document_xml_not_found' };

  const xml = documentEntry.content.toString('utf8');
  const structuredMarkers = findTcdxMarkers(xml);
  const markerPatterns = [
    /\{\{TCDX_CONTENT\}\}/,
    /\{\{tcdx_content\}\}/,
    /\{\{contenido_tcdx\}\}/,
    /\[TCDX_CONTENT\]/,
    /\[CONTENIDO_TCDX\]/,
  ];
  const hasMarker = structuredMarkers.length > 0 || markerPatterns.some((pattern) => pattern.test(xml));
  if (!hasMarker) return { buffer: null, reason: 'no_supported_docx_markers_found' };

  const replacement = markdownToDocxXml(markdown);
  let updatedXml = xml;
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const markersReplaced = [];

  for (const marker of structuredMarkers) {
    const paragraph = paragraphs.find((item) => item.includes(marker.raw));
    if (paragraph) {
      updatedXml = updatedXml.replace(paragraph, replacement);
    } else {
      updatedXml = updatedXml.replace(marker.raw, escapeXml(markdown.slice(0, 20000)));
    }
    markersReplaced.push(marker.raw);
  }

  for (const paragraph of paragraphs) {
    if (markerPatterns.some((pattern) => pattern.test(paragraph))) {
      updatedXml = updatedXml.replace(paragraph, replacement);
      markersReplaced.push('TCDX_CONTENT');
    }
  }

  if (updatedXml === xml) {
    for (const pattern of markerPatterns) {
      updatedXml = updatedXml.replace(pattern, escapeXml(markdown.slice(0, 20000)));
      markersReplaced.push(String(pattern));
    }
  }

  const zipEntries = nested.entries
    .filter((entry) => !entry.is_directory && !entry.unsafe_path && entry.content)
    .map((entry) => ({
      path: entry.full_path,
      content: entry.full_path === 'word/document.xml' ? Buffer.from(updatedXml, 'utf8') : entry.content,
    }));

  return {
    buffer: buildZip(zipEntries),
    reason: structuredMarkers.length ? 'preserve_exact_with_markers' : 'updated_original_docx_with_markers',
    markers_replaced: Array.from(new Set(markersReplaced)),
    markers_missing: [],
    layout_preserved: true,
  };
}

function buildDocxBuffer({ title, markdown, meta = {} }) {
  const body = [
    docxParagraph(`# ${title}`),
    docxParagraph(`TCDX by Tecdex · ${meta.standardCode || ''} · ${meta.periodYear || ''}`),
    docxParagraph(`Estado: ${meta.status || 'draft'} · Versión: ${meta.version || '1.0'}`),
    ...markdownLines(markdown).map(docxParagraph),
    docxParagraph('Documento generado por TCDX Compliance. Revisar pendientes antes de publicación.'),
  ].join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
  </w:body>
</w:document>`;

  return buildZip([
    { path: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { path: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { path: 'word/_rels/document.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` },
    { path: 'word/document.xml', content: documentXml },
  ]);
}

function tableRowsFromMarkdown(markdown) {
  const rows = markdownLines(markdown)
    .filter((line) => line.startsWith('|') && line.endsWith('|') && !/^\|\s*-/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  if (rows.length) return rows;
  return markdownLines(markdown).filter(Boolean).map((line) => [line]);
}

function buildXlsxBuffer({ title, markdown, meta = {} }) {
  const rows = [
    ['TCDX by Tecdex', title],
    ['Norma', meta.standardCode || ''],
    ['Periodo', meta.periodYear || ''],
    ['Estado', meta.status || 'draft'],
    [],
    ...tableRowsFromMarkdown(markdown),
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 32 }, { wch: 42 }, { wch: 28 }, { wch: 28 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Documento');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildPptxBuffer({ title, markdown, meta = {} }) {
  const lines = markdownLines(markdown).filter(Boolean).slice(0, 12).map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, ''));
  const slideText = escapeXml([title, `${meta.standardCode || ''} ${meta.periodYear || ''}`, ...lines].join('\n'));
  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="TCDX Document"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-CL" sz="2400"/><a:t>${slideText}</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  return buildZip([
    { path: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>` },
    { path: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
    { path: 'ppt/presentation.xml', content: `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/></p:presentation>` },
    { path: 'ppt/_rels/presentation.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>` },
    { path: 'ppt/slides/slide1.xml', content: slideXml },
  ]);
}

function markdownToHtml(markdown) {
  return markdownLines(markdown).slice(0, 260).map((line) => {
    if (/^#\s/.test(line)) return `<h2>${escapeHtml(line.replace(/^#\s*/, ''))}</h2>`;
    if (/^##\s/.test(line)) return `<h3>${escapeHtml(line.replace(/^##\s*/, ''))}</h3>`;
    if (/^[-*]\s/.test(line)) return `<p class="bullet">• ${escapeHtml(line.replace(/^[-*]\s*/, ''))}</p>`;
    return `<p>${escapeHtml(line || ' ')}</p>`;
  }).join('');
}

async function buildPdfBuffer({ title, markdown, meta = {} }) {
  const outputPath = path.join('/tmp', `tcdx-audit-document-${crypto.randomUUID()}.pdf`);
  const html = renderBaseTemplate({
    title,
    body: `
      <main class="page">
        <section class="hero keep-together">
          <div class="brand">TCDX by Tecdex</div>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtitle">${escapeHtml(`${meta.standardCode || ''} · ${meta.periodYear || ''} · ${meta.status || 'draft'} · version ${meta.version || '1.0'}`)}</p>
        </section>
        <section class="section card document-body">
          ${markdownToHtml(markdown)}
        </section>
        <p class="footer-note">Documento generado por TCDX Compliance. Validar pendientes antes de uso externo.</p>
      </main>
    `,
    extraStyles: `
      .document-body h2 { margin: 10px 0 6px; font-size: 16px; color: #0f172a; }
      .document-body h3 { margin: 8px 0 5px; font-size: 13px; color: #1e293b; }
      .document-body p { margin: 0 0 6px; font-size: 10px; color: #334155; }
      .document-body .bullet { padding-left: 10px; }
    `,
  });
  await renderHtmlToPdf({
    html,
    outputPath,
    metadata: { templateName: 'audit-preparation-document' },
    minBytes: 6 * 1024,
  });
  try {
    return fs.readFileSync(outputPath);
  } finally {
    fs.unlink(outputPath, () => {});
  }
}

function mimeForFormat(format) {
  return {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    md: 'text/markdown; charset=utf-8',
  }[format] || 'application/octet-stream';
}

async function renderDocumentArtifact({ pkg, template, document, originalCandidate = null }) {
  const format = String(template.output_format || 'docx').toLowerCase();
  const safeFormat = ['docx', 'xlsx', 'pptx', 'pdf', 'md'].includes(format) ? format : 'docx';
  const title = document.title || template.document_name;
  const markdown = document.content_markdown || `# ${title}\n\n[PENDIENTE DE VALIDACIÓN]\n`;
  const meta = {
    standardCode: pkg.standard_code,
    periodYear: pkg.period_year,
    status: document.pending_items?.length ? 'requires_validation' : 'generated',
    version: document.version || template.version || '1.0',
  };

  let buffer;
  let sourceDocxBuffer = null;
  let conversion = {
    pdf_conversion_attempted: false,
    pdf_conversion_success: false,
    pdf_conversion_engine: 'libreoffice',
    pdf_conversion_error: null,
  };
  let preservation = {
    mode: 'generate_tcdx_new',
    reason: 'no_original_candidate',
    layout_preserved: false,
  };

  if (['docx', 'pdf'].includes(safeFormat) && originalCandidate?.buffer) {
    const preserved = tryBuildPreservedDocxBuffer({ originalBuffer: originalCandidate.buffer, markdown });
    if (preserved.buffer) {
      sourceDocxBuffer = preserved.buffer;
      if (safeFormat === 'docx') buffer = preserved.buffer;
      preservation = {
        mode: 'preserve_exact_with_markers',
        reason: preserved.reason,
        original_file: originalCandidate.full_path || null,
        original_file_id: originalCandidate.full_path || null,
        markers_replaced: preserved.markers_replaced || [],
        markers_missing: preserved.markers_missing || [],
        layout_preserved: true,
      };
    } else {
      preservation = {
        mode: 'preserve_original_attach_generated_annex',
        reason: preserved.reason,
        original_file: originalCandidate.full_path || null,
        original_file_id: originalCandidate.full_path || null,
        markers_replaced: [],
        markers_missing: ['TCDX_SECTION', 'TCDX_FIELD', 'TCDX_TABLE'],
        layout_preserved: 'original_preserved_generated_annex',
        warning: 'No se modificó el DOCX original porque no contiene marcadores compatibles.',
      };
    }
  }

  if (!buffer) {
    if (safeFormat === 'docx') buffer = buildDocxBuffer({ title, markdown, meta });
    else if (safeFormat === 'xlsx') buffer = buildXlsxBuffer({ title, markdown, meta });
    else if (safeFormat === 'pptx') buffer = buildPptxBuffer({ title, markdown, meta });
    else if (safeFormat === 'pdf') {
      sourceDocxBuffer = sourceDocxBuffer || buildDocxBuffer({ title, markdown, meta });
      const converted = await convertDocxBufferToPdf(sourceDocxBuffer);
      conversion = {
        pdf_conversion_attempted: converted.pdf_conversion_attempted,
        pdf_conversion_success: converted.pdf_conversion_success,
        pdf_conversion_engine: converted.pdf_conversion_engine,
        pdf_conversion_error: converted.pdf_conversion_error,
      };
      buffer = converted.buffer || await buildPdfBuffer({ title, markdown, meta });
    }
    else buffer = Buffer.from(markdown, 'utf8');
  }

  const dir = ensureGeneratedDir();
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(title)}.${safeFormat}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  let sourceDocxFilename = null;
  if (safeFormat === 'pdf' && sourceDocxBuffer) {
    sourceDocxFilename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(title)}.source.docx`;
    fs.writeFileSync(path.join(dir, sourceDocxFilename), sourceDocxBuffer);
  }

  return {
    file_path: filePath,
    file_url: `/api/audit-preparation/documents/download/${filename}`,
    filename,
    output_format: safeFormat,
    mime_type: mimeForFormat(safeFormat),
    file_size_bytes: buffer.length,
    file_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    preservation,
    conversion,
    source_docx_filename: sourceDocxFilename,
  };
}

module.exports = {
  renderDocumentArtifact,
  ensureGeneratedDir,
  sanitizeFileName,
  buildZip,
};
