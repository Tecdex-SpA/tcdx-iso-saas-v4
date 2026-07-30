import BuilderSurface from './BuilderSurface';

export default function HealthScoreBreakdown() {
  return (
    <BuilderSurface
      title="Desglose de health"
      description="Muestra pesos, componentes, coverage, Data Trust y estado incomplete/unmeasured."
      steps={["Health","Componentes","Pesos","Trust","Warnings","Lineage"]}
      resultCode="health-grc"
      primaryHref="/health"
    />
  );
}
