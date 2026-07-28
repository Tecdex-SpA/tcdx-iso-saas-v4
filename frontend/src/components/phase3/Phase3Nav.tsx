'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { href: '/operaciones-grc', label: 'Resumen' },
  { href: '/operaciones-grc/activacion', label: 'Activación' },
  { href: '/operaciones-grc/importar', label: 'Importar' },
  { href: '/unidades', label: 'Unidades' },
  { href: '/procesos', label: 'Procesos' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/bia', label: 'BIA' },
  { href: '/continuidad', label: 'Continuidad' },
  { href: '/continuidad/pruebas', label: 'Pruebas' },
  { href: '/crisis', label: 'Crisis' },
  { href: '/indicadores', label: 'KPI/KRI' },
  { href: '/riesgo-cuantitativo', label: 'Riesgo cuantitativo' },
];

export default function Phase3Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Operación integrada al GRC" className="flex flex-wrap gap-2">
      {sections.map(section => {
        const active = pathname === section.href
          || (section.href !== '/operaciones-grc' && pathname.startsWith(`${section.href}/`));
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'rounded-[var(--tcdx-radius-tecdex-sm)] border px-3 py-2 text-sm font-semibold transition',
              active
                ? 'border-[var(--tcdx-color-primary)] bg-[var(--tcdx-color-primary)] text-white'
                : 'border-[var(--tcdx-color-border)] bg-white text-[var(--tcdx-color-text-secondary)] hover:border-[var(--tcdx-color-primary)] hover:text-[var(--tcdx-color-text-primary)]',
            ].join(' ')}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
