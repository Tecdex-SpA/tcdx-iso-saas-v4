# Sprint 0 - Checklist de validación

## Backend
```bash
cd backend
npm install # solo si dependencias no están instaladas o cambió package-lock
npm run check
npm test
# No reiniciar sin confirmación explícita:
# sudo systemctl restart tecdex-backend
# Health conocidos, con token válido:
# curl -H "Authorization: Bearer <token>" https://<backend>/health/dashboard
# curl -H "Authorization: Bearer <token>" https://<backend>/api/me/session
```

## Frontend
```bash
cd frontend
npm install # solo si aplica
npm run lint
npm run build
npm start
```

## AI Engine
```bash
cd ai-engine
# Comandos dependen del entorno Python real.
# curl http://<ai-engine>:8001/health
# curl -H "x-ai-token: <token>" http://<ai-engine>:8001/health/deep
# No iniciar servicio sin confirmación:
# sudo systemctl start ai-engine
```

## Base de datos
No ejecutar migraciones destructivas. Solo inspección:
```sql
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public','qa_audit') ORDER BY 1,2;
SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'tenant_id' ORDER BY 1;
```

## Git
```bash
git status
git diff --stat
git diff -- docs/sprint-0
git add docs/sprint-0
git commit -m "docs: sprint 0 inventory and MVP alignment"
```
