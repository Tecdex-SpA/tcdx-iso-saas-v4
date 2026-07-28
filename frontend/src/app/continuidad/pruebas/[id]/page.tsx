import Phase3Workspace from '@/components/phase3/Phase3Workspace';

export default async function ContinuityTest360Page({
  params,
}: PageProps<'/continuidad/pruebas/[id]'>) {
  const { id } = await params;
  return <Phase3Workspace view="continuity_tests" entityId={id} />;
}
