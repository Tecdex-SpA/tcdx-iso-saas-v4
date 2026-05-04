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
API_URL=http://192.168.100.120:3000 \
FRONTEND_URL=http://192.168.100.130:3000 \
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
