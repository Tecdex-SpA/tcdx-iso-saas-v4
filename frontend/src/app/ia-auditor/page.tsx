'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';

export default function LegacyIaAuditorRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auditorias?view=ia');
  }, [router]);

  return (
    <AppLayout>
      <div className="p-6 text-sm text-slate-500">
        Redirigiendo a Auditorías...
      </div>
    </AppLayout>
  );
}
