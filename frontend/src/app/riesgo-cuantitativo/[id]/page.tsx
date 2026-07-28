import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function QuantitativeRisk360Page({
  params,
}: PageProps<'/riesgo-cuantitativo/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="quantitative_risks" entityId={id} />;
}
