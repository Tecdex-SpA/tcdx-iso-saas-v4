from typing import Any, Dict, List

def _normalize_dedupe_text(value: Any) -> str:
    """
    Normaliza textos para deduplicar frases muy similares.
    """
    text = str(value or "").strip().lower()

    replacements = {
        "acta de revisión de accesos": "acta de revisión",
        "registro de accesos modificados o eliminados": "registro de accesos corregidos",
        "registro de accesos eliminados o corregidos": "registro de accesos corregidos",
        "aprobación del dueño del sistema": "aprobación del responsable",
        "usuarios privilegiados, inactivos, huérfanos o con accesos innecesarios": "usuarios privilegiados o con accesos innecesarios",
        "usuarios privilegiados, inactivos o con accesos innecesarios": "usuarios privilegiados o con accesos innecesarios",
        "matriz de accesos vigente": "matriz vigente",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return " ".join(text.split())


def _dedupe_list(items: List[Any], max_items: int = 12) -> List[Any]:
    out = []
    seen = set()

    for item in items or []:
        if item is None:
            continue

        key = _normalize_dedupe_text(item)

        if not key or key in seen:
            continue

        seen.add(key)
        out.append(item)

        if len(out) >= max_items:
            break

    return out



def _format_list(title: str, items: List[Any], max_items: int = 8) -> str:
    if not items:
        return ""

    clean_items = _dedupe_list(items, max_items=max_items)

    if not clean_items:
        return ""

    lines = [title]

    for index, item in enumerate(clean_items, start=1):
        lines.append(f"{index}. {item}")

    return "\n".join(lines)


def guided_solution_to_text(payload: Dict[str, Any]) -> str:
    """
    Convierte la solución guiada en texto claro para interfaces actuales.
    """
    solution = payload.get("solution") or {}
    problem = payload.get("problem") or {}
    context_summary = payload.get("context_summary") or {}

    sections = []

    problem_name = problem.get("name") or problem.get("code") or "Problema detectado"

    sections.append(f"Problema detectado: {problem_name}")
    sections.append(solution.get("problem_detected") or "")

    signals = context_summary.get("signals") or []
    if signals:
        sections.append(_format_list("Señales detectadas en el sistema:", signals, max_items=5))

    if context_summary.get("tenant_health"):
        sections.append("Contexto de salud: " + context_summary["tenant_health"])

    sections.append("Impacto en cumplimiento: " + (solution.get("compliance_impact") or ""))

    sections.append("Qué se debe hacer: " + (solution.get("solution_summary") or ""))

    sections.append(_format_list(
        "Acciones concretas recomendadas:",
        solution.get("concrete_actions") or [],
        max_items=10,
    ))

    sections.append(_format_list(
        "Entregables esperados:",
        solution.get("expected_deliverables") or [],
        max_items=10,
    ))

    sections.append(_format_list(
        "Contenido mínimo que debe tener la evidencia:",
        solution.get("minimum_content") or [],
        max_items=12,
    ))

    sections.append(_format_list(
        "Formatos aceptables:",
        solution.get("accepted_formats") or [],
        max_items=8,
    ))

    sections.append(_format_list(
        "No será suficiente como evidencia:",
        solution.get("invalid_evidence") or [],
        max_items=10,
    ))

    sections.append(_format_list(
        "Criterio de cierre:",
        solution.get("closure_conditions") or [],
        max_items=10,
    ))

    validation_questions = solution.get("validation_questions") or []
    if validation_questions:
        sections.append(_format_list(
            "Preguntas de validación antes de cerrar:",
            validation_questions,
            max_items=8,
        ))

    sections.append("Impacto en salud: " + (solution.get("health_impact") or ""))
    sections.append("Impacto en KPI: " + (solution.get("kpi_impact") or ""))

    sections.append("Siguiente mejor acción: " + (solution.get("next_best_action") or ""))

    sections.append(
        "Importante: no se recomienda cerrar automáticamente este punto. "
        "Primero debe existir evidencia objetiva, revisión responsable y validación del criterio de cierre."
    )

    return "\n\n".join([section for section in sections if section and section.strip()])


def guided_solution_to_legacy_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Respuesta compatible para endpoints actuales:
    conserva campos simples y agrega campos enriquecidos.
    """
    solution = payload.get("solution") or {}
    problem = payload.get("problem") or {}
    classification = payload.get("classification") or {}

    text = guided_solution_to_text(payload)

    return {
        "ok": True,
        "recommendation": text,
        "summary": solution.get("solution_summary") or text[:300],
        "suggestion": solution.get("next_best_action") or solution.get("solution_summary"),
        "problem_type": problem.get("code"),
        "problem_name": problem.get("name"),
        "severity": problem.get("severity"),
        "priority_weight": problem.get("priority_weight"),
        "confidence": classification.get("confidence"),
        "expected_deliverables": solution.get("expected_deliverables") or [],
        "minimum_content": solution.get("minimum_content") or [],
        "invalid_evidence": solution.get("invalid_evidence") or [],
        "closure_conditions": solution.get("closure_conditions") or [],
        "health_impact": solution.get("health_impact"),
        "kpi_impact": solution.get("kpi_impact"),
        "can_auto_close": False,
        "engine": payload.get("engine"),
        "structured": payload,
    }


def executive_recommendations_to_text(payload: Dict[str, Any]) -> str:
    context_summary = payload.get("context_summary") or {}
    priorities = payload.get("top_priorities") or []

    sections = []

    if context_summary.get("tenant_health"):
        sections.append("Resumen de salud: " + context_summary["tenant_health"])

    signals = context_summary.get("signals") or []
    if signals:
        sections.append(_format_list("Señales relevantes:", signals, max_items=6))

    lines = ["Prioridades recomendadas:"]

    for index, item in enumerate(priorities[:10], start=1):
        title = item.get("title") or "Prioridad"
        priority = item.get("priority") or "media"
        reason = item.get("reason") or ""
        action = item.get("recommended_action") or ""

        lines.append(f"{index}. [{priority.upper()}] {title}")
        if reason:
            lines.append(f"   Motivo: {reason}")
        if action:
            lines.append(f"   Acción: {action}")

    sections.append("\n".join(lines))

    return "\n\n".join(sections)


def executive_recommendations_to_legacy_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = executive_recommendations_to_text(payload)

    return {
        "ok": True,
        "recommendation": text,
        "summary": text[:500],
        "priorities": payload.get("top_priorities") or [],
        "engine": payload.get("engine"),
        "structured": payload,
    }
