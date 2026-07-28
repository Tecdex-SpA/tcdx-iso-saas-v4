import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function Crisis360Page({ params }: PageProps<'/crisis/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="crisis" entityId={id} />;
}
