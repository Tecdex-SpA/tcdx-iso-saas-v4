# Fase 0 — Observability runbook

## Estado

`in_progress`

## Brechas bloqueantes

No se verificó aún propagación completa de `X-Correlation-ID`, logs estructurados redactados, métricas API/jobs/IA/documentos, alertas accionables ni dashboard operacional interno.

## Próximo comando

`rg -n "correlation|request_id|requestId|logger|metrics|health|readiness|liveness" backend/src ai-engine/app scripts docs`
