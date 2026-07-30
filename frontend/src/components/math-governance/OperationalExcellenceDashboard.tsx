import BuilderSurface from './BuilderSurface';

export default function OperationalExcellenceDashboard() {
  return (
    <BuilderSurface
      title="Operational Excellence"
      description="Consolida eficacia, eficiencia, estabilidad, calidad, oportunidad, riesgo y cumplimiento."
      steps={["Componentes","Fuentes","Health","Warnings","Drill-down","Snapshot"]}
      resultCode="operational-excellence"
      primaryHref="/grc"
    />
  );
}
