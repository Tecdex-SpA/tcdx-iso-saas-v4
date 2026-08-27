import AppLayout from '@/components/AppLayout';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';
import RecommendedActionsDashboard from '@/components/acciones-recomendadas/RecommendedActionsDashboard';

export default function AccionesRecomendadasPage() {
  return (
    <AppLayout>
      <EnterpriseDomainWorkspaceShell
        domain="audit"
        eyebrow="Auditoría y mejora"
        title="Acciones recomendadas"
        description="Sugerencias operativas generadas desde diagnóstico, riesgos, documentos y controles ISO, siempre con revisión humana antes de crear registros."
      >
        <RecommendedActionsDashboard compactHeader />
      </EnterpriseDomainWorkspaceShell>
    </AppLayout>
  );
}
