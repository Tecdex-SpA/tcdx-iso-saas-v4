'use strict';

const assert = require('assert');
const JSZip = require('jszip');
const XLSX = require('xlsx');
const {
  ImportFileError,
  SHEETS,
  generateCatalogWorkbook,
  generateTemplate,
  inspectOoxml,
  matrixToRows,
  parseCsv,
  parseXlsx,
  validateUploadMetadata,
} = require('./excelWorkbook');
const {
  getImportDefinition,
  listImportDefinitions,
} = require('./importDefinitions');

async function rejectsCode(operation, code) {
  await assert.rejects(operation, error => error instanceof ImportFileError && error.code === code);
}

async function run() {
  const processDefinition = getImportDefinition('processes');
  assert(processDefinition);

  const csv = [
    '\uFEFFcode,name,process_type,criticality_score,unit_code,owner_email',
    'code,name,process_type,criticality_score,unit_code,owner_email',
    'PROC-01,Proceso crítico,operational,80,TI,owner@tenant.test',
  ].join('\r\n');
  const parsedCsv = parseCsv(csv, processDefinition);
  assert.strictEqual(parsedCsv.rows.length, 1);
  assert.strictEqual(parsedCsv.rows[0].data.owner_email, 'owner@tenant.test');
  assert.strictEqual(parsedCsv.rows[0].data.unit_code, 'TI');
  assert.notStrictEqual(parsedCsv.rows[0].data.owner_email, 'owner_email');
  assert.notStrictEqual(parsedCsv.rows[0].data.unit_code, 'unit_code');

  const semicolonCsv = [
    'code;name;process_type;criticality_score;unit_code;owner_email',
    'PROC-04;Proceso cuatro;support;60;TI;owner@tenant.test',
  ].join('\n');
  assert.strictEqual(parseCsv(semicolonCsv, processDefinition).rows[0].data.code, 'PROC-04');

  assert.throws(
    () => parseCsv([
      'code,name,process_type,criticality_score',
      'PROC-X,=HYPERLINK(\"https://evil.example\"),support,60',
    ].join('\n'), processDefinition),
    error => error.code === 'IMPORT_FORMULA_INJECTION_REJECTED'
  );

  assert.throws(
    () => matrixToRows([
      ['code', 'name', 'name', 'process_type', 'criticality_score'],
      ['P1', 'A', 'B', 'operational', 50],
    ], processDefinition),
    error => error.code === 'IMPORT_DUPLICATE_COLUMNS'
  );

  const reordered = matrixToRows([
    ['criticality_score', 'name', '__row_type', 'code', 'process_type', 'extra_column'],
    [80, 'Ejemplo', 'example', 'EXAMPLE', 'operational', 'ignored'],
    [75, 'Proceso', '', 'PROC-02', 'support', 'value'],
  ], processDefinition);
  assert.strictEqual(reordered.rows.length, 1);
  assert.deepStrictEqual(reordered.unknownColumns, ['extra_column']);

  const catalogs = {
    users: [{ id: '1', email: 'owner@tenant.test', name: 'Owner' }],
    organization: [{ id: '2', code: 'TI', name: 'Tecnología' }],
  };
  const template = await generateTemplate(processDefinition, catalogs);
  assert(template.length > 1000);
  const templateZip = await inspectOoxml(template);
  const workbook = XLSX.read(template, { type: 'buffer', cellFormula: false });
  assert.deepStrictEqual(workbook.SheetNames, [
    SHEETS.instructions,
    SHEETS.data,
    SHEETS.catalogs,
  ]);
  const dataXml = await templateZip.file('xl/worksheets/sheet2.xml').async('string');
  assert(dataXml.includes('<dataValidations'));
  assert(dataXml.includes('state="frozen"'));
  assert(dataXml.includes("'Catálogos'!"));

  const catalogBuffer = generateCatalogWorkbook(processDefinition, catalogs);
  const catalogWorkbook = XLSX.read(catalogBuffer, { type: 'buffer', cellFormula: false });
  assert.deepStrictEqual(catalogWorkbook.SheetNames, [
    SHEETS.instructions,
    SHEETS.catalogs,
  ]);

  const validWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(validWorkbook, XLSX.utils.aoa_to_sheet([
    ['__row_type', ...processDefinition.fields.map(field => field.key)],
    ['example', ...processDefinition.fields.map(() => '')],
    ['', 'PROC-03', 'Proceso tres', '', 'operational', 'TI', 'owner@tenant.test', 'high', 80],
  ]), SHEETS.data);
  const validBuffer = XLSX.write(validWorkbook, { type: 'buffer', bookType: 'xlsx' });
  const parsedXlsx = await parseXlsx({
    originalname: 'procesos.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: validBuffer,
    size: validBuffer.length,
  }, processDefinition);
  assert.strictEqual(parsedXlsx.rows.length, 1);
  assert.strictEqual(parsedXlsx.rows[0].rowNumber, 3);
  assert.strictEqual(parsedXlsx.rows[0].data.code, 'PROC-03');
  assert.match(parsedXlsx.checksum, /^[a-f0-9]{64}$/);

  const formulaWorkbook = XLSX.utils.book_new();
  const formulaSheet = XLSX.utils.aoa_to_sheet([
    ['code', 'name', 'process_type', 'criticality_score'],
    ['PROC-F', 'Formula', 'operational', 80],
  ]);
  formulaSheet.B2 = { t: 'n', f: '1+1', v: 2 };
  XLSX.utils.book_append_sheet(formulaWorkbook, formulaSheet, SHEETS.data);
  const formulaBuffer = XLSX.write(formulaWorkbook, { type: 'buffer', bookType: 'xlsx' });
  await rejectsCode(() => inspectOoxml(formulaBuffer), 'IMPORT_FORMULA_REJECTED');

  const macroZip = await JSZip.loadAsync(validBuffer);
  macroZip.file('xl/vbaProject.bin', Buffer.from('macro'));
  const macroBuffer = await macroZip.generateAsync({ type: 'nodebuffer' });
  await rejectsCode(() => inspectOoxml(macroBuffer), 'IMPORT_MACRO_REJECTED');

  const externalZip = await JSZip.loadAsync(validBuffer);
  externalZip.file('xl/externalLinks/externalLink1.xml', '<externalLink/>');
  const externalBuffer = await externalZip.generateAsync({ type: 'nodebuffer' });
  await rejectsCode(() => inspectOoxml(externalBuffer), 'IMPORT_EXTERNAL_LINK_REJECTED');

  const relationshipZip = await JSZip.loadAsync(validBuffer);
  relationshipZip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    '<Relationships><Relationship TargetMode="External" Target="https://evil.example"/></Relationships>'
  );
  const relationshipBuffer = await relationshipZip.generateAsync({ type: 'nodebuffer' });
  await rejectsCode(() => inspectOoxml(relationshipBuffer), 'IMPORT_EXTERNAL_LINK_REJECTED');

  await rejectsCode(
    () => inspectOoxml(Buffer.from('not-an-xlsx')),
    'IMPORT_SIGNATURE_INVALID'
  );
  assert.throws(
    () => validateUploadMetadata({
      originalname: 'payload.xlsm',
      mimetype: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    }),
    error => error.code === 'IMPORT_EXTENSION_REJECTED'
  );

  const definitions = listImportDefinitions();
  assert(definitions.length >= 30);
  assert(definitions.some(definition => definition.wave === 1 && definition.availability === 'importable_now'));
  assert(definitions.some(definition => definition.wave === 2));
  assert(definitions.some(definition => definition.wave === 3));
  assert.strictEqual(getImportDefinition('users').classification, 'security_sensitive');

  process.stdout.write('Universal Excel import parser/template tests passed\n');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
