import OperationalBuilder from './OperationalBuilder';

export default function DashboardBuilder() {
  return <OperationalBuilder kind="dashboard" title="Dashboard Builder" description="Crea dashboards, agrega widgets de resultados oficiales, guarda, publica, renderiza y genera snapshots trazables." defaultResultCode="health.grc" />;
}
