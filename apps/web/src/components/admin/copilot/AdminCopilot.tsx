"use client";

import { useId, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import type { StaffPosition } from "@/lib/admin/staff-positions";
import type { StaffScope } from "@/lib/admin/guard";
import "./admin-copilot.css";

type Turn = { role: "user" | "assistant"; text: string };

/**
 * THE ADMIN COPILOT, on every desk (founder, 10 November 2026). One floating
 * button, one sheet, the same shared engine behind every desk
 * (`/api/admin/copilot`). The route re-checks access itself; this component
 * only ever sends the scope and position the page already proved it is
 * showing, never a claim the client makes up.
 */
export function AdminCopilot({
  scope,
  position,
  deskName,
  context,
  greeting,
}: {
  scope: StaffScope;
  position: StaffPosition | null;
  /** The desk's own name, as the sidebar shows it. */
  deskName: string;
  /** A short, already-correct line or two of today's real figures for this desk, or null. */
  context?: string | null;
  /** One opening line the sheet shows before anything is asked. */
  greeting?: string;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const listId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    const message = draft.trim();
    if (!message || pending) return;
    setDraft("");
    const history = turns;
    setTurns((t) => [...t, { role: "user", text: message }, { role: "assistant", text: "" }]);
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/admin/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, position, deskName, context, history, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("no_stream");
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
          const event = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; message?: string };
          if (event.type === "text" && event.text) {
            setTurns((t) => {
              const next = [...t];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") next[next.length - 1] = { ...last, text: last.text + event.text };
              return next;
            });
          } else if (event.type === "error") {
            banner.error(event.message ?? "Something went wrong. Try again.");
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) banner.error("Could not reach the assistant just now. Try again in a moment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" className="nf-copilot-launch nf-tap" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <UiIcon name="bot" size={22} weight="lean" />
        <span className="sr-only">Open the {deskName} assistant</span>
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={`${deskName} assistant`}
        detents={[0.92]}
        closeLabel="Close"
        testId="admin-copilot-sheet"
        footer={
          <form
            className="nf-copilot-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor={`${listId}-input`} className="sr-only">
              Ask the assistant
            </label>
            <input
              id={`${listId}-input`}
              className="nf-field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about your desk"
              disabled={pending}
            />
            <Button type="submit" variant="primary" disabled={pending || !draft.trim()} data-testid="admin-copilot-send">
              {pending ? "..." : "Send"}
            </Button>
          </form>
        }
      >
        <div className="nf-copilot-thread" aria-live="polite" data-testid="admin-copilot-thread">
          {turns.length === 0 ? (
            <p className="nf-copilot-greeting">{greeting ?? `Ask me anything about your ${deskName.toLowerCase()} work.`}</p>
          ) : (
            turns.map((turn, i) => (
              <p key={i} className="nf-copilot-turn" data-role={turn.role}>
                {turn.text || (turn.role === "assistant" && pending && i === turns.length - 1 ? "…" : "")}
              </p>
            ))
          )}
        </div>
      </Sheet>
    </>
  );
}
