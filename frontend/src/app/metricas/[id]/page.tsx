import FunctionalIndicatorCatalog from '@/components/indicators/FunctionalIndicatorCatalog';
import MetricsTenantContext from '@/components/math-governance/MetricsTenantContext';

export default async function MetricDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <MetricsTenantContext />
      <FunctionalIndicatorCatalog metricCode={id} />
    </main>
  );
}
