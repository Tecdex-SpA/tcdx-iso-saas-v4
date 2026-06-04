# Sprint 3.5 Architecture

## Flow

```text
Document sources
  -> document_index / evidences
  -> evidence-library API
  -> semantic profile / chunks / suggestions
  -> human-reviewed associations
```

## Frontend

`/evidencias` now renders a single evidence library workflow:

- Sources
- Library
- Detail panel

The frontend does not perform NLP. It only renders backend results and sends user decisions.

## Backend

Backend responsibilities:

- Auth/RBAC.
- Tenant scope.
- Source document validation.
- Target object validation.
- Semantic orchestration.
- Persistence.

Main files:

- `backend/src/services/evidenceLibrary.service.js`
- `backend/src/routes/evidence-library.routes.js`

## AI Engine

AI Engine provides deterministic semantic evidence analysis through:

- existing `/api/ai-compliance/analyze-document`
- new `/semantic-evidence/analyze`

Backend remains the system of record.

## Database

Database stores:

- document-object links;
- semantic profiles;
- chunks;
- suggestions;
- review state.

