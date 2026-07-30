import BuilderSurface from './BuilderSurface';

export default function ThresholdEditor() {
  return (
    <BuilderSurface
      title="Umbrales oficiales"
      description="Define umbrales versionados sin alterar fórmulas publicadas."
      steps={["Rango","Severidad","Unidad","Vigencia","Publicación"]}
      resultCode="thresholds"
      primaryHref="/metricas"
    />
  );
}
