'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';
import StrengthenedDiagnosticPanel from '@/components/diagnostics/StrengthenedDiagnosticPanel';

export default function CumplimientoAuditoriaPage() {
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
          feature: 'compliance.read',
          tone: 'blue',
        },
        {
          href: '/controles',
          title: 'Controles',
          description: 'Gestión y revisión de controles aplicables al tenant.',
          feature: 'compliance.read',
          tone: 'emerald',
        },
        {
          href: '/soa',
          title: 'SoA',
          description: 'Declaración de aplicabilidad para normas de seguridad cuando esté habilitada.',
          feature: 'compliance.read',
          tone: 'slate',
        },
        {
          href: '/ciclo-vida',
          title: 'Ciclo de vida ISO',
          description: 'Progreso por norma y operación, con solicitudes y revisión auditora.',
          feature: 'compliance.lifecycle.read',
          tone: 'amber',
        },
        {
          href: '/auditorias',
          title: 'Auditorías',
          description: 'Programa, preparación documental y ejecución de auditorías.',
          feature: 'compliance.read',
          tone: 'blue',
        },
        {
          href: '/hallazgos',
          title: 'Hallazgos',
          description: 'Registro, revisión y seguimiento de hallazgos.',
          feature: 'compliance.read',
          tone: 'rose',
        },
        {
          href: '/no-conformidades',
          title: 'No conformidades',
          description: 'Gestión de no conformidades y cierre controlado.',
          feature: 'compliance.read',
          tone: 'rose',
        },
      ]}
    >
      <StrengthenedDiagnosticPanel />
    </MvpViewShell>
  );
}
