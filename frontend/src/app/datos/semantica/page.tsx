import SemanticLayerWorkspace from '@/components/semantic/SemanticLayerWorkspace';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';

export default function SemanticDataPage() {
  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <EnterpriseDomainWorkspaceShell
        domain="data"
        eyebrow="Gobierno de datos"
        title="Capa semántica GRC"
        description="Administra disponibilidad, calidad, vigencia y trazabilidad de las fuentes usadas por métricas oficiales."
      >
        <SemanticLayerWorkspace compactHeader />
      </EnterpriseDomainWorkspaceShell>
    </main>
  );
}
