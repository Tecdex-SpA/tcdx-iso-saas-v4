import SurveyScoringBuilder from '@/components/math-governance/SurveyScoringBuilder';
import AppLayout from '@/components/AppLayout';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function SurveyBuilder() {
  return (
    <AppLayout>
      <Phase5Workspace
        title="Encuestas"
        description="Encuestas, cuestionarios, autoevaluaciones, evaluaciones de proveedor, scoring, branching y campañas."
        endpoint="/api/surveys"
        primaryLabel="encuestas"
        emptyMessage="No hay encuestas configuradas para este tenant."
        analyticsDomain="survey"
        domainWorkspace="intelligence"
        columns={[
          { key: 'survey_key', label: 'Clave' },
          { key: 'display_name', label: 'Nombre' },
          { key: 'survey_type', label: 'Tipo' },
          { key: 'status', label: 'Estado' },
        ]}
      >
        <SurveyScoringBuilder />
      </Phase5Workspace>
    </AppLayout>
  );
}
