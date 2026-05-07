export function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat('es-CL').format(Number(value || 0));
}

export function formatPercent(value: number | string | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    listo: 'Listo para revision',
    avanzado: 'Avanzado',
    en_progreso: 'En progreso',
    requiere_atencion: 'Requiere atencion',
    saludable: 'Saludable',
    atencion: 'Atencion',
    critico: 'Critico',
    transicion: 'Transicion',
    partial: 'Parcial',
    limited: 'Limitada',
    complete: 'Completa',
  };

  return labels[String(value || '').toLowerCase()] || String(value || 'Sin datos');
}

export function readinessClass(score: number | string | null | undefined) {
  const numeric = Number(score || 0);
  if (numeric >= 85) return 'bg-emerald-600';
  if (numeric >= 70) return 'bg-sky-600';
  if (numeric >= 50) return 'bg-amber-500';
  return 'bg-rose-600';
}

export function semaphoreClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'saludable') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (normalized === 'atencion') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (normalized === 'transicion') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

export function priorityClass(value?: string | null) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critica' || normalized === 'critico') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (normalized === 'alta' || normalized === 'alto') return 'border-orange-200 bg-orange-50 text-orange-800';
  if (normalized === 'baja' || normalized === 'bajo') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}
