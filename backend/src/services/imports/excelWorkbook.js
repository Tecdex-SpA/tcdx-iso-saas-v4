'use strict';

const crypto = require('crypto');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');

const SHEETS = Object.freeze({
  instructions: 'Instrucciones',
  data: 'Datos',
  catalogs: 'Catálogos',
  errors: 'Errores',
});

const LIMITS = Object.freeze({
  maximumFileSize: 5 * 1024 * 1024,
  maximumUncompressedSize: 20 * 1024 * 1024,
  maximumEntries: 1000,
  maximumSheets: 4,
  maximumRows: 5000,
  maximumColumns: 100,
  processingTimeoutMs: 10000,
});

class ImportFileError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

function normalizeCell(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return value;
  return value.replace(/^\uFEFF/, '').trim().replace(/\r\n?/g, '\n');
}

function neutralizeSpreadsheetText(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function isDuplicateHeaderRow(row, headers) {
  if (!Array.isArray(row)) return false;
  const candidates = row.slice(0, headers.length).map(normalizeHeader);
  return candidates.length === headers.length
    && candidates.every((value, index) => value === headers[index]);
}

function matrixToRows(matrix, definition) {
  if (!Array.isArray(matrix) || !matrix.length) {
    throw new ImportFileError('IMPORT_DATA_EMPTY', 'La hoja Datos no contiene encabezados.', 400);
  }
  const headers = matrix[0].map(normalizeHeader);
  if (headers.some((header, index) => header && headers.indexOf(header) !== index)) {
    throw new ImportFileError(
      'IMPORT_DUPLICATE_COLUMNS',
      'La hoja Datos contiene encabezados duplicados.',
      400
    );
  }
  const expected = new Set(definition.fields.map(field => field.key));
  const unknown = headers.filter(header => header && header !== '__row_type' && !expected.has(header));
  const missing = definition.fields
    .filter(field => field.required)
    .map(field => field.key)
    .filter(key => !headers.includes(key));
  if (missing.length) {
    throw new ImportFileError(
      'IMPORT_REQUIRED_COLUMNS_MISSING',
      'Faltan columnas obligatorias en la hoja Datos.',
      400,
      { columns: missing }
    );
  }
  if (headers.filter(Boolean).length > LIMITS.maximumColumns) {
    throw new ImportFileError('IMPORT_COLUMN_LIMIT', 'El archivo supera el máximo de columnas.', 413);
  }
  const rows = [];
  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index] || [];
    if (isDuplicateHeaderRow(source, headers)) continue;
    const row = Object.fromEntries(headers.map((header, column) => [
      header,
      normalizeCell(source[column]),
    ]).filter(([header]) => header));
    for (const [column, value] of Object.entries(row)) {
      if (
        typeof value === 'string'
        && (/^[=@]/.test(value) || /^[+-](?!\d+(?:[.,]\d+)?$)/.test(value))
      ) {
        throw new ImportFileError(
          'IMPORT_FORMULA_INJECTION_REJECTED',
          `La columna ${column} contiene una expresión activa no permitida.`,
          400
        );
      }
    }
    const marker = normalizeHeader(row.__row_type);
    delete row.__row_type;
    if (marker === 'example' || marker === 'ejemplo' || marker === 'instruction') continue;
    if (!Object.values(row).some(value => value !== '' && value !== null && value !== undefined)) continue;
    rows.push({ rowNumber: index + 1, data: row });
  }
  if (!rows.length) {
    throw new ImportFileError('IMPORT_ROWS_REQUIRED', 'La plantilla no contiene filas para importar.', 400);
  }
  if (rows.length > Math.min(definition.maximumRows, LIMITS.maximumRows)) {
    throw new ImportFileError('IMPORT_ROW_LIMIT', 'El archivo supera el máximo de filas.', 413);
  }
  return { headers, rows, unknownColumns: unknown };
}

function parseCsv(content, definition) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let commaCount = 0;
  let semicolonCount = 0;
  let headerQuoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"') headerQuoted = !headerQuoted;
    if (!headerQuoted && firstLine[index] === ',') commaCount += 1;
    if (!headerQuoted && firstLine[index] === ';') semicolonCount += 1;
  }
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  const matrix = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some(value => value !== '') || !matrix.length) matrix.push(row);
  return matrixToRows(matrix, definition);
}

async function inspectOoxml(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.length > LIMITS.maximumFileSize) {
    throw new ImportFileError('IMPORT_FILE_SIZE_INVALID', 'El archivo excede el tamaño permitido.', 413);
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new ImportFileError('IMPORT_SIGNATURE_INVALID', 'El archivo no es un OOXML válido.', 400);
  }
  const zip = await JSZip.loadAsync(buffer, {
    checkCRC32: true,
    createFolders: false,
  });
  const entries = Object.values(zip.files);
  if (entries.length > LIMITS.maximumEntries) {
    throw new ImportFileError('IMPORT_ZIP_ENTRY_LIMIT', 'El archivo contiene demasiados componentes.', 413);
  }
  const names = entries.map(entry => entry.name.toLowerCase());
  if (names.some(name => name.includes('vbaproject.bin') || name.endsWith('.bin'))) {
    throw new ImportFileError('IMPORT_MACRO_REJECTED', 'Los archivos con macros no están permitidos.', 400);
  }
  if (names.some(name => name.includes('/externallinks/'))) {
    throw new ImportFileError('IMPORT_EXTERNAL_LINK_REJECTED', 'Los enlaces externos no están permitidos.', 400);
  }
  let uncompressed = 0;
  for (const entry of entries) {
    if (entry.dir) continue;
    const data = await entry.async('nodebuffer');
    uncompressed += data.length;
    if (uncompressed > LIMITS.maximumUncompressedSize) {
      throw new ImportFileError('IMPORT_ZIP_BOMB_REJECTED', 'El archivo expandido excede el límite seguro.', 413);
    }
    if (
      entry.name.startsWith('xl/worksheets/')
      && /<f(?:\s|>)/i.test(data.toString('utf8'))
    ) {
      throw new ImportFileError('IMPORT_FORMULA_REJECTED', 'Las fórmulas no están permitidas.', 400);
    }
    if (
      entry.name.toLowerCase().endsWith('.rels')
      && /TargetMode\s*=\s*["']External["']/i.test(data.toString('utf8'))
    ) {
      throw new ImportFileError(
        'IMPORT_EXTERNAL_LINK_REJECTED',
        'Los enlaces externos no están permitidos.',
        400
      );
    }
  }
  return zip;
}

function validateUploadMetadata(file) {
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  if (extension !== '.xlsx') {
    throw new ImportFileError(
      'IMPORT_EXTENSION_REJECTED',
      'Solo se permiten archivos .xlsx sin macros.',
      415
    );
  }
  const allowedMime = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ]);
  if (!allowedMime.has(String(file?.mimetype || '').toLowerCase())) {
    throw new ImportFileError('IMPORT_MIME_REJECTED', 'El tipo de archivo no está permitido.', 415);
  }
}

async function parseXlsx(file, definition) {
  validateUploadMetadata(file);
  const buffer = file.buffer;
  await inspectOoxml(buffer);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    bookVBA: false,
  });
  if (workbook.SheetNames.length > LIMITS.maximumSheets) {
    throw new ImportFileError('IMPORT_SHEET_LIMIT', 'El archivo contiene demasiadas hojas.', 413);
  }
  const sheet = workbook.Sheets[SHEETS.data];
  if (!sheet) {
    throw new ImportFileError('IMPORT_DATA_SHEET_REQUIRED', 'Falta la hoja Datos.', 400);
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  return {
    ...matrixToRows(matrix, definition),
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

async function parseXlsxWithTimeout(file, definition) {
  let timer;
  try {
    return await Promise.race([
      parseXlsx(file, definition),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ImportFileError(
          'IMPORT_PROCESSING_TIMEOUT',
          'El archivo excedió el tiempo máximo de procesamiento.',
          408
        )), LIMITS.processingTimeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function exampleValue(field) {
  if (field.type === 'enum') return field.values[0];
  if (field.type === 'date') return '2027-01-31';
  if (field.type === 'number') return field.minimum ?? 1;
  if (field.type === 'relation') return `REEMPLAZAR_${field.key.toUpperCase()}`;
  if (field.key === 'code') return 'EJEMPLO-001';
  return `Ejemplo ${field.label}`;
}

function buildInstructions(definition) {
  return [
    ['Motor universal de importación TECDEX', definition.displayName],
    ['Versión de plantilla', definition.version],
    ['Propósito', definition.description],
    ['Orden recomendado', definition.dependencies.length
      ? `Importe antes: ${definition.dependencies.join(', ')}.`
      : 'No requiere importaciones previas.'],
    ['Uso de relaciones', 'Use códigos y correos visibles en Catálogos. Nunca use UUID.'],
    ['Ejemplos', 'La fila marcada example se excluye automáticamente de la importación.'],
    ['Duplicados', `Política inicial: ${definition.duplicatePolicy}. Se confirma después del preview.`],
    ['Fechas', 'Use AAAA-MM-DD o fecha/hora ISO 8601.'],
    ['Porcentajes', 'Use un número o el formato definido por la columna; no use fórmulas.'],
    ['Seguridad', 'No use macros, fórmulas, enlaces externos, secretos, tokens ni contraseñas.'],
    ['Proceso', 'Descargue, complete Datos, cargue, revise errores, confirme y conserve el identificador del lote para rollback.'],
    [],
    ['Campo', 'Obligatorio', 'Tipo', 'Descripción / valores'],
    ...definition.fields.map(field => [
      field.key,
      field.required ? 'Sí' : 'No',
      field.type,
      field.values?.join(' | ') || field.catalog || field.label,
    ]),
  ];
}

function catalogColumns(definition, catalogs) {
  const columns = [];
  for (const field of definition.fields) {
    if (field.values) {
      columns.push({
        key: field.key,
        values: field.values.map(value => ({ code: value, name: value })),
      });
    } else if (field.catalog) {
      const rows = catalogs[field.catalog] || [];
      columns.push({
        key: field.key,
        values: rows.map(row => ({
          code: neutralizeSpreadsheetText(row.email || row.code || ''),
          name: neutralizeSpreadsheetText(row.name || ''),
        })).filter(row => row.code),
      });
    }
  }
  return columns;
}

function buildCatalogMatrix(columns) {
  const headers = columns.flatMap(column => [`${column.key}_value`, `${column.key}_label`]);
  const max = Math.max(0, ...columns.map(column => column.values.length));
  const rows = [headers];
  for (let index = 0; index < max; index += 1) {
    rows.push(columns.flatMap(column => [
      column.values[index]?.code || '',
      column.values[index]?.name || '',
    ]));
  }
  return rows;
}

async function addWorkbookControls(buffer, definition, columns) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = 'xl/worksheets/sheet2.xml';
  const sheet = zip.file(sheetPath);
  if (!sheet) return buffer;
  let xml = await sheet.async('string');
  const validations = [];
  for (const field of definition.fields) {
    const dataColumn = definition.fields.findIndex(candidate => candidate.key === field.key) + 2;
    const catalogIndex = columns.findIndex(column => column.key === field.key);
    if (!dataColumn || catalogIndex < 0) continue;
    const catalogColumn = (catalogIndex * 2) + 1;
    const catalogLength = Math.max(2, columns[catalogIndex].values.length + 1);
    validations.push(
      `<dataValidation type="list" allowBlank="${field.required ? '0' : '1'}" showErrorMessage="1" sqref="${XLSX.utils.encode_col(dataColumn - 1)}3:${XLSX.utils.encode_col(dataColumn - 1)}${definition.maximumRows + 2}">`
      + `<formula1>'${SHEETS.catalogs}'!$${XLSX.utils.encode_col(catalogColumn - 1)}$2:$${XLSX.utils.encode_col(catalogColumn - 1)}$${catalogLength}</formula1>`
      + '</dataValidation>'
    );
  }
  if (validations.length) {
    xml = xml.replace(
      '</worksheet>',
      `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations></worksheet>`
    );
  }
  xml = xml.replace(
    /<sheetViews>([\s\S]*?)<\/sheetViews>/,
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
  );
  zip.file(sheetPath, xml);
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

async function generateTemplate(definition, catalogs, { errors = [] } = {}) {
  const workbook = XLSX.utils.book_new();
  const instructions = XLSX.utils.aoa_to_sheet(buildInstructions(definition));
  const headers = ['__row_type', ...definition.fields.map(field => field.key)];
  const example = ['example', ...definition.fields.map(exampleValue)];
  const data = XLSX.utils.aoa_to_sheet([headers, example]);
  data['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
  data['!cols'] = headers.map((header, index) => ({
    wch: index === 0 ? 14 : Math.max(14, Math.min(38, header.length + 6)),
  }));
  definition.fields.forEach((field, index) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: index + 1 });
    data[address].c = [{
      a: 'TECDEX',
      t: `${field.label}. ${field.required ? 'Obligatorio.' : 'Opcional.'} ${field.catalog ? `Use la lista ${field.catalog}.` : ''}`,
    }];
  });
  const columns = catalogColumns(definition, catalogs);
  const catalogSheet = XLSX.utils.aoa_to_sheet(buildCatalogMatrix(columns));
  XLSX.utils.book_append_sheet(workbook, instructions, SHEETS.instructions);
  XLSX.utils.book_append_sheet(workbook, data, SHEETS.data);
  XLSX.utils.book_append_sheet(workbook, catalogSheet, SHEETS.catalogs);
  if (errors.length) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(errors.map(error => ({
        fila: error.row,
        columna: error.column,
        valor_recibido: neutralizeSpreadsheetText(String(error.value ?? '')),
        codigo: error.code,
        mensaje: error.message,
        sugerencia: error.suggestion || '',
        valores_validos: (error.validValues || []).join(', '),
      }))),
      SHEETS.errors
    );
  }
  workbook.Props = {
    Title: `Plantilla TECDEX - ${definition.displayName}`,
    Subject: definition.version,
    Author: 'TECDEX',
    Company: 'TECDEX',
  };
  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
    cellStyles: true,
  });
  return addWorkbookControls(buffer, definition, columns);
}

function generateCatalogWorkbook(definition, catalogs) {
  const workbook = XLSX.utils.book_new();
  const columns = catalogColumns(definition, catalogs);
  const instructions = XLSX.utils.aoa_to_sheet([
    ['Catálogos TECDEX', definition.displayName],
    ['Versión', definition.version],
    ['Uso', 'Use estos códigos y correos en la hoja Datos. Nunca use UUID.'],
    ['Alcance', 'Los valores corresponden a la empresa activa y a los permisos del usuario.'],
  ]);
  const catalogSheet = XLSX.utils.aoa_to_sheet(buildCatalogMatrix(columns));
  catalogSheet['!autofilter'] = {
    ref: catalogSheet['!ref'] || 'A1:A1',
  };
  catalogSheet['!cols'] = columns.flatMap(() => [{ wch: 28 }, { wch: 38 }]);
  XLSX.utils.book_append_sheet(workbook, instructions, SHEETS.instructions);
  XLSX.utils.book_append_sheet(workbook, catalogSheet, SHEETS.catalogs);
  workbook.Props = {
    Title: `Catálogos TECDEX - ${definition.displayName}`,
    Subject: definition.version,
    Author: 'TECDEX',
    Company: 'TECDEX',
  };
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
    cellStyles: true,
  });
}

module.exports = {
  ImportFileError,
  LIMITS,
  SHEETS,
  generateCatalogWorkbook,
  generateTemplate,
  inspectOoxml,
  matrixToRows,
  neutralizeSpreadsheetText,
  normalizeHeader,
  parseCsv,
  parseXlsx: parseXlsxWithTimeout,
  validateUploadMetadata,
};
