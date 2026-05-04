# IA Auditor Senior — Runbook operativo

## Servicios involucrados

- Frontend: `192.168.100.130`
- Backend: `192.168.100.120`
- Base de datos: `192.168.100.110`
- ai-engine: `192.168.100.140`

## Validar frontend

```bash
curl -I http://192.168.100.130:3000/ia-auditor
curl -I http://192.168.100.130:3000/dashboard
curl -I http://192.168.100.130:3000/auditorias
```

## Validar backend

```bash
curl -I http://192.168.100.120:3000/
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

API_URL=http://192.168.100.120:3000 \
FRONTEND_URL=http://192.168.100.130:3000 \
EMAIL=admin@rieltec.com \
PASSWORD=123456 \
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
scp database/migrations/20260504_3k_ai_auditor_runs.sql tecdex@192.168.100.110:/tmp/
scp database/migrations/20260504_3m_ai_auditor_human_review.sql tecdex@192.168.100.110:/tmp/

ssh tecdex@192.168.100.110
sudo -u postgres psql -d tecdex_saas -f /tmp/20260504_3k_ai_auditor_runs.sql
sudo -u postgres psql -d tecdex_saas -f /tmp/20260504_3m_ai_auditor_human_review.sql
sudo -u postgres psql -d tecdex_saas -c "\d ai_auditor_runs"
exit
```

## Reiniciar backend

```bash
ssh tecdex@192.168.100.120
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
exit
```

## Reiniciar ai-engine

```bash
ssh tecdex@192.168.100.140
sudo systemctl restart ai-engine || sudo systemctl start ai-engine
sudo systemctl status ai-engine --no-pager
exit
```

## Problemas comunes

### QA falla en PDF

Validar backend desplegado y reiniciado:

```bash
ssh tecdex@192.168.100.120
sudo systemctl restart tecdex-backend
exit
```

### QA falla en history

Validar migraciones:

```bash
ssh tecdex@192.168.100.110
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
