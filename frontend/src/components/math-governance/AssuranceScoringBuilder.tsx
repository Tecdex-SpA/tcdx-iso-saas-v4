import BuilderSurface from './BuilderSurface';

export default function AssuranceScoringBuilder() {
  return (
    <BuilderSurface
      title="Assurance scoring"
      description="Opera pruebas, población, muestra, resultados, excepción, hallazgo y acción."
      steps={["Definir test","Población","Muestra","Ejecución","Evidencia","Resultado","Aprobación","Re-test"]}
      resultCode="F5_5_ASSURANCE_SCORE"
      primaryHref="/tests"
    />
  );
}
