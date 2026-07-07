type Props = {
  status?: string;
  error?: string;
  onRetry?: () => void;
};

export default function IntelligenceErrorState({ status = 'error', error, onRetry }: Props) {
  const isTimeout = status === 'timeout';
  const isForbidden = status === 'forbidden';
  const title = isTimeout
    ? 'Timeout de Intelligence Layer'
    : isForbidden
      ? 'Sin permisos para Intelligence Layer'
      : 'Intelligence Layer no disponible';

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">{title}</div>
      <p className="mt-1 leading-6">
        {error || 'La UI sigue operando con los datos disponibles del módulo.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
