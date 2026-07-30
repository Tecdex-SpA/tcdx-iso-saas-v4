 'use strict';

class MathGovernanceError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'MathGovernanceError';
    this.code = code;
    this.details = details;
  }
}

function number(value, label = 'value') {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new MathGovernanceError('MATH_NON_NUMERIC', `${label} debe ser numerico.`, { label });
  return parsed;
}

function numbers(values = [], { min = 0, label = 'values' } = {}) {
  if (!Array.isArray(values)) throw new MathGovernanceError('MATH_ARRAY_REQUIRED', `${label} debe ser arreglo.`, { label });
  const clean = values.map((value, index) => number(value, `${label}[${index}]`)).filter((value) => value !== null);
  if (clean.length < min) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', `Muestra insuficiente para ${label}.`, { label, min, actual: clean.length });
  return clean;
}

function sum(values) { return numbers(values).reduce((total, value) => total + value, 0); }
function count(values) { return numbers(values).length; }
function mean(values) { const clean = numbers(values, { min: 1 }); return sum(clean) / clean.length; }
function min(values) { return Math.min(...numbers(values, { min: 1 })); }
function max(values) { return Math.max(...numbers(values, { min: 1 })); }
function range(values) { const clean = numbers(values, { min: 1 }); return max(clean) - min(clean); }
function median(values) {
  const clean = numbers(values, { min: 1 }).slice().sort((a, b) => a - b);
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}
function mode(values) {
  const clean = numbers(values, { min: 1 });
  const counts = new Map();
  clean.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const highest = Math.max(...counts.values());
  return [...counts.entries()].filter(([, c]) => c === highest).map(([value]) => value).sort((a, b) => a - b);
}
function variancePopulation(values) {
  const clean = numbers(values, { min: 1 });
  const avg = mean(clean);
  return clean.reduce((total, value) => total + (value - avg) ** 2, 0) / clean.length;
}
function varianceSample(values) {
  const clean = numbers(values, { min: 2 });
  const avg = mean(clean);
  return clean.reduce((total, value) => total + (value - avg) ** 2, 0) / (clean.length - 1);
}
function stddevPopulation(values) { return Math.sqrt(variancePopulation(values)); }
function stddevSample(values) { return Math.sqrt(varianceSample(values)); }
function coefficientOfVariation(values) {
  const avg = mean(values);
  if (avg === 0) throw new MathGovernanceError('MATH_ZERO_MEAN', 'Coeficiente de variacion no calculable con media cero.');
  return stddevSample(values) / Math.abs(avg);
}
function percentile(values, p) {
  const clean = numbers(values, { min: 1 }).slice().sort((a, b) => a - b);
  const q = number(p, 'percentile');
  if (q < 0 || q > 1) throw new MathGovernanceError('MATH_PERCENTILE_RANGE', 'Percentil debe estar entre 0 y 1.');
  if (clean.length === 1) return clean[0];
  const index = q * (clean.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return clean[lower] * (1 - weight) + clean[upper] * weight;
}
function quartiles(values) { return { q1: percentile(values, 0.25), q2: percentile(values, 0.5), q3: percentile(values, 0.75) }; }
function iqr(values) { const q = quartiles(values); return q.q3 - q.q1; }
function mad(values) { const med = median(values); return median(numbers(values).map((value) => Math.abs(value - med))); }
function zScore(x, values) {
  const sigma = stddevPopulation(values);
  if (sigma === 0) throw new MathGovernanceError('MATH_ZERO_STDDEV', 'Z-score no calculable con desviacion cero.');
  return (number(x, 'x') - mean(values)) / sigma;
}
function robustZScore(x, values) {
  const deviation = mad(values);
  if (deviation === 0) throw new MathGovernanceError('MATH_ZERO_MAD', 'Z-score robusto no calculable con MAD cero.');
  return 0.6745 * (number(x, 'x') - median(values)) / deviation;
}
function movingAverage(values, windowSize) {
  const clean = numbers(values, { min: 1 });
  const k = Math.trunc(number(windowSize, 'windowSize'));
  if (k <= 0 || k > clean.length) throw new MathGovernanceError('MATH_INVALID_WINDOW', 'Ventana invalida.');
  const out = [];
  for (let i = k - 1; i < clean.length; i += 1) out.push(mean(clean.slice(i - k + 1, i + 1)));
  return out;
}
function ema(values, windowSize) {
  const clean = numbers(values, { min: 1 });
  const k = Math.trunc(number(windowSize, 'windowSize'));
  if (k <= 0) throw new MathGovernanceError('MATH_INVALID_WINDOW', 'Ventana invalida.');
  const alpha = 2 / (k + 1);
  const out = [clean[0]];
  for (let i = 1; i < clean.length; i += 1) out.push(alpha * clean[i] + (1 - alpha) * out[i - 1]);
  return out;
}
function linearRegression(points) {
  if (!Array.isArray(points) || points.length < 2) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', 'Regresion requiere al menos dos puntos.');
  const clean = points.map((point, index) => ({ x: number(point.x ?? index, `points[${index}].x`), y: number(point.y, `points[${index}].y`) }));
  const xs = clean.map((p) => p.x);
  const ys = clean.map((p) => p.y);
  const xMean = mean(xs);
  const yMean = mean(ys);
  const sxx = xs.reduce((total, x) => total + (x - xMean) ** 2, 0);
  if (sxx === 0) throw new MathGovernanceError('MATH_ZERO_VARIANCE', 'Regresion no calculable sin variacion en x.');
  const sxy = clean.reduce((total, p) => total + (p.x - xMean) * (p.y - yMean), 0);
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const sst = ys.reduce((total, y) => total + (y - yMean) ** 2, 0);
  const sse = clean.reduce((total, p) => total + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const rSquared = sst === 0 ? 1 : 1 - (sse / sst);
  return { slope, intercept, rSquared, sampleSize: clean.length, direction: slope > 0 ? 'increase' : slope < 0 ? 'decrease' : 'stable' };
}
function absoluteVariation(current, previous) { return number(current, 'current') - number(previous, 'previous'); }
function percentageVariation(current, previous) {
  const prev = number(previous, 'previous');
  if (prev === 0) return { status: 'not_calculable', value: null, absoluteVariation: absoluteVariation(current, previous) };
  return { status: 'calculated', value: (absoluteVariation(current, previous) / Math.abs(prev)) * 100, absoluteVariation: absoluteVariation(current, previous) };
}
function confidenceIntervalProportion(successes, sampleSize, z = 1.96) {
  const n = number(sampleSize, 'sampleSize');
  if (n <= 0) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', 'Intervalo requiere muestra positiva.');
  const p = number(successes, 'successes') / n;
  const margin = number(z, 'z') * Math.sqrt((p * (1 - p)) / n);
  return { p, lower: Math.max(0, p - margin), upper: Math.min(1, p + margin), method: 'wald' };
}
function wilsonInterval(successes, sampleSize, z = 1.96) {
  const n = number(sampleSize, 'sampleSize');
  if (n <= 0) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', 'Wilson requiere muestra positiva.');
  const x = number(successes, 'successes');
  const phat = x / n;
  const z2 = z ** 2;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n)) / denom;
  return { p: phat, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), method: 'wilson' };
}
function pearson(xValues, yValues) {
  const x = numbers(xValues, { min: 2, label: 'xValues' });
  const y = numbers(yValues, { min: 2, label: 'yValues' });
  if (x.length !== y.length) throw new MathGovernanceError('MATH_LENGTH_MISMATCH', 'Series deben tener igual longitud.');
  const mx = mean(x), my = mean(y);
  const numerator = x.reduce((total, value, index) => total + (value - mx) * (y[index] - my), 0);
  const dx = Math.sqrt(x.reduce((total, value) => total + (value - mx) ** 2, 0));
  const dy = Math.sqrt(y.reduce((total, value) => total + (value - my) ** 2, 0));
  if (dx === 0 || dy === 0) throw new MathGovernanceError('MATH_ZERO_VARIANCE', 'Correlacion no calculable sin varianza.');
  return numerator / (dx * dy);
}
function ranks(values) {
  const clean = numbers(values, { min: 1 });
  const sorted = clean.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const rankValues = Array(clean.length);
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].value === sorted[i].value) j += 1;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) rankValues[sorted[k].index] = avgRank;
    i = j;
  }
  return rankValues;
}
function spearman(xValues, yValues) { return pearson(ranks(xValues), ranks(yValues)); }
function cronbachAlpha(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', 'Alfa requiere al menos dos respuestas.');
  const k = Array.isArray(matrix[0]) ? matrix[0].length : 0;
  if (k < 2) throw new MathGovernanceError('MATH_SAMPLE_TOO_SMALL', 'Alfa requiere al menos dos items.');
  const rows = matrix.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== k) throw new MathGovernanceError('MATH_LENGTH_MISMATCH', 'Matriz de encuesta inconsistente.', { rowIndex });
    return row.map((value, colIndex) => number(value, `matrix[${rowIndex}][${colIndex}]`));
  });
  const itemVariances = Array.from({ length: k }, (_, col) => varianceSample(rows.map((row) => row[col])));
  const totals = rows.map((row) => sum(row));
  const totalVariance = varianceSample(totals);
  if (totalVariance === 0) throw new MathGovernanceError('MATH_ZERO_VARIANCE', 'Alfa no calculable con varianza total cero.');
  return (k / (k - 1)) * (1 - (sum(itemVariances) / totalVariance));
}
function sampleSize({ z = 1.96, p = 0.5, e, population = null }) {
  const zValue = number(z, 'z');
  const pValue = number(p, 'p');
  const error = number(e, 'e');
  if (pValue <= 0 || pValue >= 1 || error <= 0) throw new MathGovernanceError('MATH_INVALID_PARAMETER', 'Parametros de muestra invalidos.');
  const n = (zValue ** 2 * pValue * (1 - pValue)) / (error ** 2);
  if (!population) return { n, adjusted: n };
  const N = number(population, 'population');
  return { n, adjusted: n / (1 + ((n - 1) / N)) };
}
function createSeededRng(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return function rng() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normalSample(rng) {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function poissonSample(lambda, rng = Math.random) {
  const l = Math.exp(-number(lambda, 'lambda'));
  let k = 0, p = 1;
  do { k += 1; p *= rng(); } while (p > l);
  return k - 1;
}
function lognormalSample({ mu = 0, sigma = 1 }, rng = Math.random) { return Math.exp(number(mu, 'mu') + number(sigma, 'sigma') * normalSample(rng)); }
function pertSample({ min: minValue, mode: modeValue, max: maxValue, lambda = 4 }, rng = Math.random) {
  const a = number(minValue, 'min');
  const b = number(maxValue, 'max');
  const m = number(modeValue, 'mode');
  if (!(a <= m && m <= b) || a === b) throw new MathGovernanceError('MATH_INVALID_PERT', 'PERT requiere min <= mode <= max y rango positivo.');
  const alpha = 1 + number(lambda, 'lambda') * ((m - a) / (b - a));
  const beta = 1 + number(lambda, 'lambda') * ((b - m) / (b - a));
  const x = gammaSample(alpha, rng);
  const y = gammaSample(beta, rng);
  return a + (x / (x + y)) * (b - a);
}
function gammaSample(shape, rng) {
  const k = number(shape, 'shape');
  if (k < 1) {
    const u = rng();
    return gammaSample(k + 1, rng) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x, v;
    do { x = normalSample(rng); v = 1 + c * x; } while (v <= 0);
    v = v ** 3;
    const u = rng();
    if (u < 1 - 0.0331 * (x ** 4)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function monteCarlo({ iterations = 10000, seed = 1, frequency = { type: 'poisson', lambda: 1 }, severity = { type: 'fixed', value: 1 }, threshold = null } = {}) {
  const runs = Math.trunc(number(iterations, 'iterations'));
  if (runs < 1 || runs > 100000) throw new MathGovernanceError('MATH_INVALID_ITERATIONS', 'Iteraciones fuera de rango.');
  const rng = createSeededRng(seed);
  const losses = [];
  for (let i = 0; i < runs; i += 1) {
    const events = frequency.type === 'poisson' ? poissonSample(frequency.lambda, rng) : Math.trunc(number(frequency.value ?? 1, 'frequency.value'));
    let annual = 0;
    for (let j = 0; j < events; j += 1) {
      if (severity.type === 'pert') annual += pertSample(severity, rng);
      else if (severity.type === 'lognormal') annual += lognormalSample(severity, rng);
      else annual += number(severity.value, 'severity.value');
    }
    losses.push(annual);
  }
  const expectedValue = mean(losses);
  return {
    iterations: runs,
    seed,
    expectedValue,
    p50: percentile(losses, 0.5),
    p90: percentile(losses, 0.9),
    p95: percentile(losses, 0.95),
    p99: percentile(losses, 0.99),
    exceedanceProbability: threshold === null ? null : losses.filter((loss) => loss > threshold).length / losses.length,
    losses,
  };
}
module.exports = {
  MathGovernanceError, number, numbers, sum, count, mean, median, mode, min, max, range,
  variancePopulation, varianceSample, stddevPopulation, stddevSample, coefficientOfVariation,
  percentile, quartiles, iqr, mad, zScore, robustZScore, movingAverage, ema, linearRegression,
  absoluteVariation, percentageVariation, confidenceIntervalProportion, wilsonInterval,
  pearson, spearman, cronbachAlpha, sampleSize, createSeededRng, poissonSample,
  lognormalSample, pertSample, monteCarlo,
};
