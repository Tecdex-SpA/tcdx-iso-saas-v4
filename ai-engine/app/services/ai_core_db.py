import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import psycopg2
from psycopg2.extras import RealDictCursor


ENV_PATH = Path("/home/tecdex/ai-engine/.env.ai_core")


def _load_env_file(path: Path = ENV_PATH) -> None:
    """
    Carga variables desde .env.ai_core sin depender obligatoriamente de python-dotenv.
    No sobreescribe variables ya existentes del entorno.
    """
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()


def get_connection():
    """
    Conexión PostgreSQL usando el usuario solo lectura ai_reader.
    """
    return psycopg2.connect(
        host=os.getenv("AI_CORE_DB_HOST", "192.168.100.110"),
        port=int(os.getenv("AI_CORE_DB_PORT", "5432")),
        dbname=os.getenv("AI_CORE_DB_NAME", "tecdex_saas"),
        user=os.getenv("AI_CORE_DB_USER", "ai_reader"),
        password=os.getenv("AI_CORE_DB_PASSWORD", ""),
        sslmode=os.getenv("AI_CORE_DB_SSLMODE", "disable"),
        cursor_factory=RealDictCursor,
    )


def fetch_all(query: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    """
    Ejecuta SELECT y devuelve lista de diccionarios.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or [])
            return [dict(row) for row in cur.fetchall()]


def fetch_one(query: str, params: Optional[Sequence[Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Ejecuta SELECT y devuelve un diccionario o None.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or [])
            row = cur.fetchone()
            return dict(row) if row else None


def test_connection() -> Dict[str, Any]:
    """
    Prueba rápida de conectividad y lectura.
    """
    result = fetch_one(
        """
        SELECT
          current_database() AS database_name,
          current_user AS db_user,
          now() AS checked_at
        """
    )

    counts = fetch_all(
        """
        SELECT 'problem_types' AS source, COUNT(*)::int AS total FROM ai_core.problem_types
        UNION ALL
        SELECT 'solution_playbooks', COUNT(*)::int FROM ai_core.solution_playbooks
        UNION ALL
        SELECT 'evidence_expectations', COUNT(*)::int FROM ai_core.evidence_expectations
        UNION ALL
        SELECT 'closure_criteria', COUNT(*)::int FROM ai_core.closure_criteria
        ORDER BY source
        """
    )

    return {
        "ok": True,
        "connection": result,
        "counts": counts,
    }
