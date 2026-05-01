import ipaddress
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
UUID_RE = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b", re.IGNORECASE)
JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")
RUT_RE = re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b")
URL_RE = re.compile(r"\bhttps?://[^\s<>'\"]+", re.IGNORECASE)
FILE_RE = re.compile(r"\b[^\s/\\]+\.(?:pdf|docx|xlsx|xls|csv|sql|dump|bak|zip|7z|tar|gz)\b", re.IGNORECASE)
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
LONG_SECRET_RE = re.compile(r"\b(?:sk|pk|api|key|token|secret)[-_]?[A-Za-z0-9]{20,}\b", re.IGNORECASE)

TOPIC_QUERIES = {
    "iso_best_practices": "ISO management system audit evidence traceability best practices",
    "cybersecurity_threats": "current cybersecurity threats risk management guidance CISA NIST",
    "risk_management": "risk management residual risk treatment plan best practices",
    "business_continuity": "business continuity backup recovery testing evidence best practices",
    "cloud_security": "cloud security shared responsibility access logging monitoring best practices",
    "incident_management": "incident response evidence lessons learned best practices",
}

_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_private_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
    except ValueError:
        return False

    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_unspecified
    )


def _private_host(hostname: Optional[str]) -> bool:
    if not hostname:
        return True

    host = hostname.strip().lower()

    if host in {"localhost", "local"}:
        return True

    if host.endswith((".local", ".internal", ".lan", ".corp", ".home")):
        return True

    if IPV4_RE.fullmatch(host) and _is_private_ip(host):
        return True

    return False


def _redact_private_ips(text: str) -> Tuple[str, bool, bool]:
    removed = False
    blocked = False

    def repl(match: re.Match[str]) -> str:
        nonlocal removed, blocked
        value = match.group(0)
        if _is_private_ip(value):
            removed = True
            return " "
        return value

    cleaned = IPV4_RE.sub(repl, text)

    if any(_is_private_ip(value) for value in IPV4_RE.findall(cleaned)):
        blocked = True

    return cleaned, removed, blocked


def _remove_urls(text: str) -> Tuple[str, bool, bool]:
    removed = False
    blocked = False

    def repl(match: re.Match[str]) -> str:
        nonlocal removed, blocked
        raw = match.group(0)
        removed = True
        try:
            parsed = urllib.parse.urlparse(raw)
            if _private_host(parsed.hostname):
                blocked = True
        except Exception:
            blocked = True
        return " "

    return URL_RE.sub(repl, text), removed, blocked


def _sensitive_terms_from_payload(payload: Optional[Dict[str, Any]]) -> List[str]:
    if not isinstance(payload, dict):
        return []

    tenant_context = payload.get("tenant_context") or {}
    terms = []

    for key in [
        "tenant_id",
        "id",
        "tenant_name",
        "name",
        "client_name",
        "company_name",
        "email",
        "rut",
    ]:
        value = tenant_context.get(key)
        if value and len(str(value).strip()) >= 3:
            terms.append(str(value).strip())

    for value in payload.get("sensitive_terms") or []:
        if value and len(str(value).strip()) >= 3:
            terms.append(str(value).strip())

    return terms


def sanitize_web_query(input_value: Any, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    raw = str(input_value or "").strip()

    if not raw:
        return {
            "safe": False,
            "query": "",
            "removed_sensitive_terms": False,
            "blocked_reason": "La consulta esta vacia.",
        }

    removed_sensitive = False
    blocked_reason = None
    text = raw

    if JWT_RE.search(text) or LONG_SECRET_RE.search(text):
        return {
            "safe": False,
            "query": "",
            "removed_sensitive_terms": True,
            "blocked_reason": "La consulta contiene credenciales o tokens que no deben enviarse a internet.",
        }

    for pattern in [EMAIL_RE, UUID_RE, RUT_RE, FILE_RE]:
        text, count = pattern.subn(" ", text)
        removed_sensitive = removed_sensitive or count > 0

    text, removed_urls, blocked_url = _remove_urls(text)
    removed_sensitive = removed_sensitive or removed_urls

    text, removed_ips, blocked_ip = _redact_private_ips(text)
    removed_sensitive = removed_sensitive or removed_ips

    for term in _sensitive_terms_from_payload(payload):
        escaped = re.escape(term)
        text, count = re.subn(escaped, " ", text, flags=re.IGNORECASE)
        removed_sensitive = removed_sensitive or count > 0

    if blocked_url or blocked_ip:
        blocked_reason = "La consulta contiene datos sensibles que no deben enviarse a internet."

    text = re.sub(r"[^A-Za-z0-9\s\-_/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text or len(text) < 8:
        blocked_reason = blocked_reason or "La consulta no puede sanitizarse de forma util."

    if EMAIL_RE.search(text) or JWT_RE.search(text) or LONG_SECRET_RE.search(text):
        blocked_reason = "La consulta contiene datos sensibles que no deben enviarse a internet."

    if blocked_reason:
        return {
            "safe": False,
            "query": "",
            "removed_sensitive_terms": True,
            "blocked_reason": blocked_reason,
        }

    return {
        "safe": True,
        "query": text[:220],
        "removed_sensitive_terms": removed_sensitive,
        "blocked_reason": None,
    }


def _web_context_settings() -> Dict[str, Any]:
    provider = os.getenv("WEB_CONTEXT_PROVIDER", "brave").strip().lower()
    enabled_raw = os.getenv("ENABLE_WEB_CONTEXT", "true").strip().lower()
    enabled = enabled_raw not in {"false", "0", "no", "off"} and provider != "disabled"

    max_results = int(
        os.getenv("WEB_CONTEXT_MAX_RESULTS")
        or os.getenv("BRAVE_SEARCH_MAX_RESULTS_PER_QUERY")
        or "5"
    )
    max_queries = int(os.getenv("WEB_CONTEXT_MAX_QUERIES", "2") or "2")
    timeout_ms = int(os.getenv("WEB_CONTEXT_TIMEOUT_MS", "8000") or "8000")
    ttl_minutes = int(os.getenv("WEB_CONTEXT_CACHE_TTL_MINUTES", "1440") or "1440")

    return {
        "enabled": enabled,
        "provider": provider,
        "configured": bool(os.getenv("BRAVE_SEARCH_API_KEY")),
        "endpoint": os.getenv("BRAVE_SEARCH_ENDPOINT", "https://api.search.brave.com/res/v1/web/search"),
        "max_results": max(1, min(max_results, 10)),
        "max_queries": max(1, min(max_queries, 5)),
        "timeout_seconds": max(1, min(timeout_ms / 1000, 20)),
        "ttl_seconds": max(60, ttl_minutes * 60),
    }


def _brave_search(query: str, settings: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("BRAVE_SEARCH_API_KEY")

    if not api_key:
        return {"ok": False, "error": "brave_api_key_missing", "results": []}

    cached = _CACHE.get(query)
    now = time.time()
    if cached and cached[0] > now:
        return {"ok": True, "query": query, "results": cached[1], "cached": True}

    params = urllib.parse.urlencode({
        "q": query,
        "count": settings["max_results"],
        "search_lang": "en",
        "country": "us",
    })

    request = urllib.request.Request(
        f"{settings['endpoint']}?{params}",
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "X-Subscription-Token": api_key,
            "User-Agent": "TCDX-AI-Engine/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=settings["timeout_seconds"]) as response:
            data = json.loads(response.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as exc:
        return {"ok": False, "error": f"brave_http_{exc.code}", "results": []}
    except Exception:
        return {"ok": False, "error": "brave_request_failed", "results": []}

    results = []
    for item in (data.get("web") or {}).get("results") or []:
        url = item.get("url") or ""
        if not url.startswith(("http://", "https://")):
            continue
        results.append({
            "title": item.get("title") or "Fuente externa",
            "url": url,
            "source": "brave",
            "retrieved_at": _utc_now(),
            "summary": item.get("description") or "",
        })

    _CACHE[query] = (now + settings["ttl_seconds"], results)
    return {"ok": True, "query": query, "results": results, "cached": False}


def _queries_for_payload(payload: Dict[str, Any]) -> List[str]:
    topics = payload.get("web_context_topics") or []
    queries = []

    for topic in topics:
        query = TOPIC_QUERIES.get(str(topic).strip())
        if query:
            queries.append(query)

    requested_output = str(payload.get("requested_output") or "").strip().lower()
    if not queries and requested_output in {"report", "audit_preparation", "global_analysis"}:
        queries.append(TOPIC_QUERIES["iso_best_practices"])

    seen = set()
    deduped = []
    for query in queries:
        key = query.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(query)

    return deduped


def build_external_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    settings = _web_context_settings()

    if not bool(payload.get("allow_web_context", False)):
        return {
            "used": False,
            "provider": "brave",
            "reason": "El payload no habilito contexto externo para este analisis.",
        }

    if not settings["enabled"]:
        return {
            "used": False,
            "provider": "brave",
            "reason": "La busqueda web esta desactivada por configuracion.",
        }

    if settings["provider"] != "brave":
        return {
            "used": False,
            "provider": settings["provider"],
            "reason": "El proveedor configurado no es brave.",
        }

    if not settings["configured"]:
        return {
            "used": False,
            "provider": "brave",
            "reason": "BRAVE_SEARCH_API_KEY no esta configurada.",
        }

    base_queries = _queries_for_payload(payload)
    if not base_queries:
        return {
            "used": False,
            "provider": "brave",
            "reason": "No fue necesario buscar informacion externa para este analisis.",
        }

    safe_queries = []
    limitations = [
        "La informacion externa se usa solo como contexto complementario y no reemplaza la evidencia interna del tenant."
    ]

    for query in base_queries:
        sanitized = sanitize_web_query(query, payload=payload)
        if sanitized["safe"]:
            safe_queries.append(sanitized["query"])
        else:
            limitations.append(sanitized["blocked_reason"])

    safe_queries = safe_queries[: settings["max_queries"]]

    if not safe_queries:
        return {
            "used": False,
            "provider": "brave",
            "reason": "No hubo consultas sanitizadas seguras para enviar a internet.",
            "limitations": limitations,
        }

    sources = []
    failed_queries = []
    seen_urls = set()

    for query in safe_queries:
        result = _brave_search(query, settings)
        if not result.get("ok"):
            failed_queries.append({"query": query, "error": result.get("error")})
            continue

        for item in result.get("results") or []:
            url = item.get("url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            sources.append(item)

    if not sources:
        return {
            "used": False,
            "provider": "brave",
            "reason": "No se obtuvieron fuentes externas confiables o Brave no respondio correctamente.",
            "queries": safe_queries,
            "limitations": limitations,
            "failed_queries": failed_queries,
        }

    return {
        "used": True,
        "provider": "brave",
        "purpose": "Complementar recomendaciones con buenas practicas publicas actuales.",
        "queries": safe_queries,
        "sources": sources,
        "limitations": limitations,
    }
