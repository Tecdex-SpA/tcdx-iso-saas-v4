# Oracle Cloud Cutover Checklist — TCDX ISO SaaS

## 1. Prechecks en laboratorio

```bash
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-security-basic.sh
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-rbac-basic.sh
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-ai-auditor-full.sh
```

## 2. Congelar cambios

- Avisar ventana de mantenimiento.
- Evitar cargas de evidencias durante respaldo final.
- Evitar cambios de configuración SaaS durante cutover.

## 3. Backup final DB

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p /home/tecdex/backups/cutover-$TS
sudo -u postgres pg_dump -Fc tecdex_saas > /home/tecdex/backups/cutover-$TS/tecdex_saas.dump
sudo -u postgres pg_dump tecdex_saas > /home/tecdex/backups/cutover-$TS/tecdex_saas.sql
tar -czf /home/tecdex/backups/cutover-$TS.tar.gz -C /home/tecdex/backups "cutover-$TS"
```

## 4. Backup uploads

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
tar -czf /home/tecdex/backups/uploads-$TS.tar.gz -C /home/tecdex/backend uploads
```

## 5. Restaurar en Oracle

```bash
pg_restore -h <db-private-ip> -U <db_user> -d tecdex_saas --clean --if-exists /tmp/tecdex_saas.dump
tar -xzf uploads-<TS>.tar.gz -C /home/tecdex/backend
```

## 6. DNS, TLS y QA

```bash
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-security-basic.sh
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-rbac-basic.sh
API_URL=https://api.tcdx.cl FRONTEND_URL=https://compliance.tcdx.cl EMAIL=<admin> PASSWORD=<password> bash ./scripts/qa-ai-auditor-full.sh
```

## 7. Rollback

1. Revertir DNS al laboratorio.
2. Mantener cloud aislado.
3. Revisar logs.
4. Si hubo escrituras en cloud, evaluar reconciliación antes de nuevo intento.
