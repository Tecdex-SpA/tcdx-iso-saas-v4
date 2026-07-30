import BuilderSurface from './BuilderSurface';

export default function SampleSizeCalculator() {
  return (
    <BuilderSurface
      title="Tamaño de muestra"
      description="Calcula muestra con confianza, error y corrección finita."
      steps={["Población","Confianza","Error","Método","Resultado"]}
      resultCode="F5_5_SAMPLE_SIZE"
      primaryHref="/evaluaciones"
    />
  );
}
