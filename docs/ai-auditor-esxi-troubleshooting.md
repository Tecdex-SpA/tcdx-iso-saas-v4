# IA Auditor troubleshooting on ESXi

## Symptom

Frontend message:

```txt
No fue posible ejecutar IA Auditor Senior.
```

This message can be caused by an actual backend error, ai-engine timeout, unauthorized internal token, or an upstream Nginx/504 HTML response that the browser previously tried to parse as JSON.

## Changes applied

- The consolidated IA Auditor panel now uses the shared frontend API parser in `frontend/src/utils/apiClient.ts`.
- Non-JSON upstream responses are converted into user-safe Spanish/English messages instead of crashing JSON parsing.
- `x-request-id` from backend/Nginx responses is appended to UI errors when present.
- Backend IA Auditor calls propagate `request_id` to ai-engine through `x-request-id`.
- Backend ai-engine client sends the required `x-ai-token` header.
- Legacy IA Auditor helper fallback no longer points at the old `192.168.100.140:8000`; it defaults to local development `http://localhost:8001` and production must use `AI_ENGINE_URL`.
- AI engine knowledge client now sends both `x-ai-token` and legacy `x-ai-internal-token` for compatibility.
- ESXi CORS origins were added while keeping UTM lab origins.

## Trace procedure

1. In the browser, copy the request ID shown in the UI error.
2. Backend VM:

```bash
journalctl -u tecdex-backend -n 300 --no-pager | grep '<request_id>'
```

3. AI VM:

```bash
journalctl -u ai-engine -n 300 --no-pager | grep '<request_id>'
```

4. Check connectivity from backend VM:

```bash
curl -s http://ai.tcdx.int:8001/health || curl -s http://ai.tcdx.int:8001/docs
```

5. Check token alignment:

```bash
grep -E '^(AI_ENGINE_URL|AI_INTERNAL_TOKEN)=' /home/tecdex/backend/.env
grep -E '^(AI_INTERNAL_TOKEN|OLLAMA_MODEL|LLM_PROVIDER|AI_ENGINE_LLM_TIMEOUT_MS)=' /home/tecdex/ai-engine/.env
```

The token value must match between backend and ai-engine. Do not paste token values into tickets or user-facing logs.

## Curl validation

```bash
TOKEN="$(curl -sk -X POST 'https://181.212.166.187:8443/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@rieltec.com","password":"123456"}' | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')"

curl -sk -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tcdx-locale: es" \
  -X POST 'https://181.212.166.187:8443/api/ai-auditor/analyze' \
  -d '{"depth":"executive","audit_focus":"general","use_rag":true,"use_drive":true,"use_web":false}' \
  | python3 -m json.tool
```

Expected:

- JSON response, not HTML.
- `human_review_required=true`.
- `can_create_records=false`.
- If ai-engine is slow or unavailable, backend returns a deterministic fallback with `trace.ai_engine_used=false`.

## Ollama model strategy

Current hardware target: 4 vCPU / 6 GB RAM.

Recommended default for stable local latency:

```bash
OLLAMA_MODEL=qwen2.5:1.5b
AI_ENGINE_LLM_TIMEOUT_MS=90000
AI_ENGINE_LOCAL_COMPACT=true
```

Candidate evaluation order:

| Model | Fit | Notes |
|---|---|---|
| `qwen2.5:1.5b` | Recommended default | Best latency/safety balance on 6 GB RAM. |
| `qwen2.5:3b` | Candidate if RAM headroom is stable | Test under concurrent backend traffic before switching. |
| `llama3.2:3b` | Candidate alternative | Validate Spanish audit output quality before using in demo. |
| `qwen2.5:7b` | Not recommended on this VM | Likely slow or memory constrained for interactive IA Auditor. |

Validation commands on AI VM:

```bash
ollama list
time ollama run qwen2.5:1.5b 'Responde en español con un resumen ISO 9001 de 5 líneas.'
journalctl -u ai-engine -n 200 --no-pager
```

Do not switch production model only by perceived quality. Record response time, memory pressure, timeout rate and Spanish audit quality first.

## Common causes

| Cause | Signal | Fix |
|---|---|---|
| Nginx returns HTML 502/504 | UI error mentions timeout/service unavailable with request ID | Check Nginx proxy target and upstream timeout. |
| Wrong internal token | ai-engine returns 401 `Unauthorized AI internal token` | Align `AI_INTERNAL_TOKEN` in backend and ai-engine. |
| Backend points to old UTM IP | Backend logs connection refused or timeout | Set `AI_ENGINE_URL=http://ai.tcdx.int:8001`. |
| Ollama slow | Backend fallback trace says `ai-engine timeout` | Keep `fast_mode` for executive paths and tune `AI_ENGINE_LLM_TIMEOUT_MS`. |
| DB/context error | Backend logs SQL code | Fix schema-safe context query; UI should still receive JSON. |

