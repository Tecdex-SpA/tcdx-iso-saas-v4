'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const { evaluate, validateExpression, FormulaError } = require('./formulaEngine');
const { calculateTrustScore, assessFreshness } = require('./dataTrustScore');
const { TenantResolutionError, resolveEffectiveTenant } = require('../../utils/effectiveTenant');

function assertZipMagic(buffer) {
  assert.strictEqual(buffer.slice(0, 2).toString('utf8'), 'PK');
}

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildPdfBuffer(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, info: { Title: lines[0] || 'Reporte TCDX', Author: 'TCDX' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text(lines[0] || 'Reporte TCDX');
    doc.moveDown();
    lines.slice(1).forEach((line) => doc.fontSize(10).text(String(line)));
    doc.end();
  });
}

async function buildDocxBuffer(lines) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('')}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function buildXlsxBuffer(lines) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(lines.map((line) => [line]));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
}

async function run() {
  assert.strictEqual(evaluate({ op: 'add', args: [{ op: 'literal', value: 2 }, { op: 'literal', value: 3 }] }), 5);
  assert.strictEqual(evaluate({ op: 'percentage', args: [{ op: 'literal', value: 2 }, { op: 'literal', value: 4 }] }), 50);
  assert.strictEqual(evaluate({ op: 'ratio', args: [{ op: 'literal', value: 2 }, { op: 'literal', value: 0 }] }), null);
  assert.throws(
    () => evaluate({ op: 'divide', args: [{ op: 'literal', value: 2 }, { op: 'literal', value: 0 }] }),
    (error) => error instanceof FormulaError && error.code === 'FORMULA_DIVISION_BY_ZERO'
  );
  assert.throws(
    () => validateExpression({ op: 'eval', args: [] }),
    (error) => error instanceof FormulaError && error.code === 'FORMULA_OPERATOR_NOT_ALLOWED'
  );
  assert.throws(
    () => validateExpression({ op: 'literal', value: 'process.env.SECRET' }),
    (error) => error instanceof FormulaError && error.code === 'FORMULA_UNSAFE_TOKEN'
  );
  assert.strictEqual(evaluate({
    op: 'conditional',
    condition: { filter: 'greater_than', input: 'x', value: 10 },
    then: { op: 'literal', value: 'alto' },
    else: { op: 'literal', value: 'bajo' },
  }, { inputs: { x: 11 } }), 'alto');

  const trust = calculateTrustScore({
    completeness: { score: 100, status: 'trusted', reason: 'Completo' },
    accuracy: { score: 95, status: 'trusted', reason: 'Exacto' },
    consistency: { score: 90, status: 'trusted', reason: 'Consistente' },
    freshness: { score: 45, status: 'untrusted', reason: 'Stale' },
    lineage: { score: 80, status: 'acceptable', reason: 'Lineage parcial' },
    validation: { score: 100, status: 'trusted', reason: 'Validado' },
    stability: { score: 90, status: 'trusted', reason: 'Estable' },
    coverage: { score: 90, status: 'trusted', reason: 'Cubierto' },
  });
  assert.ok(trust.score <= 69, 'dato stale debe reducir el score');
  assert.notStrictEqual(trust.status, 'trusted', 'dato stale no puede mostrarse trusted');
  assert.strictEqual(trust.formula_version, 'data_trust_score_v2');
  assert.ok(trust.components.source_availability, 'score v2 debe incluir disponibilidad de fuente');
  assert.ok(trust.components.assurance_result, 'score v2 debe incluir resultado de assurance');
  assert.ok(trust.components.evidence_trace, 'score v2 debe incluir traza de evidencia');
  assert.ok(trust.components.dimension_quality, 'score v2 debe incluir calidad dimensional');

  const rejected = calculateTrustScore({
    completeness: { score: 100, status: 'trusted' },
    accuracy: { score: 100, status: 'trusted' },
    consistency: { score: 100, status: 'trusted' },
    freshness: { score: 100, status: 'trusted' },
    lineage: { score: 100, status: 'trusted' },
    validation: { score: 0, status: 'untrusted' },
    stability: { score: 100, status: 'trusted' },
    coverage: { score: 100, status: 'trusted' },
  });
  assert.strictEqual(rejected.status, 'untrusted');
  assert.ok(rejected.score <= 39);

  const stale = assessFreshness({
    observedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    frequency: 'daily',
  });
  assert.ok(['stale', 'expired'].includes(stale.status));

  const tenantReq = {
    headers: {},
    query: {},
    body: {},
    user: { role: 'tenant_admin', tenant_id: '70000000-0000-0000-0000-000000000701' },
  };
  assert.strictEqual(await resolveEffectiveTenant(tenantReq), '70000000-0000-0000-0000-000000000701');
  assert.strictEqual(tenantReq.resolvedTenantId, '70000000-0000-0000-0000-000000000701');
  await assert.rejects(
    () => resolveEffectiveTenant({
      headers: { 'x-tenant-id': '70000000-0000-0000-0000-000000000702' },
      query: {},
      body: {},
      user: { role: 'tenant_admin', tenant_id: '70000000-0000-0000-0000-000000000701' },
    }),
    (error) => error instanceof TenantResolutionError && error.code === 'TENANT_FORBIDDEN'
  );
  await assert.rejects(
    () => resolveEffectiveTenant({ headers: {}, query: {}, body: {}, user: { role: 'tenant_admin', tenant_id: 'tecdex.net' } }),
    (error) => error instanceof TenantResolutionError && error.code === 'TENANT_INVALID'
  );
  await assert.rejects(
    () => resolveEffectiveTenant({ headers: {}, query: {}, body: {}, user: { role: 'platform_admin' } }),
    (error) => error instanceof TenantResolutionError && error.code === 'TENANT_REQUIRED'
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5-artifact-'));
  const lines = ['Informe ejecutivo GRC', 'Tenant: qa-tenant', 'Clasificacion: internal', 'Identificador de emision: qa-generation'];
  const pdfPath = path.join(tmp, 'report.pdf');
  const docxPath = path.join(tmp, 'report.docx');
  const xlsxPath = path.join(tmp, 'report.xlsx');
  fs.writeFileSync(pdfPath, await buildPdfBuffer(lines));
  fs.writeFileSync(docxPath, await buildDocxBuffer(lines));
  fs.writeFileSync(xlsxPath, buildXlsxBuffer(lines));
  const pdf = fs.readFileSync(pdfPath);
  const docx = fs.readFileSync(docxPath);
  const xlsx = fs.readFileSync(xlsxPath);
  assert.strictEqual(pdf.slice(0, 5).toString('utf8'), '%PDF-');
  assertZipMagic(docx);
  assertZipMagic(xlsx);
  const docxZip = await JSZip.loadAsync(docx);
  assert.ok(docxZip.file('word/document.xml'), 'DOCX debe incluir word/document.xml');
  const workbook = XLSX.read(xlsx, { type: 'buffer' });
  assert.ok(workbook.SheetNames.includes('Reporte'), 'XLSX debe incluir hoja Reporte');
  assert.strictEqual(crypto.createHash('sha256').update(docx).digest('hex').length, 64);

  const loss = { gross_loss: 1000, recoveries: 250 };
  const netLoss = loss.gross_loss - loss.recoveries;
  assert.strictEqual(netLoss, 750);
  assert.throws(() => {
    const invalid = { gross_loss: 100, recoveries: 101 };
    if (invalid.gross_loss - invalid.recoveries < 0) throw new Error('negative_net_loss');
  }, /negative_net_loss/);

  process.stdout.write('phase5Core tests OK\n');
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
