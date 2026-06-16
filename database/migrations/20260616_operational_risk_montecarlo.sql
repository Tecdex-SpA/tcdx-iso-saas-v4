-- =========================================================
-- TCDX ISO SaaS - Operational Risk Monte Carlo
-- v4 MVP: simulacion operacional Beta-PERT para ISO27001/ISO9001.
--
-- Modo no destructivo:
-- - Solo crea tablas nuevas operational_risk_*.
-- - No modifica matriz de riesgo existente.
-- - No guarda muestras crudas; solo metricas agregadas e histograma.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS operational_risk_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_risk_id uuid NULL REFERENCES iso_risk_matrix_items(id),
  norma_tipo text NOT NULL,
  modelo_usado text NOT NULL,
  nombre_riesgo text NOT NULL,
  proceso_afectado text NULL,
  descripcion text NULL,
  frecuencia_min numeric NOT NULL,
  frecuencia_mode numeric NOT NULL,
  frecuencia_max numeric NOT NULL,
  impacto_min numeric NULL,
  impacto_mode numeric NULL,
  impacto_max numeric NULL,
  tasa_error_min numeric NULL,
  tasa_error_mode numeric NULL,
  tasa_error_max numeric NULL,
  tiempo_subsanacion_min numeric NULL,
  tiempo_subsanacion_mode numeric NULL,
  tiempo_subsanacion_max numeric NULL,
  volumen_operativo_anual numeric NULL,
  umbral_disrupcion_critica_horas numeric NULL,
  iteraciones integer NOT NULL DEFAULT 10000,
  media_operativa_anual numeric NOT NULL,
  mediana_operativa_anual numeric NULL,
  peor_escenario_p90 numeric NULL,
  peor_escenario_p95 numeric NOT NULL,
  peor_escenario_p99 numeric NULL,
  desviacion_estandar numeric NULL,
  minimo_simulado numeric NULL,
  maximo_simulado numeric NULL,
  probabilidad_disrupcion_critica numeric NULL,
  histograma_json jsonb NULL,
  input_json jsonb NOT NULL,
  result_json jsonb NOT NULL,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_operational_risk_norma CHECK (norma_tipo IN ('ISO27001', 'ISO9001')),
  CONSTRAINT chk_operational_risk_modelo CHECK (modelo_usado IN ('ISO27001_TTIA', 'ISO9001_COP_SIMPLE', 'ISO9001_COP_AVANZADO')),
  CONSTRAINT chk_operational_risk_iterations CHECK (iteraciones >= 10000 AND iteraciones <= 100000),
  CONSTRAINT chk_operational_risk_frequency_order CHECK (
    frecuencia_min >= 0 AND frecuencia_mode >= frecuencia_min AND frecuencia_max >= frecuencia_mode
  ),
  CONSTRAINT chk_operational_risk_impact_order CHECK (
    impacto_min IS NULL OR (
      impacto_min >= 0 AND impacto_mode >= impacto_min AND impacto_max >= impacto_mode
    )
  ),
  CONSTRAINT chk_operational_risk_error_order CHECK (
    tasa_error_min IS NULL OR (
      tasa_error_min >= 0 AND tasa_error_mode >= tasa_error_min AND tasa_error_max >= tasa_error_mode
    )
  ),
  CONSTRAINT chk_operational_risk_subsanacion_order CHECK (
    tiempo_subsanacion_min IS NULL OR (
      tiempo_subsanacion_min >= 0
      AND tiempo_subsanacion_mode >= tiempo_subsanacion_min
      AND tiempo_subsanacion_max >= tiempo_subsanacion_mode
    )
  ),
  CONSTRAINT chk_operational_risk_threshold CHECK (
    umbral_disrupcion_critica_horas IS NULL OR umbral_disrupcion_critica_horas >= 0
  ),
  CONSTRAINT chk_operational_risk_probability CHECK (
    probabilidad_disrupcion_critica IS NULL
    OR (probabilidad_disrupcion_critica >= 0 AND probabilidad_disrupcion_critica <= 1)
  )
);

CREATE TABLE IF NOT EXISTS operational_risk_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  simulation_id uuid NOT NULL REFERENCES operational_risk_simulations(id) ON DELETE CASCADE,
  source_risk_id uuid NULL REFERENCES iso_risk_matrix_items(id),
  diagnostico_operativo text NOT NULL,
  controles_sugeridos jsonb NOT NULL,
  efectividad_estimada_pct numeric NULL,
  ai_model text NULL,
  prompt_version text NULL,
  created_by uuid NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_operational_risk_recommendation_effectiveness CHECK (
    efectividad_estimada_pct IS NULL OR (efectividad_estimada_pct >= 0 AND efectividad_estimada_pct <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_risk_simulations_tenant
  ON operational_risk_simulations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_operational_risk_simulations_tenant_norma
  ON operational_risk_simulations(tenant_id, norma_tipo);

CREATE INDEX IF NOT EXISTS idx_operational_risk_simulations_tenant_created
  ON operational_risk_simulations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_risk_simulations_tenant_p95
  ON operational_risk_simulations(tenant_id, peor_escenario_p95 DESC);

CREATE INDEX IF NOT EXISTS idx_operational_risk_simulations_source_risk
  ON operational_risk_simulations(source_risk_id);

CREATE INDEX IF NOT EXISTS idx_operational_risk_recommendations_tenant_created
  ON operational_risk_recommendations(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_risk_recommendations_simulation
  ON operational_risk_recommendations(simulation_id);
