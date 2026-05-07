import type { UnifiedIsoQuickLink } from './types';

type Props = {
  links: UnifiedIsoQuickLink[];
};

export default function IsoQuickLinks({ links }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Accesos rapidos</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={`${link.kind}-${link.route}`}
            href={link.route}
            className="rounded border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}
