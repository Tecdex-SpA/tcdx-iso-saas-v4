# Semantic Evidence Data Model

## Reused Tables

- `document_index`
- `evidences`
- `document_ai_analysis`
- `document_association_suggestions`
- `tenant_process_entity_links`

## New Tables

### `tenant_document_object_links`

Stores human-reviewed links from a document/evidence to:

- controls;
- NCs;
- findings;
- processes;
- operations;
- risks;
- actions.

### `tenant_evidence_semantic_profiles`

Stores latest semantic profile per source document/evidence.

### `tenant_evidence_chunks`

Stores traceable citeable fragments.

### `tenant_evidence_applicability_suggestions`

Stores reviewable semantic suggestions with score, reason, and snippet.

## Deletion Policy

No hard delete. Associations use `is_active`.

