-- TCDX ISO SaaS v4 - Phase 5.5 snapshot contract hotfix.
-- Additive and idempotent. Existing valid rows are preserved.

BEGIN;

DO $$
DECLARE
  invalid_count bigint;
BEGIN
  IF to_regclass('public.calculation_snapshots') IS NULL THEN
    RAISE EXCEPTION 'calculation_snapshots table is required';
  END IF;

  SELECT count(*) INTO invalid_count
  FROM calculation_snapshots
  WHERE snapshot_type NOT IN ('source_dataset','input','output','explanation','comparison');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Cannot align calculation_snapshots constraint: % invalid rows exist', invalid_count;
  END IF;

  ALTER TABLE calculation_snapshots
    DROP CONSTRAINT IF EXISTS calculation_snapshots_snapshot_type_check;

  ALTER TABLE calculation_snapshots
    ADD CONSTRAINT calculation_snapshots_snapshot_type_check
    CHECK (snapshot_type IN ('source_dataset','input','output','explanation','comparison'));
END $$;

COMMENT ON COLUMN calculation_snapshots.snapshot_type IS
  'Governed snapshot kind. Source datasets must use source_dataset; source is not a valid value.';

COMMIT;
