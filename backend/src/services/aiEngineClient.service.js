class AiEngineClient {
  constructor() {
    this.baseUrl = String(
      process.env.AI_ENGINE_URL ||
        process.env.AI_ENGINE_BASE_URL ||
        'http://localhost:8001'
    ).replace(/\/+$/, '');
    this.timeout = Number.parseInt(
      process.env.AI_ENGINE_REQUEST_TIMEOUT_MS ||
        process.env.AI_ENGINE_TIMEOUT_MS ||
        '120000',
      10
    ) || 120000;
    this.auditorTimeout = Number.parseInt(
      process.env.AI_AUDITOR_TIMEOUT_MS ||
        process.env.AI_AUDITOR_ENGINE_TIMEOUT_MS ||
        process.env.AI_ENGINE_REQUEST_TIMEOUT_MS ||
        process.env.AI_ENGINE_TIMEOUT_MS ||
        String(this.timeout),
      10
    ) || this.timeout;
    this.reportTimeout = Number.parseInt(
      process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS ||
        process.env.AI_ENGINE_REQUEST_TIMEOUT_MS ||
        process.env.AI_ENGINE_TIMEOUT_MS ||
        String(this.timeout),
      10
    ) || this.timeout;
    this.token = process.env.AI_INTERNAL_TOKEN || process.env.AI_ENGINE_TOKEN || process.env.AI_TOKEN || '';
  }

  resolveReportTimeoutMs(modelMode = '', options = {}) {
    const mode = String(modelMode || '').toLowerCase();
    const configured = Number.parseInt(
      String(
        options.timeoutMs ||
          (mode === 'deep'
            ? (process.env.REPORT_DEEP_JOB_TIMEOUT_MS ||
                process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS ||
                process.env.AI_ENGINE_REQUEST_TIMEOUT_MS)
            : (process.env.AI_REPORT_ENRICHMENT_TIMEOUT_MS ||
                process.env.AI_ENGINE_REQUEST_TIMEOUT_MS)) ||
          this.reportTimeout
      ),
      10
    );
    const fallback = mode === 'deep' ? 600000 : this.reportTimeout;
    const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : fallback;
    return mode === 'deep' ? Math.max(timeoutMs, 600000) : timeoutMs;
  }

  async postJson(path, payload, options = {}) {
    const controller = new AbortController();
    const timeoutMs = Number.parseInt(String(options.timeoutMs || this.timeout), 10) || this.timeout;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const requestId =
      payload?.request_metadata?.request_id ||
      payload?.request_id ||
      null;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-token': this.token,
          'x-tcdx-locale': 'es',
          ...(requestId ? { 'x-request-id': requestId } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch (error) {
        const preview = String(text || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);
        throw new Error(`ai-engine JSON inválido o respuesta intermedia no JSON: ${preview}`);
      }

      if (!response.ok) {
        const detail = json?.detail || json?.error || response.statusText;
        throw new Error(`ai-engine HTTP ${response.status}: ${detail}`);
      }

      return json;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`ai-engine timeout after ${timeoutMs}ms`);
        timeoutError.name = 'AbortError';
        timeoutError.code = 'AI_ENGINE_TIMEOUT';
        timeoutError.timeout_ms = timeoutMs;
        timeoutError.cause = error;
        throw timeoutError;
      }
      throw error;
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
      return await this.postJson('/api/ai/senior-auditor/analyze', payload, {
        timeoutMs: this.auditorTimeout,
      });
    } catch (error) {
      if (this.isNetworkError(error)) {
        try {
          return await this.postJson('/api/ai/senior-auditor/analyze', payload, {
            timeoutMs: this.auditorTimeout,
          });
        } catch (retryError) {
          return this.buildFallback(payload, retryError);
        }
      }

      return this.buildFallback(payload, error);
    }
  }

  async analyzeReport(payload, options = {}) {
    if (!this.baseUrl || !this.token) {
      return this.buildFallback(payload, new Error('AI_ENGINE_URL o AI_INTERNAL_TOKEN no configurado'));
    }

    const modelMode = String(
      payload?.options?.model_mode ||
        payload?.request_metadata?.model_mode ||
        ''
    ).toLowerCase();
    const timeoutMs = this.resolveReportTimeoutMs(modelMode, options);

    try {
      return await this.postJson('/api/ai/senior-auditor/analyze', payload, { timeoutMs });
    } catch (error) {
      if (this.isNetworkError(error)) {
        try {
          return await this.postJson('/api/ai/senior-auditor/analyze', payload, { timeoutMs });
        } catch (retryError) {
          return this.buildFallback(payload, retryError);
        }
      }

      return this.buildFallback(payload, error);
    }
  }

  async generateAuditDocument(payload) {
    if (!this.baseUrl || !this.token) {
      return this.buildAuditDocumentFallback(payload, new Error('AI_ENGINE_URL o AI_INTERNAL_TOKEN no configurado'));
    }

    try {
      return await this.postJson('/api/ai-compliance/audit-documents/generate', payload);
    } catch (error) {
      if (this.isNetworkError(error)) {
        try {
          return await this.postJson('/api/ai-compliance/audit-documents/generate', payload);
        } catch (retryError) {
          return this.buildAuditDocumentFallback(payload, retryError);
        }
      }

      return this.buildAuditDocumentFallback(payload, error);
    }
  }

  buildAuditDocumentFallback(payload, error = null) {
    const template = payload?.document_template || {};
    const periodYear = payload?.period_year || new Date().getFullYear();
    const title = template.document_name || 'Documento de auditoría ISO 9001';
    const pendingItems = [
      '[PENDIENTE DE VALIDACIÓN] ai-engine no disponible para redacción documental completa.',
      '[REQUIERE COMPLETAR CON DATO REAL] Revisar y completar contenido antes de uso en auditoría.',
    ];

    return {
      status: 'fallback',
      document: {
        title,
        version: template.version || '1.0',
        period_year: periodYear,
        sections: [
          {
            title: 'Borrador pendiente de generación IA',
            content: 'El documento no pudo ser redactado por ai-engine. Use el contexto de plataforma y complete la información real requerida.',
          },
        ],
        content_markdown: `# ${title}\n\n[PENDIENTE DE VALIDACIÓN] ai-engine no disponible. Documento pendiente de generación formal.\n`,
        content_json: {
          fallback: true,
          reason: 'ai-engine unavailable',
        },
        pending_items: pendingItems,
        evidence_suggestions: [],
        source_trace: {
          ai_engine: {
            available: false,
            reason: 'fallback',
          },
        },
      },
    };
  }

  buildFallback(payload, error = null) {
    const tenantId = payload?.tenant_id || payload?.context?.tenant?.tenant_id || '';
    const requestId =
      payload?.request_metadata?.request_id ||
      payload?.request_id ||
      null;
    const message = error?.message ? String(error.message).slice(0, 220) : 'ai-engine no disponible';
    const timeoutMs = error?.timeout_ms || null;

    return {
      ok: false,
      code: error?.name === 'AbortError' || message.includes('timeout')
        ? 'AI_AUDITOR_TIMEOUT'
        : 'AI_ENGINE_UNAVAILABLE',
      request_id: requestId,
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
        selected_model: 'backend_fallback',
        request_id: requestId,
        used_internal_context: true,
        used_rag: false,
        used_drive: false,
        used_web: false,
        ai_engine_used: false,
        fallback_used: true,
        ai_enrichment_failed: true,
        error_type: error?.code || error?.name || 'AI_ENGINE_UNAVAILABLE',
        error_message: message,
        timeout_stage: error?.name === 'AbortError' || error?.code === 'AI_ENGINE_TIMEOUT'
          ? 'backend_to_ai_engine'
          : null,
        timeout_ms: timeoutMs,
      },
    };
  }
}

module.exports = new AiEngineClient();
module.exports.AiEngineClient = AiEngineClient;
