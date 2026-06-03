# Sprint 0 - Roadmap operativo posterior

## Sprint 1: Perfil empresa y procesos
Objetivo: formalizar perfil empresa y modelo conceptual de procesos/operaciones sin romper tenant actual.
Alcance: diseño DB no destructivo, endpoints internos, UI mínima si se aprueba, mapeo con `tenant_company_profiles`.
Entregables: ADR, migraciones no destructivas propuestas, contratos API, pruebas tenant.
Riesgos: duplicar `tenant_standard_operations` o mezclar proceso con norma.
Criterios de aceptación: proceso pertenece a tenant, tiene owner, criticidad, estado, y no altera módulos existentes.
Dependencias: validación DBA y decisión de nomenclatura proceso/operación.

## Sprint 2: Vincular procesos con controles/evidencias/riesgos
Objetivo: conectar proceso -> norma -> control -> evidencia/riesgo.
Alcance: relaciones no destructivas, backfill opcional/manual, filtros por proceso.
Entregables: tablas puente o columnas aprobadas, endpoints y pruebas cross-tenant.
Riesgos: romper vistas health existentes.
Criterios: un control/evidencia/riesgo puede consultarse por proceso sin perder filtro tenant.
Dependencias: Sprint 1.

## Sprint 3: Diagnóstico fortalecido
Objetivo: diagnóstico por proceso y norma activa.
Alcance: preguntas/gaps por proceso, acciones derivadas y trazabilidad.
Entregables: endpoints y UI incremental.
Riesgos: duplicar diagnóstico ISO Express.
Criterios: brechas quedan asociadas a proceso/control y generan action plans.
Dependencias: Sprint 2.

## Sprint 4: KPIs y salud por proceso
Objetivo: dashboard de salud/cumplimiento por proceso.
Alcance: agregaciones, vistas, índices y cards ejecutivas.
Entregables: vistas DB, endpoints health/KPI, pruebas performance.
Riesgos: consultas costosas y datos incompletos.
Criterios: KPIs por proceso reproducibles y filtrables por norma.
Dependencias: Sprint 2 y 3.

## Sprint 5: Reportes e IA operacional
Objetivo: reportes ejecutivos e IA Auditor con contexto real operacional.
Alcance: report templates, context builder proceso/operación, trazabilidad fuentes.
Entregables: reportes por proceso, prompts actualizados, logs IA con contexto operacional.
Riesgos: respuestas IA sin fuente o con mezcla tenant.
Criterios: toda recomendación IA cita proceso, control/evidencia/brecha cuando aplique.
Dependencias: Sprint 4.
