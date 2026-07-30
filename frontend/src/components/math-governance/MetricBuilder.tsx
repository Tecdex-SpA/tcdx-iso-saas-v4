import BuilderSurface from './BuilderSurface';

export default function MetricBuilder() {
  return (
    <BuilderSurface
      title="Constructor de métricas"
      description="Experiencia principal para definir, validar, publicar y ejecutar métricas oficiales."
      steps={["Definición","Fuente","Variables","Fórmula","Umbrales","Preview","Publicación","Ejecución"]}
      resultCode="metric_builder"
      primaryHref="/metricas"
    />
  );
}
