# API y consumers

La API autenticada vive bajo `/api/metrics/official`: catálogo, dashboard, detalle funcional/técnico, cálculo, draft/publicación de snapshot, historial, comparaciones, propuestas y jobs. El tenant proviene exclusivamente de sesión/middleware.

`/metricas` consume el catálogo funcional; `/metricas/[code]` muestra resultado, unidad, período, cobertura, trust, freshness, suficiencia, interpretación, historial y comparabilidad. El detalle técnico se solicita solo al abrirlo y solo para roles autorizados. `/dashboard` consume el adaptador oficial y recibe score/cobertura agregados desde backend, sin cálculo React. BI y reporting permanecen sobre el registro matemático oficial y se enlazan mediante los mismos códigos/bindings; el snapshot ID viaja en el payload publicado cuando existe.

Contrato de igualdad: un valor publicado conserva `snapshot_id`, valor, unidad, período, estado, trust y cobertura desde almacenamiento hasta API y UI. Estados no calculados se presentan como ausencia explicada, nunca como cero.

## Superficies

| Superficie | Contrato 5-C3 |
|---|---|
| `/metricas` y detalle | catálogo, snapshot, historia, comparaciones, propuesta y detalle técnico autorizado |
| `/dashboard` | adapter backend `/official/dashboard`; React no agrega score oficial |
| `/bi` y `GrcDecisionCenter` | catálogo/snapshot e interpretación persistida; máximo una carga lógica |
| `OfficialAnalyticsPanel` / portal GRC | mismas propiedades y snapshot ID, sin tarjetas paralelas del overview |
| reportes | `official_indicators` agregado al artifact por backend |
| export | fila JSON con estado, valor, unidad, período, trust, cobertura, snapshot y checksum idénticos |

Los endpoints administrativos de metodología, cálculo, snapshot, publicación, propuesta y job no se montan para roles sin capacidad. El E2E autentica cuatro perfiles y prueba que el valor 82 del Tenant A y 64 del Tenant B coincide entre catálogo API, export, `/metricas`, `/bi` y `/dashboard` autorizado.
