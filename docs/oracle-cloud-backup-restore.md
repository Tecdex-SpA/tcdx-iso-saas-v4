# Oracle Cloud Backup & Restore — TCDX ISO SaaS

## PostgreSQL backup

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
BACKUP_DIR="/home/tecdex/backups/db-$TS"
mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump -Fc tecdex_saas > "$BACKUP_DIR/tecdex_saas.dump"
sudo -u postgres pg_dump tecdex_saas > "$BACKUP_DIR/tecdex_saas.sql"
tar -czf "$BACKUP_DIR.tar.gz" -C /home/tecdex/backups "db-$TS"
sha256sum "$BACKUP_DIR.tar.gz" > "$BACKUP_DIR.tar.gz.sha256"
```

## PostgreSQL restore test

```bash
createdb -h <db-private-ip> -U <db_user> tecdex_saas_restore_test
pg_restore -h <db-private-ip> -U <db_user> -d tecdex_saas_restore_test /tmp/tecdex_saas.dump
```

## Uploads backup

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
tar -czf /home/tecdex/backups/uploads-$TS.tar.gz -C /home/tecdex/backend uploads
sha256sum /home/tecdex/backups/uploads-$TS.tar.gz > /home/tecdex/backups/uploads-$TS.tar.gz.sha256
```

## `.env` backup fuera de Git

```bash
TS="$(date '+%Y%m%d_%H%M%S')"
mkdir -p /home/tecdex/secure-backups/env-$TS
cp /home/tecdex/backend/.env /home/tecdex/secure-backups/env-$TS/backend.env
cp /home/tecdex/frontend/.env /home/tecdex/secure-backups/env-$TS/frontend.env
cp /home/tecdex/ai-engine/.env /home/tecdex/secure-backups/env-$TS/ai-engine.env
chmod -R 600 /home/tecdex/secure-backups/env-$TS/*
```

No subir estos archivos a Git.
