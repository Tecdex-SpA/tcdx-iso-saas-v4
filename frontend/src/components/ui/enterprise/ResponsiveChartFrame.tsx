'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ResponsiveContainer } from 'recharts';
import { cx } from './utils';

type ResponsiveChartFrameProps = {
  ariaDescription?: string;
  ariaLabel?: string;
  children: ReactElement;
  className?: string;
  fallback?: ReactNode;
  height?: number | string;
  minHeight?: number;
  minWidth?: number;
};

type ChartSize = {
  height: number;
  width: number;
};

function toCssSize(value: number | string) {
  return typeof value === 'number' ? `${value}px` : value;
}

export default function ResponsiveChartFrame({
  ariaDescription,
  ariaLabel,
  children,
  className,
  fallback,
  height = 240,
  minHeight = 48,
  minWidth = 120,
}: ResponsiveChartFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        height: Math.max(0, rect.height),
        width: Math.max(0, rect.width),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const ready = Boolean(
    size &&
    size.width >= minWidth &&
    size.height >= minHeight
  );

  return (
    <div
      ref={frameRef}
      aria-label={ariaLabel}
      aria-roledescription={ariaLabel ? 'visualizacion de datos' : undefined}
      className={cx(
        'tcdx-responsive-chart-frame min-w-0 overflow-hidden',
        className
      )}
      data-phase6-chart-frame="true"
      role={ariaLabel ? 'img' : undefined}
      style={{ '--tcdx-chart-frame-height': toCssSize(height) } as CSSProperties}
    >
      {ariaDescription ? <span className="sr-only">{ariaDescription}</span> : null}
      {ready ? (
        <ResponsiveContainer debounce={80} height="100%" minHeight={minHeight} minWidth={minWidth} width="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        fallback ?? (
          <div className="flex h-full min-h-[inherit] items-center justify-center rounded-[var(--tcdx-radius-tecdex-sm)] border border-dashed border-[var(--tcdx-color-border)] bg-white/70 text-xs font-semibold text-[var(--tcdx-color-text-secondary)]">
            Preparando gráfico…
          </div>
        )
      )}
    </div>
  );
}
