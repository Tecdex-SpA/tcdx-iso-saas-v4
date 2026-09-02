import Link from 'next/link';
import ReportStudioWorkspace from '@/components/math-governance/ReportStudioWorkspace';
import EnterpriseDomainWorkspaceShell from '@/components/enterprise-domain/EnterpriseDomainWorkspaceShell';

export default function ReportStudio() {
  return (
    <main className="min-h-full bg-[var(--tcdx-color-surface)] px-4 py-6 text-[var(--tcdx-color-text-ink)] sm:px-6">
      <EnterpriseDomainWorkspaceShell
        domain="reports"
        title="Diseñador de reportes"
        description="Selecciona información real, guarda o revisa la configuración y genera un archivo descargable. Una configuración guardada no es un informe generado."
        actions={
          <Link
            href="/reportes/generaciones"
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--tcdx-color-border)] bg-white px-4 text-sm font-semibold text-[var(--tcdx-color-text-ink)] hover:bg-[var(--tcdx-color-surface-subtle)]"
          >
            Abrir Informes generados
          </Link>
        }
      >
        <ReportStudioWorkspace />
      </EnterpriseDomainWorkspaceShell>
    </main>
  );
}
