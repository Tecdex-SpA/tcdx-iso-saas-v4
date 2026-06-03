'use client';

import MvpViewShell from '@/components/mvp/MvpViewShell';

export default function ConfiguracionPage() {
  return (
    <MvpViewShell
      eyebrow="Vista consolidada Sprint 1"
      title="Configuración"
      description="Administración tenant para usuarios y perfil empresa. La consola SaaS interna permanece separada del flujo cliente."
      links={[
        {
          href: '/usuarios',
          title: 'Usuarios',
          description: 'Gestión de usuarios y roles permitidos dentro del tenant.',
          feature: 'configuration.users.manage',
          tone: 'blue',
        },
        {
          href: '/perfil-empresa',
          title: 'Perfil empresa',
          description: 'Contexto del tenant para priorización de controles, evidencias, riesgos y reportes.',
          feature: 'configuration.company_profile.manage',
          tone: 'emerald',
        },
      ]}
    />
  );
}
