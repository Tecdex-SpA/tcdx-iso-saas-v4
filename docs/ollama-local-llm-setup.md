# Ollama Local LLM Setup

Objetivo: permitir que `ai-engine` use un LLM local sin costo por token. Backend y frontend nunca llaman Ollama directamente; el flujo correcto es Backend -> ai-engine -> Ollama local.

## Configuración recomendada

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
AI_ENGINE_LLM_TIMEOUT_MS=90000
```

Modelos sugeridos:

- 8 GB RAM: `qwen2.5:3b`
- 16 GB RAM: `qwen2.5:7b`
- 32 GB RAM o GPU: evaluar `qwen2.5:14b`

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

## Prueba desde ai-engine después del deploy

```bash
curl -s http://localhost:11434/api/tags | python3 -m json.tool
curl -s http://localhost:8001/health | python3 -m json.tool
```

Luego probar IA Auditor o IA Compliance desde backend y verificar:

- `engine.llm_provider = "ollama"`
- `engine.used_llm = true` cuando Ollama responde.
- `engine.model = "ollama/qwen2.5:7b"` o el modelo configurado.
- Si falla, `limitations` debe indicar fallback determinístico y modelo intentado.
