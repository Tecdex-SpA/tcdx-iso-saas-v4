type Props = {
  title?: string;
  description?: string;
};

export default function IntelligenceEmptyState({
  title = 'Sin datos inteligentes disponibles',
  description = 'Faltan datos operacionales del tenant o cobertura KB suficiente para construir una lectura confiable.',
}: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-1 leading-6">{description}</p>
    </div>
  );
}
