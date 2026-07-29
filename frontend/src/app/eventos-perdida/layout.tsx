import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';

export default function LossEventsLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
