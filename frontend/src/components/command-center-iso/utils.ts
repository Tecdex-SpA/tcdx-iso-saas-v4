export function formatNumber(value?: number | string | null) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString('es-CL') : '0';
}

export function formatPercent(value?: number | string | null) {
  const n = Number(value || 0);
  return `${Number.isFinite(n) ? Math.round(n) : 0}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function label(value?: string | null) {
  const map: Record<string, string> = {
    listo: 'Listo para revision',
    avanzado: 'Avanzado',
    en_progreso: 'En progreso',
    requiere_atencion: 'Requiere atencion',
    saludable: 'Saludable',
    atencion: 'Atencion',
    critico: 'Critico',
    critica: 'Critica',
    alta: 'Alta',
    media: 'Media',
    baja: 'Baja',
    transicion: 'Transicion',
    transition_prep: 'Transicion',
    partial: 'Parcial',
    complete: 'Completa',
    limited: 'Limitada',
  };
  return map[String(value || '')] || String(value || 'Sin dato').replaceAll('_', ' ');
}

export function semaphoreClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'saludable') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (normalized === 'atencion') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (normalized === 'transicion') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function priorityClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critica') return 'bg-red-600 text-white';
  if (normalized === 'alta') return 'bg-orange-500 text-white';
  if (normalized === 'media') return 'bg-amber-100 text-amber-900';
  return 'bg-emerald-100 text-emerald-800';
}

export function scoreBarClass(score?: number | null) {
  const value = Number(score || 0);
  if (value >= 85) return 'bg-emerald-500';
  if (value >= 70) return 'bg-blue-500';
  if (value >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}
