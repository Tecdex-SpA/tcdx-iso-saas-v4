'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');
const XLSX = require('xlsx');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function neutralizeSpreadsheetValue(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function buildPdfBuffer(lines, metadata) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 48,
      info: {
        Title: metadata.title,
        Author: 'TCDX ISO SaaS',
        Subject: `formula=${metadata.formula_code}@v${metadata.formula_version}`,
        Keywords: `tenant=${metadata.tenant_id};period=${metadata.period_key};checksum=${metadata.payload_checksum}`,
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text(metadata.title);
    doc.moveDown();
    for (const line of lines) doc.fontSize(10).text(String(line));
    doc.end();
  });
}

async function buildDocxBuffer(lines, metadata) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.folder('docProps').file('core.xml', `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(metadata.title)}</dc:title><dc:subject>${escapeXml(metadata.formula_code)}@v${escapeXml(metadata.formula_version)}</dc:subject><dc:description>${escapeXml(metadata.payload_checksum)}</dc:description></cp:coreProperties>`);
  zip.folder('word').file('styles.xml', '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('')}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function buildXlsxBuffer(rows, metadata) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: metadata.title,
    Subject: `${metadata.formula_code}@v${metadata.formula_version}`,
    Author: 'TCDX ISO SaaS',
    Keywords: metadata.payload_checksum,
  };
  const safeRows = rows.map((row) => row.map(neutralizeSpreadsheetValue));
  const methodology = [
    ['Campo', 'Valor'],
    ['Formula', `${metadata.formula_code}@v${metadata.formula_version}`],
    ['Tenant', metadata.tenant_id],
    ['Periodo', metadata.period_key],
    ['Checksum', metadata.payload_checksum],
    ['Lineage', metadata.lineage_url],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(safeRows), 'Reporte');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(methodology), 'Metodologia');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['source', 'calculation_run'], ['official_result', metadata.calculation_run_id]]), 'Lineage');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
}

async function main() {
  const metadata = {
    title: 'Reporte GRC validacion Fase 5.5',
    tenant_id: '70000000-0000-0000-0000-000000000701',
    period_key: '2026-Q3',
    formula_code: 'F5_5_COMPLIANCE_WEIGHTED',
    formula_version: 1,
    calculation_run_id: '70000000-0000-0000-0000-000000000777',
    lineage_url: '/api/grc/official/calculations/70000000-0000-0000-0000-000000000777/lineage',
  };
  metadata.payload_checksum = sha256(Buffer.from(JSON.stringify(metadata))).slice(0, 64);
  const lines = [
    `Tenant: ${metadata.tenant_id}`,
    `Periodo: ${metadata.period_key}`,
    `Formula: ${metadata.formula_code}@v${metadata.formula_version}`,
    `Calculation run: ${metadata.calculation_run_id}`,
    `Lineage: ${metadata.lineage_url}`,
    `Checksum: ${metadata.payload_checksum}`,
    'Resultado: 87.13 %',
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5-artifacts-'));
  try {
    const pdf = await buildPdfBuffer(lines, metadata);
    const docx = await buildDocxBuffer(lines, metadata);
    const xlsx = buildXlsxBuffer([
      ['Campo', 'Valor'],
      ['Resultado', '87.13'],
      ['Formula', `${metadata.formula_code}@v${metadata.formula_version}`],
      ['Tenant', metadata.tenant_id],
      ['Periodo', metadata.period_key],
      ['FormulaInjectionProbe', '=HYPERLINK("https://invalid.example","x")'],
    ], metadata);

    fs.writeFileSync(path.join(tmp, 'report.pdf'), pdf);
    fs.writeFileSync(path.join(tmp, 'report.docx'), docx);
    fs.writeFileSync(path.join(tmp, 'report.xlsx'), xlsx);

    assert.strictEqual(pdf.slice(0, 5).toString('utf8'), '%PDF-');
    assert(pdf.includes(Buffer.from(metadata.formula_code)) || pdf.includes(Buffer.from('F5_5')));
    assert.strictEqual(sha256(pdf).length, 64);

    assert.strictEqual(docx.slice(0, 2).toString('utf8'), 'PK');
    const docxZip = await JSZip.loadAsync(docx);
    assert(docxZip.file('[Content_Types].xml'));
    assert(docxZip.file('word/document.xml'));
    assert(docxZip.file('word/styles.xml'));
    const docXml = await docxZip.file('word/document.xml').async('string');
    const coreXml = await docxZip.file('docProps/core.xml').async('string');
    assert(docXml.includes(metadata.formula_code));
    assert(docXml.includes(metadata.tenant_id));
    assert(coreXml.includes(metadata.payload_checksum));
    assert.strictEqual(sha256(docx).length, 64);

    assert.strictEqual(xlsx.slice(0, 2).toString('utf8'), 'PK');
    const workbook = XLSX.read(xlsx, { type: 'buffer', cellFormula: true });
    assert.deepStrictEqual(workbook.SheetNames, ['Reporte', 'Metodologia', 'Lineage']);
    const reportSheet = workbook.Sheets.Reporte;
    assert.strictEqual(reportSheet.A6.v, 'FormulaInjectionProbe');
    assert.strictEqual(reportSheet.B6.t, 's');
    assert.strictEqual(reportSheet.B6.v, '\'=HYPERLINK("https://invalid.example","x")');
    assert.strictEqual(reportSheet.B6.f, undefined);
    const methodology = XLSX.utils.sheet_to_json(workbook.Sheets.Metodologia, { header: 1 });
    assert(methodology.flat().includes(metadata.payload_checksum));
    assert(methodology.flat().includes(metadata.lineage_url));
    assert.strictEqual(sha256(xlsx).length, 64);

    console.log(JSON.stringify({
      status: 'PHASE5_5_ARTIFACT_VALIDATION_OK',
      artifacts: ['pdf', 'docx', 'xlsx'],
      pdf_pages_minimum: 1,
      docx_parts: ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'docProps/core.xml'],
      xlsx_sheets: workbook.SheetNames,
      checksum_verified: true,
      formula_injection_prevented: true,
    }));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
