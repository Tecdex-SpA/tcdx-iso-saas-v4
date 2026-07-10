# Healthcheck runbook

## Objetivo

Validar estado minimo de backend, frontend, DB y AI Engine para operar pilotos
Credex y Tecdex sin depender de memoria tribal.

## Script local

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
export BACKEND_URL=http://localhost:3000
export FRONTEND_URL=http://192.168.2.43
export AI_ENGINE_URL=http://ai-v4.tcdx.int:8001
export PGHOST=<db-host>
export PGDATABASE=tecdx_saas
export PGUSER=<db-user>
export PGPASSWORD=<db-password>
bash scripts/ops/healthcheck.sh
```

Defaults permitidos:

```text
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://192.168.2.43
AI_ENGINE_URL=http://ai-v4.tcdx.int:8001
PGPORT=5432
```

Interpretacion:

- `[OK]`: componente disponible.
- `[DEGRADED]`: componente no critico degradado. AI Engine puede caer en esta
  categoria si backend mantiene fallback.
- `[FAIL]`: componente critico falla. El script termina con exit code distinto
  de 0.

## URL publica

```bash
curl -I https://tcdx-iso.tecdex.net
curl -s -i https://tcdx-iso.tecdex.net/api/health
```

`/api/health` puede responder `401` si esta protegido. Lo relevante es que la
ruta responda desde backend con JSON o estado esperado y no con `502`, `503` o
`504`.

## Backend VM 192.168.2.41

```bash
ssh tecdex@192.168.2.41
sudo systemctl status tecdex-backend.service --no-pager -l
curl -s http://localhost:3000/health
curl -s -i http://localhost:3000/api/health
sudo journalctl -u tecdex-backend.service -n 200 --no-pager
```

Si `/health` exige autenticacion, validar `/api/health` y root `/`.

## Frontend VM 192.168.2.43

```bash
ssh tecdex@192.168.2.43
sudo nginx -t
sudo systemctl status nginx --no-pager -l
curl -I http://localhost
curl -I http://192.168.2.43
```

Revisar que no existan `502/504` en Nginx. Si Nginx esta activo pero el sitio no
carga, revisar upstream frontend y logs.

## DB VM 192.168.2.40

```bash
ssh tecdex@192.168.2.40
sudo systemctl status postgresql --no-pager -l
pg_isready
psql -d tecdx_saas -c "select 1;"
```

Si `pg_isready` responde OK pero `select 1` falla, revisar credenciales,
permisos, `pg_hba.conf` y saturacion de conexiones.

## AI VM 192.168.2.44

```bash
ssh tecdex@192.168.2.44
sudo systemctl status ai-engine.service --no-pager -l
curl -s http://localhost:8001/health
```

AI Engine degradado no equivale automaticamente a SaaS caido. Si backend mantiene
fallback, clasificar como degradacion y registrar el impacto en funciones IA.

## Endpoints conocidos

- Backend root: `http://localhost:3000/`
- Backend health protegido o parcial: `/api/health`
- AI Engine health: `http://localhost:8001/health`
- Public HTTPS: `https://tcdx-iso.tecdex.net`

## Escalamiento rapido

1. Confirmar publico HTTPS.
2. Confirmar backend local.
3. Confirmar DB.
4. Confirmar frontend/Nginx.
5. Confirmar AI Engine y fallback.
6. Guardar hora, comandos, codigos HTTP y extractos de logs.
