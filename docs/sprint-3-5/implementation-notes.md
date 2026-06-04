# Sprint 3.5 - Implementation Notes

## Scope Implemented

Sprint 3.5 converts `/evidencias` into a unified tenant evidence/document library.

Implemented:

- Compact document source cards.
- Unified document list from `document_index` and `evidences`.
- Backend-level active-version/dedupe grouping.
- Detail panel with summary, associations, semantic suggestions, fragments, versions, and history.
- Multi-object document associations through `tenant_document_object_links`.
- Semantic profile, chunks, and applicability suggestions.
- Human accept/reject flow for suggestions.
- AI context builder support for citeable evidence chunks.

Not implemented:

- KPI/Health by process.
- Sprint 4 diagnosis by process/standard.
- Automatic evidence approval.
- Certification language.
- Vector DB or semantic search engine.
- Hard delete of source files.

## Existing Structures Reused

- `document_index`
- `evidences`
- `document_ai_analysis`
- `document_association_suggestions`
- `tenant_process_entity_links`
- Existing document extraction service.
- Existing AI engine document analysis endpoint.

## New Structures

- `tenant_document_object_links`
- `tenant_evidence_semantic_profiles`
- `tenant_evidence_chunks`
- `tenant_evidence_applicability_suggestions`

## Safety Decisions

- Tenant ID is derived from JWT/backend context.
- The frontend never sends trusted tenant scope.
- Associations are soft-state based with `is_active`.
- Semantic suggestions require human acceptance.
- Source files are not deleted.

