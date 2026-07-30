import BuilderSurface from './BuilderSurface';

export default function CalculationPreview() {
  return (
    <BuilderSurface
      title="Preview de cálculo"
      description="Ejecuta preview con cobertura, trust, warnings, explicación y lineage."
      steps={["Período","Dataset","Validación","Resultado","Warnings","Lineage"]}
      resultCode="calculation_preview"
      primaryHref="/grc"
    />
  );
}
