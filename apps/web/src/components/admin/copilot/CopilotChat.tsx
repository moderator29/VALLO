"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { COPILOT_ASK_EVENT } from "./CopilotCapabilities";
import { CopilotMarkdown } from "./markdown-lite";
import { ProposalCard } from "./ProposalCard";
import { useCopilotChat } from "./use-copilot-chat";
import "./admin-copilot.css";

/**
 * THE COPILOT CONVERSATION, used by the desk sheet and the full page. It owns
 * the message list, the starter chips, the live tool-status line, the answer
 * copy buttons, the proposal cards, the New chat button and the composer
 * (Enter sends, Shift+Enter adds a line). The answer list is a polite live
 * region so a screen reader hears the answer as it is written.
 */
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
  const { turns, pending, tool, send, confirm, dismiss, newChat } = useCopilotChat({ storageKey, scope, deskName, context: context ?? null });
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns, tool]);

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
      await navigator.clipboard.writeText(text);
      banner.success("Answer copied");
    } catch {
      banner.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const last = turns[turns.length - 1];
  const writing = pending && last?.role === "assistant" && last.text === "";

  return (
    <div className="nf-copilot" data-variant={variant}>
      <div className="nf-copilot__bar">
        <p className="nf-copilot__hint">{pending ? "Working on it" : turns.length ? `${deskName} assistant` : "Ask about your work"}</p>
        <Button type="button" variant="quiet" size="sm" onClick={() => { newChat(); input.current?.focus({ preventScroll: true }); }} disabled={turns.length === 0 && !pending} data-testid="copilot-new-chat">
          New chat
        </Button>
      </div>

      <div className="nf-copilot-thread" aria-live="polite" aria-busy={pending} data-testid="admin-copilot-thread">
        {turns.length === 0 ? (
          <div className="nf-copilot-empty">
            <p className="nf-copilot-greeting">{greeting ?? `Ask me anything about your ${deskName.toLowerCase()} work.`}</p>
            <div className="nf-copilot-chips" role="group" aria-label="Suggested questions">
              {starters.map((prompt) => (
                <button key={prompt} type="button" className="nf-copilot-chip nf-tap" onClick={() => submit(prompt)} disabled={pending}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => (
            <div key={turn.id} className="nf-copilot-row" data-role={turn.role}>
              {turn.role === "user" ? (
                <p className="nf-copilot-turn" data-role="user">{turn.text}</p>
              ) : (
                <>
                  {turn.text ? (
                    <div className="nf-copilot-turn" data-role="assistant">
                      <CopilotMarkdown text={turn.text} {...(onNavigate ? { onNavigate } : {})} />
                      {!(pending && i === turns.length - 1) ? (
                        <button type="button" className="nf-copilot-copy nf-tap" onClick={() => void copyAnswer(turn.text)}>
                          Copy answer
                        </button>
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
            <span className="nf-copilot-status__dot" aria-hidden="true" />
            {tool ? `${tool.label}...` : writing ? "Thinking..." : "Writing..."}
          </p>
        ) : null}
        <div ref={end} />
      </div>

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
          className="nf-field nf-copilot-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask about your desk. Enter to send, Shift+Enter for a new line."
          maxLength={2000}
          enterKeyHint="send"
        />
        <Button type="submit" variant="primary" disabled={pending || !draft.trim()} data-testid="admin-copilot-send" aria-label="Send">
          <UiIcon name="send" size={18} weight="lean" />
        </Button>
      </form>
    </div>
  );
}
