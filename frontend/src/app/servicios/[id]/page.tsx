import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function Service360Page({ params }: PageProps<'/servicios/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="services" entityId={id} />;
}
