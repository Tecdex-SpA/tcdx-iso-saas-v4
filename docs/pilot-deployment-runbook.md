# TCDX Compliance - Runbook de Piloto Asistido

## 1. Preparación
1. Confirmar rama aprobada y mergeada en `main`.
2. Confirmar respaldo PostgreSQL reciente.
3. Confirmar variables productivas sin cambios manuales no documentados.
4. Ejecutar QA local de sintaxis antes de deploy.

## 2. Crear o preparar tenant
1. Entrar como superadmin a Administración SaaS.
2. Crear empresa/tenant.
3. Asociar usuario administrador del tenant.
4. Configurar normas activas, por ejemplo ISO 9001 e ISO 27001.
5. Configurar IA:
   - Sin IA: `ai_enabled=false`, `ai_plan=none`.
   - Con IA piloto: `ai_enabled=true`, plan acordado y features explícitas.

## 3. Perfil Empresa y aplicabilidad
1. Iniciar sesión como usuario del tenant.
2. Ir a `Perfil empresa`.
3. Completar industria, subindustria, tamaño, madurez, alcance, procesos críticos y exclusiones.
4. Guardar perfil.
5. Reconstruir universo aplicable.
6. Validar:
   - Controles aplicables.
   - KPIs aplicables.
   - Exclusiones registradas.
   - Health con metadata de aplicabilidad.

## 4. Validación operativa
1. Revisar Dashboard.
2. Revisar Health.
3. Revisar Controles.
4. Revisar Administrar KPIs.
5. Subir evidencia y asociarla a control aplicable.
6. Crear hallazgo/no conformidad/plan de acción si aplica.
7. Generar reporte ejecutivo PDF.
8. Generar Contexto de la organización PDF.

## 5. Deploy
Backend:
```bash
cd /home/tecdex/backend
git pull
npm install
sudo systemctl restart tecdex-backend
```

Frontend:
```bash
cd /home/tecdex/frontend
git pull
npm install
npm run build
# reiniciar servicio frontend existente si aplica
```

AI Engine, sólo si hubo cambios:
```bash
cd /home/tecdex/ai-engine
git pull
sudo systemctl restart ai-engine
```

## 6. QA post-deploy
```bash
cd ~/repos/tcdx-iso-saas
TCDX_PASSWORD='<password>' ./scripts/test-market-readiness-flow.sh
TCDX_PASSWORD='<password>' ./scripts/test-tcdx-system-master.sh
TCDX_PASSWORD='<password>' ./scripts/test-health-applicability-flow.sh
TCDX_PASSWORD='<password>' ./scripts/test-report-applicability-flow.sh
```

## 7. Revisión de logs
```bash
sudo journalctl -u tecdex-backend -n 400 --no-pager -l \
| grep -Ei "ERROR|failed|syntax|ambiguous|does not exist|fetch failed|timeout|HTML|Unexpected"
```

`AI_DISABLED_BY_PLAN`, `CONTROL_MAPPING_REQUIRED` y fuentes opcionales omitidas no son errores críticos si aparecen como `INFO`/`WARN` controlados.

## 8. Rollback
1. Volver al commit anterior aprobado.
2. Reiniciar servicios.
3. Si hubo migración nueva, aplicar rollback manual sólo si está documentado y respaldado. No borrar datos productivos sin respaldo.
4. Reejecutar QA smoke.

