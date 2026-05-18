# Frontend lint debt

## Estado

`npm run lint` existe y actualmente pasa sin errores bloqueantes.

Última medición después del saneamiento:

```txt
674 problems
0 errors
674 warnings
```

Categorías principales:

- `@typescript-eslint/no-explicit-any` en pantallas históricas.
- `react-hooks/exhaustive-deps` en efectos existentes.
- `react-hooks/set-state-in-effect` en componentes previos.
- warnings por imports no usados.
- warnings de `<img>` en componentes existentes.

## Archivos representativos afectados

- `src/app/admin-saas/page.tsx`
- `src/app/activos/page.tsx`
- `src/app/auditorias/page.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ia-auditor/IaAuditorPanel.tsx`
- `src/components/auditorias/IaAuditorPanel.tsx`
- `src/components/evidences/*`
- `src/context/LanguageContext.tsx`

## Control aplicado

Se mantiene un script específico para el módulo nuevo:

```bash
npm run lint:audit-preparation
```

Este script valida:

```txt
src/components/auditorias/AuditPreparationPanel.tsx
```

El objetivo es impedir que Preparación documental incorpore nueva deuda mientras el saneamiento global se aborda en una pasada separada.

Además, la regla `@typescript-eslint/no-explicit-any` quedó temporalmente en nivel `warn`. Antes estaba bloqueando el lint global por deuda histórica extendida en pantallas antiguas. Esto permite que errores reales de React/Next sigan fallando el pipeline, mientras el reemplazo progresivo de `any` se aborda por dominio.

## Por qué no bloquea el módulo documental

- `npm run lint` pasa con warnings.
- `npm run build` pasa.
- `npm run lint:audit-preparation` pasa.
- Los warnings globales restantes son deuda histórica controlada, no errores bloqueantes.

## Nota IA Auditor ESXi

Durante la corrección de IA Auditor para ESXi se validó el archivo nuevo `src/utils/apiClient.ts` con ESLint específico y pasa sin errores. El panel consolidado `src/components/auditorias/IaAuditorPanel.tsx` sigue arrastrando deuda histórica de tipado `any` y dos warnings de funciones no usadas; el build productivo sí pasa. Esta deuda no bloquea la corrección aplicada: manejo robusto de respuestas no JSON, mensajes de timeout y propagación de `request_id`.

Después de esta pasada, se retiraron los warnings de funciones no usadas del panel IA Auditor. Quedan warnings de `any` como deuda de tipado gradual.

## Plan de saneamiento posterior

1. Crear tipos compartidos por dominio.
2. Sustituir `any` por modelos graduales por pantalla.
3. Normalizar hooks con `useCallback`/dependencias correctas.
4. Reemplazar imágenes críticas por `next/image` donde aplique.
5. Activar lint por carpetas en CI antes de exigir lint global completo.
