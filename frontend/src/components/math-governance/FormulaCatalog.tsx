import BuilderSurface from './BuilderSurface';

export default function FormulaCatalog() {
  return (
    <BuilderSurface
      title="Catálogo de fórmulas"
      description="Consulta fórmulas oficiales publicadas, versión, unidad, precisión, source contract y estado."
      steps={["Seleccionar dominio","Revisar fórmula","Validar source contract","Consultar evidencia","Abrir explicación"]}
      resultCode="F5_5_GRC_HEALTH"
      primaryHref="/metricas"
    />
  );
}
