import Phase2Workspace from '@/components/phase2/Phase2Workspace';

export default async function Supplier360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Phase2Workspace view="supplier-detail" id={id} />;
}
