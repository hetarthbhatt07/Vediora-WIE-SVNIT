'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, CheckCircle2, Clock3, Database, ExternalLink, MessageSquarePlus, Pill, Send, ShieldAlert, Sparkles, UserRound } from 'lucide-react';
import { TactileBadge } from '@/components/ui/TactileBadge';
import { TactileButton } from '@/components/ui/TactileButton';
import { medicineLabel, type MedicineChatResult } from '@/lib/medicine-chat';

interface ChatMessage {
  id: number | string;
  role: 'patient' | 'doctor' | 'assistant';
  text: string;
  result?: MedicineChatResult;
  error?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

const STARTER_MESSAGE: ChatMessage = {
  id: 1,
  role: 'assistant',
  text: 'Hello. Ask a medical question, ask about one medicine, or list several medicines. Local Mistral explains general medical information, while Vediora checks recognized medicine pairs against the interaction database.',
};

const EXAMPLE_QUESTIONS = [
  'What does aspirin do?',
  'Can I take aspirin and warfarin together?',
  'Explain the advantages, risks, and common treatment approaches for high blood pressure.',
];

function severityVariant(severity: string | null): 'red' | 'amber' | 'green' | 'slate' {
  if (severity?.toLowerCase() === 'major') return 'red';
  if (severity?.toLowerCase() === 'moderate') return 'amber';
  if (severity?.toLowerCase() === 'minor') return 'green';
  return 'slate';
}

function AssistantMarkdown({ children }: { children: string }) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h2>,
      h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold text-slate-900 first:mt-0">{children}</h3>,
      p: ({ children }) => <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>,
      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
      ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
      ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
      li: ({ children }) => <li className="pl-1">{children}</li>,
      a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline underline-offset-2">{children}</a>,
      hr: () => <hr className="my-4 border-slate-200" />,
    }}
  >{children}</ReactMarkdown>;
}

function AssistantResult({ result }: { result: MedicineChatResult }) {
  return <div className="mt-4 space-y-3">
    {result.generatedBy ? <div className="flex"><TactileBadge variant="teal"><Sparkles className="mr-1 h-3 w-3" />Explained by {result.generatedBy.model}</TactileBadge></div> : null}
    {result.recognized.length > 0 ? <div className="flex flex-wrap gap-2" aria-label="Recognized medicines">
      {result.recognized.map(medicine => <TactileBadge key={medicine.id} variant="blue"><Pill className="mr-1 h-3 w-3" />{medicineLabel(medicine)}</TactileBadge>)}
    </div> : null}
    {result.activeMedicinesIncluded && result.activeMedicinesIncluded.length > 0 ? <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Vediora also compared your saved active medicines: {result.activeMedicinesIncluded.map(medicineLabel).join(', ')}.</div> : null}

    {result.interactions.map(finding => <article key={finding.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Documented interaction</p><h3 className="mt-1 font-semibold text-slate-900">{finding.medicineA} + {finding.medicineB}</h3></div>
        <TactileBadge variant={severityVariant(finding.severity)}>{finding.severity || 'Severity not recorded'}</TactileBadge>
      </div>
      {finding.description ? <p className="mt-3 text-sm leading-6 text-slate-700">{finding.description}</p> : <p className="mt-3 text-sm text-slate-600">The database identifies this pair as an interaction, but its description is not available.</p>}
      {finding.clinicalEffect ? <div className="mt-3 rounded-lg bg-white/80 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded clinical effect</p><p className="mt-1 text-sm leading-6 text-slate-700">{finding.clinicalEffect}</p></div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Source: {finding.evidenceSource || 'Not recorded'}</span>
        {finding.referenceUrl ? <a className="inline-flex items-center gap-1 text-blue-700 hover:underline" href={finding.referenceUrl} target="_blank" rel="noreferrer">View reference <ExternalLink className="h-3 w-3" /></a> : null}
      </div>
    </article>)}

    {result.pairsWithoutRecords.length > 0 ? <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-800"><CheckCircle2 className="h-4 w-4 text-slate-500" /><p className="text-sm font-semibold">No record found for {result.pairsWithoutRecords.length === 1 ? 'this pair' : 'these pairs'}</p></div>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">{result.pairsWithoutRecords.map(pair => <li key={pair}>{pair}</li>)}</ul>
      <p className="mt-2 text-xs text-slate-500">No database record does not mean the combination is proven safe.</p>
    </div> : null}

    <div className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-600"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{result.limitation}</p></div>
  </div>;
}

export function MedicineChat({ workspaceRole = 'patient' }: { workspaceRole?: 'patient' | 'doctor' }) {
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const nextId = useRef(2);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const historyRequestId = useRef(0);
  const chatSessionId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const endpoint = workspaceRole === 'doctor' ? '/api/doctor/medicine-chat' : '/api/patient/medicine-chat';

  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, loading]);
  const loadHistory = useCallback(async (selectedId?: string | null, replaceMessages = true) => {
    const requestId = ++historyRequestId.current;
    if (replaceMessages) setHistoryLoading(true);
    try {
      const url = selectedId ? `${endpoint}?conversationId=${encodeURIComponent(selectedId)}` : endpoint;
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Chat history could not be loaded.');
      if (requestId !== historyRequestId.current) return;
      setConversations(payload.conversations || []);
      if (!replaceMessages) return;
      if (!payload.conversation) {
        setConversationId(null);
        setMessages([STARTER_MESSAGE]);
        return;
      }
      setConversationId(payload.conversation.id);
      setMessages(payload.messages.map((item: { id: string; role: 'user' | 'assistant'; content: string; structured_result?: MedicineChatResult | null }) => ({
        id: item.id,
        role: item.role === 'assistant' ? 'assistant' : workspaceRole,
        text: item.content,
        result: item.role === 'assistant' ? item.structured_result || undefined : undefined,
      })));
    } catch (error) {
      if (requestId !== historyRequestId.current) return;
      setMessages(current => [...current, { id: nextId.current++, role: 'assistant', text: error instanceof Error ? error.message : 'Chat history could not be loaded.', error: true }]);
    } finally {
      if (requestId === historyRequestId.current && replaceMessages) setHistoryLoading(false);
    }
  }, [endpoint, workspaceRole]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function sendMessage(message: string) {
    const question = message.trim();
    if (!question || loading) return;
    const patientMessage: ChatMessage = { id: nextId.current++, role: workspaceRole, text: question };
    setMessages(current => [...current, patientMessage]);
    setInput('');
    setLoading(true);
    const sessionId = chatSessionId.current;
    const controller = new AbortController();
    activeRequest.current = controller;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, conversationId }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (sessionId !== chatSessionId.current) return;
      if (!response.ok) {
        const choices = Array.isArray(payload.ambiguity)
          ? payload.ambiguity.flatMap((item: { candidates?: string[] }) => item.candidates || []).join(', ')
          : '';
        throw new Error(`${payload.error || 'The medicine check could not be completed.'}${choices ? ` Possible matches: ${choices}.` : ''}`);
      }
      setConversationId(payload.conversationId || conversationId);
      setMessages(current => [...current, { id: nextId.current++, role: 'assistant', text: payload.result.answer, result: payload.result }]);
      void loadHistory(payload.conversationId || conversationId, false);
    } catch (error) {
      if (controller.signal.aborted || sessionId !== chatSessionId.current) return;
      setMessages(current => [...current, { id: nextId.current++, role: 'assistant', text: error instanceof Error ? error.message : 'The medicine check could not be completed.', error: true }]);
    } finally {
      if (sessionId === chatSessionId.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function startNewConversation() {
    chatSessionId.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    historyRequestId.current += 1;
    setLoading(false);
    setHistoryLoading(false);
    setConversationId(null);
    setMessages([STARTER_MESSAGE]);
    setInput('');
  }

  function openConversation(id: string) {
    if (id === conversationId) return;
    chatSessionId.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    void loadHistory(id);
  }

  return <div className="space-y-4 xl:flex xl:h-[calc(100dvh-8.25rem)] xl:min-h-[680px] xl:flex-col xl:space-y-0">
    <header className="shrink-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">{workspaceRole === 'doctor' ? 'Doctor workspace' : 'Patient workspace'}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Medical and medicine chat</h1><p className="mt-1 max-w-5xl text-sm leading-5 text-slate-600">Ask a medical question, request medicine information, or compare several medicines. Local Mistral explains, while Vediora checks imported interaction evidence.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={startNewConversation} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><MessageSquarePlus className="h-4 w-4" />New chat</button><TactileBadge variant="teal" dot><Database className="mr-1 h-3 w-3" />Database connected</TactileBadge></div>
      </div>
    </header>

    <div className="grid gap-4 pt-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white xl:h-full xl:min-h-0" aria-label="Medicine safety conversation">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.map(message => <div key={message.id} className={`flex gap-3 ${message.role !== 'assistant' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Bot className="h-5 w-5" /></div> : null}
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role !== 'assistant' ? 'bg-blue-600 text-white' : message.error ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
              {message.role === 'assistant' && !message.error
                ? <AssistantMarkdown>{message.text}</AssistantMarkdown>
                : <p className="whitespace-pre-wrap">{message.text}</p>}
              {message.result ? <AssistantResult result={message.result} /> : null}
            </div>
            {message.role !== 'assistant' ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700"><UserRound className="h-5 w-5" /></div> : null}
          </div>)}
          {historyLoading ? <p role="status" className="text-center text-xs text-slate-400">Loading your recent conversation…</p> : null}
          {loading ? <div className="flex items-center gap-3 text-sm text-slate-500" role="status"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Bot className="h-5 w-5" /></div><span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Reviewing context and medicine evidence…</span></div> : null}
          <div ref={conversationEnd} />
        </div>

        <form onSubmit={submit} className="shrink-0 border-t border-slate-200 bg-slate-50 p-3">
          <label htmlFor={`medicine-question-${workspaceRole}`} className="sr-only">Ask a medical or medicine question</label>
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea id={`medicine-question-${workspaceRole}`} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2000} rows={1} placeholder="Ask about a condition, medicine, side effect, test, or medicine combination" className="min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
            <TactileButton type="submit" aria-label="Send medicine question" disabled={!input.trim() || historyLoading} isLoading={loading} leftIcon={<Send className="h-4 w-4" />}>Send</TactileButton>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line · Not for emergencies</p>
        </form>
      </section>

      <aside className="grid gap-3 xl:h-full xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_auto_auto]">
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex shrink-0 items-center justify-between gap-2"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Previous chats</h2></div><span className="text-[11px] text-slate-400">{conversations.length}</span></div><div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{conversations.length === 0 ? <p className="text-xs leading-5 text-slate-500">Your saved conversations will appear here after the first reply.</p> : conversations.map(conversation => <button key={conversation.id} type="button" onClick={() => openConversation(conversation.id)} disabled={historyLoading} className={`w-full rounded-lg border p-2.5 text-left transition ${conversation.id === conversationId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}><span className="block truncate text-xs font-semibold text-slate-700">{conversation.title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{new Date(conversation.updated_at).toLocaleString()}</span></button>)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-semibold text-slate-900">Try asking</h2></div><div className="mt-2 space-y-1.5">{EXAMPLE_QUESTIONS.map(question => <button key={question} type="button" onClick={() => void sendMessage(question)} disabled={loading} className="w-full truncate rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50" title={question}>{question}</button>)}</div></div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-[11px] leading-4 text-blue-900"><div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" />Medical support, with clear limits</div><p className="mt-1.5">Database evidence and local Mistral support the answer. Confirm medicine decisions with a clinician.</p></div>
      </aside>
    </div>
  </div>;
}
