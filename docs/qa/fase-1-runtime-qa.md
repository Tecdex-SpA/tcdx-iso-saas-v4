# Fase 1R - Runtime QA

El workflow `.github/workflows/phase1-runtime-qa.yml` se despacha manualmente desde `main` con el SHA completo ya desplegado. Environment `qa` debe suministrar URLs, usuarios Tenant A/B, revisor, auditoría sintética, tokens administrativos y una conexión PostgreSQL exclusiva de QA para limpiar solo el manifest sintético.

Secuencia bloqueante: validar SHA/variables, instalar, activar módulo tenant, bootstrap idempotente, seed con prefijo `PHASE1R_QA_`, ejecutar 30 Playwright reales, derivar artifacts del JSON exitoso, limpiar IDs del manifest y subir evidencia. No hay `continue-on-error`, tests omitidos ni credenciales en archivos.

La limpieza solo admite `qa/test/local`, confirmación literal, tenant coincidente, IDs del manifest y prefijo reconocido. No elimina datos previos ni versiones publicadas.
