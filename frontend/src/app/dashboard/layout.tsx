import type { ReactNode } from 'react';
import GrcDecisionCenter from '@/components/math-governance/GrcDecisionCenter';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="mx-auto w-full max-w-[1680px] px-4 pb-8 md:px-6">
        <GrcDecisionCenter
          compact
          variant="summary"
          title="Resumen ejecutivo GRC"
          ctaHref="/grc"
          ctaLabel="Ver análisis GRC"
        />
      </div>
    </>
  );
}
