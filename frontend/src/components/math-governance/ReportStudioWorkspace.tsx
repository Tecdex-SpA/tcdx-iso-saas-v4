import OperationalBuilder from './OperationalBuilder';

export default function ReportStudioWorkspace() {
  return <OperationalBuilder kind="report" title="Diseñador de reportes" description="Elige qué informar, define periodo y formato, revisa la configuración y genera una salida descargable con datos oficiales existentes." defaultResultCode="health.grc" />;
}
