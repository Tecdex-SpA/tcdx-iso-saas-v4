import Phase2Workspace from '@/components/phase2/Phase2Workspace';

export default async function Incident360Page({ params }: PageProps<'/incidentes/[id]'>) {
  const { id } = await params;
  return <Phase2Workspace view="incident-detail" id={id} />;
}
