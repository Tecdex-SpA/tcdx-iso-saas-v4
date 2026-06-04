# AI Engine Integration

## Existing Integration

Backend reuses `documentAiAnalysis.service.js`, which calls the AI Engine document analysis endpoint when configured:

```text
/api/ai-compliance/analyze-document
```

If AI Engine is unavailable or tenant AI entitlement is not active, backend falls back to deterministic analysis.

## New Explicit Endpoint

AI Engine now exposes:

```text
POST /semantic-evidence/analyze
```

It returns:

- classification;
- chunks;
- suggestions;
- scoring;
- human review requirement.

## Security

AI Engine does not decide permissions and does not write production DB in this flow. Backend remains authoritative.

## Dependencies

No new AI Engine dependencies were added.

