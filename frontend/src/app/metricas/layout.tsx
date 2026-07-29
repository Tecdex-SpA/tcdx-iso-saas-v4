import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';

export default function MetricsLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
