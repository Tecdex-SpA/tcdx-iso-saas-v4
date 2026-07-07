'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';
import StrengthenedDiagnosticPanel from '@/components/diagnostics/StrengthenedDiagnosticPanel';
import AuditReadinessCard from '@/components/intelligence/AuditReadinessCard';
import IntelligenceEmptyState from '@/components/intelligence/IntelligenceEmptyState';
import IntelligenceErrorState from '@/components/intelligence/IntelligenceErrorState';
import useIntelligenceBrief from '@/hooks/useIntelligenceBrief';

export default function CumplimientoAuditoriaPage() {
  const intelligence = useIntelligenceBrief();

  return (
    <MvpViewShell
      eyebrow="Vista consolidada Sprint 1"
      title="Cumplimiento y Auditoría"
      description="Entrada única para diagnóstico, controles, SoA, ciclo de vida ISO, auditorías, hallazgos y no conformidades. Las acciones disponibles dependen del rol y del alcance del tenant."
      notes={[
        'La IA apoya el análisis, pero no certifica cumplimiento ni reemplaza revisión humana.',
        'Los movimientos del ciclo de vida quedan sujetos a solicitud del administrador de cumplimiento y revisión del auditor.',
      ]}
      links={[
        {
          href: '/diagnostico',
          title: 'Diagnóstico de cumplimiento',
          description: 'Evaluación de brechas y preparación por norma activa.',
          feature: 'compliance.functional_subflows.read',
          tone: 'blue',
        },
        {
          href: '/iso-health',
          title: 'Salud del sistema',
          description: 'Health global, por norma/proceso y KPIs mínimos reproducibles.',
          feature: 'compliance.functional_subflows.read',
          tone: 'emerald',
        },
        {
          href: '/controles',
          title: 'Controles',
          description: 'Gestión y revisión de controles aplicables al tenant.',
          feature: 'compliance.functional_subflows.read',
          tone: 'emerald',
        },
        {
          href: '/soa',
          title: 'SoA',
          description: 'Declaración de aplicabilidad para normas de seguridad cuando esté habilitada.',
          feature: 'compliance.functional_subflows.read',
          tone: 'slate',
        },
        {
          href: '/ciclo-vida',
          title: 'Ciclo de vida ISO',
          description: 'Progreso por norma y operación, con solicitudes y revisión auditora.',
          feature: 'compliance.functional_subflows.read',
          tone: 'amber',
        },
        {
          href: '/auditorias',
          title: 'Auditorías',
          description: 'Programa, preparación documental y ejecución de auditorías.',
          feature: 'compliance.functional_subflows.read',
          tone: 'blue',
        },
        {
          href: '/hallazgos',
          title: 'Hallazgos',
          description: 'Registro, revisión y seguimiento de hallazgos.',
          feature: 'compliance.functional_subflows.read',
          tone: 'rose',
        },
        {
          href: '/no-conformidades',
          title: 'No conformidades',
          description: 'Gestión de no conformidades y cierre controlado.',
          feature: 'compliance.functional_subflows.read',
          tone: 'rose',
        },
      ]}
    >
      {intelligence.loading ? (
        <div className="mb-6 h-48 animate-pulse rounded-lg border border-slate-200 bg-white" />
      ) : intelligence.data ? (
        <div className="mb-6">
          <AuditReadinessCard brief={intelligence.data} />
        </div>
      ) : intelligence.status === 'error' || intelligence.status === 'timeout' || intelligence.status === 'forbidden' ? (
        <div className="mb-6">
          <IntelligenceErrorState status={intelligence.status} error={intelligence.error} onRetry={intelligence.refresh} />
        </div>
      ) : (
        <div className="mb-6">
          <IntelligenceEmptyState
            title="Sin readiness inteligente"
            description="El diagnóstico sigue disponible; la preparación auditora inteligente se mostrará cuando existan datos y fundamento suficientes."
          />
        </div>
      )}
      <StrengthenedDiagnosticPanel />
    </MvpViewShell>
  );
}
