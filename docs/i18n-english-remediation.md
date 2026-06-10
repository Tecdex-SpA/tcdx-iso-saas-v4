# Remediación i18n English — TCDX ISO SaaS

## Objetivo

Dejar la versión English del SaaS ISO/TCDX con una experiencia visual completa en inglés, evitando mezcla de español en vistas críticas y sin modificar datos originales de clientes ni registros almacenados en base de datos.

## Alcance aplicado

Se priorizó una corrección segura por capas:

1. Uso de diccionarios y `useTranslation` donde el componente ya podía integrarse sin riesgo.
2. Traducción visual controlada para textos provenientes de interfaz, sistema y valores conocidos de BD.
3. Guards visuales aislados por vista para corregir residuos dinámicos sin tocar lógica funcional.
4. QA específico para detectar regresiones i18n en inglés.

## Vistas trabajadas

- Ciclo de Vida / Objetivos.
- No conformidades.
- Hallazgos.
- Administración SaaS.

## Archivos principales

- `frontend/src/components/objectives/ObjectivesPanel.tsx`
- `frontend/src/components/EnglishVisualTextGuard.tsx`
- `frontend/src/components/EnglishFindingsTextGuard.tsx`
- `frontend/src/components/EnglishAdminSaasTextGuard.tsx`
- `frontend/src/components/AppLayout.tsx`
- `scripts/qa-i18n-english-full.sh`

## Reglas de seguridad

- No se modifica la base de datos.
- No se ejecutan migraciones.
- No se sobrescriben datos cliente.
- No se cambian valores internos enviados al backend.
- No se traducen destructivamente payloads.
- No se toca `.env`.
- No se exponen secretos.

## Tratamiento de datos provenientes desde BD

La versión English debe mostrar el mayor nivel posible de inglés. Para hacerlo sin alterar datos originales:

- Estados, prioridades, severidades, módulos, normas y labels del sistema se traducen para visualización.
- Frases frecuentes de sistema almacenadas en BD se traducen mediante mapeos determinísticos.
- Texto libre no conocido conserva fallback al valor original.
- La traducción automática completa de contenido libre de cliente queda como evolución posterior con IA, caché, trazabilidad y revisión humana.

## Límites conocidos

El selector nativo de archivos puede mostrar textos controlados por el navegador o sistema operativo, por ejemplo `Seleccionar archivo` o `Sin archivos seleccionados`. Para controlarlo al 100% se debe reemplazar el input file nativo por un componente custom.

Admin SaaS es una vista amplia y dinámica. Los guards cubren los residuos conocidos, pero nuevas pestañas, textos de backend o datos cargados desde BD pueden requerir agregar nuevas equivalencias.

## QA

Script principal:

```bash
bash scripts/qa-i18n-english-full.sh
```

Validaciones complementarias:

```bash
bash scripts/qa-bilingual-full.sh
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL="<qa-user-email>" PASSWORD="<qa-user-password>" bash scripts/qa-security-basic.sh
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL="<qa-user-email>" PASSWORD="<qa-user-password>" bash scripts/qa-rbac-basic.sh
API_URL=http://bk.tcdx.int:3000 FRONTEND_URL=https://181.212.166.187:8443 EMAIL="<qa-user-email>" PASSWORD="<qa-user-password>" bash scripts/qa-ai-auditor-full.sh
```

## Criterios de aceptación

- `npm run build` OK.
- Diccionarios JSON válidos.
- `qa-i18n-english-full.sh` sin FAIL.
- No hay `.env`, dumps, backups ni `.tar.gz` en cambios.
- English no muestra residuos críticos en vistas priorizadas.
- Spanish sigue funcionando como idioma base.
- IA Auditor, IA Compliance, RBAC y seguridad no se degradan.

## Fase 5A — Traducción visual de datos BD

Se agrega una capa central no destructiva para traducir visualmente datos provenientes desde BD cuando el usuario usa English.

Referencia:

- `docs/i18n-db-display-layer.md`
- `frontend/src/i18n/displayText.ts`
- `scripts/qa-i18n-db-display.sh`

Esta fase no modifica BD, no altera payloads internos y mantiene los guards visuales como red de seguridad.
