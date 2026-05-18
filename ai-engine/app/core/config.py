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

settings = Settings()
