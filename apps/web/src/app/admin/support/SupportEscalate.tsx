"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  ESCALATION_TARGET_LABEL,
  ESCALATION_TARGETS,
  type EscalationTarget,
} from "@/lib/admin/support-workspace";
import { escalateSupportTicket, returnSupportEscalation } from "@/lib/admin/support-workbench-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * HAND A TICKET TO ANOTHER DESK. Support routes money, safety and identity;
 * it does not decide them. The reason is the first thing the other desk
 * reads, so it is required. When the escalation door is not installed in
 * this database, the panel says so in the present tense and points at the
 * internal note instead.
 */
export function SupportEscalate({
  ticketId,
  installed,
  suggested,
  taken,
}: {
  ticketId: string;
  installed: boolean;
  suggested: EscalationTarget | null;
  /** Desks that already hold this ticket. */
  taken: readonly EscalationTarget[];
}) {
  const router = useRouter();
  const free = ESCALATION_TARGETS.filter((t) => !taken.includes(t));
  const [scope, setScope] = useState<EscalationTarget | null>(
    suggested && free.includes(suggested) ? suggested : (free[0] ?? null),
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useSafeTransition();

  return (
    <details id="support-escalate" className="nf-panel nf-panel--card mt-md p-md" data-testid="support-escalate">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-xs font-semibold">
        <span>Hand to another desk</span>
        <kbd className="nf-badge nf-badge--neutral nf-numeric px-xs py-3xs">e</kbd>
      </summary>
      {!installed ? (
        <p className="mt-xs nf-body-sm text-[var(--nf-content-secondary)]" role="note">
          Escalation is not installed in this database. Leave an internal note below naming the desk that should look,
          and tell your lead; nothing is lost.
        </p>
      ) : free.length === 0 ? (
        <p className="mt-xs nf-body-sm text-[var(--nf-content-secondary)]">Every desk support can hand to already has this ticket.</p>
      ) : (
        <form
          className="mt-xs grid gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (!scope) return;
            start(async () => {
              const r = await escalateSupportTicket({ ticketId, scope, reason });
              if (!r.ok) setMessage({ ok: false, text: r.error });
              else {
                setMessage({ ok: true, text: `Handed to the ${ESCALATION_TARGET_LABEL[scope].name.toLowerCase()} desk. They have been told.` });
                setReason("");
                router.refresh();
              }
            });
          }}
        >
          <fieldset className="grid gap-2xs">
            <legend className="nf-label">Which desk</legend>
            {free.map((t) => (
              <label
                key={t}
                className={`flex min-h-11 cursor-pointer items-start gap-xs rounded-[var(--nf-radius-md)] border p-sm ${
                  scope === t ? "border-[var(--nf-border-brand)]" : "border-[var(--nf-border-subtle)]"
                }`}
              >
                <input type="radio" name="escalate-scope" value={t} checked={scope === t} onChange={() => setScope(t)} className="mt-3xs" />
                <span>
                  <span className="block font-semibold">
                    {ESCALATION_TARGET_LABEL[t].name}
                    {t === suggested ? <span className="nf-caption text-[var(--nf-content-muted)]"> · suggested by the topic</span> : null}
                  </span>
                  <span className="block nf-caption text-[var(--nf-content-secondary)]">{ESCALATION_TARGET_LABEL[t].covers}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="grid gap-2xs">
            <span className="nf-label">Why (the other desk reads this first; the member never does)</span>
            <textarea
              className="nf-field w-full resize-y"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What happened, what you have checked, and what you need them to decide."
            />
          </label>
          <div className="flex flex-wrap items-center gap-xs">
            <Button type="submit" variant="primary" size="md" loading={pending} disabled={!scope || reason.trim().length < 8}>
              Hand it over
            </Button>
            <span className="nf-caption text-[var(--nf-content-muted)]">
              Money and safety hand-offs run on the four-hour promise.
            </span>
          </div>
        </form>
      )}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`mt-xs nf-caption ${message.ok ? "text-[var(--nf-state-success)]" : "text-[var(--nf-state-warning)]"}`}>
          {message.text}
        </p>
      ) : null}
    </details>
  );
}

/** Hand an escalated ticket back to support, with what the other desk found or did. */
export function ReturnEscalation({ ticketId, escalationId, label }: { ticketId: string; escalationId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form
      className="mt-xs grid gap-2xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await returnSupportEscalation({ ticketId, escalationId, note });
          if (!r.ok) setError(r.error);
          else {
            setOpen(false);
            setNote("");
            router.refresh();
          }
        });
      }}
    >
      <label className="grid gap-2xs">
        <span className="nf-label">What your desk found or did</span>
        <textarea className="nf-field w-full resize-y" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-xs">
        <Button type="submit" variant="primary" size="sm" loading={pending} disabled={note.trim().length < 8}>
          Hand back
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Not yet
        </Button>
      </div>
      {error ? (
        <p role="alert" className="nf-caption text-[var(--nf-state-warning)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
