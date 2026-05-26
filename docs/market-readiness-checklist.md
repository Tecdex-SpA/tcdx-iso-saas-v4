# TCDX Compliance - Checklist de Salida a Mercado Controlada

Fecha base: 2026-05-26  
Estado objetivo: demo comercial y piloto pagado asistido, no SaaS autoservicio masivo.

## Criterios Go/No-Go

### Go para demo comercial
- `scripts/test-market-readiness-flow.sh` termina con `OVERALL_STATUS=PASS`.
- `scripts/test-tcdx-system-master.sh` termina sin fallas críticas.
- No aparecen `HTML_RESPONSE`, stacktraces o HTTP 500 en APIs críticas.
- Tenant sin IA no ve ni consume módulos IA.
- Reportes PDF se generan sin declarar IA cuando el plan no la incluye.
- Health, KPIs, controles y reportes declaran metadata de universo aplicable.

### Go para piloto pagado asistido
- Todo lo anterior.
- Flujo manual validado: crear tenant, activar normas, completar Perfil Empresa, reconstruir aplicabilidad, revisar controles/KPIs/health, subir evidencia y generar reporte.
- Logs backend post-prueba sin errores críticos nuevos.
- Backups y rollback operativo confirmados para la ventana de piloto.

### No-Go para SaaS autoservicio masivo
No declarar apto si falta alguno de estos puntos:
- Onboarding autoservicio probado con múltiples tenants reales.
- Monitoreo, alertas y SLO documentados.
- Backups automatizados y restore ensayado.
- Política de soporte y operación 24/7 o ventana equivalente.
- Pruebas multi-tenant con datos reales anonimizados y más de dos tenants.

## Checklist Técnico
- Backend `npm run check` pasa.
- Frontend `npm run lint` sin errores y `npm run build` pasa.
- AI Engine `py_compile` pasa en rutas principales.
- Scripts QA pasan con credenciales de QA.
- No hay IPs legacy `192.168.100` activas en runtime.
- `.env.example` no contiene secretos reales.
- No se usa PM2 para backend productivo.

## Checklist Seguridad
- Todas las rutas sensibles requieren JWT.
- RBAC tiene regla explícita o excepción documentada.
- `tenant_id` proviene del JWT salvo rutas superadmin explícitas.
- Descargas sensibles requieren autorización.
- AI Engine requiere token interno.
- Tenant sin IA no llama ai-engine, Ollama, Brave ni RAG.
- Errores esperados (`AI_DISABLED_BY_PLAN`, `CONTROL_MAPPING_REQUIRED`) no se registran como `ERROR`.

## Checklist Funcional
- Dashboard muestra datos tenant-scoped.
- Health usa universo aplicable o declara fallback legacy.
- Controles y KPIs excluidos no aparecen al cliente.
- Perfil Empresa guarda datos y reconstruye universo aplicable.
- Evidencias no quedan huérfanas ni asociadas a controles excluidos.
- Reporte ejecutivo premium genera PDF con trazabilidad compacta.
- Auditorías funcionan sin IA y, si el plan lo permite, con IA.

## Checklist Comercial
- Alcance del piloto comunicado al cliente.
- Limitaciones IA explicadas: apoyo, no reemplazo de auditor humano.
- Datos mínimos requeridos para valor real: normas activas, Perfil Empresa, controles, KPIs y evidencias.
- Plan IA y features por tenant configurables desde Administración SaaS.
- Mensaje de venta evita prometer certificación automática.

## Checklist Demo
- Tenant demo sin IA: experiencia limpia, sin menús IA.
- Tenant demo con IA: qwen2.5:3b, trazabilidad y ejecución async en tareas largas.
- PDF de ejemplo disponible.
- Flujo de mapping documental muestra resultado controlado si falta control aplicable.

