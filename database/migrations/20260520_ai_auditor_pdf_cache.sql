ALTER TABLE IF EXISTS ai_auditor_runs
  ADD COLUMN IF NOT EXISTS rendered_pdf_file_path text,
  ADD COLUMN IF NOT EXISTS rendered_pdf_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_render_engine text,
  ADD COLUMN IF NOT EXISTS pdf_render_trace_json jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_auditor_runs_rendered_pdf_at
  ON ai_auditor_runs (rendered_pdf_at DESC)
  WHERE rendered_pdf_file_path IS NOT NULL;
