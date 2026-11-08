"use client";

import { banner } from "@/lib/ui/toast";
import type { Dictionary } from "@vallo/i18n/core";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { findFaqEntry } from "@/lib/support/faq";
import { chatTranscript } from "@/lib/support/new-query";
import { fileSupportTicket } from "@/lib/support/actions";
import { TicketFiledSheet } from "./TicketFiledSheet";
import type { SupportAction, SupportStreamEvent, SupportTurn } from "@/lib/support/types";
import { ICON } from "@/components/app/Screen";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useDeviceIdentity } from "./device-identity";
import { recordAiConsent } from "@/lib/ai/consent-actions";
import { AI_CONSENT_REQUIRED_CODE } from "@/lib/ai/consent";
import { IconPlate } from "@/components/ui/IconPlate";
import { AIResponse, type AIResponseStatus } from "@/components/ui/AIResponse";
import { useInboxPart } from "@/components/app/threads/use-inbox-copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
/* The answer card's fit (the words keep the line breaks, the stopped note, the
   thinking orb) is the assistant's; support's answers are the same card. */
import "@/components/app/assistant/assistant-answer.css";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Help and support, AI first.
 *
 * The card opens a real support conversation: replies stream token by token
 * from /api/support, where a grounded agent answers from Vallo's canonical
 * help notes and, for a signed-in person, from their own bookings and wallet
 * read under their own Row Level Security. When it should stop trying it files
 * a real support ticket and hands back the VAL-SUP reference the database gave,
 * which lands in this thread as a receipt.
 *
 * Two promises the surface keeps whatever happens. Talk to a person is visible
 * at all times, never buried behind a failed answer, and it collects a name and
 * an email and nothing else. And when the platform has no model key, the route
 * says so honestly and this surface falls back to the keyword help store, so
 * support answers the common questions rather than going dark.
 *
 * The thread lives under `nf_support_thread` on this device and survives
 * navigation and reloads.
 */

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  /** Real surfaces this answer earned, rendered as chips under the bubble. */
  actions?: SupportAction[];
  /** Set when a ticket row was really written, by the agent or by the form. */
  reference?: string;
  /** The ticket's id, when it is on the member's account and has a thread to open. */
  ticketId?: string;
  /** True when this bubble carries the name and email escalation card. */
  escalating?: boolean;
  /** The question an escalation from this bubble files as the ticket body. */
  question?: string;
  error?: boolean;
  /** The person pressed Stop: what arrived is kept and the card says so. */
  stopped?: boolean;
};

const THREAD_KEY = "nf_support_thread";

const GREETING =
  "Hello, I am Vallo's AI support helper, not a person. Ask me anything about your bookings, payments, your agreements, listing a property, verification or cancellations. If you are signed in I can look at your own bookings and agreements, and I bring in a person whenever that is the right answer.";

const STARTERS = [
  "Where is my booking?",
  "How do cancellations work?",
  "Where does my money go when I pay?",
  "How do I list my property?",
];

const HUMAN_TEXT =
  "Of course. Tell me who to reply to and I will pass this to the support team. We keep only your name and email, and use them just to answer you.";
const HUMAN_TEXT_SIGNED_IN =
  "Of course. I will pass this conversation to the support team as it is, so you do not have to repeat yourself. A person replies in Messages and by email.";
const ESCALATION_TEXT =
  "I do not have a confident answer for that, so let me put it in front of a person. Check your details below and send it over.";
const NETWORK_ERROR_MESSAGE =
  "Support could not reach the network just now. Your message is kept; try again, or use Talk to a person.";
const PACE_FALLBACK_MESSAGE =
  "You are asking faster than support can answer. Give it a few minutes and try again.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Quick actions the keyword fallback can offer honestly.
 *
 * When the agent is running it earns these from the tools it actually called.
 * With no key there are no tool results, so the only actions offered are the
 * ones the matched help topic guarantees: a booking answer really does belong
 * on the trips hub, a payment answer really does belong on the agreements. Nothing
 * here claims to have read anybody's record.
 */
const FALLBACK_ACTIONS: Record<string, SupportAction | undefined> = {
  booking: { kind: "bookings", label: "Open my bookings", href: "/bookings" },
  cancellations: { kind: "bookings", label: "Open my bookings", href: "/bookings" },
  wallet: { kind: "agreements", label: "Open my agreements", href: "/agreements" },
  payments: { kind: "agreements", label: "Open my agreements", href: "/agreements" },
  guarantee: { kind: "agreements", label: "Open my agreements", href: "/agreements" },
  "messaging-safety": { kind: "messages", label: "Message the agent", href: "/messages" },
  "rent-inspection": { kind: "messages", label: "Message the agent", href: "/messages" },
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadThread(): Message[] {
  try {
    const raw = window.localStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as Message).id === "string" &&
        typeof (m as Message).text === "string" &&
        ((m as Message).role === "user" || (m as Message).role === "assistant"),
    );
  } catch {
    return [];
  }
}

/** The wire history: plain text turns, empty bubbles left out. */
function toTurns(messages: Message[]): SupportTurn[] {
  return messages
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.text }));
}

/**
 * What a human picking up the ticket sees first when the person escalated:
 * the whole conversation, oldest first, cut from the oldest end only if it is
 * longer than a ticket message can hold (`chatTranscript`).
 */
function transcriptSummary(messages: Message[]): string {
  return chatTranscript(messages.map((m) => ({ role: m.role, text: m.text })));
}

const DRAFT_KEY = "nf_support_chat_draft";

export function SupportChat({
  aiConsented = false,
  defaultOpen = false,
  signedIn = false,
  embedded = false,
  assistantCopy,
}: {
  aiConsented?: boolean;
  /** `experienceInbox.assistant` from the server parent (no client dictionary read). */
  assistantCopy?: Dictionary["experienceInbox"]["assistant"];
  /** Starts with the conversation showing, for a caller that opened it on purpose (the support home's sheet). */
  defaultOpen?: boolean;
  /**
   * A signed-in member is handed to a person without being asked for a name
   * and an email: the ticket files under their account, the reply lands in
   * Messages, and the server reads the address they sign in with.
   */
  signedIn?: boolean;
  /** Drawn inside a sheet that already has a title: no card, no open toggle. */
  embedded?: boolean;
} = {}) {
  const [open, setOpen] = useState(defaultOpen || embedded);
  /* STORE-07: the AI half of this chat runs only after this person agrees to
     the disclosure; declining keeps the chat, answered from the help pages
     and a person, with no AI. The route refuses without agreement anyway. */
  const [consent, setConsent] = useState<"yes" | "ask" | "declined">(aiConsented ? "yes" : "ask");
  const [messages, setMessages] = useState<Message[]>([]);
  /* The reference `fileSupportTicket` just answered with, for the success sheet. */
  const [justFiled, setJustFiled] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  /**
   * True once the route has told us it cannot run: no key, or the support flag
   * switched off. From then on this surface answers from the keyword help
   * store rather than asking the route the same question again.
   */
  const [keywordOnly, setKeywordOnly] = useState(false);
  /*
   * THE NAME AND EMAIL COME FROM THE STORE, NOT FROM A MOUNT EFFECT.
   *
   * This kept its own copy of the two key strings and read them once, inside
   * the same effect that loads the thread. On `/settings` the identity card and
   * this sheet can both be mounted: somebody who corrects their name in the
   * card and then escalates here filed the ticket under the OLD name, because
   * this component had already read storage and had no way to be told. A
   * support ticket under the wrong name is a reply that does not arrive. See
   * `./device-identity`.
   */
  const { identity } = useDeviceIdentity();
  /* The answer card's words are the assistant's (experienceInbox.assistant):
     one voice for "thinking", "stop", "copy" and what each state announces. */
  const answerWords = useInboxPart("assistant", assistantCopy);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The latest thread, so sending reads it without re-binding the callback. */
  const messagesRef = useRef<Message[]>([]);
  const panelId = "support-chat-panel";

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* The thread itself is still an effect and should be: it is a document this
     component owns and writes back, not a value shared with anybody, so there
     is no second reader to notify and nothing to subscribe to. `hydrated` gates
     the write below so an empty first render cannot erase a stored thread. */
  useEffect(() => {
    setMessages(loadThread());
    try {
      const stored = window.localStorage.getItem(DRAFT_KEY);
      if (stored) setDraft(stored.slice(0, 2000));
    } catch {
      // No stored draft.
    }
    setHydrated(true);
  }, []);

  /* The half-typed message survives the sheet closing, a reload and a lost
     connection: closing the sheet unmounts this component. */
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (draft) window.localStorage.setItem(DRAFT_KEY, draft);
      else window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage blocked: the draft lives in memory.
    }
  }, [draft, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(THREAD_KEY, JSON.stringify(messages));
    } catch {
      // Storage full or blocked: the conversation lives in memory.
    }
  }, [messages, hydrated]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages, streaming, open]);

  /* Abort any in-flight reply when this card leaves the page. */
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const patch = useCallback((id: string, next: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? next(m) : m)));
  }, []);

  /** Answer from the keyword help store, escalating when nothing matches. */
  const answerFromKeywords = useCallback(
    (id: string, question: string, prefix?: string) => {
      const entry = findFaqEntry(question);
      const answer = entry?.answer ?? null;
      const action = entry ? FALLBACK_ACTIONS[entry.id] : undefined;
      patch(id, (m) => ({
        ...m,
        text: answer
          ? prefix
            ? `${prefix}\n\n${answer}`
            : answer
          : (prefix ?? ESCALATION_TEXT),
        ...(action ? { actions: [action] } : {}),
        ...(answer ? {} : { escalating: true, question }),
      }));
    },
    [patch],
  );

  const send = useCallback(
    async (raw: string, decided?: "yes" | "declined") => {
      /* `decided` is the answer the consent sheet has just given, passed in
         because the state set beside it is not visible until the next render. */
      const answer = decided ?? consent;
      const text = raw.trim();
      if (!text || streaming) return;
      if (!keywordOnly && answer === "ask") {
        /* Sending is agreeing (29 October 2026): no card in the chat. The
           agreement is recorded, then the message goes. */
        setConsent("yes");
        const recorded = await recordAiConsent().catch(() => ({ ok: false as const, error: "Network error" }));
        if (!recorded.ok) setConsent("ask");
        return send(raw, recorded.ok ? "yes" : "declined");
      }
      setDraft("");

      const userMessage: Message = { id: makeId(), role: "user", text };
      const replyId = makeId();
      const history: SupportTurn[] = toTurns([...messagesRef.current, userMessage]);
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: replyId, role: "assistant" as const, text: "" },
      ]);

      // Already told the platform cannot answer, or the person said no to the
      // AI: stay local, stay useful.
      if (keywordOnly || answer === "declined") {
        answerFromKeywords(replyId, text);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          patch(replyId, (m) => ({ ...m, text: j?.message ?? PACE_FALLBACK_MESSAGE }));
          return;
        }
        if (res.status === 403) {
          const j = (await res.json().catch(() => null)) as { code?: string } | null;
          if (j?.code === AI_CONSENT_REQUIRED_CODE) {
            /* Nothing went to the AI. Ask, and answer this one from the help
               pages meanwhile. */
            setConsent("ask");
            answerFromKeywords(replyId, text);
            return;
          }
        }
        if (!res.ok || !res.body) {
          patch(replyId, (m) => ({ ...m, text: m.text.trim() ? m.text : NETWORK_ERROR_MESSAGE, error: true }));
          return;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          // The honest unconfigured answer, rendered as an ordinary reply, with
          // the keyword store carrying the question from here on.
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          setKeywordOnly(true);
          answerFromKeywords(replyId, text, j?.message ?? NETWORK_ERROR_MESSAGE);
          return;
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
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              let event: SupportStreamEvent;
              try {
                event = JSON.parse(line.slice(5).trim()) as SupportStreamEvent;
              } catch {
                continue;
              }
              if (event.type === "text") {
                const slice = event.text;
                patch(replyId, (m) => ({ ...m, text: m.text + slice }));
              } else if (event.type === "actions") {
                const items = event.items;
                patch(replyId, (m) => ({ ...m, actions: items }));
              } else if (event.type === "ticket") {
                const reference = event.reference;
                patch(replyId, (m) => ({ ...m, reference }));
              } else if (event.type === "error") {
                const message = event.message;
                patch(replyId, (m) =>
                  m.text.trim() ? m : { ...m, text: message, error: true },
                );
              }
            }
          }
        }

        // A reply that arrived empty still deserves a way forward.
        patch(replyId, (m) =>
          m.text.trim()
            ? m
            : { ...m, text: ESCALATION_TEXT, escalating: true, question: text },
        );
      } catch {
        if (controller.signal.aborted) {
          /* Stop keeps what arrived. With nothing yet there is no card to
             keep, and the thinking card simply goes. */
          patch(replyId, (m) => ({ ...m, stopped: true }));
          return;
        }
        patch(replyId, (m) => ({ ...m, text: m.text.trim() ? m.text : NETWORK_ERROR_MESSAGE, error: true }));
      } finally {
        setStreaming(false);
      }
    },
    [answerFromKeywords, keywordOnly, patch, streaming, consent],
  );


  /**
   * Talk to a person: always available, never behind a failed answer.
   *
   * Whatever is sitting unsent in the box goes with it, as the member's own
   * message, so pressing this halfway through a sentence loses nothing.
   */
  const askForHuman = () => {
    const unsent = draft.trim();
    const lastQuestion = unsent || ([...messages].reverse().find((m) => m.role === "user")?.text ?? "");
    setDraft("");
    setMessages((prev) => [
      ...prev,
      ...(unsent ? [{ id: makeId(), role: "user" as const, text: unsent }] : []),
      { id: makeId(), role: "user", text: "I would like to talk to a person." },
      {
        id: makeId(),
        role: "assistant",
        text: signedIn ? HUMAN_TEXT_SIGNED_IN : HUMAN_TEXT,
        escalating: true,
        question: lastQuestion || "Asked to speak to a person from the support chat.",
      },
    ]);
  };

  const markFiled = (messageId: string, reference: string, ticketId?: string) => {
    patch(messageId, (m) => ({ ...m, reference, ...(ticketId ? { ticketId } : {}) }));
    setJustFiled(reference);
  };

  const clearConversation = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages([]);
    try {
      window.localStorage.removeItem(THREAD_KEY);
    } catch {
      // Already cleared in memory.
    }
  };

  /** What an answer earned or filed, drawn under it: places to go, the receipt, the escalation. */
  const extras = (m: Message) => (
    <>
      {m.actions && m.actions.length > 0 && (
        <div className="mt-row flex flex-wrap gap-xs">
          {m.actions.map((action) => (
            <Link
              key={action.kind}
              href={action.href}
              /* 12px was a step BELOW the chip's own caption
                 size, on the one element in a reply that is a
                 place to go. The class already sets it. */
              className="nf-chip max-w-full cursor-pointer font-semibold"
            >
              <UiIcon name={ACTION_GLYPH[action.kind]} size={12} />
              <span className="min-w-0 break-words">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      {m.reference ? (
        <TicketReceipt reference={m.reference} ticketId={m.ticketId} />
      ) : (
        m.escalating && (
          <EscalationCard
            defaultName={identity.name}
            defaultEmail={identity.email}
            signedIn={signedIn}
            question={m.question ?? m.text}
            summary={transcriptSummary(messages)}
            onFiled={(reference, ticketId) => markFiled(m.id, reference, ticketId)}
          />
        )
      )}
    </>
  );

  const empty = hydrated && messages.length === 0;
  const lastId = messages[messages.length - 1]?.id;
  const awaitingFirstToken =
    streaming && messages[messages.length - 1]?.text.trim().length === 0;

  return (
    <section className={embedded ? "block" : "nf-panel nf-panel--card block p-card"} aria-label="Help and support">
      {/* Keyed by the reference, so a second escalation is a second moment. */}
      {justFiled ? <TicketFiledSheet key={justFiled} reference={justFiled} signedIn={signedIn} /> : null}
      {!embedded && (
      /* Wraps, so under ~400px the chip drops to its own line under the text
         instead of squeezing the title and sentence into a 38px column
         (measured on /help at 320). The text column's 12rem basis is the
         width below which it yields the row to the chip. */
      <div className="flex flex-wrap items-center gap-group">
        <IconPlate size="md" className="shrink-0">
          <UiIcon name="headset" size={20} />
        </IconPlate>
        <div className="min-w-0 flex-1 basis-[10rem]">
          <h2 className="nf-body font-semibold leading-tight">Help and support</h2>
          {/* A title and its own subtitle are two rows of one object, so they
              take the row interval. This was mt-0.5, which is 2px: a heading
              and a sentence touching rather than an interval. */}
          <p className="mt-row nf-caption text-[var(--nf-content-muted)]">
            {/* UX-15: said plainly that this is AI, and "agent" is kept for estate
                agents, which is what the word means everywhere else here. */}
            An AI helper that reads your own bookings and hands you to a person when it should.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          data-testid="support-open"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0"
        >
          {open ? "Close" : "Open chat"}
        </Button>
      </div>
      )}

      <div id={panelId} hidden={!open}>
        {open && (
          <div
            data-testid="support-panel"
            className={embedded ? "block" : "nf-panel nf-panel--card nf-rise mt-heading block overflow-hidden p-0"}
          >
            <div
              ref={scrollerRef}
              className={embedded ? "min-h-52 space-y-group pb-group" : "max-h-96 min-h-52 space-y-group overflow-y-auto p-card-sm"}
              /* Not live while an answer streams: reading every token aloud
                 makes it unusable. The answer card announces its own state. */
              aria-live={streaming ? "off" : "polite"}
              aria-label="Support conversation"
            >
              <AgentBubble text={GREETING} />

              {empty && (
                /* Aligned to the bubble text rather than to the scroller's
                   edge, so the openers read as the agent offering them. The
                   lead is DERIVED from the avatar and the row gap beside it,
                   the same way `--nf-row-divider-lead` is: pl-9 was 36px against
                   an actual lead of 38 and would drift the moment either
                   changed. */
                <div className="flex flex-wrap gap-xs ps-[calc(1.625rem+var(--nf-gap-row))]">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="nf-chip max-w-full cursor-pointer text-left"
                    >
                      <UiIcon name="chat-bubble" size={12} />
                      <span className="min-w-0 break-words">{s}</span>
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="nf-rise flex justify-end">
                    <p className="nf-body-sm max-w-[85%] break-words rounded-2xl rounded-br-md bg-[var(--nf-brand-primary)] px-sm py-xs leading-relaxed text-[var(--nf-content-on-brand)]">
                      {m.text}
                    </p>
                  </div>
                ) : m.text.trim() ? (
                  /* An answer is drawn by the shared answer card, with the
                     places it earned and any receipt or escalation under it. */
                  <div key={m.id} className="nf-rise space-y-row">
                    <AIResponse
                      className="nf-ai-answer"
                      status={answerStatus(m, streaming && m.id === lastId)}
                      label={answerWords.answerLabel}
                      thinkingLabel={answerWords.thinking}
                      statusLabels={{
                        done: answerWords.statusDone,
                        stopped: answerWords.statusStopped,
                        error: answerWords.statusError,
                      }}
                      stopLabel={answerWords.stop}
                      onStop={() => abortRef.current?.abort()}
                      {...(m.error ? { errorMessage: m.text } : {})}
                      actions={[
                        {
                          id: "copy",
                          label: copiedId === m.id ? answerWords.copied : answerWords.copy,
                          icon: copiedId === m.id ? "check" : "clipboard-list",
                          onSelect: () => {
                            void navigator.clipboard
                              ?.writeText(m.text)
                              .then(() => {
                                setCopiedId(m.id);
                                window.setTimeout(() => setCopiedId((id) => (id === m.id ? null : id)), 1600);
                              })
                              .catch(() => undefined);
                          },
                        },
                      ]}
                      data-testid="support-reply"
                    >
                      {m.error ? null : m.text}
                      {m.stopped ? <span className="nf-ai-answer__stopped">{answerWords.stoppedNote}</span> : null}
                    </AIResponse>
                    {extras(m)}
                  </div>
                ) : m.escalating || m.reference ? (
                  <AgentBubble key={m.id} text="" error={m.error}>
                    {extras(m)}
                  </AgentBubble>
                ) : null,
              )}

              {awaitingFirstToken && (
                /* THE ONE PERMITTED LOOP: three shaped lines breathing, until
                   the first words arrive. Never a spinner, never bouncing dots. */
                <div className="nf-rise">
                  <AIResponse
                    className="nf-ai-answer"
                    status="thinking"
                    label={answerWords.answerLabel}
                    thinkingLabel={answerWords.thinking}
                    statusLabels={{
                      done: answerWords.statusDone,
                      stopped: answerWords.statusStopped,
                      error: answerWords.statusError,
                    }}
                    stopLabel={answerWords.stop}
                    onStop={() => abortRef.current?.abort()}
                    data-testid="support-thinking"
                  />
                </div>
              )}
            </div>

            {/* In the sheet the composer stays on screen while the thread
                scrolls under it, the way a messaging app's does. */}
            <div className={embedded ? "sticky bottom-0 bg-[var(--nf-surface-elevated)]" : ""}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="flex items-center gap-xs border-t border-[var(--nf-border-subtle)] p-row"
            >
              <label htmlFor="support-input" className="sr-only">
                Message support
              </label>
              <input
                id="support-input"
                data-testid="support-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about a booking, a payment or your account"
                autoComplete="off"
                enterKeyHint="send"
                className="nf-field min-w-0 flex-1"
              />
              {/* Rounded square, as the composer send in
                  GOVERNING-chat-booking-card.png is. It was `rounded-full`. */}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                iconOnly
                aria-label="Send message"
                data-testid="support-send"
                disabled={!draft.trim() || streaming}
                className="shrink-0"
              >
                <UiIcon name="arrow-right" size={16} className="-rotate-90" />
              </Button>
            </form>

            {/* Both of these were bare text with no height at all, which is a
                14px-tall tap target on the two controls that end a conversation
                or hand it to a person. The 44px floor is drawn on the button
                rather than faked with an overlay, because there is room here. */}
            <div className="flex flex-wrap items-center gap-x-group gap-y-inline border-t border-[var(--nf-border-subtle)] p-row">
              <Button variant="quiet" size="sm" leadingIcon="user" data-testid="support-human" onClick={askForHuman}>
                Talk to a person
              </Button>
              {messages.length > 0 && (
                <Button variant="quiet" size="sm" onClick={clearConversation}>
                  Clear conversation
                </Button>
              )}
              {signedIn && (
                <Link
                  href="/support/new"
                  data-testid="support-write-instead"
                  className="inline-flex min-h-11 items-center nf-caption font-normal text-[var(--nf-content-muted)] transition-colors hover:text-[var(--nf-content-primary)]"
                >
                  Write to the team instead
                </Link>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The answer card's state is a fact about the turn, never a guess: streaming
 * while this reply's stream is open, error when the turn failed, stopped when
 * the person cut it, done otherwise.
 */
function answerStatus(m: Message, streamingHere: boolean): AIResponseStatus {
  if (m.error) return "error";
  if (streamingHere) return "streaming";
  return m.stopped ? "stopped" : "done";
}

/** Navigation glyphs for the quick actions; content icons never go here. */
const ACTION_GLYPH: Record<SupportAction["kind"], "calendar-booking" | "document" | "chat-bubble" | "user"> = {
  bookings: "calendar-booking",
  agreements: "document",
  messages: "chat-bubble",
  "sign-in": "user",
};

function AgentBubble({
  text,
  error,
  children,
}: {
  text: string;
  error?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="nf-rise flex items-end gap-row">
      <IconPlate size="sm" className="shrink-0">
        <UiIcon name="bot" size={20} />
      </IconPlate>
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-inset)] px-sm py-xs">
        {text.trim() && (
          <p
            data-testid="support-reply"
            className={`nf-body-sm whitespace-pre-wrap break-words leading-relaxed ${
              error ? "text-[var(--nf-state-error)]" : "text-[var(--nf-content-secondary)]"
            }`}
          >
            {text}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

/** The receipt. Only ever rendered from a reference the database returned. */
function TicketReceipt({ reference, ticketId }: { reference: string; ticketId?: string }) {
  return (
    <div
      data-testid="support-receipt"
      className="mt-row nf-panel nf-panel--card block p-row"
    >
      <p className="flex items-start gap-inline nf-caption font-semibold text-[var(--nf-brand-secondary)]">
        {/* 3xs is the optical-alignment rung, which is what this is: a glyph
            nudged onto the baseline of the line beside it, not a gap. */}
        <UiIcon name="verified" size={ICON.inline} className="mt-3xs shrink-0" />
        <span className="min-w-0 break-words">
          {ticketId
            ? `Ticket ${reference} is filed with this conversation attached. A person replies in Messages and by email.`
            : `Ticket ${reference} is filed. A person replies by email.`}
        </span>
      </p>
      {ticketId ? (
        <Link
          href={`/support/messages/${ticketId}`}
          className="nf-caption mt-row inline-flex min-h-11 items-center font-semibold text-[var(--nf-content-link)]"
          data-testid="support-receipt-open"
        >
          Open the conversation
        </Link>
      ) : (
        <p className="mt-row nf-caption leading-relaxed text-[var(--nf-content-muted)]">
          We keep only the name and email you gave here, and use them just to
          reply to this ticket.
        </p>
      )}
    </div>
  );
}

/**
 * Escalation card. Files the ticket through the server action, with the whole
 * conversation as its first message, and shows the real VAL-SUP reference the
 * database returned. When the platform cannot file yet, the action's honest
 * message is shown instead of pretending a ticket exists.
 *
 * Signed out, it collects a name and an email and nothing else. Signed in it
 * asks for nothing: the ticket files under the member's account, the server
 * reads their name and sign-in address, and the reply lands in Messages.
 */
function EscalationCard({
  defaultName,
  defaultEmail,
  signedIn,
  question,
  summary,
  onFiled,
}: {
  defaultName: string;
  defaultEmail: string;
  signedIn: boolean;
  question: string;
  summary: string;
  onFiled: (reference: string, ticketId?: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [pending, startTransition] = useSafeTransition();

  const submit = () => {
    if (!signedIn) {
      const errors: { name?: string; email?: string } = {};
      if (!name.trim()) errors.name = "Add your name so we know who to reply to.";
      if (!email.trim()) errors.email = "Add an email address so we can reply.";
      else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }

    startTransition(async () => {
      try {
        const result = await fileSupportTicket({
          ...(signedIn ? {} : { name: name.trim(), email: email.trim() }),
          topic: "other",
          kind: "question",
          body: question,
          summary,
        });
        if (result.ok) {
          onFiled(result.data.reference, result.data.id);
        } else {
          setFieldErrors({
            ...(result.fieldErrors?.name ? { name: result.fieldErrors.name } : {}),
            ...(result.fieldErrors?.email ? { email: result.fieldErrors.email } : {}),
          });
          /* Said by the one banner at the top of the screen (Grade 1). */
          banner.error(result.error);
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div
      data-testid="support-escalation"
      className="mt-row nf-panel nf-panel--card block p-row"
    >
      <p className="flex items-center gap-inline nf-caption font-semibold text-[var(--nf-brand-secondary)]">
        <UiIcon name="user" size={ICON.inline} className="shrink-0" />
        Bring in a person
      </p>

      {signedIn ? (
        <p className="mt-row nf-caption leading-relaxed text-[var(--nf-content-secondary)]">
          The team gets this whole conversation, so you do not have to repeat yourself.
        </p>
      ) : (
        /*
          `Field` owns the message element now - including its `role="alert"` and
          the `aria-describedby` that points at it - so the message no longer has
          a node of its own to hang a hook on. The `-error` test ids therefore sit
          on the field wrappers, whose text content IS the message when there is
          one. Same locator, same assertion, and the state is finally visible.
        */
        <div className="mt-heading space-y-row">
          <div data-testid="support-name-error">
            <TextField
              label="Name"
              id="support-escalation-name"
              data-testid="support-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              error={fieldErrors.name}
            />
          </div>
          <div data-testid="support-email-error">
            <TextField
              label="Email"
              id="support-escalation-email"
              data-testid="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              error={fieldErrors.email}
            />
          </div>
        </div>
      )}


      <Button
        variant="primary"
        size="sm"
        full
        className="mt-heading"
        data-testid="support-file"
        onClick={submit}
        loading={pending}
      >
        {signedIn ? "Send to a person" : "File the ticket"}
      </Button>

      {!signedIn && (
        <p className="mt-row nf-caption leading-relaxed text-[var(--nf-content-muted)]">
          We collect only the name and email above, and use them just to reply to
          this question.
        </p>
      )}
    </div>
  );
}
