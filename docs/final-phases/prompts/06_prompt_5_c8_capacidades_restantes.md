# Prompt 5-C8 — Encuestas, assurance, pérdidas y reporting

## Rol

Actúa como principal full-stack engineer GRC, estadístico, especialista en reporting documental y QA de artefactos.

## Contexto y objetivo

Completa operacionalmente encuestas, assurance, pérdidas y Report Studio sobre la capa oficial. No basta con servicios o componentes descriptivos: todos los flujos deben persistir, ejecutar, aprobar, explicar y producir evidencia real.

## Preflight y rama

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git switch main
git fetch origin --prune
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git remote get-url origin
git switch -c phase5/c8-operational-capabilities
```

Resolver el SHA desde `main` actual; abortar si el worktree no está limpio.

## Restricciones

- No scoring simple cuando corresponde ponderación.
- No tratar `not_applicable` o `inconclusive` como positivo.
- No mezclar monedas ni calcular VaR sin supuestos/muestra.
- No generar documentos ficticios o solo HTML renombrado.
- No producción, merge ni deploy.

## Alcance

1. Encuesta: definición, versiones, preguntas, branching, campaña, respuestas, scoring, coverage, rates, Cronbach y propuesta GRC.
2. Assurance: test, población, muestra, ejecución, evidencia, excepción, hallazgo, acción, aprobación y re-test.
3. Pérdidas: evento, recuperación, net loss, expected loss, estadística, VaR/Monte Carlo cuando aplica, KRI y relaciones.
4. Report Studio: definición, secciones, resultados oficiales, preview, PDF/DOCX/XLSX, aprobación, descarga, historial y programación.

## Modelo de datos

Reutilizar tablas actuales; agregar solo persistencia faltante para versiones, aprobaciones, artefactos/checksums, programaciones y manifiestos. Todo tenant-scoped, auditable, con status checks, FK y retención.

## Migración

Crear migración aditiva e idempotente solo para brechas confirmadas. Probar datos existentes, reaplicación, checksum, rollback y postcondiciones PostgreSQL.

## Backend

Completar APIs y servicios oficiales de los cuatro dominios, validación estadística, snapshots, explanation/lineage, jobs de generación y almacenamiento seguro. Mantener respuesta sanitizada y descarga autorizada.

## Frontend

Constructores operacionales sin JSON primario: formularios, validación, preview, draft, review, publicación/ejecución, resultado, historial y explicación. Report Studio permite secciones, resultados, tablas, gráficas, notas, clasificación y artefactos.

## Seguridad, permisos, capabilities y límites

Permisos separados por dominio y acción; capability y límite por campañas/respuestas/tests/muestras/eventos/reportes/generaciones/retención. Validar archivo, MIME, tamaño, tenant, token de descarga y clasificación.

## Jobs

Jobs de cálculo, simulación, report generation y scheduling con idempotency key, tenant, período, timeout, retries, checksum, estado y cleanup.

## Pruebas y CI

Unitarias numéricas, PostgreSQL, API, permisos, tenant A/B, jobs y Playwright de cada flujo. Generar y abrir PDF, DOCX y XLSX: firma/ZIP, estructura, contenido, metadata, fórmula/version/período/tenant, checksum y prevención de formula injection.

## Documentación

Actualizar metodologías, API, UX, runbooks, consumers, seguridad, evidencia E2E y artefactos. Declarar limitaciones estadísticas reales.

## Criterios de cierre

- flujos completos desde UI;
- resultados oficiales y lineage;
- artefactos reales abiertos y validados;
- aprobaciones y descargas autorizadas;
- jobs idempotentes y cleanup;
- cero deuda del bloque.

## Salida obligatoria

Informar SHA, migración, formularios, endpoints, jobs, pruebas numéricas, E2E, artefactos, tenant isolation, límites, riesgos y PR.

## Git y prohibiciones finales

No merge. No deploy.

Commit/push y PR contra `main`; no merge, no deploy, no producción.
