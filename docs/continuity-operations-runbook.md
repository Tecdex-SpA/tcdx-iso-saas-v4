# Continuity Operations Runbook — TCDX ISO SaaS

## Objetivo

Definir acciones de continuidad ante fallas operativas en DB, backend, frontend, Nginx, AI Engine, disco, certificados y uploads.

## Comandos base por VM

### Backend

```bash
sudo systemctl status tecdex-backend --no-pager
sudo journalctl -u tecdex-backend -n 100 --no-pager
curl -I http://127.0.0.1:3000/
sudo systemctl restart tecdex-backend
```

### Frontend

```bash
sudo systemctl status tecdex-frontend --no-pager
sudo journalctl -u tecdex-frontend -n 100 --no-pager
curl -I http://127.0.0.1:8080/login
sudo systemctl restart tecdex-frontend
```

### Nginx

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 100 --no-pager
curl -I http://127.0.0.1:3000/login
sudo systemctl reload nginx
```

### AI Engine

```bash
sudo systemctl status ai-engine --no-pager
sudo journalctl -u ai-engine -n 100 --no-pager
curl -I http://127.0.0.1:8000/health
sudo systemctl restart ai-engine
```

### PostgreSQL

```bash
sudo systemctl status postgresql --no-pager
sudo journalctl -u postgresql -n 100 --no-pager
sudo -u postgres psql -d tecdex_saas -c "SELECT now();"
```

## Escenario: DB caída

Síntomas:

- login falla;
- backend responde 500;
- `psql` no conecta.

Acciones:

1. Revisar servicio PostgreSQL.
2. Revisar disco.
3. Revisar logs.
4. Reiniciar solo si corresponde.
5. Si hay corrupción o pérdida, activar restore desde backup validado.

## Escenario: backend caído

Acciones:

```bash
node -c /home/tecdex/backend/src/app.js
sudo systemctl restart tecdex-backend
sudo journalctl -u tecdex-backend -n 100 --no-pager
```

Validar:

```bash
curl -I http://127.0.0.1:3000/
```

## Escenario: frontend caído

Acciones:

```bash
cd /home/tecdex/frontend
npm run build
sudo systemctl restart tecdex-frontend
curl -I http://127.0.0.1:8080/login
```

## Escenario: Nginx caído

Acciones:

```bash
sudo nginx -t
sudo systemctl restart nginx
curl -I http://127.0.0.1:3000/login
```

## Escenario: AI Engine caído

El sistema debe degradar de forma controlada en IA Compliance/IA Auditor.

Acciones:

```bash
sudo systemctl restart ai-engine
curl -I http://127.0.0.1:8000/health
```

## Escenario: disco lleno

```bash
df -h
du -sh /home/tecdex/* 2>/dev/null
du -sh /var/log/* 2>/dev/null
```

Acciones:

- no borrar DB;
- no borrar uploads sin respaldo;
- rotar logs;
- mover backups antiguos a almacenamiento externo;
- limpiar caches temporales.

## Escenario: certificado expirado

```bash
sudo certbot certificates
sudo certbot renew --dry-run
sudo systemctl reload nginx
```

## Escenario: pérdida de uploads

1. Detener escrituras si la pérdida es activa.
2. Restaurar último backup de uploads.
3. Validar permisos de archivos.
4. Validar descarga desde módulo Evidencias.

## QA post-incidente

```bash
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:3000 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-security-basic.sh
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:3000 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-rbac-basic.sh
API_URL=http://192.168.100.120:3000 FRONTEND_URL=http://192.168.100.130:3000 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-ai-auditor-full.sh
```

## Checklist post-incidente

- [ ] causa identificada;
- [ ] servicio restaurado;
- [ ] backup validado;
- [ ] QA ejecutado;
- [ ] logs preservados;
- [ ] acciones preventivas definidas;
- [ ] cliente informado si corresponde.

## Observabilidad operativa Fase 4F

La fase 4F agrega:

```bash
bash scripts/monitor-runtime.sh
bash scripts/collect-ops-logs.sh
bash scripts/qa-observability.sh
```

Uso recomendado post-deploy:

```bash
API_URL=http://192.168.100.120:3000 \
FRONTEND_URL=http://192.168.100.130:3000 \
AI_ENGINE_URL=http://192.168.100.140:8000 \
EMAIL=<admin> \
PASSWORD=<password> \
bash scripts/qa-observability.sh
```
