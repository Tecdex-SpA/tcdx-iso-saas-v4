'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';

export default function RiesgosPage() {
  return (
    <MvpViewShell
      eyebrow="Gestión operacional"
      title="Riesgos"
      description="Entrada operacional para matriz de riesgos, simulación de riesgo operacional y riesgos asociados a activos del tenant."
      links={[
        {
          href: '/matriz-riesgo',
          title: 'Matriz de riesgos',
          description: 'Heatmap ISO, priorización por impacto/probabilidad y simulación operativa Beta-PERT.',
          feature: 'risks.functional_subflows.read',
          tone: 'amber',
        },
        {
          href: '/activos',
          title: 'Activos',
          description: 'Inventario, criticidad y riesgos asociados a activos, amenazas y controles.',
          feature: 'risks.functional_subflows.read',
          tone: 'slate',
        },
      ]}
    />
  );
}
