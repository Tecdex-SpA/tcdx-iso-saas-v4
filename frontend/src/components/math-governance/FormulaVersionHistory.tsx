import BuilderSurface from './BuilderSurface';

export default function FormulaVersionHistory() {
  return (
    <BuilderSurface
      title="Historial de versiones"
      description="Muestra versiones, checksum, vigencia, aprobación e inmutabilidad."
      steps={["Seleccionar fórmula","Comparar versión","Ver checksum","Ver aprobación","Ver consumidores"]}
      resultCode="formula_version_history"
      primaryHref="/metricas"
    />
  );
}
