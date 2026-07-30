'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
};

type State = {
  failed: boolean;
  message: string;
};

export default class MetricsSectionBoundary extends Component<Props, State> {
  state: State = {
    failed: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      failed: true,
      message: error.message || 'La sección no pudo renderizarse.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('METRICS_SECTION_ERROR', {
      section: this.props.title,
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ failed: false, message: '' });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="rounded-[var(--tcdx-radius-tecdex-lg)] border border-red-200 bg-white p-5 shadow-[var(--tcdx-shadow-tecdex-sm)]" role="alert">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Sección aislada</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{this.props.title} no pudo mostrarse</h2>
        <p className="mt-2 text-sm text-slate-600">
          El resto de la vista continúa operativo. Reintenta esta sección sin perder la empresa activa ni la sesión.
        </p>
        {this.state.message && <p className="mt-2 text-xs text-slate-500">Detalle: {this.state.message}</p>}
        <button type="button" onClick={this.retry} className="mt-4 rounded-md bg-[var(--tcdx-color-action-primary)] px-4 py-2 text-sm font-semibold text-white">
          Reintentar sección
        </button>
      </section>
    );
  }
}
