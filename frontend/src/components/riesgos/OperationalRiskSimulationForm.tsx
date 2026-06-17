import type { ReactNode } from 'react';

export type OperationalRiskSimulationModel = 'ISO27001_TTIA' | 'ISO9001_COP_SIMPLE' | 'ISO9001_COP_AVANZADO';

export type OperationalRiskSimulationFormState = {
  norma_tipo: 'ISO27001' | 'ISO9001';
  modelo_usado: OperationalRiskSimulationModel;
  nombre_riesgo: string;
  proceso_afectado: string;
  frecuencia_min: string;
  frecuencia_mode: string;
  frecuencia_max: string;
  impacto_min: string;
  impacto_mode: string;
  impacto_max: string;
  tasa_error_min: string;
  tasa_error_mode: string;
  tasa_error_max: string;
  volumen_operativo_anual: string;
  umbral_disrupcion_critica_horas: string;
  iteraciones: string;
};

type OperationalRiskSimulationFormProps = {
  form: OperationalRiskSimulationFormState;
  onChange: (field: keyof OperationalRiskSimulationFormState, value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
  error?: string;
  successMessage?: string;
};

function inputClassName() {
  return 'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export default function OperationalRiskSimulationForm({
  form,
  onChange,
  onSubmit,
  loading,
  disabled = false,
  error = '',
  successMessage = '',
}: OperationalRiskSimulationFormProps) {
  const numberInput = (
    label: string,
    field: keyof OperationalRiskSimulationFormState,
    min = '0',
    step = '0.01'
  ) => (
    <FieldLabel label={label}>
      <input
        type="number"
        min={min}
        step={step}
        value={form[field]}
        onChange={(event) => onChange(field, event.target.value)}
        className={inputClassName()}
      />
    </FieldLabel>
  );

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Parametros de simulacion Beta-PERT</h2>
            <p className="text-sm text-slate-500">
              Ingresa supuestos operativos y guarda la simulacion para alimentar KPIs, matriz y tabla cuantitativa.
            </p>
          </div>
          <span className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
            Estima impacto operacional en horas, no impacto financiero.
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <FieldLabel label="Norma">
            <select
              value={form.norma_tipo}
              onChange={(event) => onChange('norma_tipo', event.target.value)}
              className={inputClassName()}
            >
              <option value="ISO27001">ISO27001</option>
              <option value="ISO9001">ISO9001</option>
            </select>
          </FieldLabel>

          <FieldLabel label="Modelo">
            <select
              value={form.modelo_usado}
              onChange={(event) => onChange('modelo_usado', event.target.value)}
              className={inputClassName()}
            >
              {form.norma_tipo === 'ISO27001' ? (
                <option value="ISO27001_TTIA">ISO27001_TTIA</option>
              ) : (
                <>
                  <option value="ISO9001_COP_SIMPLE">ISO9001_COP_SIMPLE</option>
                  <option value="ISO9001_COP_AVANZADO">ISO9001_COP_AVANZADO</option>
                </>
              )}
            </select>
          </FieldLabel>

          {numberInput('Iteraciones', 'iteraciones', '10000', '1')}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FieldLabel label="Nombre del riesgo">
            <input
              type="text"
              value={form.nombre_riesgo}
              onChange={(event) => onChange('nombre_riesgo', event.target.value)}
              className={inputClassName()}
              placeholder="Interrupcion de servicio critico"
            />
          </FieldLabel>

          <FieldLabel label="Proceso afectado">
            <input
              type="text"
              value={form.proceso_afectado}
              onChange={(event) => onChange('proceso_afectado', event.target.value)}
              className={inputClassName()}
              placeholder="Continuidad operacional"
            />
          </FieldLabel>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {numberInput('Frecuencia minima', 'frecuencia_min')}
          {numberInput('Frecuencia mas probable', 'frecuencia_mode')}
          {numberInput('Frecuencia maxima', 'frecuencia_max')}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {numberInput(form.norma_tipo === 'ISO27001' ? 'MTTR minimo (horas)' : 'Reproceso minimo (horas)', 'impacto_min')}
          {numberInput(form.norma_tipo === 'ISO27001' ? 'MTTR mas probable (horas)' : 'Reproceso mas probable (horas)', 'impacto_mode')}
          {numberInput(form.norma_tipo === 'ISO27001' ? 'MTTR maximo (horas)' : 'Reproceso maximo (horas)', 'impacto_max')}
        </div>

        {form.modelo_usado === 'ISO9001_COP_AVANZADO' && (
          <div className="rounded border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">Parametros avanzados ISO9001</div>
            <div className="grid gap-3 md:grid-cols-4">
              {numberInput('Tasa error minima (%)', 'tasa_error_min')}
              {numberInput('Tasa error mas probable (%)', 'tasa_error_mode')}
              {numberInput('Tasa error maxima (%)', 'tasa_error_max')}
              {numberInput('Volumen anual', 'volumen_operativo_anual', '0', '1')}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {numberInput('Umbral critico (horas)', 'umbral_disrupcion_critica_horas')}
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || loading}
            className="inline-flex items-center justify-center rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Ejecutando...' : 'Ejecutar y guardar simulacion'}
          </button>
          {disabled && (
            <p className="text-xs text-slate-500">
              Tu rol puede consultar resultados, pero no crear simulaciones operativas.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
