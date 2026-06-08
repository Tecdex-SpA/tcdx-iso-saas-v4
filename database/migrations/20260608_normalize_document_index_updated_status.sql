-- Sprint 3.5 document_index visible status normalization.
-- Non-destructive: active documents previously marked as "updated" become
-- visible active documents with status "indexed"; the sync operation is kept
-- in metadata_json. Excluded rows are not touched.

BEGIN;

UPDATE document_index
SET
  status = 'indexed',
  metadata_json = COALESCE(metadata_json, '{}'::jsonb)
    || jsonb_build_object(
      'last_sync_operation', 'updated',
      'status_normalized_from', 'updated',
      'status_normalized_at', NOW()
    )
WHERE status = 'updated';

COMMIT;
