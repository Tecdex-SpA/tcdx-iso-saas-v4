import BuilderSurface from './BuilderSurface';

export default function FormulaEditor() {
  return (
    <BuilderSurface
      title="Editor de métrica oficial"
      description="Configura una métrica sin JavaScript, SQL arbitrario ni inputs ocultos."
      steps={["Definición","Tipo","Fuente","Variables","Fórmula","Unidad","Umbrales","Preview","Revisión","Publicación"]}
      resultCode="metric_builder"
      primaryHref="/metricas"
    />
  );
}
