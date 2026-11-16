"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { banner } from "@/lib/ui/toast";
import type { Destination } from "@/lib/admin/copilot/destinations";
import type { CopilotProposal } from "@/lib/admin/copilot/tools/types";
import { answersToMessage, type CopilotForm, type FormAnswers } from "@/lib/admin/copilot/forms";
import type { QuestionCardState } from "@/components/chat/QuestionCard";

/**
 * The copilot's conversation state, shared by the desk sheet and the full
 * page. The stream has four kinds of event: `text` (the answer as it is
 * written), `tool` (a status line while a read runs), `proposal` (a card for
 * the person to confirm) and `done` or `error`. The conversation is kept for
 * the session in sessionStorage (every access in try/catch: private windows
 * and blocked storage must not break the chat).
 */

export type ProposalStatus = "pending" | "confirming" | "done" | "failed" | "dismissed" | "expired";
export type ProposalState = { proposal: CopilotProposal; status: ProposalStatus; message?: string; href?: string };
export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposals: ProposalState[];
  /** The pages the tools offered this turn. Only these are drawn as buttons. */
  destinations?: Destination[];
  /** What the copilot read or prepared for this answer, by tool name and by its plain label. */
  tools?: { name: string; label: string }[];
  /** Question cards the copilot put on screen in this answer, and what became of each. */
  forms?: FormState[];
};

/** A question card and its fate: still open, sent with these answers, or skipped. */
export type FormState = QuestionCardState;

/**
 * THE PERSON'S OWN COPILOT SETTINGS (16 November 2026), kept on this device:
 * how long answers run, whether the steps it took are shown under each
 * answer, whether conversations are saved to History, and whether Enter
 * sends (on a phone keyboard many people want Enter for a new line).
 */
export type CopilotSettings = { style: "short" | "balanced" | "detailed"; showSteps: boolean; saveHistory: boolean; enterSends: boolean };
export const DEFAULT_SETTINGS: CopilotSettings = { style: "balanced", showSteps: true, saveHistory: true, enterSends: true };
const SETTINGS_KEY = "vallo.copilot.settings.v1";

export function readSettings(): CopilotSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<CopilotSettings>;
    return {
      style: v.style === "short" || v.style === "detailed" ? v.style : "balanced",
      showSteps: v.showSteps !== false,
      saveHistory: v.saveHistory !== false,
      enterSends: v.enterSends !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(next: CopilotSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* Blocked storage: the setting holds for this visit. */
  }
}
export type ToolLine = { id: string; label: string };
export type ThreadSummary = { id: string; title: string; desk: string; updatedAt: string };
/** "unknown" until the first save or list answers; "off" when the console has no history table yet. */
export type HistoryState = "unknown" | "on" | "off";

const MAX_TURNS = 40;

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; label: string; phase: "start" | "done" | "error" }
  | { type: "proposal"; proposal: CopilotProposal }
  | { type: "form"; form: CopilotForm }
  | { type: "destinations"; links: Destination[] }
  | { type: "done" }
  | { type: "error"; message: string };

/** The desk's own context, with a carried summary in front of it, within the route's 2,000 characters. */
export function withCarry(carry: string | null, context: string | null): string | null {
  const parts = [carry ? `Summary of the conversation before this one: ${carry}` : null, context].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join("\n").slice(0, 2000) : null;
}

/** Past this many turns the copilot no longer reads the start (it reads the newest twenty). */
export const LONG_CHAT_TURNS = 18;

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

function readThreadId(key: string): string | null {
  try {
    const id = window.sessionStorage.getItem(`${key}.thread`);
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

function writeThreadId(key: string, id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(`${key}.thread`, id);
    else window.sessionStorage.removeItem(`${key}.thread`);
  } catch {
    /* Storage can be blocked; the chat works without it. */
  }
}

/** What is saved: the conversation without a single confirm token in it. */
function forStore(turns: Turn[]) {
  return turns.map((t) => ({ ...t, proposals: t.proposals.map(({ proposal, ...rest }) => ({ ...rest, proposal: { ...proposal, token: undefined } })) }));
}

function readStored(key: string): Turn[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    return Array.isArray(parsed)
      ? parsed
          .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
          .map((t) => ({ ...t, proposals: Array.isArray(t.proposals) ? t.proposals : [], destinations: Array.isArray(t.destinations) ? t.destinations : [], tools: Array.isArray(t.tools) ? t.tools : [] }))
      : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, turns: Turn[]) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    /* Storage can be blocked; the chat works without it. */
  }
}

export function useCopilotChat({ storageKey, scope, deskName, context, settings = DEFAULT_SETTINGS }: { storageKey: string; scope: string | null; deskName: string; context: string | null; settings?: CopilotSettings }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [tool, setTool] = useState<ToolLine | null>(null);
  const [restored, setRestored] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState>("unknown");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [listing, setListing] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  /** The summary a fresh conversation carries from a long one, if any. */
  const [carry, setCarry] = useState<string | null>(null);
  const carryRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const threadRef = useRef<string | null>(null);
  threadRef.current = threadId;
  /** The last conversation the server holds, so an unchanged one is not sent again. */
  const savedSig = useRef<string>("");

  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored.length) {
      setTurns(stored);
      savedSig.current = JSON.stringify(forStore(stored));
    }
    setThreadId(readThreadId(storageKey));
    setRestored(true);
    return () => abortRef.current?.abort();
  }, [storageKey]);

  useEffect(() => {
    if (restored && !pending) writeStored(storageKey, turns);
  }, [turns, restored, pending, storageKey]);

  /* SAVE TO HISTORY: after every answer, every confirmed or dismissed card.
     A short wait so a burst of changes is one save; nothing while an answer
     is still being written. */
  useEffect(() => {
    if (!restored || pending || history === "off" || !settings.saveHistory || turns.length === 0) return;
    const body = forStore(turns);
    const sig = JSON.stringify(body);
    if (sig === savedSig.current) return;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/copilot/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: threadRef.current, desk: scope ?? deskName, turns: body }),
        });
        const out = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; state?: string } | null;
        if (out?.state === "not_set_up") {
          setHistory("off");
          return;
        }
        if (res.ok && out?.ok && typeof out.id === "string") {
          savedSig.current = sig;
          setHistory("on");
          if (out.id !== threadRef.current) {
            setThreadId(out.id);
            writeThreadId(storageKey, out.id);
          }
        }
      } catch {
        /* Offline or the console is busy: the next answer saves it. */
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [turns, pending, restored, history, scope, deskName, storageKey, settings.saveHistory]);

  const patchLast = useCallback((fn: (turn: Turn) => Turn) => {
    setTurns((all) => {
      const next = [...all];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });
  }, []);

  const send = useCallback(
    async (raw: string): Promise<string> => {
      const message = raw.trim();
      if (!message || pending) return "";
      let full = "";
      const history = turnsRef.current.filter((t) => t.text.trim()).map((t) => ({ role: t.role, text: t.text }));
      setTurns((t) => [...t, { id: newId(), role: "user", text: message, proposals: [] }, { id: newId(), role: "assistant", text: "", proposals: [], destinations: [], tools: [] }]);
      setPending(true);
      setTool(null);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/admin/copilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, deskName, context: withCarry(carryRef.current, context), history, message, style: settings.style }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const reason = res.status === 429 ? "You have asked a lot in the last hour. Try again a little later." : res.status === 403 ? "Your access does not include the copilot. Check with your lead." : "The assistant is not available just now. Try again in a moment.";
          banner.error(reason);
          patchLast((t) => ({ ...t, text: reason }));
          return "";
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split: number;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line.slice(5).trim()) as StreamEvent;
            } catch {
              continue;
            }
            if (event.type === "text") {
              full += event.text;
              patchLast((t) => ({ ...t, text: t.text + event.text }));
            } else if (event.type === "tool") {
              setTool(event.phase === "start" ? { id: event.id, label: event.label } : null);
              if (event.phase === "done") {
                const step = { name: String(event.name ?? ""), label: String(event.label ?? "") };
                patchLast((t) => ((t.tools ?? []).some((x) => x.name === step.name) ? t : { ...t, tools: [...(t.tools ?? []), step] }));
              }
            } else if (event.type === "form") {
              const card = event.form;
              if (card && typeof card.id === "string" && Array.isArray(card.fields)) patchLast((t) => ({ ...t, forms: [...(t.forms ?? []), { form: card, status: "open" }] }));
            } else if (event.type === "proposal") {
              patchLast((t) => ({ ...t, proposals: [...t.proposals, { proposal: event.proposal, status: "pending" }] }));
            } else if (event.type === "destinations") {
              /* The server has already dropped every page this person may not
                 open. Nothing outside this list is ever drawn as a button. */
              const links = Array.isArray(event.links) ? event.links.filter((l) => l && typeof l.href === "string" && typeof l.label === "string") : [];
              if (links.length > 0) patchLast((t) => ({ ...t, destinations: [...(t.destinations ?? []), ...links] }));
            } else if (event.type === "error") {
              banner.error(event.message);
              patchLast((t) => (t.text ? t : { ...t, text: event.message }));
            }
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          banner.error("Could not reach the assistant just now. Try again in a moment.");
          patchLast((t) => (t.text ? t : { ...t, text: "I could not reach the assistant just now. Your question is still here; try again in a moment." }));
        }
      } finally {
        setPending(false);
        setTool(null);
      }
      return full;
    },
    [pending, scope, deskName, context, patchLast, settings.style],
  );

  /**
   * A LONG CONVERSATION, CARRIED OVER (the founder's "context window full"
   * reference, 16 November 2026). The copilot reads only the newest twenty
   * turns, so past that it quietly forgets the start. Instead the person can
   * start fresh with a summary: the copilot writes one, a new conversation
   * begins, and the summary rides along with every question in it as context.
   */
  const startFreshWithSummary = useCallback(async (): Promise<boolean> => {
    if (pending) return false;
    const summary = (await send("Summarise this conversation so far in at most six short lines: what I asked, what you found, what was done, and what is still open. No headings.")).trim();
    if (!summary) return false;
    abortRef.current?.abort();
    setTurns([]);
    setThreadId(null);
    savedSig.current = "";
    writeThreadId(storageKey, null);
    carryRef.current = summary.slice(0, 1500);
    setCarry(carryRef.current);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    return true;
  }, [pending, send, storageKey]);

  /** Take back the newest question: it returns to the composer, and its answer goes. */
  const takeBackLast = useCallback((): string | null => {
    if (pending) return null;
    const all = turnsRef.current;
    let lastUser = -1;
    for (let i = all.length - 1; i >= 0; i -= 1) if (all[i]!.role === "user") { lastUser = i; break; }
    if (lastUser < 0) return null;
    const text = all[lastUser]!.text;
    turnsRef.current = all.slice(0, lastUser);
    setTurns(all.slice(0, lastUser));
    return text;
  }, [pending]);

  /** Rename a saved conversation. */
  const renameThread = useCallback(async (id: string, title: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/copilot/threads/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
      const out = (await res.json().catch(() => null)) as { ok?: boolean; title?: string } | null;
      if (!res.ok || !out?.ok || !out.title) {
        banner.error("That conversation could not be renamed just now.");
        return false;
      }
      const named = out.title;
      setThreads((all) => all.map((t) => (t.id === id ? { ...t, title: named } : t)));
      return true;
    } catch {
      banner.error("Could not reach the console just now.");
      return false;
    }
  }, []);

  /** Send a question card's answers as the person's next message; the card locks showing them. */
  const answerForm = useCallback(
    (formId: string, answers: FormAnswers) => {
      if (pending) return;
      const owner = turnsRef.current.find((t) => (t.forms ?? []).some((f) => f.form.id === formId));
      const state = owner?.forms?.find((f) => f.form.id === formId);
      if (!state || state.status !== "open") return;
      setTurns((all) => all.map((t) => ({ ...t, forms: t.forms?.map((f) => (f.form.id === formId ? { ...f, status: "sent" as const, answers } : f)) })));
      void send(answersToMessage(state.form, answers));
    },
    [pending, send],
  );

  /** Set a card aside without answering it. */
  const skipForm = useCallback((formId: string) => {
    setTurns((all) => all.map((t) => ({ ...t, forms: t.forms?.map((f) => (f.form.id === formId && f.status === "open" ? { ...f, status: "skipped" as const } : f)) })));
  }, []);

  /** Stop the answer being written. What has arrived stays on screen. */
  const stop = useCallback(() => {
    abortRef.current?.abort();
    setPending(false);
    setTool(null);
    patchLast((t) => (t.text ? t : { ...t, text: "Stopped. Ask again whenever you are ready." }));
  }, [patchLast]);

  /** Ask the last question again: the last answer is replaced by a new one. */
  const askAgain = useCallback(() => {
    if (pending) return;
    const all = turnsRef.current;
    let lastUser = -1;
    for (let i = all.length - 1; i >= 0; i -= 1) if (all[i]!.role === "user") { lastUser = i; break; }
    if (lastUser < 0) return;
    const question = all[lastUser]!.text;
    turnsRef.current = all.slice(0, lastUser);
    setTurns(all.slice(0, lastUser));
    void send(question);
  }, [pending, send]);

  const setProposal = useCallback((id: string, patch: Partial<ProposalState>) => {
    setTurns((all) => all.map((t) => ({ ...t, proposals: t.proposals.map((p) => (p.proposal.id === id ? { ...p, ...patch } : p)) })));
  }, []);

  const confirm = useCallback(
    async (proposal: CopilotProposal, typed?: string) => {
      if (!proposal.token) return;
      setProposal(proposal.id, { status: "confirming" });
      try {
        const res = await fetch("/api/admin/copilot/act", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: proposal.token, ...(typed ? { typed } : {}) }),
        });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; href?: string; code?: string } | null;
        const message = body?.message ?? "That did not go through. Try again, or make the change on the desk.";
        if (res.ok && body?.ok) {
          banner.success(message);
          setProposal(proposal.id, { status: "done", message, ...(body.href ? { href: body.href } : {}) });
        } else {
          banner.error(message);
          /* A mistyped word leaves the card as it was, to type again. */
          const retry = body?.code === "invalid" && Boolean(proposal.confirmWord);
          setProposal(proposal.id, { status: retry ? "pending" : body?.code === "expired" ? "expired" : "failed", message });
        }
      } catch {
        const message = "Could not reach the console just now. Nothing was changed. Try again.";
        banner.error(message);
        setProposal(proposal.id, { status: "pending", message });
      }
    },
    [setProposal],
  );

  const dismiss = useCallback((id: string) => setProposal(id, { status: "dismissed" }), [setProposal]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    carryRef.current = null;
    setCarry(null);
    setTurns([]);
    setPending(false);
    setTool(null);
    setThreadId(null);
    savedSig.current = "";
    writeThreadId(storageKey, null);
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  /** The person's saved conversations, newest first. */
  const loadThreads = useCallback(async (): Promise<void> => {
    setListing("loading");
    try {
      const res = await fetch("/api/admin/copilot/threads", { cache: "no-store" });
      const out = (await res.json().catch(() => null)) as { ok?: boolean; state?: string; threads?: ThreadSummary[] } | null;
      if (out?.state === "not_set_up") {
        setHistory("off");
        setListing("ready");
        return;
      }
      if (res.ok && out?.ok && Array.isArray(out.threads)) {
        setHistory("on");
        setThreads(out.threads);
        setListing("ready");
        return;
      }
      setListing("failed");
    } catch {
      setListing("failed");
    }
  }, []);

  /** Open a saved conversation in place of this one. */
  const openThread = useCallback(
    async (id: string): Promise<boolean> => {
      if (pending) return false;
      try {
        const res = await fetch(`/api/admin/copilot/threads/${encodeURIComponent(id)}`, { cache: "no-store" });
        const out = (await res.json().catch(() => null)) as { ok?: boolean; thread?: { id: string; turns: Turn[] } } | null;
        if (!res.ok || !out?.ok || !out.thread) {
          banner.error("That conversation could not be opened just now.");
          return false;
        }
        const loaded = out.thread.turns.map((t) => ({ ...t, proposals: Array.isArray(t.proposals) ? t.proposals : [], destinations: Array.isArray(t.destinations) ? t.destinations : [] }));
        abortRef.current?.abort();
        carryRef.current = null;
        setCarry(null);
        savedSig.current = JSON.stringify(forStore(loaded));
        setTurns(loaded);
        setThreadId(out.thread.id);
        writeThreadId(storageKey, out.thread.id);
        return true;
      } catch {
        banner.error("Could not reach the console just now.");
        return false;
      }
    },
    [pending, storageKey],
  );

  /** Delete a saved conversation. The one on screen starts afresh if it was that one. */
  const deleteThread = useCallback(
    async (id: string): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/copilot/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          banner.error("That conversation could not be deleted just now.");
          return;
        }
        setThreads((all) => all.filter((t) => t.id !== id));
        if (threadRef.current === id) newChat();
        banner.quick("Conversation deleted");
      } catch {
        banner.error("Could not reach the console just now.");
      }
    },
    [newChat],
  );

  return { turns, pending, tool, send, stop, askAgain, confirm, dismiss, newChat, threadId, history, threads, listing, loadThreads, openThread, deleteThread, renameThread, carry, startFreshWithSummary, takeBackLast, answerForm, skipForm };
}
