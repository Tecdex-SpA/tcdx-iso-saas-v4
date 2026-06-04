# Sprint 3.5 API Contracts

All routes are behind `/api`, JWT auth, RBAC middleware, and tenant request scope middleware.

## Sources

```http
GET /api/evidence-library/sources
```

Returns compact source cards.

## Documents

```http
GET /api/evidence-library/documents
```

Query filters:

- `search`
- `origin`
- `document_type`
- `status`
- `association`
- `semantic_status`
- `version=active|all`

## Document Detail

```http
GET /api/evidence-library/documents/:sourceType/:sourceId
```

Returns document, versions, associations, suggestions, chunks, and history.

## Associations

```http
GET /api/evidence-library/associations
POST /api/evidence-library/associations
PATCH /api/evidence-library/associations/:id/deactivate
PATCH /api/evidence-library/associations/:id/reactivate
```

POST payload:

```json
{
  "source_type": "document_index",
  "source_id": "uuid",
  "target_type": "control",
  "target_id": "uuid",
  "evidence_usage": "supporting_evidence",
  "notes": "optional"
}
```

## Targets

```http
GET /api/evidence-library/targets/:targetType?search=...
```

Supported target types:

- control
- nonconformity
- finding
- process
- operation
- risk
- action

## Semantic

```http
POST /api/evidence-library/semantic/analyze
POST /api/evidence-library/semantic/suggestions/:id/accept
POST /api/evidence-library/semantic/suggestions/:id/reject
```

Semantic analysis returns reviewable suggestions only.

