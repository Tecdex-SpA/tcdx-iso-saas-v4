import LossAnalyticsPanel from '@/components/math-governance/LossAnalyticsPanel';
import Phase5Workspace from '@/components/phase5/Phase5Workspace';

export default function LossEventManager() {
  return (
    <Phase5Workspace
      title="Eventos de pérdida"
      description="Pérdidas operacionales con recuperación, pérdida neta, trazabilidad, aprobación y alimentación de KRI."
      endpoint="/api/loss-events"
      primaryLabel="eventos de pérdida"
      emptyMessage="No hay eventos de pérdida registrados."
      analyticsDomain="loss"
      columns={[
        { key: 'event_code', label: 'Evento' },
        { key: 'event_type', label: 'Tipo' },
        { key: 'gross_loss', label: 'Pérdida bruta' },
        { key: 'net_loss', label: 'Pérdida neta' },
        { key: 'status', label: 'Estado' },
      ]}
    >
      <LossAnalyticsPanel />
    </Phase5Workspace>
  );
}
