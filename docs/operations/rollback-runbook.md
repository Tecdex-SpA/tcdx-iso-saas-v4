# Rollback runbook

## Objetivo

Definir rollback operativo conservador para TCDX ISO SaaS v4. La preferencia es
rollback de codigo o build antes que restore DB.

## Principios

- No hacer rollback sin identificar componente afectado.
- No ejecutar migraciones destructivas.
- No restaurar DB sin aprobacion explicita.
- No usar `DROP`, `DELETE` ni `TRUNCATE` sobre `tecdx_saas`.
- Registrar commit anterior, commit nuevo y validaciones.

## Deploy actual

El comando de deploy operacional existente es:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
./scripts/deploy-vms.sh
```

Ese script valida rama `main`, working tree limpio, SSH, wrappers remotos y
servicios:

- backend: `tecdex-backend.service`
- frontend: `tcdx-frontend.service` y Nginx
- AI Engine: `ai-engine.service`

No ejecutar deploy ni rollback productivo sin autorizacion.

## Rollback frontend

Usar cuando el problema esta en UI, build, assets o proxy hacia frontend.

Flujo recomendado:

1. Confirmar commit anterior funcional.
2. Validar que no requiere migracion.
3. En la VM frontend, volver el repo al commit aprobado o usar wrapper remoto
   existente si el procedimiento de deploy lo soporta.
4. Reconstruir/reiniciar frontend solo en ventana aprobada.
5. Validar:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
curl -I http://localhost
curl -I http://192.168.2.43
curl -I https://tcdx-iso.tecdex.net
```

## Rollback backend

Usar cuando el problema esta en API, rutas, servicios Node o integracion backend.

Flujo recomendado:

1. Confirmar commit anterior funcional.
2. Confirmar si hubo migraciones entre commit anterior y actual.
3. Si no hubo migraciones, volver backend al commit aprobado y reiniciar servicio
   en ventana autorizada.
4. Validar:

```bash
sudo systemctl status tecdex-backend.service --no-pager -l
curl -s http://localhost:3000/
curl -s -i http://localhost:3000/api/health
sudo journalctl -u tecdex-backend.service -n 200 --no-pager
```

## Rollback de migraciones

Solo permitido si:

- existe script reversible revisado;
- fue probado en ambiente temporal;
- existe backup reciente y verificado;
- hay aprobacion explicita del responsable tecnico.

Si no existe rollback reversible, no improvisar SQL manual en produccion.

## Restore DB

Restore DB es ultimo recurso, no rollback normal.

Requisitos:

- aprobacion explicita;
- backup identificado y checksum validado;
- restore smoke test exitoso en base temporal;
- ventana de mantenimiento;
- plan de comunicacion.

Nunca ejecutar restore sobre `tecdx_saas` desde los scripts de smoke test.

## Validaciones post-rollback

```bash
curl -I https://tcdx-iso.tecdex.net
curl -s -i https://tcdx-iso.tecdex.net/api/health
bash scripts/ops/healthcheck.sh
```

Validar flujos funcionales minimos:

- login;
- dashboard;
- evidencias;
- reportes;
- SoA;
- AI fallback si AI Engine esta degradado.

## Cierre

Registrar en `docs/operations/deploy-log-template.md`:

- commit revertido;
- commit objetivo;
- componente;
- motivo;
- validaciones;
- incidentes residuales.
