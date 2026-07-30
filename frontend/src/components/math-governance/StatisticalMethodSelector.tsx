import BuilderSurface from './BuilderSurface';

export default function StatisticalMethodSelector() {
  return (
    <BuilderSurface
      title="Métodos estadísticos"
      description="Selecciona percentiles, intervalos, tendencia, Cronbach, muestra y Monte Carlo."
      steps={["Método","Supuestos","Muestra","Semilla","Tolerancia","Resultado"]}
      resultCode="statistics"
      primaryHref="/metricas"
    />
  );
}
