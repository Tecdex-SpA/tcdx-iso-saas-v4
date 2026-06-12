import { redirect } from 'next/navigation';

export default function CentroControlIsoLegacyPage() {
  redirect('/dashboard?view=iso');
}
