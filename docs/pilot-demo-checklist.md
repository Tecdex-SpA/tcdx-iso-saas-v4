# Pilot / Demo Checklist — TCDX ISO SaaS

## Objetivo

Preparar una demo comercial o piloto controlado sin comprometer datos reales ni habilitar operaciones destructivas innecesarias.

## 1. Ambiente

- [ ] Confirmar URL frontend.
- [ ] Confirmar backend.
- [ ] Confirmar AI Engine `8001`.
- [ ] Confirmar tenant demo.
- [ ] Confirmar usuario demo.
- [ ] Confirmar datos demo no sensibles.

## 2. Usuarios demo

- [ ] Usuario admin demo.
- [ ] Usuario compliance/demo.
- [ ] Usuario auditor/demo si aplica.
- [ ] Validar login.
- [ ] Validar permisos.

## 3. Recorrido comercial recomendado

1. Login.
2. Dashboard.
3. Controles.
4. Evidencias.
5. Hallazgos.
6. Plan de acción.
7. IA Compliance.
8. IA Auditor Senior.
9. Historial IA Auditor.
10. Revisión humana.
11. PDF ejecutivo.
12. Exportes/reportes.

## 4. Mensajes comerciales clave

- IA Auditor entrega recomendaciones, no reemplaza al auditor humano.
- El sistema no crea hallazgos, planes, evidencias ni no conformidades automáticamente desde IA Auditor.
- Existe revisión humana.
- Existe trazabilidad.
- Existe PDF ejecutivo.
- Existe preparación para operación cloud.

## 5. Límites a explicar al cliente

- IA requiere revisión humana.
- AI Engine puede degradar sin detener todo el sistema.
- RBAC avanzado puede ajustarse según roles finales.
- Normalización de AI Engine a puerto 8000 queda como decisión futura.
- Backups deben probarse con restore real antes de producción crítica.

## 6. Soporte durante demo

- [ ] Tener terminal con monitor runtime.
- [ ] Tener runbook de continuidad.
- [ ] Tener backup reciente si se usan datos reales.
- [ ] Tener plan de rollback.

## 7. Checklist posterior

- [ ] Registrar feedback.
- [ ] Registrar brechas.
- [ ] Registrar preguntas del cliente.
- [ ] Definir ajustes de Fase 5.
