'use strict';

const TRANSFORMATIONS = new Set([
  'direct', 'trim', 'lowercase', 'uppercase', 'date_parse', 'timezone_normalize',
  'status_map', 'severity_map', 'unit_convert', 'boolean_map', 'numeric_parse',
  'enum_map', 'coalesce_controlled',
]);

class SemanticTransformError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'SemanticTransformError';
    this.code = code;
    this.status = 422;
    this.details = details;
  }
}

function asMap(config) {
  return config && typeof config.map === 'object' && !Array.isArray(config.map) ? config.map : {};
}

function numeric(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(result)) throw new SemanticTransformError('SEMANTIC_NUMERIC_INVALID', `${field} no contiene un número válido.`);
  return result;
}

function transformValue(type, value, config = {}, field = 'value') {
  if (!TRANSFORMATIONS.has(type)) throw new SemanticTransformError('SEMANTIC_TRANSFORMATION_NOT_ALLOWED', 'Transformación no permitida.', { type });
  if (type === 'coalesce_controlled') {
    if (value !== null && value !== undefined && value !== '') return value;
    if (!Object.prototype.hasOwnProperty.call(config, 'fallback')) return null;
    if (config.fallback === 0 && config.allow_zero_fallback !== true) {
      throw new SemanticTransformError('SEMANTIC_ZERO_FALLBACK_FORBIDDEN', 'Un valor ausente no puede convertirse en cero sin regla explícita.');
    }
    return config.fallback;
  }
  if (value === null || value === undefined || value === '') return null;
  if (type === 'direct') return value;
  if (type === 'trim') return String(value).trim();
  if (type === 'lowercase') return String(value).trim().toLowerCase();
  if (type === 'uppercase') return String(value).trim().toUpperCase();
  if (type === 'numeric_parse') return numeric(value, field);
  if (type === 'date_parse' || type === 'timezone_normalize') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new SemanticTransformError('SEMANTIC_DATE_INVALID', `${field} no contiene una fecha válida.`);
    return date.toISOString();
  }
  if (type === 'boolean_map') {
    const map = { true: true, false: false, yes: true, no: false, si: true, sí: true, '1': true, '0': false, ...asMap(config) };
    const key = String(value).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(map, key)) throw new SemanticTransformError('SEMANTIC_BOOLEAN_INVALID', `${field} no contiene un booleano reconocido.`);
    return Boolean(map[key]);
  }
  if (type === 'status_map' || type === 'severity_map' || type === 'enum_map') {
    const map = asMap(config);
    const key = String(value).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(map, key)) throw new SemanticTransformError('SEMANTIC_ENUM_UNKNOWN', `${field} no está incluido en el catálogo autorizado.`, { value: key });
    return map[key];
  }
  if (type === 'unit_convert') {
    const factor = Number(config.factor);
    if (!Number.isFinite(factor) || factor === 0) throw new SemanticTransformError('SEMANTIC_UNIT_FACTOR_INVALID', 'El factor de conversión no es válido.');
    const offset = Number(config.offset || 0);
    return numeric(value, field) * factor + offset;
  }
  return value;
}

function applyMappings(row, mappings) {
  const output = {};
  const warnings = [];
  for (const mapping of mappings) {
    try {
      output[mapping.canonical_field] = transformValue(
        mapping.transformation_type,
        row[mapping.source_alias || mapping.physical_column],
        mapping.transformation_config || {},
        mapping.canonical_field
      );
    } catch (error) {
      warnings.push({
        code: error.code || 'SEMANTIC_TRANSFORMATION_ERROR',
        field: mapping.canonical_field,
        message: error.message,
      });
    }
  }
  return { output, warnings };
}

module.exports = { TRANSFORMATIONS, SemanticTransformError, transformValue, applyMappings };
