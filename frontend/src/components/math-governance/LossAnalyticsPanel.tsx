import BuilderSurface from './BuilderSurface';

export default function LossAnalyticsPanel() {
  return (
    <BuilderSurface
      title="Analítica de pérdidas"
      description="Opera pérdida neta, expected loss, VaR, Monte Carlo, KRI y concentración."
      steps={["Alta","Clasificación","Recuperación","Net loss","Estadística","VaR","Monte Carlo","Cierre"]}
      resultCode="F5_5_EXPECTED_LOSS"
      primaryHref="/eventos-perdida"
    />
  );
}
