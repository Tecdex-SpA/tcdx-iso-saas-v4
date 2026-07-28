import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function Process360Page({ params }: PageProps<'/procesos/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="processes" entityId={id} />;
}
