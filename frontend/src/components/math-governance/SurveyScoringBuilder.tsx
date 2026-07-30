import BuilderSurface from './BuilderSurface';

export default function SurveyScoringBuilder() {
  return (
    <BuilderSurface
      title="Scoring de encuestas"
      description="Define secciones, dimensiones, pesos, máximos, branching y no aplica."
      steps={["General","Secciones","Preguntas","Pesos","Branching","Preview","Publicación","Campaña"]}
      resultCode="F5_5_SURVEY_SCORE"
      primaryHref="/encuestas"
    />
  );
}
