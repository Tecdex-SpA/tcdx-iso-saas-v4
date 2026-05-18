# Operacion de secretos y runtime

Este proyecto no debe versionar secretos productivos. Backend, AI Engine y base de datos deben leer credenciales desde archivos de entorno administrados en la VM o en el gestor de secretos de la nube.

## Backend

Archivo recomendado:

```ini
/etc/tecdex/backend.env
```

Variables minimas:

```ini
NODE_ENV=production
PORT=3000
DB_HOST=db.tcdx.int
DB_PORT=5432
DB_NAME=tecdex_saas
DB_USER=<usuario_db>
DB_PASSWORD=<password_db>
JWT_SECRET=<jwt_secret>
OWN_AI_SHARED_SECRET=<mismo_token_real_del_ai_engine>
CORS_ORIGINS=https://181.212.166.187:8443,https://saas.tcdx.cl
```

Override systemd recomendado:

```ini
[Service]
EnvironmentFile=/etc/tecdex/backend.env
```

Comandos de referencia:

```bash
sudo systemctl edit tecdex-backend
sudo systemctl daemon-reload
sudo systemctl restart tecdex-backend
sudo systemctl status tecdex-backend --no-pager
```

## AI Engine

Archivo recomendado:

```ini
/etc/tecdex/ai-engine.env
```

Variables minimas:

```ini
APP_ENV=production
DB_HOST=db.tcdx.int
DB_PORT=5432
DB_NAME=tecdex_saas
DB_USER=<usuario_db>
DB_PASSWORD=<password_db>
AI_INTERNAL_TOKEN=<mismo_token_real_del_backend>
BACKEND_API_URL=http://bk.tcdx.int:3000
FRONTEND_URL=https://181.212.166.187:8443
```

Override systemd recomendado:

```ini
[Service]
EnvironmentFile=/etc/tecdex/ai-engine.env
```

Comandos de referencia:

```bash
sudo systemctl edit ai-engine
sudo systemctl daemon-reload
sudo systemctl restart ai-engine
sudo systemctl status ai-engine --no-pager
```

## Validacion segura

Usar el script:

```bash
scripts/check-secrets-runtime.sh
```

El script solo imprime `LEN=<n>` para variables sensibles. Nunca debe imprimir valores reales de `JWT_SECRET`, `DB_PASSWORD`, `OWN_AI_SHARED_SECRET`, `AI_INTERNAL_TOKEN` ni `AI_TOKEN`.

Para validar el AI Engine:

```bash
scripts/check-ai-engine.sh
```

`/` y `/health` son publicos y no consultan la base de datos. `/health/deep` exige token interno y solo responde si la base de datos esta disponible.
