# Frontend lint debt

## Estado

`npm run lint` existe y actualmente falla por deuda histórica amplia fuera del módulo Preparación documental.

Última medición durante este cierre:

```txt
683 problems
440 errors
243 warnings
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

Se agregó un script específico para el módulo nuevo:

```bash
npm run lint:audit-preparation
```

Este script valida:

```txt
src/components/auditorias/AuditPreparationPanel.tsx
```

El objetivo es impedir que Preparación documental incorpore nueva deuda mientras el saneamiento global se aborda en una pasada separada.

## Por qué no bloquea el módulo documental

- `npm run build` pasa.
- `npm run lint:audit-preparation` pasa.
- Los errores globales no provienen de los cambios de cierre documental.
- Corregir los 440 errores globales requiere una tarea dedicada para evitar regresiones funcionales en pantallas históricas.

## Nota IA Auditor ESXi

Durante la corrección de IA Auditor para ESXi se validó el archivo nuevo `src/utils/apiClient.ts` con ESLint específico y pasa sin errores. El panel consolidado `src/components/auditorias/IaAuditorPanel.tsx` sigue arrastrando deuda histórica de tipado `any` y dos warnings de funciones no usadas; el build productivo sí pasa. Esta deuda no bloquea la corrección aplicada: manejo robusto de respuestas no JSON, mensajes de timeout y propagación de `request_id`.

## Plan de saneamiento posterior

1. Crear tipos compartidos por dominio.
2. Sustituir `any` por modelos graduales por pantalla.
3. Normalizar hooks con `useCallback`/dependencias correctas.
4. Reemplazar imágenes críticas por `next/image` donde aplique.
5. Activar lint por carpetas en CI antes de exigir lint global completo.
