const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const { buildZip, sanitizeFileName } = require('../auditDocumentRenderer.service');
const { stableStringify } = require('./grcRules');

const FORMATS = new Set(['pdf', 'docx', 'xlsx', 'csv']);
const MIME = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function scalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return stableStringify(value);
  return String(value);
}

function columnsOf(rows) {
  const columns = new Set();
  rows.forEach(row => Object.keys(row || {}).forEach(key => columns.add(key)));
  return [...columns].sort();
}

function csvCell(value) {
  const text = scalar(value).replace(/\r?\n/g, ' ');
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows) {
  const columns = columnsOf(rows);
  const lines = [columns.map(csvCell).join(',')];
  rows.forEach(row => lines.push(columns.map(column => csvCell(row[column])).join(',')));
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

function buildXlsx(rows, metadata) {
  const safeRows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, scalar(value)])));
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: metadata.title, Subject: metadata.sourceHash, Author: 'TCDX' };
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(safeRows), 'Datos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    tenant_id: metadata.tenantId,
    domain: metadata.domain,
    generated_at: metadata.generatedAt,
    version: metadata.version,
    source_hash: metadata.sourceHash,
  }]), 'Trazabilidad');
  return Buffer.from(XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', compression: true }));
}

function escapeXml(value) {
  return scalar(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildDocx(rows, metadata) {
  const columns = columnsOf(rows);
  const paragraphs = [
    metadata.title,
    `Tenant: ${metadata.tenantId}`,
    `Generado: ${metadata.generatedAt}`,
    `Version: ${metadata.version}`,
    `Hash fuente: ${metadata.sourceHash}`,
    '',
    ...rows.flatMap((row, index) => [`Registro ${index + 1}`, ...columns.map(column => `${column}: ${scalar(row[column])}`), '']),
  ].map(line => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('');
  const entries = [
    { path: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { path: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { path: 'word/document.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>` },
  ];
  return buildZip(entries, new Date(metadata.generatedAt));
}

function buildPdf(rows, metadata) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ autoFirstPage: true, margin: 42, info: { Title: metadata.title, Author: 'TCDX', CreationDate: new Date(metadata.generatedAt) } });
    const chunks = [];
    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(18).text(metadata.title);
    document.moveDown(0.5).fontSize(9).text(`Tenant: ${metadata.tenantId}`);
    document.text(`Generado: ${metadata.generatedAt} · Version: ${metadata.version}`);
    document.text(`Hash fuente: ${metadata.sourceHash}`);
    document.moveDown();
    rows.forEach((row, index) => {
      document.fontSize(11).text(`Registro ${index + 1}`, { underline: true });
      Object.entries(row).forEach(([key, value]) => document.fontSize(8).text(`${key}: ${scalar(value)}`));
      document.moveDown(0.5);
      if (document.y > 720) document.addPage();
    });
    document.end();
  });
}

async function buildGrcExport({ domain, format, rows, tenantId, generatedAt, version = 1 }) {
  if (!FORMATS.has(format)) throw new Error('GRC_EXPORT_FORMAT_INVALID');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('GRC_EXPORT_EMPTY');
  const sourceSnapshot = { domain, tenant_id: tenantId, rows };
  const sourceHash = sha256(Buffer.from(stableStringify(sourceSnapshot)));
  const timestamp = new Date(generatedAt || Date.now()).toISOString();
  const metadata = { domain, tenantId, generatedAt: timestamp, sourceHash, version, title: `Exportacion GRC - ${domain}` };
  let buffer;
  if (format === 'csv') buffer = buildCsv(rows);
  if (format === 'xlsx') buffer = buildXlsx(rows, metadata);
  if (format === 'docx') buffer = buildDocx(rows, metadata);
  if (format === 'pdf') buffer = await buildPdf(rows, metadata);
  const fileName = sanitizeFileName(`grc_${domain}_v${version}_${timestamp.slice(0, 10)}_${sourceHash.slice(0, 12)}.${format}`);
  return {
    buffer,
    contentHash: sha256(buffer),
    fileName,
    format,
    generatedAt: timestamp,
    mimeType: MIME[format],
    sourceHash,
    sourceSnapshot,
    version,
  };
}

module.exports = { FORMATS, MIME, buildGrcExport, buildCsv, columnsOf };
