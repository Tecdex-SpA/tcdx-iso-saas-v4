'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';

export default function PlanesAccionPage() {
  return (
    <MvpViewShell
      eyebrow="Gestión operacional"
      title="Planes de acción"
      description="Seguimiento de planes reales y acciones recomendadas, con revisión humana antes de convertir sugerencias en trabajo operativo."
      links={[
        {
          href: '/plan-accion',
          title: 'Plan de acción',
          description: 'Gestión de acciones, responsables, estados y evidencia de avance.',
          feature: 'action_plans.functional_subflows.read',
          tone: 'emerald',
        },
        {
          href: '/acciones-recomendadas',
          title: 'Acciones recomendadas',
          description: 'Recomendaciones originadas desde diagnóstico, riesgos, evidencias y auditoría.',
          feature: 'action_plans.functional_subflows.read',
          tone: 'blue',
        },
      ]}
    />
  );
}
