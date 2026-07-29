import type { ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';

export default function GrcLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
