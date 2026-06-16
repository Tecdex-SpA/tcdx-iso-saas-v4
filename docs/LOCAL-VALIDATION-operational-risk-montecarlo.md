# Local Validation: Operational Risk Monte Carlo

This runbook is for local validation only. Do not use it to deploy, restart services, or apply migrations in dev, QA, or production.

## 1. Install Dependencies

Backend:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/backend
npm ci
```

Frontend:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/frontend
npm ci
```

Do not run `npm audit fix` as part of this validation.

## 2. Backend Validation

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/backend
npm test
npm run check
```

Expected:

- `node -c src/app.js` passes.
- `operationalRiskMonteCarlo.service tests OK`.

## 3. Frontend Validation

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/frontend
npm run lint
npm run build
```

Expected:

- Lint exits `0`. Existing warnings are acceptable unless new errors appear.
- Build completes and includes `/matriz-riesgo`.

## 4. Repository Hygiene

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
git diff --check
git status --short --branch --untracked-files=all
```

Expected:

- `git diff --check` returns no output.
- Only intentional files appear in status.

## 5. Safe SQL Review

Static review:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4
grep -RIn "DROP TABLE\|DROP COLUMN\|TRUNCATE\|DELETE FROM\|ALTER TABLE tenants\|ALTER TABLE users" \
  database/migrations/20260616_operational_risk_montecarlo.sql || true
```

Expected:

- No destructive statements.

Syntax/application validation must use a disposable local database or restored local test database only. Do not run this against dev, QA, or production.

If a local database already has the baseline schema:

```bash
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
  -f database/migrations/20260616_operational_risk_montecarlo.sql
```

If using a fresh disposable database, apply required baseline migrations first. This migration has foreign keys to existing tables such as `tenants`, `users`, and `iso_risk_matrix_items`.

## 6. Optional Local PostgreSQL Container

There is no Docker Compose pattern in this repo. For a disposable PostgreSQL only, use a one-off local container:

```bash
docker run --rm --name tcdx-v4-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tcdx_v4_local \
  -p 54329:5432 \
  postgres:18
```

Then in another terminal:

```bash
export LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/tcdx_v4_local"
```

Do not use real credentials in this file or in shell history.

## 7. Local API Smoke Tests

Start a local backend only after configuring local `.env` values for a disposable/local database. Do not point local validation at shared servers.

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/backend
npm start
```

Use a valid local JWT from a local login/session:

```bash
export API_URL="http://127.0.0.1:3000"
export TOKEN="<local_valid_jwt>"
```

Create ISO27001 simulation:

```bash
curl -sS -X POST "$API_URL/api/operational-risks/simulations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "norma_tipo": "ISO27001",
    "modelo_usado": "ISO27001_TTIA",
    "nombre_riesgo": "Interrupcion de servicio critico",
    "proceso_afectado": "Continuidad operacional",
    "frecuencia": { "min": 1, "mode": 3, "max": 8, "unidad": "eventos_por_ano" },
    "impacto_operativo": { "min": 2, "mode": 6, "max": 16, "unidad": "horas_por_evento" },
    "umbral_disrupcion_critica_horas": 40,
    "iteraciones": 10000
  }' | jq
```

List simulations:

```bash
curl -sS "$API_URL/api/operational-risks/simulations?norma_tipo=ISO27001" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Get one simulation:

```bash
export SIMULATION_ID="<id_returned_by_create_or_list>"
curl -sS "$API_URL/api/operational-risks/simulations/$SIMULATION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Generate rule-based recommendation:

```bash
curl -sS -X POST "$API_URL/api/operational-risks/simulations/$SIMULATION_ID/recommendations" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 8. Local UI Validation

Run frontend locally:

```bash
cd /Users/andresbarouh/repos/tcdx-iso-saas-v4/frontend
NEXT_PUBLIC_API_URL="http://127.0.0.1:3000" npm run dev
```

Open:

```text
http://127.0.0.1:8080/matriz-riesgo
```

Validate:

- The existing risk matrix still renders.
- The "Simulacion Operativa" section is visible inside `/matriz-riesgo`.
- The form can run ISO27001 and ISO9001 simulations.
- Result cards show mean, P95, critical probability, and iterations.
- Saved simulations list refreshes.
- Rule-based recommendation can be generated.
- Viewer/read-only role cannot create simulations.
- No financial language appears in the UI or recommendation output.

## 9. Cross-Tenant Local Tests

With two local tenants and valid local tokens:

```bash
export TOKEN_TENANT_A="<local_jwt_tenant_a>"
export TOKEN_TENANT_B="<local_jwt_tenant_b>"
export SIMULATION_A="<simulation_id_created_by_tenant_a>"
```

Tenant B should not access Tenant A simulation:

```bash
curl -i "$API_URL/api/operational-risks/simulations/$SIMULATION_A" \
  -H "Authorization: Bearer $TOKEN_TENANT_B"
```

Expected:

- `404` or `403` depending on tenant and RBAC path.
- No Tenant A data in the response body.

## 10. No-Deploy Boundary

Do not:

- deploy to VMs
- restart services
- apply migrations to dev, QA, or production
- use production credentials
- run `npm audit fix`
- push or merge without explicit approval
