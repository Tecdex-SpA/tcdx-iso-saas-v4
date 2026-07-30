import OperationalBuilder from './OperationalBuilder';

export default function SurveyScoringBuilder() {
  return <OperationalBuilder kind="survey" title="Constructor de scoring de encuestas" description="Crea encuesta, versión, secciones, preguntas, pesos, branching, campaña y scoring oficial con cobertura y propuestas GRC." domain="survey" defaultResultCode="survey.score" />;
}
