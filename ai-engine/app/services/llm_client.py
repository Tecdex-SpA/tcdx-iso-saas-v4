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
    return ""


def is_llm_available() -> bool:
    provider = _provider()
    if provider in {"openai", "openai_compatible", "azure_openai"}:
        return bool(_env("OPENAI_API_KEY"))
    if provider == "ollama":
        return bool(_env("OLLAMA_HOST"))
    return False


def get_llm_metadata() -> dict:
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
            "available": bool(_env("OLLAMA_HOST")),
            "provider": "ollama",
            "model": _env("OLLAMA_MODEL") or _env("MODEL_NAME") or "llama3.1",
            "base_url": _env("OLLAMA_HOST"),
        }
    return {
        "available": False,
        "provider": provider or "none",
        "model": "",
        "base_url": "",
    }


def _request_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout: int) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8", errors="replace")
        return json.loads(raw or "{}")


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


def call_llm_json(prompt: str, system_prompt: str = "", temperature: float = 0.2, timeout: int = 60) -> dict:
    metadata = get_llm_metadata()
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
        url = f"{base_url}/api/chat"
        payload = {
            "model": metadata["model"],
            "stream": False,
            "format": "json",
            "options": {"temperature": temperature},
            "messages": [
                {"role": "system", "content": system_prompt or "Responde siempre JSON válido en español."},
                {"role": "user", "content": prompt},
            ],
        }
        data = _request_json(url, {"Content-Type": "application/json"}, payload, int(timeout))
        content = (data.get("message") or {}).get("content") or ""
        return _parse_json_text(content)

    raise RuntimeError(f"Unsupported LLM provider: {provider}")
