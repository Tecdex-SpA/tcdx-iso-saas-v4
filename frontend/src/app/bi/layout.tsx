import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';

export default function BusinessIntelligenceLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
