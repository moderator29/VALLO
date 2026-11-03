"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decideHeldItem,
  type ModerationTarget,
} from "@/lib/admin/moderation-actions";
import { Button } from "@/components/ui/Button";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Let it through, or take it down.
 *
 * Releasing needs no words: the author is told the check finished and their
 * words are back. Removing does, and the reason is written onto the row so the
 * notification trigger reads it back to them verbatim. That is why the Remove
 * control stays disabled until something is typed: a takedown nobody explained
 * is the single fastest way to convince somebody a platform is arbitrary.
 *
 * Nothing here is optimistic. Both decisions reach a real person by
 * notification, so the row waits for the server and then refreshes.
 */
export function HoldDecision({
  target,
  id,
  what,
}: {
  target: ModerationTarget;
  id: string;
  /** The noun used in the copy, for example "post" or "bio". */
  what: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const run = (decision: "RELEASE" | "REMOVE") => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await decideHeldItem({ target, id, decision, reason });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const canRemove = reason.trim().length > 0;

  return (
    <div className="mt-sm">
      <label className="sr-only" htmlFor={`reason-${target}-${id}`}>
        Why this {what} is coming down
      </label>
      <textarea
        id={`reason-${target}-${id}`}
        className="nf-field min-h-[60px] w-full resize-y text-[length:var(--nf-text-body-sm)]"
        value={reason}
        maxLength={400}
        placeholder={`Why this ${what} is coming down. The author reads this word for word.`}
        disabled={pending}
        onChange={(event) => setReason(event.target.value)}
      />

      {/*
        A takedown is destructive and it was the quietest control in the row -
        a ghost button, lower contrast than the note field above it. It is a
        solid danger button now: the two outcomes read as two different kinds
        of decision, which is the only honest way to draw them.
      */}
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          data-testid={`release-${id}`}
          onClick={() => run("RELEASE")}
        >
          {pending ? "Working" : "Let it through"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={pending || !canRemove}
          title={canRemove ? undefined : "Say why first"}
          data-testid={`remove-${id}`}
          onClick={() => run("REMOVE")}
        >
          Take it down
        </Button>
      </div>

      {!canRemove && (
        <p className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          Taking something down needs a reason. They receive it word for word.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
