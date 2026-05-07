CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS iso_recommended_action_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  previous_status text NULL,
  new_status text NOT NULL,
  event_type text NOT NULL,
  comment text NULL,
  user_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iso_recommended_action_workflow_event_type_chk CHECK (
    event_type IN ('transition','comment','system_note')
  ),
  CONSTRAINT iso_recommended_action_workflow_status_chk CHECK (
    new_status IN ('suggested','approved','converted','in_progress','blocked','done','rejected','needs_review','pending','applied','archived','error')
  )
);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_workflow_suggestion
  ON iso_recommended_action_workflow_events(suggestion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_workflow_tenant
  ON iso_recommended_action_workflow_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_iso_recommended_action_workflow_status
  ON iso_recommended_action_workflow_events(tenant_id, new_status);

COMMENT ON TABLE iso_recommended_action_workflow_events IS
  'Historial no destructivo de seguimiento para acciones recomendadas ISO.';
