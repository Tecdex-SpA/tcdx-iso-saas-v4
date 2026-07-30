import OperationalBuilder from './OperationalBuilder';

export default function ControlEffectivenessEditor() {
  return <OperationalBuilder kind="metric" title="Efectividad de controles" description="Configura D/I/O/E, source contract, thresholds y ejecución oficial para efectividad individual o combinada." domain="control" defaultResultCode="control.effectiveness" />;
}
