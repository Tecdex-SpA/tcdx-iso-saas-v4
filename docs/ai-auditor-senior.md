# IA Auditor Senior — Fase 3

## Objetivo

IA Auditor Senior entrega una evaluación auditora no destructiva usando datos reales del tenant.

## Alcance inicial

- GET `/api/ai-auditor/scope`
- POST `/api/ai-auditor/analyze`
- POST `/api/ai-auditor/suggestions/:type/prepare`
- Vista frontend `/ia-auditor`

## Seguridad

IA Auditor:

- no aprueba controles;
- no cierra planes;
- no crea hallazgos definitivos;
- no modifica evidencias;
- no modifica datos históricos;
- requiere revisión humana.

## Datos considerados

- normas activas;
- controles;
- evidencias;
- hallazgos abiertos;
- planes de acción abiertos/vencidos;
- health por norma;
- auditorías recientes;
- ciclo de vida si existe.

## Roles

Solo lectura:

- gerencia;
- auditor externo;
- consultor externo;
- responsable de área.

Ejecución IA:

- responsable ISO;
- auditor interno;
- CISO;
- compliance manager.

Aprobación humana:

- administrador tenant;
- responsable ISO principal;
- auditor líder.

## Validación

```bash
node -c backend/src/routes/ai-auditor.routes.js
cd frontend && npm run build
```

Post deploy:

```bash
GET /api/ai-auditor/scope
POST /api/ai-auditor/analyze
```

## Límite de Fase 3 inicial

Esta fase no toca DB, no toca PDF y no obliga a ai-engine. Deja una base segura para evolucionar hacia análisis IA más profundo.
