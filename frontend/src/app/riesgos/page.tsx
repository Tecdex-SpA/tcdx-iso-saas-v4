'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';

export default function RiesgosPage() {
  return (
    <MvpViewShell
      eyebrow="Vista consolidada Sprint 1"
      title="Riesgos"
      description="Entrada MVP para activos y matriz de riesgos, limitada al valor de cumplimiento y auditoría disponible hoy."
      links={[
        {
          href: '/matriz-riesgo',
          title: 'Matriz de riesgos',
          description: 'Riesgos ISO priorizados por contexto, controles y evidencias.',
          feature: 'risks.read',
          tone: 'amber',
        },
        {
          href: '/activos',
          title: 'Activos',
          description: 'Inventario de activos usado como contexto para riesgos y controles.',
          feature: 'risks.read',
          tone: 'slate',
        },
      ]}
    />
  );
}
