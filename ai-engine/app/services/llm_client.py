import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict


def _env(name: str, fallback: str = "") -> str:
    return str(os.getenv(name, fallback) or "").strip()


def _provider() -> str:
    provider = _env("LLM_PROVIDER") or _env("MODEL_PROVIDER")
    if provider:
        return provider.lower()
    if _env("OPENAI_API_KEY"):
        return "openai"
    if _env("OLLAMA_HOST"):
        return "ollama"
    return "none"


def is_llm_available() -> bool:
    provider = _provider()
    if provider in {"none", "disabled", "off"}:
        return False
    if provider in {"openai", "openai_compatible", "azure_openai"}:
        return bool(_env("OPENAI_API_KEY"))
    if provider == "ollama":
        return True
    return False


def _resolve_ollama_model(depth: str = "standard", local_compact: bool = False) -> str:
    depth = depth if depth in {"executive", "standard", "deep"} else "standard"
    mode = _env("AI_AUDITOR_MODEL_MODE").lower()
    fallback = _env("OLLAMA_MODEL") or _env("MODEL_NAME") or _env("OLLAMA_MODEL_FALLBACK") or "qwen2.5:1.5b"

    if mode == "fast" or depth == "executive" or local_compact:
        return _env("OLLAMA_MODEL_FAST") or fallback

    if mode in {"balanced", "deep"} or depth in {"standard", "deep"}:
        return _env("OLLAMA_MODEL_AUDITOR") or fallback

    return fallback


def get_llm_metadata(depth: str = "standard", local_compact: bool = False) -> dict:
    provider = _provider()
    if provider in {"openai", "openai_compatible", "azure_openai"}:
        return {
            "available": bool(_env("OPENAI_API_KEY")),
            "provider": provider,
            "model": _env("OPENAI_MODEL") or _env("MODEL_NAME") or "gpt-4o-mini",
            "base_url": _env("OPENAI_BASE_URL") or "https://api.openai.com/v1",
        }
    if provider == "ollama":
        return {
            "available": True,
            "provider": "ollama",
            "model": _resolve_ollama_model(depth, local_compact),
            "base_url": _env("OLLAMA_HOST") or "http://localhost:11434",
            "model_mode": _env("AI_AUDITOR_MODEL_MODE") or "auto",
        }
    return {
        "available": False,
        "provider": provider or "none",
        "model": "",
        "base_url": "",
    }


def _int_env(name: str, fallback: int) -> int:
    try:
        return int(os.getenv(name, str(fallback)) or fallback)
    except (TypeError, ValueError):
        return fallback


def get_ollama_generation_options(depth: str = "standard", local_compact: bool = False, temperature: float = 0.2) -> Dict[str, Any]:
    depth = depth if depth in {"executive", "standard", "deep"} else "standard"
    defaults = {
        "executive": _int_env("AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_EXECUTIVE", 220),
        "standard": _int_env("AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_STANDARD", 420),
        "deep": _int_env("AI_ENGINE_LOCAL_COMPACT_NUM_PREDICT_DEEP", 700),
    }
    options: Dict[str, Any] = {
        "temperature": temperature,
        "top_p": 0.9,
        "repeat_penalty": 1.05,
    }
    if local_compact:
        options["num_predict"] = defaults[depth]
        options["num_ctx"] = _int_env("AI_ENGINE_LOCAL_COMPACT_NUM_CTX", 2048)
    return options


def _request_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout: int) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return json.loads(raw or "{}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"LLM HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"LLM connection error: {error.reason}") from error


def _parse_json_text(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return {}
    text = value.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except Exception:
        return {"answer": text}


def call_llm_json(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.2,
    timeout: int = 60,
    depth: str = "standard",
    local_compact: bool = False,
) -> dict:
    metadata = get_llm_metadata(depth, local_compact)
    if not metadata["available"]:
        raise RuntimeError("LLM provider not configured")

    timeout = int(os.getenv("AI_ENGINE_LLM_TIMEOUT_MS", str(timeout * 1000)) or timeout * 1000) / 1000
    provider = metadata["provider"]

    if provider in {"openai", "openai_compatible", "azure_openai"}:
        base_url = metadata["base_url"].rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_env('OPENAI_API_KEY')}",
        }
        payload = {
            "model": metadata["model"],
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt or "Responde siempre JSON válido en español."},
                {"role": "user", "content": prompt},
            ],
        }
        data = _request_json(url, headers, payload, int(timeout))
        content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        return _parse_json_text(content)

    if provider == "ollama":
        base_url = metadata["base_url"].rstrip("/")
        url = f"{base_url}/api/generate"
        combined_prompt = "\n\n".join([
            system_prompt or "Responde siempre JSON válido en español.",
            prompt,
            "Devuelve exclusivamente JSON válido con los campos answer y structured_result.",
        ])
        payload = {
            "model": metadata["model"],
            "prompt": combined_prompt,
            "stream": False,
            "format": "json",
            "options": get_ollama_generation_options(depth, local_compact, temperature),
        }
        data = _request_json(url, {"Content-Type": "application/json"}, payload, int(timeout))
        content = data.get("response") or (data.get("message") or {}).get("content") or ""
        return _parse_json_text(content)

    raise RuntimeError(f"Unsupported LLM provider: {provider}")
