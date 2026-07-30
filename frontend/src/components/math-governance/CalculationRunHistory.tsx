import BuilderSurface from './BuilderSurface';

export default function CalculationRunHistory() {
  return (
    <BuilderSurface
      title="Historial de ejecuciones"
      description="Lista calculation runs, snapshots, outputs y consumidores."
      steps={["Filtrar","Comparar","Explicar","Lineage","Descargar evidencia"]}
      resultCode="calculation_runs"
      primaryHref="/grc"
    />
  );
}
