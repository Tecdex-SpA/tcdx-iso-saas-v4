-- =========================================================
-- TCDX ISO SaaS - Minimal AI knowledge tables
-- Required by ai-knowledge routes/import scripts when the target
-- environment does not already have ai_knowledge_* tables.
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS ai_knowledge_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name text NOT NULL,
  schema_version text,
  generated_on text,
  language text NOT NULL DEFAULT 'es',
  scope text NOT NULL DEFAULT 'global',
  source_file_name text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS dataset_name text;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS schema_version text;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS generated_on text;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS source_file_name text;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ai_knowledge_datasets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_knowledge_datasets_key
ON ai_knowledge_datasets(dataset_name, schema_version, generated_on, scope);

CREATE TABLE IF NOT EXISTS ai_knowledge_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE,
  norma text,
  norma_key text,
  edicion_estado text,
  status text,
  standard_type text,
  uses_hls_annex_sl boolean NOT NULL DEFAULT false,
  certifiable_or_assurable text,
  objective text,
  principal_control_areas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_standards_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_public_crosswalks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_public_summary text,
  key_definitions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  structure_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  record_count integer NOT NULL DEFAULT 0,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS norma text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS norma_key text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS edicion_estado text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS standard_type text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS uses_hls_annex_sl boolean NOT NULL DEFAULT false;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS certifiable_or_assurable text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS principal_control_areas_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS related_standards_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS verified_public_crosswalks_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS notes_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS scope_public_summary text;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS key_definitions_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS structure_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS record_count integer NOT NULL DEFAULT 0;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS raw_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ai_knowledge_standards ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_standards_dataset
ON ai_knowledge_standards(dataset_id);

CREATE TABLE IF NOT EXISTS ai_knowledge_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  norma text,
  norma_key text,
  edicion_estado text,
  coverage_type text,
  clausula_o_control text,
  titulo text,
  descripcion_resumen text,
  que_exige text,
  ejemplos_evidencia_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  hallazgos_tipicos_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  acciones_correctivas_sugeridas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  palabras_clave_tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_norms_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  standard_type text,
  uses_hls_annex_sl boolean NOT NULL DEFAULT false,
  norma_objetivo text,
  scope_public_summary text,
  verified_public_crosswalks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  embedding_text text,
  search_text text,
  is_draft boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS dataset_id uuid REFERENCES ai_knowledge_datasets(id) ON DELETE CASCADE;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS record_id text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS norma text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS norma_key text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS edicion_estado text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS coverage_type text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS clausula_o_control text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS titulo text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS descripcion_resumen text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS que_exige text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS ejemplos_evidencia_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS hallazgos_tipicos_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS acciones_correctivas_sugeridas_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS palabras_clave_tags_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS related_norms_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS standard_type text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS uses_hls_annex_sl boolean NOT NULL DEFAULT false;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS norma_objetivo text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS scope_public_summary text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS verified_public_crosswalks_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS embedding_text text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS search_text text;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS raw_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE ai_knowledge_records ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_knowledge_records_dataset_record
ON ai_knowledge_records(dataset_id, record_id);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_records_norma_key
ON ai_knowledge_records(norma_key);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_records_active
ON ai_knowledge_records(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_records_search_trgm
ON ai_knowledge_records USING gin (search_text gin_trgm_ops);
