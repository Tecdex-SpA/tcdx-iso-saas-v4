import OperationalBuilder from './OperationalBuilder';

export default function SourceBindingEditor() {
  return <OperationalBuilder kind="metric" title="Editor de source binding" description="Asocia métrica, resultado oficial y source contract tenant-scoped; valida disponibilidad y ejecuta preview oficial antes de persistir." domain="data_quality" defaultResultCode="data.completeness" />;
}
