 'use strict';
const stats = require('./statisticalEngine.service');
const { officialResult, unmeasured } = require('./officialCalculation.service');
function daysBetween(a, b) { return (new Date(b).getTime() - new Date(a).getTime()) / 86400000; }
function isClosed(item) { return ['closed','completed','cerrado','cerrada','done'].includes(String(item.status || '').toLowerCase()); }
function isOpen(item) { return !isClosed(item) && !['cancelled','canceled','archived'].includes(String(item.status || '').toLowerCase()); }
function severityIndex({ low = 0, medium = 0, high = 0, critical = 0 } = {}) { const total = Number(low) + Number(medium) + Number(high) + Number(critical); if (!total) return null; return ((Number(low) + 2 * Number(medium) + 3 * Number(high) + 4 * Number(critical)) / (4 * total)) * 100; }
function summarizeActions({ items = [], now = new Date() } = {}) {
  const open = items.filter(isOpen);
  const closed = items.filter(isClosed);
  const ages = open.map((item) => daysBetween(item.createdAt || item.openedAt, now)).filter(Number.isFinite);
  const closeTimes = closed.map((item) => daysBetween(item.openedAt || item.createdAt, item.closedAt || item.completedAt)).filter(Number.isFinite);
  const overdue = open.filter((item) => item.dueAt || item.due_at || item.due_date).filter((item) => new Date(item.dueAt || item.due_at || item.due_date).getTime() < new Date(now).getTime());
  const progressItems = items.map((item) => ({ progress: Number(item.progress ?? item.progress_ratio ?? 0), weight: Number(item.weight ?? 1), overdue: overdue.includes(item) ? 1 : 0 }));
  return { open: open.length, closed: closed.length, overdue: overdue.length, age_mean: ages.length ? stats.mean(ages) : null, age_median: ages.length ? stats.median(ages) : null, age_p75: ages.length ? stats.percentile(ages, 0.75) : null, age_p90: ages.length ? stats.percentile(ages, 0.9) : null, age_max: ages.length ? stats.max(ages) : null, mttc: closeTimes.length ? stats.mean(closeTimes) : null, progressItems };
}
function officialSeverity(input = {}) { const value = severityIndex(input); if (value === null) return unmeasured('F5_5_SEVERITY_INDEX', 'Sin hallazgos para severidad ponderada.', { unit: '%', period: input.period || {}, source: input.source || null }); return officialResult('F5_5_SEVERITY_INDEX', input, { period: input.period || {}, source: input.source || null }); }
function officialClosureRate(input = {}) { if (!Number(input.openAtStart) && !Number(input.created)) return unmeasured('F5_5_CLOSURE_RATE', 'Sin base de acciones para tasa de cierre.', { unit: '%', period: input.period || {}, source: input.source || null }); return officialResult('F5_5_CLOSURE_RATE', input, { period: input.period || {}, source: input.source || null }); }
function officialWeightedProgress(input = {}) { if (!input.items?.length) return unmeasured('F5_5_WEIGHTED_PROGRESS', 'Sin acciones para avance ponderado.', { unit: '%', period: input.period || {}, source: input.source || null }); return officialResult('F5_5_WEIGHTED_PROGRESS', input, { period: input.period || {}, source: input.source || null }); }
function officialOverdueRate(input = {}) { if (!Number(input.openActions)) return unmeasured('F5_5_OVERDUE_RATE', 'Sin acciones abiertas para indice de atraso.', { unit: '%', period: input.period || {}, source: input.source || null }); return officialResult('F5_5_OVERDUE_RATE', input, { period: input.period || {}, source: input.source || null }); }
function backlogGrowth({ openEnd = 0, openStart = 0 }) { return Number(openEnd) - Number(openStart); }
function closureTrend(points = []) { return stats.linearRegression(points.map((value, index) => ({ x: value.x ?? index, y: value.y ?? value.closed ?? 0 }))); }
module.exports = { severityIndex, summarizeActions, officialSeverity, officialClosureRate, officialWeightedProgress, officialOverdueRate, backlogGrowth, closureTrend };
