# IA Auditor Senior — Runbook operativo

## Servicios involucrados

- Frontend: `www.tcdx.int`
- Backend: `bk.tcdx.int`
- Base de datos: `db.tcdx.int`
- ai-engine: `ai.tcdx.int`

## Validar frontend

```bash
curl -I https://181.212.166.187:8443/ia-auditor
curl -I https://181.212.166.187:8443/dashboard
curl -I https://181.212.166.187:8443/auditorias
```

## Validar backend

```bash
curl -I http://bk.tcdx.int:3000/
```

## Validar sintaxis backend

```bash
cd ~/repos/tcdx-iso-saas
node -c backend/src/routes/ai-auditor.routes.js
```

## Validar frontend build

```bash
cd ~/repos/tcdx-iso-saas/frontend
npm run build
```

## Validar ai-engine

```bash
cd ~/repos/tcdx-iso-saas
python3 -m py_compile ai-engine/main.py
python3 -m py_compile ai-engine/app/routes/ai.py
```

## Ejecutar QA IA Auditor

```bash
cd ~/repos/tcdx-iso-saas

API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
EMAIL="<qa-user-email>" \
PASSWORD="<qa-user-password>" \
bash ./scripts/qa-ai-auditor-full.sh
```

Resultado esperado:

- `FAIL: 0`

## Migraciones necesarias en instalación nueva

Aplicar:

```bash
database/migrations/20260504_3k_ai_auditor_runs.sql
database/migrations/20260504_3m_ai_auditor_human_review.sql
```

Ejemplo:

```bash
scp database/migrations/20260504_3k_ai_auditor_runs.sql tecdex@db.tcdx.int:/tmp/
scp database/migrations/20260504_3m_ai_auditor_human_review.sql tecdex@db.tcdx.int:/tmp/

ssh tecdex@db.tcdx.int
sudo -u postgres psql -d tecdex_saas -f /tmp/20260504_3k_ai_auditor_runs.sql
sudo -u postgres psql -d tecdex_saas -f /tmp/20260504_3m_ai_auditor_human_review.sql
sudo -u postgres psql -d tecdex_saas -c "\d ai_auditor_runs"
exit
```

## Reiniciar backend

```bash
ssh tecdex@bk.tcdx.int
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
exit
```

## Reiniciar ai-engine

```bash
ssh tecdex@ai.tcdx.int
sudo systemctl restart ai-engine || sudo systemctl start ai-engine
sudo systemctl status ai-engine --no-pager
exit
```

## Problemas comunes

### QA falla en PDF

Validar backend desplegado y reiniciado:

```bash
ssh tecdex@bk.tcdx.int
sudo systemctl restart tecdex-backend
exit
```

### QA falla en history

Validar migraciones:

```bash
ssh tecdex@db.tcdx.int
sudo -u postgres psql -d tecdex_saas -c "\d ai_auditor_runs"
exit
```

### Frontend no muestra cambios

Recompilar y redeploy:

```bash
cd ~/repos/tcdx-iso-saas
./scripts/deploy-vms.sh
```

## Criterio operativo

IA Auditor está operativo si:

- frontend `/ia-auditor` responde;
- backend scope/analyze responde;
- ai-engine se usa o fallback opera;
- historial guarda ejecución;
- revisión humana funciona;
- PDF actual e histórico descargan;
- QA termina con `FAIL: 0`.
