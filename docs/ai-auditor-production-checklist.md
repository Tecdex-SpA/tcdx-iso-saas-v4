# Checklist productivo — IA Auditor Senior

## Estado

Primera versión productiva no destructiva.

## Seguridad

- [ ] IA Auditor no crea registros automáticamente.
- [ ] IA Auditor no cierra hallazgos automáticamente.
- [ ] IA Auditor no aprueba planes automáticamente.
- [ ] IA Auditor no modifica evidencias históricas.
- [ ] `human_review_required=true` en análisis y sugerencias.
- [ ] `can_create_records=false` en análisis y sugerencias.
- [ ] `trace.db_write=false` en análisis.
- [ ] Los deep links son construidos por backend, no aceptados desde frontend.
- [ ] Los drafts se validan antes de prellenar módulos destino.
- [ ] Los drafts pueden descartarse manualmente.

## QA técnico

Ejecutar desde la raíz del repo:

```bash
cd ~/repos/tcdx-iso-saas

cd frontend && npm run build

cd ~/repos/tcdx-iso-saas
node -c backend/src/routes/ai-auditor.routes.js
python3 -m py_compile ai-engine/main.py
python3 -m py_compile ai-engine/app/routes/ai.py
bash -n scripts/qa-ai-auditor-full.sh
```

QA operacional:

```bash
API_URL=http://bk.tcdx.int:3000 \
FRONTEND_URL=https://181.212.166.187:8443 \
EMAIL=admin@rieltec.com \
PASSWORD=123456 \
bash ./scripts/qa-ai-auditor-full.sh
```

## Operación

Validar acceso desde:

- [ ] Sidebar.
- [ ] Dashboard.
- [ ] Auditorías.
- [ ] Ruta `/ia-auditor`.

Validar módulos destino:

- [ ] `/hallazgos`.
- [ ] `/plan-accion`.
- [ ] `/evidencias`.
- [ ] `/no-conformidades`.

## Demo comercial recomendada

1. Entrar al dashboard.
2. Abrir IA Auditor desde CTA o sidebar.
3. Ejecutar análisis con todas las normas.
4. Mostrar score, cobertura, trazabilidad de ai-engine y seguridad.
5. Filtrar por ISO27001 o ISO9001.
6. Preparar un hallazgo sugerido.
7. Mostrar que se redirige con borrador y banner de revisión humana.
8. Descartar borrador.
9. Preparar un plan de acción.
10. Reforzar que no se crea nada automáticamente.

## Próximos pasos sugeridos

- Historial persistente de análisis IA Auditor.
- Reporte PDF ejecutivo IA Auditor.
- Permisos finos por rol.
- Exportes ejecutivos desde análisis IA Auditor.
- Registro de aceptación/rechazo de recomendaciones.

## Historial persistente Fase 3K

- [ ] Migración `ai_auditor_runs` aplicada.
- [ ] `POST /api/ai-auditor/analyze` agrega `trace.history_saved=true`.
- [ ] `trace.history_run_id` existe cuando se guarda historial.
- [ ] `GET /api/ai-auditor/history` lista ejecuciones del tenant.
- [ ] `GET /api/ai-auditor/history/:id` valida tenant y devuelve detalle.
- [ ] El historial no crea hallazgos, planes, evidencias ni no conformidades.

## Frontend historial Fase 3K.2

- [ ] `/ia-auditor` muestra historial reciente.
- [ ] El detalle histórico se puede abrir.
- [ ] El historial se refresca después de análisis con `history_saved=true`.
- [ ] Si historial falla, el análisis sigue operativo.

## Reporte PDF Fase 3L

- [ ] PDF desde análisis actual funciona.
- [ ] PDF desde historial funciona.
- [ ] PDF no crea registros críticos.
- [ ] PDF incluye revisión humana requerida.
- [ ] PDF mantiene formato ejecutivo TCDX by Tecdex.

## Revisión humana Fase 3M

- [ ] Endpoint `PATCH /api/ai-auditor/history/:id/review` funciona.
- [ ] La revisión solo actualiza `ai_auditor_runs`.
- [ ] `/ia-auditor` muestra estado de revisión.
- [ ] No se crean registros críticos.
- [ ] PDF histórico sigue funcionando.

## PDF con gobernanza Fase 3N

- [ ] PDF histórico incluye estado de revisión humana.
- [ ] PDF histórico incluye comentario humano si existe.
- [ ] PDF indica que la revisión humana no equivale a cierre formal.
- [ ] PDF actual funciona aunque no exista revisión humana.
- [ ] PDF histórico y actual siguen superando validación HTTP 200 y tamaño mínimo.

## Cierre Fase 3O

- [ ] QA IA Auditor FAIL 0.
- [ ] Curl final Fase 3O FAIL 0.
- [ ] PDF actual e histórico funcionan.
- [ ] Historial y revisión humana funcionan.
- [ ] Prepare/drafts funcionan.
- [ ] No se crean registros críticos automáticamente.
- [ ] Documentos finales creados.
