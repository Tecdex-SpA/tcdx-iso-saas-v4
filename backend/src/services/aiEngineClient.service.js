class AiEngineClient {
  constructor() {
    this.baseUrl = String(
      process.env.AI_ENGINE_URL ||
        process.env.AI_ENGINE_BASE_URL ||
        'http://localhost:8001'
    ).replace(/\/+$/, '');
    this.timeout = Number.parseInt(process.env.AI_ENGINE_TIMEOUT_MS || '30000', 10) || 30000;
    this.token = process.env.AI_INTERNAL_TOKEN || process.env.AI_TOKEN || '';
  }

  async postJson(path, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Token': this.token,
          'x-tcdx-locale': 'es',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch (error) {
        throw new Error(`ai-engine JSON inválido: ${String(text || '').slice(0, 180)}`);
      }

      if (!response.ok) {
        const detail = json?.detail || json?.error || response.statusText;
        throw new Error(`ai-engine HTTP ${response.status}: ${detail}`);
      }

      return json;
    } finally {
      clearTimeout(timeout);
    }
  }

  isNetworkError(error) {
    return (
      error?.name === 'AbortError' ||
      ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error?.code)
    );
  }

  async analyzeWithSeniorAuditor(payload) {
    if (!this.baseUrl || !this.token) {
      return this.buildFallback(payload, new Error('AI_ENGINE_URL o AI_INTERNAL_TOKEN no configurado'));
    }

    try {
      return await this.postJson('/api/ai/senior-auditor/analyze', payload);
    } catch (error) {
      if (this.isNetworkError(error)) {
        try {
          return await this.postJson('/api/ai/senior-auditor/analyze', payload);
        } catch (retryError) {
          return this.buildFallback(payload, retryError);
        }
      }

      return this.buildFallback(payload, error);
    }
  }

  buildFallback(payload, error = null) {
    const tenantId = payload?.tenant_id || payload?.context?.tenant?.tenant_id || '';
    const message = error?.message ? String(error.message).slice(0, 220) : 'ai-engine no disponible';

    return {
      ok: false,
      answer: 'El motor de análisis no está disponible temporalmente. Los datos internos del sistema siguen accesibles. Por favor intente nuevamente en unos minutos.',
      structured_result: {
        executive_summary: 'Análisis no disponible: motor IA temporalmente fuera de servicio.',
        diagnosis: '',
        confirmed_facts: [],
        inferences: [],
        gaps: [],
        evidence_assessment: {
          available_evidence: [],
          official_evidence: [],
          weak_evidence: [],
          missing_evidence: [],
        },
        risk_impact: '',
        audit_readiness: {
          status: 'sin_datos',
          reason: 'Motor IA no disponible',
          auditor_concerns: [],
        },
        recommended_actions: [],
        auditor_questions: [],
        documents_to_request: [],
        web_context_used: [],
        drive_context_used: [],
        rag_context_used: [],
        source_trace: [
          {
            source: 'internal_db',
            reference: 'context_builder',
            used_for: 'contexto armado pero ai-engine no disponible',
          },
        ],
        confidence: 0.0,
        limitations: [
          'ai-engine no disponible: modo fallback activo',
          'Análisis IA no ejecutado',
          'No hay evidencia suficiente para concluir cumplimiento. Se requieren datos internos antes de emitir diagnóstico.',
          'Este control no está en alcance activo para esta operación/norma. No se incluye en el diagnóstico de cumplimiento.',
          'Existe evidencia registrada, pero no tiene categoría oficial computable. No es sustentable ante auditoría formal sin oficialización.',
          'La referencia externa consultada no reemplaza la evidencia interna del sistema. Se usa únicamente como contexto normativo.',
          'El documento analizado desde Google Drive debe ser validado por el responsable formal antes de considerarse evidencia oficial.',
          'Nivel de confianza bajo (0.0). Datos insuficientes para análisis completo. Se requiere: ai-engine disponible.',
          'Este sistema apoya la preparación y gestión diaria de cumplimiento. No reemplaza una auditoría de certificación formal realizada por organismo acreditado.',
          `Detalle técnico controlado: ${message}`,
          `Análisis restringido estrictamente al tenant ${tenantId}. Datos de otros tenants no accesibles ni comparables.`,
        ],
      },
      source_trace: [],
      confidence: 0.0,
      limitations: ['ai-engine unavailable: fallback mode'],
      engine: {
        prompt_version: 'fallback',
        context_version: payload?.context?.scope?.context_version || '',
        model: 'backend_fallback',
        used_internal_context: true,
        used_rag: false,
        used_drive: false,
        used_web: false,
      },
    };
  }
}

module.exports = new AiEngineClient();
module.exports.AiEngineClient = AiEngineClient;
