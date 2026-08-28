-- RBAC-02 commercial gating normalization.
-- Forward-only, idempotent catalog correction. Do not execute from Codex.

BEGIN;

UPDATE commercial_technical_capabilities
   SET required_permission = 'dashboards.read',
       updated_at = now()
 WHERE capability_key = 'core.dashboard'
   AND required_permission IS DISTINCT FROM 'dashboards.read';

COMMIT;
