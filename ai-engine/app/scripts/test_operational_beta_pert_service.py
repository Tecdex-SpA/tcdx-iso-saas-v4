from app.services import operational_risk_beta_pert_service as service


def test_semantic_mapping():
    risk = {"name": "Error en liberacion de version", "process": "Cambios TI", "standard": "ISO9001"}
    domain = service.infer_operational_domain(risk)
    assert domain["domain"] == "cambios_qa"
    assert "Control operacional" in domain["iso_suggestions"]


def test_payload_compaction_and_selected_risk():
    risks = [
        {
            "id": f"risk-{index}",
            "name": "Riesgo duplicado" if index % 2 == 0 else f"Riesgo {index}",
            "standard": "ISO27001",
            "model": "ISO27001_TTIA",
            "process": "Continuidad" if index % 2 == 0 else f"Proceso {index}",
            "p95": index * 10,
            "criticalProbability": index / 20,
            "status": "alto" if index > 8 else "medio",
        }
        for index in range(12)
    ]
    payload = service.sanitize_beta_pert_payload({"risks": risks, "selectedRisk": risks[0]})
    assert len(payload["risks"]) <= 5
    assert payload["risks"][0]["id"] == "risk-0"
    assert len([risk for risk in payload["risks"] if risk["name"] == "Riesgo duplicado"]) == 1


def test_normalize_valid_analysis():
    payload = service.sanitize_beta_pert_payload({
        "risks": [{"id": "risk-1", "name": "Caida de servicio critico", "standard": "ISO27001", "process": "Continuidad", "p95": 120, "criticalProbability": 0.4}],
        "kpis": {"conservativeP95": 120},
    })
    analysis = service.normalize_beta_pert_analysis({
        "diagnostico_ejecutivo": "Exposicion operacional alta concentrada en continuidad.",
        "lectura_portafolio": "La cola conservadora esta dominada por el riesgo seleccionado.",
        "acciones_sugeridas": [{"accion": "Probar recuperacion.", "horizonte": "30_dias"}],
        "proximos_pasos": ["Asignar owner."],
        "ai_model": "qwen-test",
    }, payload, {"model": "qwen-test"})
    assert analysis["source"] == service.SOURCE
    assert analysis["prompt_version"] == service.PROMPT_VERSION
    assert analysis["generation_mode"] == service.GENERATION_MODE
    assert len(analysis["riesgos_prioritarios"]) > 0
    assert len(analysis["controles_iso_sugeridos"]) > 0


def test_normalize_partial_json_from_markdown():
    payload = service.sanitize_beta_pert_payload({
        "risks": [{"id": "risk-1", "name": "Error en liberacion de version", "standard": "ISO9001", "process": "Cambios TI", "p95": 80, "criticalProbability": 0.35}],
        "kpis": {"conservativeP95": 80},
    })
    raw = 'texto previo ```json\n{"lectura_portafolio":"La exposicion se concentra en cambios TI."}\n``` texto final'
    analysis = service.normalize_beta_pert_analysis(raw, payload, {"model": "qwen-test"})
    assert analysis["lectura_portafolio"] == "La exposicion se concentra en cambios TI."
    assert analysis["generation_mode"] == service.GENERATION_MODE
    assert analysis["acciones_sugeridas"]


def test_accept_answer_string_json_wrapper():
    payload = service.sanitize_beta_pert_payload({
        "risks": [{"id": "risk-1", "name": "Caida de servicio", "standard": "ISO27001", "process": "Continuidad", "p95": 90}],
        "kpis": {"conservativeP95": 90},
    })
    analysis = service.normalize_beta_pert_analysis({
        "answer": "{\"diagnostico_ejecutivo\":\"Texto operacional con P95\", \"lectura_portafolio\":\"Lectura operacional\"}"
    }, payload, {"model": "qwen-test"})
    assert analysis["diagnostico_ejecutivo"] == "Texto operacional con P95"
    assert analysis["lectura_portafolio"] == "Lectura operacional"
    assert analysis["generation_mode"] == service.GENERATION_MODE
    assert analysis["source"] == service.SOURCE


def test_accept_nested_answer_string_json_wrapper():
    payload = service.sanitize_beta_pert_payload({
        "risks": [{"id": "risk-1", "name": "Caida de servicio", "standard": "ISO27001", "process": "Continuidad", "p95": 90}],
        "kpis": {"conservativeP95": 90},
    })
    analysis = service.normalize_beta_pert_analysis({
        "answer": "{\"answer\":{\"diagnostico_ejecutivo\":\"Texto operacional con P95\", \"lectura_portafolio\":\"Lectura operacional\"}}"
    }, payload, {"model": "qwen-test"})
    assert analysis["diagnostico_ejecutivo"] == "Texto operacional con P95"
    assert analysis["lectura_portafolio"] == "Lectura operacional"
    assert analysis["acciones_sugeridas"]


def test_accept_nested_answer_dict_wrapper():
    payload = service.sanitize_beta_pert_payload({
        "risks": [{"id": "risk-1", "name": "Caida de servicio", "standard": "ISO27001", "process": "Continuidad", "p95": 90}],
        "kpis": {"conservativeP95": 90},
    })
    analysis = service.normalize_beta_pert_analysis({
        "answer": {
            "answer": {
                "diagnostico_ejecutivo": "Texto operacional con P95",
                "lectura_portafolio": "Lectura operacional",
            }
        }
    }, payload, {"model": "qwen-test"})
    assert analysis["diagnostico_ejecutivo"] == "Texto operacional con P95"
    assert analysis["lectura_portafolio"] == "Lectura operacional"


def test_reject_readiness_inside_nested_answer_wrapper():
    payload = service.sanitize_beta_pert_payload({"risks": [{"id": "risk-1", "name": "Caida servicio", "p95": 50}]})
    try:
        service.normalize_beta_pert_analysis({
            "answer": "{\"answer\":{\"diagnostico_ejecutivo\":\"Preparacion sin_datos: 0 controles activos\"}}"
        }, payload, {"model": "qwen-test"})
    except service.OperationalBetaPertError as exc:
        assert exc.code == "ai_domain_mismatch"
    else:
        raise AssertionError("Expected ai_domain_mismatch")


def test_reject_documental_readiness():
    payload = service.sanitize_beta_pert_payload({"risks": [{"id": "risk-1", "name": "Caida servicio", "p95": 50}]})
    try:
        service.normalize_beta_pert_analysis({
            "diagnostico_ejecutivo": "Preparacion sin_datos: 0 controles activos, 0% cumplimiento efectivo.",
            "acciones_sugeridas": [{"accion": "Completar evidencias.", "horizonte": "30_dias"}],
        }, payload, {"model": "qwen-test"})
    except service.OperationalBetaPertError as exc:
        assert exc.code == "ai_domain_mismatch"
    else:
        raise AssertionError("Expected ai_domain_mismatch")


if __name__ == "__main__":
    test_semantic_mapping()
    test_payload_compaction_and_selected_risk()
    test_normalize_valid_analysis()
    test_normalize_partial_json_from_markdown()
    test_accept_answer_string_json_wrapper()
    test_accept_nested_answer_string_json_wrapper()
    test_accept_nested_answer_dict_wrapper()
    test_reject_readiness_inside_nested_answer_wrapper()
    test_reject_documental_readiness()
    print("operational beta pert service tests OK")
