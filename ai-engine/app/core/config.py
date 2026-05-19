import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME = os.getenv("APP_NAME", "AI Compliance Engine")
    APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT = int(os.getenv("APP_PORT", "8001"))
    APP_ENV = os.getenv("APP_ENV", "production")

    BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://bk.tcdx.int:3000")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://181.212.166.187:8443")

    DB_HOST = os.getenv("DB_HOST", "db.tcdx.int")
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    DB_NAME = os.getenv("DB_NAME", "tecdex_saas")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN") or os.getenv("AI_TOKEN") or ""
    OLLAMA_MODEL_FAST = os.getenv("OLLAMA_MODEL_FAST", "")
    OLLAMA_MODEL_AUDITOR = os.getenv("OLLAMA_MODEL_AUDITOR", "")
    OLLAMA_MODEL_DEEP = os.getenv("OLLAMA_MODEL_DEEP", "")
    OLLAMA_MODEL_FALLBACK = os.getenv("OLLAMA_MODEL_FALLBACK", "")
    AI_AUDITOR_MODEL_MODE = os.getenv("AI_AUDITOR_MODEL_MODE", "fast")
    AI_AUDITOR_ASYNC_THRESHOLD_MS = int(os.getenv("AI_AUDITOR_ASYNC_THRESHOLD_MS", "30000"))
    AI_AUDITOR_DEEP_ASYNC_REQUIRED = os.getenv("AI_AUDITOR_DEEP_ASYNC_REQUIRED", "true").lower() != "false"
    AI_ENGINE_LLM_TIMEOUT_MS = int(os.getenv("AI_ENGINE_LLM_TIMEOUT_MS", "60000"))

settings = Settings()
