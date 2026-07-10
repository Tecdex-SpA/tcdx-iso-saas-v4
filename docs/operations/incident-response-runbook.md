# Incident response runbook

## Objetivo

Responder incidentes minimos de continuidad para pilotos Credex y Tecdex con
triage, evidencias, decision de rollback y registro posterior.

## Severidades

| Severidad | Definicion | Ejemplos |
| --- | --- | --- |
| P1 | SaaS publico caido | `https://tcdx-iso.tecdex.net` no responde, Nginx 502/504 sostenido, DB caida |
| P2 | Backend/API caida o 5xx sostenido | backend local no responde, rutas API criticas fallan |
| P3 | AI Engine degradado con fallback operativo | `/health` AI falla, reportes o IA usan fallback |
| P4 | Incidencia menor sin impacto productivo | warnings, logs aislados, lentitud no sostenida |

## Checklist de triage

1. Registrar fecha/hora, responsable y severidad inicial.
2. Ejecutar healthcheck minimo:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
bash scripts/ops/healthcheck.sh
```

3. Validar publico:

```bash
curl -I https://tcdx-iso.tecdex.net
curl -s -i https://tcdx-iso.tecdex.net/api/health
```

4. Revisar componentes segun el runbook de healthcheck.
5. Identificar si el impacto afecta a todos los tenants o solo a Credex/Tecdex.
6. Confirmar si hubo deploy, migracion, cambio de secrets o cambio de red.

## Logs a revisar

Backend:

```bash
sudo journalctl -u tecdex-backend.service -n 200 --no-pager
```

Frontend/Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 200 --no-pager
```

DB:

```bash
sudo systemctl status postgresql --no-pager -l
pg_isready
psql -d tecdx_saas -c "select 1;"
```

AI Engine:

```bash
sudo systemctl status ai-engine.service --no-pager -l
sudo journalctl -u ai-engine.service -n 200 --no-pager
curl -s http://localhost:8001/health
```

## Evidencias a guardar

- Hora de inicio y deteccion.
- Severidad asignada.
- Codigos HTTP.
- Capturas o salida de healthcheck.
- Extractos de logs sin secretos.
- Commit desplegado si aplica.
- Tenants afectados.
- Accion tomada y resultado.

## Cuando hacer rollback

Considerar rollback si:

- la falla inicio inmediatamente despues de un deploy;
- backend o frontend queda caido y no hay fix rapido seguro;
- el error afecta flujo critico de login, dashboard, evidencias, reportes o SoA;
- no hubo migraciones irreversibles asociadas.

## Cuando no hacer rollback

No hacer rollback si:

- la causa es DB caida, red, DNS, TLS o infraestructura externa;
- AI Engine esta degradado pero backend mantiene fallback;
- el cambio incluyo migracion no reversible sin plan aprobado;
- no existe commit anterior validado;
- el rollback requiere restore DB sin aprobacion explicita.

## Comunicacion interna

Mensaje minimo:

```text
Severidad:
Inicio:
Impacto:
Tenants afectados:
Estado actual:
Accion en curso:
Proxima actualizacion:
```

## Registro posterior

Cerrar el incidente con:

- causa raiz probable o confirmada;
- duracion;
- impacto;
- comandos ejecutados;
- rollback si hubo;
- acciones preventivas;
- link o archivo del registro operativo.
