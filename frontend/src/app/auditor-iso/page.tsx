'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';

export default function LegacyAuditorIsoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auditorias?view=preauditoria');
  }, [router]);

  return (
    <AppLayout>
      <div className="p-6 text-sm text-slate-500">
        Redirigiendo a Auditorías...
      </div>
    </AppLayout>
  );
}
