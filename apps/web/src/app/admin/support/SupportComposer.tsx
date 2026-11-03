"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fillMacro, SUPPORT_MACROS, type SupportMacro } from "@/lib/admin/support-macros";
import { sendSupportReply } from "@/lib/admin/support-workbench-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE REPLY BOX. Saved replies fill it (never send it); the agent reads,
 * edits and sends. Ctrl or Cmd with Enter sends. "Send and resolve" answers
 * and closes the loop in one step when nothing is left to do. The line
 * under the box says where the reply goes, so nobody has to guess whether the
 * member will see it.
 */
export function SupportComposer({
  ticketId,
  status,
  firstName,
  reference,
  hasAccount,
}: {
  ticketId: string;
  status: string;
  firstName: string | null;
  reference: string;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const box = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<SupportMacro | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useSafeTransition();

  const use = (macro: SupportMacro) => {
    const text = fillMacro(macro, { firstName, reference });
    setBody((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text));
    setPicked(macro);
    setMessage(null);
    requestAnimationFrame(() => box.current?.focus());
  };

  const send = (then: "keep" | "resolve") => {
    if (body.trim().length < 2 || pending) return;
    start(async () => {
      try {
        const result = await sendSupportReply({ ticketId, body, then, status });
        if (!result.ok) {
          setMessage({ ok: false, text: result.error });
          return;
        }
        setBody("");
        setPicked(null);
        setMessage({
          ok: true,
          text: then === "resolve" ? "Sent, and the ticket is resolved." : "Sent. It is on their thread now.",
        });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const closable = status === "open" || status === "pending";

  return (
    <section className="mt-md" aria-labelledby="support-reply-label" data-testid="support-composer">
      <div className="flex flex-wrap items-baseline justify-between gap-xs">
        <label id="support-reply-label" htmlFor="support-reply" className="nf-label">
          Reply to the member
        </label>
        <span className="nf-caption text-[var(--nf-content-muted)]">
          <kbd className="nf-numeric">r</kbd> to write, <kbd className="nf-numeric">m</kbd> for saved replies
        </span>
      </div>

      <div className="mt-2xs flex flex-wrap gap-2xs" role="group" aria-label="Saved replies">
        {SUPPORT_MACROS.map((macro, i) => (
          <button
            key={macro.id}
            type="button"
            className={`nf-admin-seg__item${picked?.id === macro.id ? " nf-admin-seg__item--on" : ""}`}
            title={macro.when}
            onClick={() => use(macro)}
            {...(i === 0 ? { "data-support-macro": "" } : {})}
          >
            {macro.title}
          </button>
        ))}
      </div>
      {picked ? (
        <p className="mt-2xs nf-caption text-[var(--nf-content-secondary)]">
          {picked.when} Read it through and make it theirs before sending.
        </p>
      ) : null}

      <textarea
        id="support-reply"
        ref={box}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send(picked?.then === "resolve" ? "resolve" : "keep");
          }
        }}
        rows={5}
        maxLength={4000}
        className="nf-field mt-xs w-full resize-y"
        placeholder="Write as you would speak to them: plain, warm, and clear about what happens next."
        aria-describedby="support-reply-where"
      />

      <div className="mt-xs flex flex-wrap items-center gap-xs">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={body.trim().length < 2}
          onClick={() => send("keep")}
          data-testid="support-send"
        >
          Send reply
        </Button>
        {closable ? (
          <Button variant="secondary" size="md" disabled={pending || body.trim().length < 2} onClick={() => send("resolve")}>
            Send and resolve
          </Button>
        ) : null}
        <span className="nf-caption nf-numeric text-[var(--nf-content-muted)]">{body.length} / 4,000</span>
      </div>
      <p id="support-reply-where" className="mt-2xs nf-caption text-[var(--nf-content-secondary)]">
        {hasAccount
          ? "The reply goes on their support thread and they are told in the app. They read it as from Vallo support, with your first name."
          : "They filed without an account, so the app cannot tell them. The reply waits at the link their filing email carried."}
      </p>
      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-xs nf-caption ${message.ok ? "text-[var(--nf-state-success)]" : "text-[var(--nf-state-warning)]"}`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
