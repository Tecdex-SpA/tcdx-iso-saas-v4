# Ollama Local LLM Setup

Objetivo: permitir que `ai-engine` use un LLM local sin costo por token. Backend y frontend nunca llaman Ollama directamente; el flujo correcto es Backend -> ai-engine -> Ollama local.

## Configuración recomendada

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
AI_ENGINE_LLM_TIMEOUT_MS=90000
AI_ENGINE_LOCAL_COMPACT=true
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_EXECUTIVE=220
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_STANDARD=420
AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_DEEP=700
AI_ENGINE_LOCAL_COMPACT_NUM_CTX=2048
```

Modelos sugeridos:

- 8 GB RAM: `qwen2.5:3b`
- 16 GB RAM: `qwen2.5:7b`
- 32 GB RAM sin GPU: mantener `qwen2.5:7b`; evaluar modelos mayores solo cuando exista GPU o batch dedicado.

## Instalación Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
systemctl status ollama --no-pager
```

## Cargar modelo inicial

```bash
ollama pull qwen2.5:7b
ollama run qwen2.5:7b "Responde en español: explica en 5 líneas qué es ISO 27001."
```

## Probar API local

```bash
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5:7b",
    "prompt": "Responde en español: dame 3 evidencias esperadas para gestión de vulnerabilidades ISO 27001.",
    "stream": false
  }' | python3 -m json.tool
```

## Seguridad

- No exponer Ollama públicamente.
- Mantener Ollama ligado a `localhost:11434`.
- No configurar `OLLAMA_HOST=0.0.0.0` salvo que exista control de red explícito.
- No enviar secretos, tokens ni credenciales al prompt.
- Si Ollama está caído o el modelo no existe, `ai-engine` debe responder con fallback determinístico y limitación explícita.
- Para modelos pequeños como `qwen2.5:1.5b` o `qwen2.5:3b`, mantener `local_compact` activo para reducir contexto y limitar generación.

## Prueba desde ai-engine después del deploy

```bash
curl -s http://localhost:11434/api/tags | python3 -m json.tool
curl -s http://localhost:8001/health | python3 -m json.tool
```

Luego probar IA Auditor o IA Compliance desde backend y verificar:

- `engine.llm_provider = "ollama"`
- `engine.used_llm = true` cuando Ollama responde.
- `engine.model = "ollama/qwen2.5:7b"` o el modelo configurado.
- `engine.local_compact = true` cuando el proveedor sea Ollama o se fuerce por request.
- `engine.ollama_options.num_predict` debe reflejar la profundidad solicitada.
- Si falla, `limitations` debe indicar fallback determinístico y modelo intentado.
