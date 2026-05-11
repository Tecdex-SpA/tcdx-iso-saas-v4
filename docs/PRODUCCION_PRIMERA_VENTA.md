# Producción Primera Venta

## Objetivo

Dejar TCDX Compliance listo para un piloto comercial controlado de 1 a 5 clientes, con operación asistida, revisión humana y alcance funcional acotado.

## Requisito Node

El frontend usa Next.js 16.2.3 y React 19.2.4. Para evitar incompatibilidades en build/runtime, usar Node.js LTS 22 o superior compatible.

Validación mínima en VM frontend:

```bash
node -v
npm install
npm run build
npm start
```

El archivo `frontend/.nvmrc` fija `22` como versión recomendada para desarrollo y despliegue.

## Validación mínima local

```bash
cd ~/repos/tcdx-iso-saas
bash scripts/preventa-check.sh

cd backend
npm install
npm run check
npm test

cd ../frontend
npm install
npm run build
```

## Deploy

El deploy oficial se ejecuta solo desde el worktree estable en `main`:

```bash
cd ~/repos/tcdx-iso-saas
git branch --show-current
git status
./scripts/deploy-vms.sh
```

## Variables de entorno

Usar los archivos `.env.example` como referencia. No commitear `.env`, dumps, backups, uploads ni evidencias reales.

## Uploads y evidencias

En piloto, no subir evidencias altamente sensibles hasta validar formalmente la política de acceso a archivos. Algunas rutas históricas usan `/uploads`; la fase siguiente recomendada es mover evidencias sensibles a storage privado o descarga autenticada por endpoint.

## Límites de la primera venta

- Máximo 1 a 2 normas por cliente al inicio.
- Máximo 5 clientes piloto.
- Onboarding asistido.
- IA Auditor funciona como preauditoría/asistente: no certifica, no reemplaza auditoría humana y no crea registros críticos sin validación.
- No prometer SLA 24/7 hasta cerrar observabilidad, backups y soporte formal.
