 'use strict';

const { MathGovernanceError, number } = require('./statisticalEngine.service');

const ALLOWED_OPERATORS = new Set([
  'literal','input','add','subtract','multiply','divide','ratio','percentage','sum','count','count_distinct',
  'average','min','max','latest','coalesce','conditional','unmeasured','weighted_average','product',
  'complement_product','normalize','inverse_normalize','clamp','absolute','power','square_root','exponential','logarithm'
]);
const ALLOWED_FILTERS = new Set(['equals','not_equals','greater_than','greater_or_equal','less_than','less_or_equal','in','not_in','is_null','is_not_null']);
const FORBIDDEN_TOKEN_RE = /\b(eval|function|constructor|require|process|global|globalThis|window|document|fetch|import|fs|child_process|net|http|https|sql|select|insert|update|delete|drop|alter|copy|grant|revoke)\b/i;

function asArray(value) { return Array.isArray(value) ? value : []; }
function assertSafeString(value, path) {
  if (typeof value === 'string' && FORBIDDEN_TOKEN_RE.test(value)) {
    throw new MathGovernanceError('FORMULA_UNSAFE_TOKEN', 'La expresion contiene un token no permitido.', { path });
  }
}
function validateCondition(condition, path = 'condition') {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) throw new MathGovernanceError('FORMULA_INVALID_CONDITION', 'Condicion invalida.', { path });
  if (!ALLOWED_FILTERS.has(condition.filter)) throw new MathGovernanceError('FORMULA_FILTER_NOT_ALLOWED', 'Filtro no permitido.', { filter: condition.filter, path });
  Object.entries(condition).forEach(([key, value]) => { assertSafeString(key, `${path}.${key}`); assertSafeString(value, `${path}.${key}`); });
  return true;
}
function validateExpression(node, path = 'expression') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) throw new MathGovernanceError('FORMULA_INVALID_NODE', 'Nodo de formula invalido.', { path });
  if (!ALLOWED_OPERATORS.has(node.op)) throw new MathGovernanceError('FORMULA_OPERATOR_NOT_ALLOWED', 'Operador no permitido.', { op: node.op, path });
  Object.entries(node).forEach(([key, value]) => { assertSafeString(key, `${path}.${key}`); assertSafeString(value, `${path}.${key}`); });
  asArray(node.args).forEach((child, index) => validateExpression(child, `${path}.args[${index}]`));
  if (node.then) validateExpression(node.then, `${path}.then`);
  if (node.else) validateExpression(node.else, `${path}.else`);
  if (node.condition) validateCondition(node.condition, `${path}.condition`);
  return true;
}
function resolveInput(name, context) {
  if (!Object.prototype.hasOwnProperty.call(context.inputs || {}, name)) throw new MathGovernanceError('FORMULA_INPUT_MISSING', 'Falta variable de formula.', { input: name });
  return context.inputs[name];
}
function conditionValue(condition, side, context) {
  if (condition[`${side}Input`]) return resolveInput(condition[`${side}Input`], context);
  if (side === 'left' && condition.input) return resolveInput(condition.input, context);
  return condition[side] ?? condition.value;
}
function evaluateCondition(condition, context) {
  validateCondition(condition);
  const left = conditionValue(condition, 'left', context);
  const right = conditionValue(condition, 'right', context);
  switch (condition.filter) {
    case 'equals': return left === right;
    case 'not_equals': return left !== right;
    case 'greater_than': return number(left, 'left') > number(right, 'right');
    case 'greater_or_equal': return number(left, 'left') >= number(right, 'right');
    case 'less_than': return number(left, 'left') < number(right, 'right');
    case 'less_or_equal': return number(left, 'left') <= number(right, 'right');
    case 'in': return asArray(condition.values ?? right).includes(left);
    case 'not_in': return !asArray(condition.values ?? right).includes(left);
    case 'is_null': return left === null || left === undefined;
    case 'is_not_null': return left !== null && left !== undefined;
    default: throw new MathGovernanceError('FORMULA_FILTER_NOT_ALLOWED', 'Filtro no permitido.');
  }
}
function values(args, context) { return asArray(args).map((child) => evaluateExpression(child, context)); }
function evaluateExpression(node, context = {}) {
  validateExpression(node);
  const args = values(node.args, context);
  switch (node.op) {
    case 'literal': return node.value;
    case 'input': return resolveInput(node.name, context);
    case 'unmeasured': return null;
    case 'add': return args.reduce((a, b) => a + number(b, 'arg'), 0);
    case 'subtract': return args.slice(1).reduce((a, b) => a - number(b, 'arg'), number(args[0] ?? 0, 'arg0'));
    case 'multiply': return args.reduce((a, b) => a * number(b, 'arg'), 1);
    case 'product': return args.reduce((a, b) => a * number(b, 'arg'), 1);
    case 'divide': {
      const denominator = number(args[1], 'denominator');
      if (denominator === 0) throw new MathGovernanceError('FORMULA_DIVISION_BY_ZERO', 'Division por cero.');
      return number(args[0], 'numerator') / denominator;
    }
    case 'ratio': {
      const denominator = number(args[1], 'denominator');
      return denominator === 0 ? null : number(args[0], 'numerator') / denominator;
    }
    case 'percentage': {
      const denominator = number(args[1], 'denominator');
      return denominator === 0 ? null : (number(args[0], 'numerator') / denominator) * 100;
    }
    case 'sum': return args.reduce((a, b) => a + number(b, 'arg'), 0);
    case 'count': return args.filter((value) => value !== null && value !== undefined).length;
    case 'count_distinct': return new Set(args.filter((value) => value !== null && value !== undefined).map((value) => JSON.stringify(value))).size;
    case 'average': {
      const clean = args.map((value) => number(value, 'arg')).filter((value) => value !== null);
      return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
    }
    case 'min': return Math.min(...args.map((value) => number(value, 'arg')));
    case 'max': return Math.max(...args.map((value) => number(value, 'arg')));
    case 'latest': return args.length ? args[args.length - 1] : null;
    case 'coalesce': return args.find((value) => value !== null && value !== undefined) ?? null;
    case 'conditional': return evaluateCondition(node.condition, context) ? evaluateExpression(node.then, context) : evaluateExpression(node.else, context);
    case 'weighted_average': {
      const items = asArray(resolveInput(node.items || 'items', context));
      let weighted = 0, weights = 0;
      items.forEach((item) => { const w = number(item.weight, 'weight'); weighted += number(item.value, 'value') * w; weights += w; });
      return weights === 0 ? null : weighted / weights;
    }
    case 'complement_product': return 1 - args.reduce((product, value) => product * (1 - number(value, 'arg')), 1);
    case 'normalize': {
      const value = number(args[0], 'value'), min = number(args[1], 'min'), max = number(args[2], 'max');
      if (max === min) throw new MathGovernanceError('FORMULA_ZERO_RANGE', 'Normalizacion con rango cero.');
      return (value - min) / (max - min);
    }
    case 'inverse_normalize': {
      const value = number(args[0], 'value'), min = number(args[1], 'min'), max = number(args[2], 'max');
      if (max === min) throw new MathGovernanceError('FORMULA_ZERO_RANGE', 'Normalizacion inversa con rango cero.');
      return 1 - ((value - min) / (max - min));
    }
    case 'clamp': return Math.max(number(args[1], 'min'), Math.min(number(args[2], 'max'), number(args[0], 'value')));
    case 'absolute': return Math.abs(number(args[0], 'value'));
    case 'power': return number(args[0], 'base') ** number(args[1], 'exponent');
    case 'square_root': {
      const value = number(args[0], 'value');
      if (value < 0) throw new MathGovernanceError('FORMULA_NEGATIVE_ROOT', 'Raiz cuadrada negativa.');
      return Math.sqrt(value);
    }
    case 'exponential': return Math.exp(number(args[0], 'value'));
    case 'logarithm': {
      const value = number(args[0], 'value');
      const base = args[1] === undefined ? Math.E : number(args[1], 'base');
      if (value <= 0 || base <= 0 || base === 1) throw new MathGovernanceError('FORMULA_INVALID_LOG', 'Logaritmo invalido.');
      return Math.log(value) / Math.log(base);
    }
    default: throw new MathGovernanceError('FORMULA_OPERATOR_NOT_ALLOWED', 'Operador no permitido.');
  }
}
module.exports = { ALLOWED_OPERATORS, ALLOWED_FILTERS, validateExpression, validateCondition, evaluateExpression };
