import { redirect } from 'next/navigation';

export default function CommandCenterIsoPage() {
  redirect('/dashboard?view=iso');
}
