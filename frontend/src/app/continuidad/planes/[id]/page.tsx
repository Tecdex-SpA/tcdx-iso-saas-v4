import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function ContinuityPlan360Page({
  params,
}: PageProps<'/continuidad/planes/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="continuity" entityId={id} />;
}
