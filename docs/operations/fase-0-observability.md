# Fase 0 — Observabilidad runtime

## Contrato

El backend expone:

- `GET /live`: proceso activo.
- `GET /ready`: readiness de DB, almacenamiento, jobs y AI Engine cuando está configurado.
- `GET /health`: estado operativo, siempre JSON y con degradación explícita.
- `GET /metrics`: métricas Prometheus de requests, errores, duración y status.

Cada respuesta incluye `X-Request-Id`. El log `HTTP_REQUEST` es JSON y contiene `request_id`, `tenant_id`, `user_id`, método, ruta, status, duración y código de error, sin Authorization, tokens, passwords, prompts ni bodies.

## Validación

```bash
node scripts/phase0/check-observability-runtime.js
sudo journalctl -u tecdex-backend.service -n 500 --no-pager | grep HTTP_REQUEST | tail -50
```

El script valida correlación, liveness, health, readiness bajo tres segundos, métricas, error instrumentado y denegación tenant. La evidencia queda en `artifacts/fase-0/observability-runtime.json`.

El monitoreo debe alertar por readiness 503, incremento de `tcdx_http_errors_total`, latencia sostenida y jobs fallidos. Los retries y estados terminales continúan siendo responsabilidad de los servicios de jobs existentes; la readiness confirma la disponibilidad de su tabla operativa.
