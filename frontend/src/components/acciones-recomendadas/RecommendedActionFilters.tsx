import type { RecommendedActionFilters } from './types';

type Props = {
  filters: RecommendedActionFilters;
  standards: string[];
  sources: string[];
  types: string[];
  onChange: (next: RecommendedActionFilters) => void;
  onRefresh: () => void;
};

export default function RecommendedActionFilters({
  filters,
  standards,
  sources,
  types,
  onChange,
  onRefresh,
}: Props) {
  const update = (key: keyof RecommendedActionFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-7">
        <select
          value={filters.status}
          onChange={(event) => update('status', event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="pending">Pendientes</option>
          <option value="applied">Convertidas</option>
          <option value="rejected">Descartadas</option>
          <option value="">Todos los estados</option>
        </select>

        <select
          value={filters.standard}
          onChange={(event) => update('standard', event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todas las normas</option>
          {standards.map((standard) => (
            <option key={standard} value={standard}>{standard}</option>
          ))}
        </select>

        <select
          value={filters.priority}
          onChange={(event) => update('priority', event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Toda prioridad</option>
          <option value="critica">Critica</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        <select
          value={filters.type}
          onChange={(event) => update('type', event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todo tipo</option>
          {types.map((type) => (
            <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
          ))}
        </select>

        <select
          value={filters.source}
          onChange={(event) => update('source', event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todo origen</option>
          {sources.map((source) => (
            <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>
          ))}
        </select>

        <input
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Buscar accion..."
          className="rounded border border-gray-300 px-3 py-2 text-sm lg:col-span-1"
        />

        <button
          type="button"
          onClick={onRefresh}
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
