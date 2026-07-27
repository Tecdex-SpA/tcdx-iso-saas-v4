import Phase2Workspace from '@/components/phase2/Phase2Workspace';

export default async function ProcessingActivity360Page({ params }: PageProps<'/privacidad/actividades/[id]'>) {
  const { id } = await params;
  return <Phase2Workspace view="processing-detail" id={id} />;
}
