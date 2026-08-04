# Fase 5-C2-H — Estabilización transversal

Este bloque se ejecuta antes de Fase 5-C3 y corrige las brechas detectadas por la primera auditoría funcional.

## Cambios incluidos

- Rate limiting público exclusivo para login, identificado por IP y correo normalizado.
- Rate limiting autenticado por tenant, usuario y política de operación.
- Políticas separadas para lectura, escritura, IA y reportes/exportaciones.
- Headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` y `X-RateLimit-Policy`.
- Métricas Prometheus para solicitudes permitidas y bloqueadas.
- Correcciones de hidratación para idioma y estado del sidebar.
- Restauración de preferencias cliente mediante `requestAnimationFrame`, sin alterar el primer render SSR y sin infringir `react-hooks/set-state-in-effect`.
- Cache de corta duración y single-flight para bootstrap de módulos y permisos.
- Normalización de tipos de páginas dinámicas para Next.js.

## Variables de entorno

```text
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTHENTICATED_RATE_LIMIT_WINDOW_MS=60000
AUTHENTICATED_READ_RATE_LIMIT_MAX=600
AUTHENTICATED_WRITE_RATE_LIMIT_MAX=180
AUTHENTICATED_AI_RATE_LIMIT_MAX=30
AUTHENTICATED_REPORT_RATE_LIMIT_MAX=10
AUTHENTICATED_REPORT_RATE_LIMIT_WINDOW_MS=300000
```

Los valores son una línea base y deben ajustarse con telemetría real. Los límites comerciales deben conservar códigos funcionales distintos de `RATE_LIMITED`.

## Validación obligatoria antes del merge

```text
npm --prefix backend run check
node backend/src/middleware/authenticatedRateLimit.middleware.test.js
node backend/src/middleware/publicRateLimit.middleware.test.js
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Después del despliegue controlado se debe ejecutar Playwright v2 con los dos tenants demo y confirmar:

- cero React hydration error 418;
- cero HTTP 429 durante navegación normal;
- HTTP 429 reproducible bajo burst controlado;
- cero HTTP 5xx;
- navegación coherente por rol;
- separación de cuota entre tenant y usuario;
- ausencia de páginas vacías causadas por errores transversales.
