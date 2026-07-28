import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function Metric360Page({ params }: PageProps<'/indicadores/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="metrics" entityId={id} />;
}
