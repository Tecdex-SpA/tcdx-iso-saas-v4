import { redirect } from 'next/navigation';

export default function DashboardKpiLegacyPage() {
  redirect('/dashboard?view=kpi');
}
