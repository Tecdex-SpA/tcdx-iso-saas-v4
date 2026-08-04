import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function Bia360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Phase3Workspace view="bia" entityId={id} />;
}
