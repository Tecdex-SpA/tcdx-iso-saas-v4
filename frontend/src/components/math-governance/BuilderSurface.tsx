import Link from 'next/link';

type BuilderSurfaceProps = {
  title: string;
  description: string;
  steps: string[];
  resultCode?: string;
  primaryHref?: string;
};

export default function BuilderSurface({ title, description, steps, resultCode, primaryHref = '/grc' }: BuilderSurfaceProps) {
  return (
    <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-[var(--tcdx-color-border)] bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tcdx-color-primary)]">Operación guiada</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--tcdx-color-text-ink)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--tcdx-color-text-secondary)]">{description}</p>
        </div>
        <Link href={primaryHref} className="inline-flex min-h-10 items-center rounded-md bg-[var(--tcdx-color-action-primary)] px-4 text-sm font-semibold text-white">
          Abrir flujo
        </Link>
      </div>
      {resultCode && (
        <div className="mt-4 rounded-md border border-[var(--tcdx-color-border)] bg-[var(--tcdx-color-surface)] p-3 text-sm">
          Resultado oficial: <span className="font-semibold">{resultCode}</span>. Requiere fórmula publicada, source contract permitido, Data Trust y lineage.
        </div>
      )}
      <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step} className="rounded-md border border-[var(--tcdx-color-border)] p-3 text-sm">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tcdx-color-primary)] text-xs font-semibold text-white">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
