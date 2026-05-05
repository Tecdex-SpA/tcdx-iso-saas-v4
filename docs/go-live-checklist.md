# Go-live Checklist — TCDX ISO SaaS

## Objetivo

Checklist de salida para habilitar demo seria, piloto productivo o migración cloud controlada.

## 1. Prechecks técnicos

- [ ] `npm run build` frontend OK.
- [ ] `node -c backend/src/app.js` OK.
- [ ] `python3 -m py_compile ai-engine/main.py` OK.
- [ ] Backend responde.
- [ ] Frontend responde por Nginx.
- [ ] AI Engine responde en `8001`.
- [ ] PostgreSQL operativo.
- [ ] Nginx operativo.
- [ ] Systemd activo en servicios críticos.

## 2. Seguridad

- [ ] `scripts/qa-security-basic.sh` FAIL 0.
- [ ] CORS permitido solo para orígenes esperados.
- [ ] Origin malicioso no permitido.
- [ ] Headers básicos presentes.
- [ ] Payload limit activo.
- [ ] Rate limiting no rompe QA.
- [ ] `.env` reales fuera de Git.
- [ ] No hay secretos en scripts ni docs.

## 3. RBAC

- [ ] `scripts/qa-rbac-basic.sh` FAIL 0.
- [ ] Endpoints sensibles rechazan sin token.
- [ ] Admin actual conserva acceso.
- [ ] Módulos sensibles no quedan expuestos indebidamente.

## 4. Backup/restore

- [ ] `scripts/qa-backup-readiness.sh` FAIL 0.
- [ ] `DRY_RUN=true bash scripts/backup-runtime.sh` OK.
- [ ] `DRY_RUN=true bash scripts/restore-test.sh` OK.
- [ ] Existe plan de almacenamiento externo.
- [ ] Existe plan para prueba de restore real en DB temporal.

## 5. Observabilidad

- [ ] `scripts/qa-observability.sh` FAIL 0.
- [ ] Runtime monitor genera TXT/JSON/MD.
- [ ] Snapshot logs operativo genera TXT.
- [ ] AI Engine validado en `8001`.
- [ ] Runbook de incidentes disponible.

## 6. IA Auditor

- [ ] `scripts/qa-ai-auditor-full.sh` FAIL 0.
- [ ] Análisis IA funciona.
- [ ] Historial funciona.
- [ ] Revisión humana funciona.
- [ ] PDF histórico funciona.
- [ ] PDF actual funciona.
- [ ] No crea registros críticos automáticamente.

## 7. IA Compliance

- [ ] Vista responde.
- [ ] Endpoint `engine-health` responde.
- [ ] Vista bilingüe operativa.
- [ ] No se cae si AI Engine degrada.

## 8. Cloud/DNS/TLS

- [ ] Dominio definido.
- [ ] DNS planificado.
- [ ] TLS/Let's Encrypt planificado.
- [ ] Nginx 80/443 documentado.
- [ ] Variables cloud preparadas.
- [ ] Puertos privados definidos.

## 9. Rollback

- [ ] Backup DB reciente.
- [ ] Backup uploads reciente.
- [ ] Commit desplegado identificado.
- [ ] Procedimiento de rollback documentado.
- [ ] Ventana de cambio definida.

## 10. Criterios de no-go

No avanzar si ocurre cualquiera de estos puntos:

- [ ] Login falla.
- [ ] Frontend no responde.
- [ ] Backend no responde.
- [ ] QA security tiene FAIL.
- [ ] QA RBAC tiene FAIL.
- [ ] QA IA Auditor tiene FAIL.
- [ ] No existe backup reciente.
- [ ] `.env` reales aparecen en Git.
- [ ] AI Engine requerido no responde.
- [ ] DB no responde.

## 11. Aprobación final

| Rol | Nombre | Estado |
|---|---|---|
| Responsable técnico |  | Pendiente |
| Comercial/product owner |  | Pendiente |
| Soporte/operaciones |  | Pendiente |
