import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import RiskRegisterWorkspace from '@/components/risk-control/RiskRegisterWorkspace';

export default function RiesgosPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="space-y-4" aria-busy="true">
            <div className="h-28 animate-pulse rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-surface-muted)]" />
            <div className="h-48 animate-pulse rounded-[var(--tcdx-radius-tecdex-lg)] bg-[var(--tcdx-color-surface-muted)]" />
          </div>
        }
      >
        <RiskRegisterWorkspace />
      </Suspense>
    </AppLayout>
  );
}
