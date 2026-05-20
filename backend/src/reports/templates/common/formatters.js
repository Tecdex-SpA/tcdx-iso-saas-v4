'use strict';

const { cleanText } = require('./sanitize');

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function yesNo(value, fallback = '-') {
  if (value === true || String(value).toLowerCase() === 'true') return 'Si';
  if (value === false || String(value).toLowerCase() === 'false') return 'No';
  return fallback;
}

function displayStatus(value, fallback = '-') {
  if (value === true || value === false) return yesNo(value);
  const map = {
    not_ready: 'No listo',
    no_listo: 'No listo',
    critical: 'No listo',
    critico: 'No listo',
    critica: 'No listo',
    partial: 'Parcial',
    parcial: 'Parcial',
    ready_with_observations: 'Listo con observaciones',
    listo_con_observaciones: 'Listo con observaciones',
    ready: 'Listo',
    listo: 'Listo',
    needs_review: 'Requiere revision',
    requiere_revision: 'Requiere revision',
    no_data: 'Sin datos',
    sin_datos: 'Sin datos',
    high: 'Alta',
    alta: 'Alta',
    medium: 'Media',
    media: 'Media',
    low: 'Baja',
    baja: 'Baja',
    fast: 'Rapido',
    balanced: 'Balanceado',
    deep: 'Profundo',
  };
  return map[normalizeKey(value)] || cleanText(value, fallback);
}

function clampPercent(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatDate(value = new Date()) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return cleanText(value);
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function severityClass(value) {
  const key = normalizeKey(value);
  if (key.includes('crit') || key.includes('alta') || key.includes('high') || key.includes('not_ready')) return 'danger';
  if (key.includes('media') || key.includes('medium') || key.includes('partial')) return 'warning';
  if (key.includes('baja') || key.includes('low') || key.includes('ready')) return 'success';
  return 'neutral';
}

module.exports = {
  normalizeKey,
  yesNo,
  displayStatus,
  clampPercent,
  formatDate,
  severityClass,
};
