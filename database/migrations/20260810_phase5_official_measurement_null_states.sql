-- TCDX ISO SaaS v4
-- Phase 5 official measurement null-state compatibility.
-- Removes only the legacy invariant that forced every measurement to carry
-- a value, while preserving the C3 official value/state contracts.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.metric_measurements') IS NULL THEN
    RAISE EXCEPTION 'public.metric_measurements does not exist';
  END IF;
END
$$;

ALTER TABLE public.metric_measurements
  DROP CONSTRAINT IF EXISTS metric_measurements_check1;

DO $$
DECLARE
  legacy_contract text;
  official_contract text;
  official_state_contract text;
  coverage_contract text;
BEGIN
  SELECT pg_get_constraintdef(oid, true)
    INTO legacy_contract
  FROM pg_constraint
  WHERE conrelid = 'public.metric_measurements'::regclass
    AND conname = 'metric_measurements_legacy_or_official_value_check';

  IF legacy_contract IS NULL THEN
    RAISE EXCEPTION
      'Required constraint metric_measurements_legacy_or_official_value_check is missing';
  END IF;

  SELECT pg_get_constraintdef(oid, true)
    INTO official_contract
  FROM pg_constraint
  WHERE conrelid = 'public.metric_measurements'::regclass
    AND conname = 'metric_measurements_official_value_contract';

  IF official_contract IS NULL THEN
    RAISE EXCEPTION
      'Required constraint metric_measurements_official_value_contract is missing';
  END IF;

  SELECT pg_get_constraintdef(oid, true)
    INTO official_state_contract
  FROM pg_constraint
  WHERE conrelid = 'public.metric_measurements'::regclass
    AND conname = 'metric_measurements_official_state_check';

  IF official_state_contract IS NULL THEN
    RAISE EXCEPTION
      'Required constraint metric_measurements_official_state_check is missing';
  END IF;

  SELECT pg_get_constraintdef(oid, true)
    INTO coverage_contract
  FROM pg_constraint
  WHERE conrelid = 'public.metric_measurements'::regclass
    AND conname = 'metric_measurements_coverage_ratio_check';

  IF coverage_contract IS NULL THEN
    RAISE EXCEPTION
      'Required constraint metric_measurements_coverage_ratio_check is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.metric_measurements'::regclass
      AND conname = 'metric_measurements_check1'
  ) THEN
    RAISE EXCEPTION
      'Legacy metric_measurements_check1 still exists after migration';
  END IF;
END
$$;

COMMIT;
