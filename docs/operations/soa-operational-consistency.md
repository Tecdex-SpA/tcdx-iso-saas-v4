# SOA operational consistency

## Contrato corregido

El modulo SOA opera sobre filas materializadas en `control_soa` vinculadas a `controls.id` legacy. Para flujos operativos modernos, el backend expone tambien `modern_tenant_control_id`, resuelto contra `tenant_controls.id` dentro del mismo tenant.

## GET read-only e inicializacion

- `GET /api/soa/:tenant_id?iso=...` es solo lectura. No ejecuta bootstrap ni escrituras.
- Si no existen filas SOA, responde `requires_initialization=true`, `rows=[]`, `metrics` en cero y `preflight`.
- `POST /api/soa/:tenant_id/initialize?iso=...` es el unico flujo que materializa SOA.
- La inicializacion usa una transaccion, el mismo `client`, es idempotente y registra `control_soa_change_log` con `source='initialize'` para filas creadas.

## Relacion controls / tenant_controls / aplicabilidad

- `control_soa.tenant_control_id` conserva el contrato legacy hacia `controls.id`.
- `tenant_controls.id` se usa para planes de accion y alcance operativo moderno.
- El backend resuelve desde SOA ambos formatos: `controls.id` legacy y `tenant_controls.id` moderno, siempre filtrando por `tenant_id`.
- No se migran datos legacy de forma destructiva.

## Estados canonicos

Estados validos:

- `pendiente`
- `parcial`
- `implementado`
- `no aplica`

Aliases legacy como `no implementado` se normalizan a `pendiente` para lectura/compatibilidad. El backend rechaza combinaciones contradictorias, por ejemplo `applicable=true` con `implementation_status=no aplica`. `applicable=false` exige justificacion y fuerza estado `no aplica`.

## Metricas canonicas

El backend entrega `metrics` en `GET /api/soa/:tenant_id`:

- `implementation_coverage_pct = implemented_applicable_count / applicable_count`
- `applicability_coverage_pct = decision_count / total_controls`
- `na_justification_coverage_pct = not_applicable_justified_count / not_applicable_count`
- `evidence_validity_pct = controls_with_valid_evidence_count / applicable_count`

Las divisiones por cero devuelven `0`.

## Evidencia valida

Cuenta como valida solo evidencia aprobada/validada, no rechazada y no vencida. Evidencia solo cargada, vencida o rechazada no cuenta como evidencia valida.

## Inconsistencias

El backend expone inconsistencias por fila y resumen. Codigos principales:

- `NOT_APPLICABLE_WITHOUT_JUSTIFICATION`
- `NOT_APPLICABLE_IMPLEMENTED`
- `APPLICABLE_WITH_NO_APPLIES_STATUS`
- `IMPLEMENTED_WITHOUT_VALID_EVIDENCE`
- `IMPLEMENTED_WITH_REJECTED_EVIDENCE`
- `IMPLEMENTED_WITH_EXPIRED_EVIDENCE`
- `NOT_APPLICABLE_WITH_HIGH_RISK`
- `COMPLIANT_WITH_OPEN_NC`
- `COMPLIANT_WITH_OVERDUE_ACTION`
- `MISSING_OWNER_FOR_APPLICABLE`
- `REVIEW_OVERDUE`
- `REVIEW_MISSING`

## Change log

Toda actualizacion manual de SOA inserta registros en `control_soa_change_log` por campo cambiado. Se registran tenant, control legacy, campo, valor anterior, valor nuevo, source, actor disponible y timestamp.

## Acciones y hallazgos desde SOA

- Hallazgos desde SOA siguen usando resolucion legacy compatible con `controls.id`.
- Planes de accion aceptan `tenant_controls.id` moderno o `controls.id` legacy y resuelven al ID moderno dentro del tenant.
- Si el control no se puede resolver de forma segura, el backend responde 400 sin stack trace.

## Normalizacion ISO

El backend acepta canonicos `ISO27001`, `ISO27701`, `ISO27017`, `ISO27018` y aliases `ISO/IEC27001`, `ISO/IEC 27001`, `ISO/IEC27701`, `ISO/IEC 27701`, `ISO/IEC27017`, `ISO/IEC 27017`, `ISO/IEC27018`, `ISO/IEC 27018`.

## QA operativo

Validaciones locales:

```bash
cd backend
npm run check
npm test

cd ../frontend
npm run lint
npm run check

cd ..
git diff --check
```

`scripts/qa-tenant-path-p1.sh` incluye GET SOA read-only y cross-tenant si se entregan variables de entorno reales.
