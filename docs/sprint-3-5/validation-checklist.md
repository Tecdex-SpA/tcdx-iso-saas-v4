# Sprint 3.5 Validation Checklist

## Backend

```bash
cd backend
npm run check
npm test
```

## Frontend

```bash
cd frontend
npm run lint
npm run build
```

## AI Engine

Inspect available scripts first. If no tests exist, run Python syntax validation only.

## Browser

Open:

```text
https://181.212.166.187:8443/login
```

Validate:

- `/evidencias` shows sources, library, and detail panel.
- Active versions are shown by default.
- Previous versions appear in detail.
- Search and filters work.
- Select a document.
- Run semantic analysis.
- Confirm classification, score, suggestions, and fragments appear.
- Associate document to control, NC, finding, process, operation, risk, and action when targets exist.
- Accept and reject suggestions.
- Confirm no hard delete is available.

Regression:

- `/configuracion`
- `/cumplimiento-auditoria`
- `/riesgos`
- `/planes-accion`
- `/ciclo-vida`
- `/ia-compliance`

