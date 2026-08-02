# Evidencia browser E2E de 5-C1

Comando ejecutado: `npm run phase5-5:browser-e2e`.

Navegador: Chromium gestionado por Playwright 1.62.0. Configuración: un worker, cero reintentos, backend y frontend locales, PostgreSQL 16 efímero.

Resultado: **10 passed (19.7s)**; `expected=10`, `unexpected=0`, `flaky=0`, `skipped=0`.

Escenarios ejecutados:

1. Login, tenant context y Portal GRC.
2. Accesibilidad Axe WCAG 2 A/AA en login y rutas críticas.
3. Métrica: configuración, preview, publicación, cálculo, resultado, explicación y lineage.
4. Encuesta: publicación, campaña y scoring oficial.
5. Assurance: muestra, resultado y revisión.
6. Evento de pérdida y estadísticas oficiales.
7. Dashboard: widget oficial, publicación y snapshot.
8. Report Studio: PDF, DOCX, XLSX, aprobación y descarga.
9. Consistencia de resultado oficial entre Portal GRC, dominio, dashboard y reporte.
10. RBAC de usuario restringido y aislamiento Tenant A/B.

Los resultados Playwright son locales y temporales; no contienen datos de cliente. El runner elimina PostgreSQL, los procesos y los artefactos no versionables al concluir la auditoría.
