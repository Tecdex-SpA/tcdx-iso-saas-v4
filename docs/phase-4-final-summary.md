# Fase 4 — Cierre productivo inicial

## Resumen ejecutivo

La Fase 4 deja el SaaS ISO/TCDX preparado para operación controlada, demo comercial seria, piloto productivo y migración futura a Oracle Cloud.

Esta fase no agrega una gran funcionalidad de usuario final. Su valor está en preparar el sistema para operar con menos riesgo:

- configuración por entorno;
- proxy Nginx;
- hardening básico;
- RBAC baseline;
- preparación Oracle Cloud;
- backup/restore;
- continuidad operativa;
- observabilidad;
- QA final repetible.

## Objetivo de Fase 4

Convertir el sistema desde un producto funcional de laboratorio a una base productiva inicial operable, auditable y documentada.

## Estado por subfase

| Fase | Estado | Resultado |
|---|---:|---|
| 4A | Cerrada | Configuración por entorno, Nginx externo 3000, Next interno 8080 |
| 4B | Cerrada | Hardening básico, CORS, headers, payload limits, rate limiting |
| 4C | Cerrada | RBAC baseline y QA de permisos |
| 4D | Cerrada | Readiness Oracle Cloud, plantillas systemd/Nginx, cutover |
| 4E | Cerrada | Backup, restore-test, inventario y continuidad |
| 4F | Cerrada | Observabilidad básica, runtime monitor y logs snapshot |

## Arquitectura laboratorio validada

```text
Usuario/Mac
  -> https://181.212.166.187:8443
  -> Nginx frontend
  -> Next.js interno 127.0.0.1:8080

Frontend
  -> Backend http://bk.tcdx.int:3000

Backend
  -> PostgreSQL db.tcdx.int:5432
  -> AI Engine ai.tcdx.int:8001
```

## Arquitectura cloud objetivo

```text
Usuario Internet
  -> DNS
  -> Nginx / Load Balancer 80/443
  -> Next.js interno 127.0.0.1:8080
  -> API backend 3000
  -> PostgreSQL privado 5432
  -> AI Engine privado 8001 o normalizado futuro a 8000
```

## Puertos reales

| Servicio | Lab validado | Nota |
|---|---:|---|
| Frontend externo | 3000 | Expuesto por Nginx |
| Next.js interno | 8080 | Puerto interno |
| Backend | 3000 | API Node/Express |
| PostgreSQL | 5432 | Privado |
| AI Engine | 8001 | Estado real validado |
| AI Engine objetivo futuro | 8000 | Normalización opcional posterior |

## Seguridad aplicada

- CORS restringido a orígenes definidos.
- Headers básicos de seguridad.
- Payload limit.
- Rate limiting básico.
- QA de seguridad repetible.
- `.env` reales fuera de Git.
- Endpoints sensibles sin token no entregan datos.

## RBAC baseline

- QA básico de RBAC.
- Endpoints sensibles validados sin token.
- Admin actual no bloqueado.
- RBAC avanzado queda como evolución futura si requiere modelado adicional de DB/permisos.

## Backup/restore

- Scripts de backup runtime.
- Restore-test seguro sobre base temporal o dry-run.
- Inventario operativo.
- Runbook de backup/restore.
- Prohibición explícita de restore sobre DB productiva.

## Observabilidad

- Monitor runtime.
- Snapshot de logs operativos.
- QA observability.
- Runbook de observabilidad.
- AI Engine validado en `8001` para laboratorio.

## QA disponibles

| Script | Propósito |
|---|---|
| `scripts/env-check.sh` | Validación de entorno |
| `scripts/qa-security-basic.sh` | Seguridad básica |
| `scripts/qa-rbac-basic.sh` | RBAC baseline |
| `scripts/qa-cloud-readiness.sh` | Readiness cloud |
| `scripts/qa-backup-readiness.sh` | Backup/restore readiness |
| `scripts/qa-observability.sh` | Observabilidad |
| `scripts/qa-ai-auditor-full.sh` | IA Auditor end-to-end |
| `scripts/qa-bilingual-full.sh` | Validación bilingüe |
| `scripts/qa-phase4-final.sh` | Agregador final Fase 4 |

## Riesgos residuales

Los riesgos residuales quedan documentados en:

```text
docs/phase-4-risk-register.md
```

## Próximos pasos Fase 5

Opciones recomendadas:

1. Fase 5A: migración real a Oracle Cloud.
2. Fase 5B: piloto productivo controlado.
3. Fase 5C: onboarding/comercialización inicial.
4. Fase 5D: normalización AI Engine a puerto 8000, si se decide.
