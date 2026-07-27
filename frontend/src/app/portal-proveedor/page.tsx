'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl, readJsonResponse } from '@/utils/apiClient';

type Row = Record<string, unknown>;
type Envelope<T> = { ok: boolean; data: T };

const SESSION_KEY = 'tcdx_supplier_portal_session';

async function portalRequest<T>(path: string, options: RequestInit = {}, session?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (session) headers.set('Authorization', `Bearer ${session}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${getApiBaseUrl()}/api/supplier-portal${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
  const payload = await readJsonResponse<Envelope<T>>(response);
  return payload.data;
}

export default function SupplierPortalPage() {
  const [session, setSession] = useState('');
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (activeSession: string) => {
    setLoading(true);
    setError('');
    try {
      setData(await portalRequest<Row>('/assessment', {}, activeSession));
    } catch (loadError) {
      sessionStorage.removeItem(SESSION_KEY);
      setSession('');
      setData(null);
      setError(loadError instanceof Error ? loadError.message : 'Sesión no disponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const existing = sessionStorage.getItem(SESSION_KEY) || '';
    if (existing) {
      setSession(existing);
      void load(existing);
    }
  }, [load]);

  async function exchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get('token') || '').trim();
    setLoading(true);
    setError('');
    try {
      const result = await portalRequest<{ session_token: string }>('/exchange', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      sessionStorage.setItem(SESSION_KEY, result.session_token);
      setSession(result.session_token);
      await load(result.session_token);
    } catch (exchangeError) {
      setError(exchangeError instanceof Error ? exchangeError.message : 'Invitación inválida.');
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswer(event: FormEvent<HTMLFormElement>, question: Row) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const rawAnswer = String(values.get('answer') || '');
    const answer = question.answer_type === 'boolean' ? rawAnswer === 'true' : rawAnswer;
    setLoading(true);
    setError('');
    try {
      await portalRequest('/answers', {
        method: 'PUT',
        body: JSON.stringify({
          question_id: question.id,
          answer,
          observation: String(values.get('observation') || ''),
        }),
      }, session);
      setNotice('Respuesta guardada y trazada.');
      await load(session);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No fue posible guardar.');
    } finally {
      setLoading(false);
    }
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>, questionId: string) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    body.set('question_id', questionId);
    setLoading(true);
    setError('');
    try {
      await portalRequest('/evidence', { method: 'POST', body }, session);
      event.currentTarget.reset();
      setNotice('Evidencia recibida con hash y procedencia.');
      await load(session);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Archivo rechazado.');
    } finally {
      setLoading(false);
    }
  }

  async function submitAssessment() {
    setLoading(true);
    setError('');
    try {
      await portalRequest('/submit', {
        method: 'POST',
        body: JSON.stringify({ comment: 'Envío confirmado por el proveedor.' }),
      }, session);
      setNotice('Evaluación enviada para revisión humana.');
      await load(session);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible enviar.');
    } finally {
      setLoading(false);
    }
  }

  const assessment = (data?.assessment || {}) as Row;
  const supplier = (data?.supplier || {}) as Row;
  const questions = Array.isArray(data?.questions) ? data.questions as Row[] : [];

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">TCDX · Acceso restringido</p>
          <h1 className="mt-2 text-3xl font-black">Portal de proveedores</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Responde únicamente la evaluación asignada. No se exponen datos internos ni información de otros proveedores.</p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        {!session ? (
          <form onSubmit={exchange} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Abrir invitación</h2>
            <label className="mt-4 block text-sm font-semibold">
              Token de invitación
              <input name="token" required autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <button disabled={loading} className="mt-4 rounded-lg bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50">
              {loading ? 'Validando…' : 'Continuar'}
            </button>
          </form>
        ) : loading && !data ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        ) : data ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{String(supplier.name || '')}</p>
                  <h2 className="text-2xl font-black">{String(assessment.questionnaire_name || 'Evaluación')}</h2>
                  <p className="mt-1 text-sm text-slate-500">Versión {String(assessment.questionnaire_version || '—')} · Vence {assessment.due_at ? new Date(String(assessment.due_at)).toLocaleString('es-CL') : 'sin fecha'}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{String(assessment.status || '')}</span>
              </div>
            </section>

            <div className="space-y-4">
              {questions.map(question => (
                <section key={String(question.id)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-600">{String(question.section_title || question.section_code || '')}</p>
                  <h3 className="mt-2 text-lg font-bold">{String(question.prompt || '')}{question.required ? ' *' : ''}</h3>
                  <form onSubmit={event => void saveAnswer(event, question)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <AnswerField question={question} />
                    <label className="text-sm font-semibold">
                      Observación
                      <input name="observation" defaultValue={String(question.observation || '')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <div className="flex items-end">
                      <button disabled={loading || !['invited', 'in_progress', 'remediation_required'].includes(String(assessment.status))} className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-40">Guardar</button>
                    </div>
                  </form>
                  <form onSubmit={event => void uploadEvidence(event, String(question.id))} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <label className="text-sm font-semibold">
                      Evidencia {question.evidence_required ? 'obligatoria' : 'opcional'}
                      <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.txt" className="mt-1 block text-sm" />
                    </label>
                    <button disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Cargar archivo</button>
                  </form>
                </section>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading || !['in_progress', 'remediation_required'].includes(String(assessment.status))}
                onClick={() => void submitAssessment()}
                className="rounded-lg bg-orange-600 px-6 py-3 font-black text-white disabled:opacity-40"
              >
                Enviar a revisión
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

function AnswerField({ question }: { question: Row }) {
  const type = String(question.answer_type || 'text');
  const current = typeof question.answer === 'object' && question.answer !== null
    ? String((question.answer as Row).value ?? '')
    : String(question.answer ?? '');
  if (type === 'boolean') {
    return (
      <label className="text-sm font-semibold">
        Respuesta
        <select name="answer" defaultValue={current} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Selecciona</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      </label>
    );
  }
  return (
    <label className="text-sm font-semibold">
      Respuesta
      <input name="answer" defaultValue={current} required type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
  );
}
