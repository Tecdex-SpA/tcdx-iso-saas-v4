# Plan Primera Venta 1 a 5 Clientes

## Qué sí está listo para vender

- Plataforma multi-tenant para gestión ISO con usuarios, roles y módulos.
- Dashboard operativo para seguimiento de cumplimiento.
- Gestión de controles, evidencias, hallazgos, no conformidades y planes de acción.
- Diagnóstico ISO Express.
- Matriz de riesgos ISO.
- Generación documental ISO.
- IA Auditor como asistente/preauditoría con revisión humana.
- Exportes PDF premium existentes.

## Qué vender como piloto controlado

Vender TCDX Compliance como piloto asistido para ordenar cumplimiento, evidencias, riesgos y trabajo operativo previo a auditorías internas o externas.

Alcance recomendado:

- 1 a 2 normas por cliente.
- Hasta 5 clientes piloto.
- Onboarding asistido por Tecdex.
- Revisión humana obligatoria sobre recomendaciones IA.
- Soporte en horario laboral acordado.

## Normas recomendadas

- ISO 27001:2022.
- ISO 9001:2015.
- ISO/IEC 42001:2023 solo si el cliente requiere gobierno IA y acepta acompañamiento.

## Qué no prometer todavía

- Certificación automática.
- Reemplazo de auditor humano o casa certificadora.
- SLA 24/7.
- Integración masiva sin levantamiento previo.
- Carga de evidencias altamente sensibles sin política de storage validada.
- Automatización irreversible de hallazgos, no conformidades o evidencias.

## Checklist comercial previo a demo

- [ ] Definir industria, norma objetivo y dolor principal del cliente.
- [ ] Definir si demo será con datos ficticios o tenant piloto.
- [ ] Explicar que IA Auditor asiste y no certifica.
- [ ] Mostrar flujo: diagnóstico, controles, evidencias, riesgo, acciones y PDF.
- [ ] Acordar alcance de piloto, responsables y duración.

## Checklist técnico previo a onboarding

- [ ] Crear tenant y usuarios mínimos.
- [ ] Activar solo normas contratadas.
- [ ] Validar roles: admin, auditor, operativo, viewer.
- [ ] Ejecutar `bash scripts/preventa-check.sh`.
- [ ] Ejecutar build frontend.
- [ ] Validar backend y AI Engine con systemd.
- [ ] Confirmar política de evidencias antes de cargar archivos reales sensibles.
