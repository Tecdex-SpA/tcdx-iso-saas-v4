import { dataQualityWarnings } from './utils';
import type { IntelligenceBrief } from './types';

type Props = {
  brief?: IntelligenceBrief | null;
  maxItems?: number;
};

export default function DataQualityWarnings({ brief, maxItems = 4 }: Props) {
  const warnings = dataQualityWarnings(brief).slice(0, maxItems);
  const hasKnowledge = Number(brief?.metadata?.knowledge_items_count || brief?.knowledge_context?.knowledge_items_used?.length || 0) > 0;

  if (!warnings.length && hasKnowledge) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-semibold">Limitaciones y calidad de datos</div>
      {!hasKnowledge && (
        <p className="mt-2">No hay fundamento KB aplicable para parte de la lectura. La recomendación se limita a reglas y datos confirmados.</p>
      )}
      {warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
