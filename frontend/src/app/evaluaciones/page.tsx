import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function SurveyCampaignManager() {
  return (
    <Phase5Workspace
      title="Evaluaciones y campañas"
      description="Campañas, destinatarios, progreso, cierre, evaluación, aprobación y consecuencias GRC con preview."
      endpoint="/api/survey-campaigns"
      primaryLabel="campañas"
      emptyMessage="No hay campañas de evaluación configuradas."
      columns={[
        { key: 'campaign_key', label: 'Campaña' },
        { key: 'display_name', label: 'Nombre' },
        { key: 'status', label: 'Estado' },
        { key: 'ends_at', label: 'Cierre' },
      ]}
    />
  );
}
