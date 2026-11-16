"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { COPILOT_ASK_EVENT } from "./CopilotCapabilities";
import { CopilotAnswer } from "./CopilotAnswer";
import { ProposalCard } from "./ProposalCard";
import { useCopilotChat, type ThreadSummary } from "./use-copilot-chat";
import "./admin-copilot.css";

/**
 * THE COPILOT CONVERSATION, used by the desk sheet and the full page.
 *
 * Rebuilt for the phone on 16 November 2026 (the founder: "look at the
 * frontend of the chat box, make it clean on mobile, lovely and high end, and
 * there should be chat history"). A small bar with History and New chat; your
 * questions in a Vallo-blue bubble on the right; the copilot's answers on the
 * page itself, full width, as a well-set chat answer reads, with a quiet Copy
 * under each; the cards it offers (each with its own preview and button); a
 * floating composer that grows as you write. History opens over the thread:
 * every conversation you have had, newest first, to open again or delete.
 *
 * The answer list is a polite live region so a screen reader hears the answer
 * as it is written. Enter sends, Shift+Enter adds a line.
 */

function ago(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

function deskLabel(desk: string): string {
  const words = desk.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Console";
}

export function CopilotChat({
  scope,
  deskName,
  context,
  greeting,
  starters,
  storageKey,
  variant = "sheet",
  autoFocus = false,
  onNavigate,
}: {
  scope: string | null;
  deskName: string;
  context?: string | null;
  greeting?: string;
  starters: readonly string[];
  storageKey: string;
  variant?: "sheet" | "page";
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const chat = useCopilotChat({ storageKey, scope, deskName, context: context ?? null });
  const { turns, pending, tool, send, confirm, dismiss, newChat, threadId, history, threads, listing, loadThreads, openThread, deleteThread } = chat;
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(0);
  const inputId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (!showHistory) end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, tool, showHistory]);

  /* The composer grows with what is written, up to about six lines. */
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  const submitRef = useRef<(text: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      if (typeof prompt === "string") submitRef.current(prompt);
    };
    window.addEventListener(COPILOT_ASK_EVENT, onAsk);
    return () => window.removeEventListener(COPILOT_ASK_EVENT, onAsk);
  }, []);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setShowHistory(false);
    void send(message);
    input.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    submitRef.current = submit;
  });

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  };

  const copyAnswer = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*/g, ""));
      banner.quick("Answer copied");
    } catch {
      banner.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const openHistory = () => {
    setNow(Date.now());
    setShowHistory(true);
    void loadThreads();
  };

  const pick = async (thread: ThreadSummary) => {
    const opened = await openThread(thread.id);
    if (opened) setShowHistory(false);
  };

  const last = turns[turns.length - 1];
  const writing = pending && last?.role === "assistant" && last.text === "";

  return (
    <div className="nf-copilot" data-variant={variant}>
      <div className="nf-copilot__bar">
        <button type="button" className="nf-copilot-barbtn nf-tap" onClick={showHistory ? () => setShowHistory(false) : openHistory} aria-pressed={showHistory} data-testid="copilot-history">
          <UiIcon name={showHistory ? "arrow-left" : "history"} size={18} weight="lean" />
          <span>{showHistory ? "Back to chat" : "History"}</span>
        </button>
        <p className="nf-copilot__hint" aria-live="polite">
          {pending ? (
            <>
              <span className="nf-copilot-dot" aria-hidden="true" />
              Working on it
            </>
          ) : history === "on" && threadId ? (
            "Saved to your history"
          ) : null}
        </p>
        <button
          type="button"
          className="nf-copilot-barbtn nf-tap"
          onClick={() => {
            newChat();
            setShowHistory(false);
            input.current?.focus({ preventScroll: true });
          }}
          disabled={turns.length === 0 && !pending && !showHistory}
          data-testid="copilot-new-chat"
        >
          <UiIcon name="pencil" size={18} weight="lean" />
          <span>New chat</span>
        </button>
      </div>

      {showHistory ? (
        <section className="nf-copilot-history" aria-label="Your conversations" data-testid="copilot-history-list">
          <h3 className="nf-copilot-history__title">Your conversations</h3>
          {history === "off" ? (
            <p className="nf-copilot-history__note">Saved history is not switched on for this console yet. This conversation is kept until you close the browser.</p>
          ) : listing === "failed" ? (
            <p className="nf-copilot-history__note">
              Your conversations could not be loaded just now.{" "}
              <button type="button" className="nf-copilot-history__retry" onClick={() => void loadThreads()}>
                Try again
              </button>
            </p>
          ) : threads.length === 0 ? (
            <p className="nf-copilot-history__note">{listing === "ready" ? "Nothing saved yet. Every conversation is kept here after the first answer." : "Loading your conversations"}</p>
          ) : (
            <ul className="nf-copilot-history__list">
              {threads.map((thread) => (
                <li key={thread.id} className="nf-copilot-history__item" data-current={thread.id === threadId || undefined}>
                  <button type="button" className="nf-copilot-history__open nf-tap" onClick={() => void pick(thread)}>
                    <span className="nf-copilot-history__name">{thread.title}</span>
                    <span className="nf-copilot-history__meta">
                      {deskLabel(thread.desk)}
                      {now ? ` · ${ago(thread.updatedAt, now)}` : ""}
                    </span>
                  </button>
                  <button type="button" className="nf-copilot-history__delete nf-tap" onClick={() => void deleteThread(thread.id)} aria-label={`Delete "${thread.title}"`}>
                    <UiIcon name="trash" size={18} weight="lean" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="nf-copilot-thread" aria-live="polite" aria-busy={pending} data-testid="admin-copilot-thread">
          {turns.length === 0 ? (
            <div className="nf-copilot-empty">
              <span className="nf-copilot-empty__mark" aria-hidden="true">
                <UiIcon name="bot" size={26} weight="lean" />
              </span>
              <p className="nf-copilot-greeting">{greeting ?? `Ask me anything about your ${deskName.toLowerCase()} work.`}</p>
              <p className="nf-copilot-empty__can">I read your desks, write replies and notes, and do the work for you. Every change shows you a preview first and happens only when you press its button.</p>
              <div className="nf-copilot-chips" role="group" aria-label="Suggested questions">
                {starters.map((prompt) => (
                  <button key={prompt} type="button" className="nf-copilot-chip nf-tap" onClick={() => submit(prompt)} disabled={pending}>
                    <span>{prompt}</span>
                    <UiIcon name="arrow-up-right" size={16} weight="lean" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, i) => (
              <div key={turn.id} className="nf-copilot-row" data-role={turn.role}>
                {turn.role === "user" ? (
                  <p className="nf-copilot-turn" data-role="user">
                    {turn.text}
                  </p>
                ) : (
                  <>
                    {turn.text ? (
                      <div className="nf-copilot-turn" data-role="assistant">
                        <CopilotAnswer text={turn.text} destinations={turn.destinations ?? []} {...(onNavigate ? { onNavigate } : {})} />
                        {!(pending && i === turns.length - 1) ? (
                          <div className="nf-copilot-acts">
                            <button type="button" className="nf-copilot-act nf-tap" onClick={() => void copyAnswer(turn.text)}>
                              <UiIcon name="clipboard-list" size={16} weight="lean" />
                              Copy
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {turn.proposals.map((p) => (
                      <ProposalCard key={p.proposal.id} state={p} onConfirm={() => void confirm(p.proposal)} onDismiss={() => dismiss(p.proposal.id)} {...(onNavigate ? { onNavigate } : {})} />
                    ))}
                  </>
                )}
              </div>
            ))
          )}
          {pending ? (
            <p className="nf-copilot-status" role="status" data-testid="copilot-status">
              <span className="nf-copilot-typing" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {tool ? `${tool.label}` : writing ? "Thinking" : "Writing"}
            </p>
          ) : null}
          <div ref={end} />
        </div>
      )}

      <form
        className="nf-copilot-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask the assistant
        </label>
        <textarea
          id={inputId}
          ref={input}
          className="nf-copilot-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Ask about ${deskName === "Console" ? "your desks" : `the ${deskName.toLowerCase()} desk`}`}
          maxLength={2000}
          enterKeyHint="send"
        />
        <button type="submit" className="nf-copilot-send nf-tap" disabled={pending || !draft.trim()} data-testid="admin-copilot-send" aria-label="Send">
          <UiIcon name="arrow-up" size={20} weight="lean" />
        </button>
      </form>
    </div>
  );
}
