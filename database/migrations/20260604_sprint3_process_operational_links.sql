-- =========================================================
-- TCDX ISO SaaS
-- Sprint 3 - Process/operation links with operational entities
-- Non-destructive/idempotent migration proposal
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tenant_process_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.tenant_processes(id) ON DELETE CASCADE,
  operation_id uuid NULL REFERENCES public.tenant_operations(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'associated',
  source text NOT NULL DEFAULT 'manual',
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_process_entity_links
  ADD COLUMN IF NOT EXISTS operation_id uuid NULL REFERENCES public.tenant_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS relation_type text NOT NULL DEFAULT 'associated',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamp without time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_process_entity_links_target_type_check'
      AND conrelid = 'public.tenant_process_entity_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_process_entity_links
      ADD CONSTRAINT tenant_process_entity_links_target_type_check
      CHECK (target_type IN ('control', 'evidence', 'risk', 'action'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_process_entity_links_relation_type_check'
      AND conrelid = 'public.tenant_process_entity_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_process_entity_links
      ADD CONSTRAINT tenant_process_entity_links_relation_type_check
      CHECK (relation_type IN ('associated', 'primary', 'supporting', 'impacted', 'mitigates', 'requires_evidence'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_process_entity_links_source_check'
      AND conrelid = 'public.tenant_process_entity_links'::regclass
  ) THEN
    ALTER TABLE public.tenant_process_entity_links
      ADD CONSTRAINT tenant_process_entity_links_source_check
      CHECK (source IN ('manual', 'system', 'import', 'ai_suggested'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_process_entity_links_active
  ON public.tenant_process_entity_links (
    tenant_id,
    process_id,
    COALESCE(operation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    target_type,
    target_id
  )
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_process_entity_links_tenant
  ON public.tenant_process_entity_links (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_process_entity_links_process_active
  ON public.tenant_process_entity_links (tenant_id, process_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_process_entity_links_operation
  ON public.tenant_process_entity_links (tenant_id, operation_id)
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_process_entity_links_target
  ON public.tenant_process_entity_links (tenant_id, target_type, target_id);
