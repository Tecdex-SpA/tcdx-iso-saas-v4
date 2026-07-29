'use strict';

const ALLOWED_OPERATORS = new Set([
  'literal',
  'input',
  'add',
  'subtract',
  'multiply',
  'divide',
  'ratio',
  'percentage',
  'count',
  'count_distinct',
  'sum',
  'average',
  'min',
  'max',
  'latest',
  'coalesce',
  'conditional',
  'unmeasured',
]);

const ALLOWED_FILTERS = new Set([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
  'is_null',
  'is_not_null',
  'between',
  'date_range',
]);

const FORBIDDEN_TOKEN_RE = /\b(eval|function|constructor|require|process|global|globalThis|window|document|fetch|import|fs|child_process|net|http|https|sql|select|insert|update|delete|drop|alter|copy|grant|revoke)\b/i;

class FormulaError extends Error {
  constructor(code, message, status = 422, details = null) {
    super(message);
    this.name = 'FormulaError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new FormulaError('FORMULA_NON_NUMERIC_INPUT', 'La formula recibio un valor no numerico.');
  return number;
}

function assertSafeString(value, path = 'expression') {
  if (typeof value !== 'string') return;
  if (FORBIDDEN_TOKEN_RE.test(value)) {
    throw new FormulaError('FORMULA_UNSAFE_TOKEN', 'La formula contiene un token no permitido.', 422, { path });
  }
}

function validateNode(node, path = 'expression') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new FormulaError('FORMULA_INVALID_NODE', 'Cada nodo de formula debe ser un objeto declarativo.', 422, { path });
  }
  const op = String(node.op || '').trim();
  if (!ALLOWED_OPERATORS.has(op)) {
    throw new FormulaError('FORMULA_OPERATOR_NOT_ALLOWED', 'Operador de formula no permitido.', 422, { op, path });
  }
  Object.entries(node).forEach(([key, value]) => {
    assertSafeString(key, `${path}.${key}`);
    assertSafeString(value, `${path}.${key}`);
  });
  asArray(node.args).forEach((child, index) => validateNode(child, `${path}.args[${index}]`));
  if (node.then) validateNode(node.then, `${path}.then`);
  if (node.else) validateNode(node.else, `${path}.else`);
  if (node.condition) validateCondition(node.condition, `${path}.condition`);
  return true;
}

function validateCondition(condition, path = 'condition') {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    throw new FormulaError('FORMULA_INVALID_CONDITION', 'La condicion debe ser declarativa.', 422, { path });
  }
  const filter = String(condition.filter || '').trim();
  if (!ALLOWED_FILTERS.has(filter)) {
    throw new FormulaError('FORMULA_FILTER_NOT_ALLOWED', 'Filtro de formula no permitido.', 422, { filter, path });
  }
  Object.entries(condition).forEach(([key, value]) => {
    assertSafeString(key, `${path}.${key}`);
    assertSafeString(value, `${path}.${key}`);
  });
  return true;
}

function resolveInputValue(name, context) {
  if (!name || typeof name !== 'string') throw new FormulaError('FORMULA_INPUT_REQUIRED', 'La entrada de formula requiere nombre.');
  if (!Object.prototype.hasOwnProperty.call(context.inputs || {}, name)) {
    throw new FormulaError('FORMULA_INPUT_MISSING', 'Falta una entrada requerida para calcular la metrica.', 422, { input: name });
  }
  return context.inputs[name];
}

function evaluateCondition(condition, context) {
  validateCondition(condition);
  const left = condition.input ? resolveInputValue(condition.input, context) : condition.left;
  const right = condition.value;
  switch (condition.filter) {
    case 'equals': return left === right;
    case 'not_equals': return left !== right;
    case 'in': return asArray(right).includes(left);
    case 'not_in': return !asArray(right).includes(left);
    case 'greater_than': return asNumber(left) > asNumber(right);
    case 'greater_or_equal': return asNumber(left) >= asNumber(right);
    case 'less_than': return asNumber(left) < asNumber(right);
    case 'less_or_equal': return asNumber(left) <= asNumber(right);
    case 'is_null': return left === null || left === undefined;
    case 'is_not_null': return left !== null && left !== undefined;
    case 'between': {
      const number = asNumber(left);
      return number >= asNumber(condition.min) && number <= asNumber(condition.max);
    }
    case 'date_range': {
      const value = new Date(left).getTime();
      const from = new Date(condition.from).getTime();
      const to = new Date(condition.to).getTime();
      return Number.isFinite(value) && value >= from && value <= to;
    }
    default:
      throw new FormulaError('FORMULA_FILTER_NOT_ALLOWED', 'Filtro de formula no permitido.');
  }
}

function evaluate(node, context = {}) {
  validateNode(node);
  const args = asArray(node.args).map((child) => evaluate(child, context));
  switch (node.op) {
    case 'literal': return node.value;
    case 'input': return resolveInputValue(node.name, context);
    case 'unmeasured': return null;
    case 'add': return args.reduce((sum, value) => sum + asNumber(value), 0);
    case 'subtract': return args.slice(1).reduce((left, value) => left - asNumber(value), asNumber(args[0] || 0));
    case 'multiply': return args.reduce((product, value) => product * asNumber(value), 1);
    case 'divide': {
      const numerator = asNumber(args[0]);
      const denominator = asNumber(args[1]);
      if (denominator === 0) throw new FormulaError('FORMULA_DIVISION_BY_ZERO', 'Division por cero controlada.');
      return numerator / denominator;
    }
    case 'ratio': {
      const numerator = asNumber(args[0]);
      const denominator = asNumber(args[1]);
      if (denominator === 0) return null;
      return numerator / denominator;
    }
    case 'percentage': {
      const numerator = asNumber(args[0]);
      const denominator = asNumber(args[1]);
      if (denominator === 0) return null;
      return (numerator / denominator) * 100;
    }
    case 'count': return args.filter((value) => value !== null && value !== undefined).length;
    case 'count_distinct': return new Set(args.filter((value) => value !== null && value !== undefined).map((value) => JSON.stringify(value))).size;
    case 'sum': return args.reduce((sum, value) => sum + asNumber(value), 0);
    case 'average': {
      const numbers = args.map(asNumber).filter((value) => value !== null);
      return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
    }
    case 'min': return Math.min(...args.map(asNumber));
    case 'max': return Math.max(...args.map(asNumber));
    case 'latest': return args.length ? args[args.length - 1] : null;
    case 'coalesce': return args.find((value) => value !== null && value !== undefined) ?? null;
    case 'conditional': return evaluateCondition(node.condition, context) ? evaluate(node.then, context) : evaluate(node.else, context);
    default:
      throw new FormulaError('FORMULA_OPERATOR_NOT_ALLOWED', 'Operador de formula no permitido.');
  }
}

module.exports = {
  ALLOWED_OPERATORS,
  ALLOWED_FILTERS,
  FormulaError,
  validateExpression: validateNode,
  validateCondition,
  evaluate,
};
