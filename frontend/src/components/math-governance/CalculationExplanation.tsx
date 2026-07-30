import BuilderSurface from './BuilderSurface';

export default function CalculationExplanation() {
  return (
    <BuilderSurface
      title="¿Cómo se calculó?"
      description="Panel de explicabilidad con fórmula, variables, fuentes, precisión y limitaciones."
      steps={["Fórmula","Variables","Fuentes","Exclusiones","Trust","Lineage"]}
      resultCode="explainability"
      primaryHref="/grc"
    />
  );
}
