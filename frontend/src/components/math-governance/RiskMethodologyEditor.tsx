import BuilderSurface from './BuilderSurface';

export default function RiskMethodologyEditor() {
  return (
    <BuilderSurface
      title="Metodología de riesgo"
      description="Configura matriz, cuantificación, expected loss y Monte Carlo sin mezclar escalas."
      steps={["Escala","Probabilidad","Impacto","Control","Residual","Umbral"]}
      resultCode="F5_5_RESIDUAL_RISK"
      primaryHref="/riesgos"
    />
  );
}
