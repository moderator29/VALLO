"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { fill } from "../_components/copy";
import {
  removeBankAccountAsAdmin,
  removePaymentMethodAsAdmin,
} from "@/lib/admin/payments-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * Removing a saved card or a bank account for somebody who asked.
 *
 * The rule the whole payments desk is built around: a destructive action
 * states what it will do before it does it. So the control names the entry
 * by its masked tail, asks who asked and how, and only then offers the
 * button. The reason is the record; the owner is told; nothing about the
 * card or the account goes into the log.
 */
export function RemoveSavedMethod({
  kind,
  id,
  describe,
  copy,
}: {
  kind: "card" | "account";
  id: string;
  /** "Visa ending 4821" or "GTBank ending 0912". The masked words only. */
  describe: string;
  /** The remove sheet's words and the shared "Not now", from the server page, so this client file never imports the dictionary. */
  copy: { remove: Dictionary["admin"]["payments"]["remove"]; notNow: string };
}) {
  const c = copy.remove;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const problemId = useId();
  const [done, setDone] = useState(false);
  const [pending, start] = useSafeTransition();

  function run() {
    setError(null);
    start(async () => {
      try {
        const result =
          kind === "card"
            ? await removePaymentMethodAsAdmin({ id, reason: reason.trim() })
            : await removeBankAccountAsAdmin({ id, reason: reason.trim() });
        if (!result.ok) {
          const about = result.fieldErrors?.["reason"];
          if (about) setError(about);
          else banner.error(result.error, { retry: run });
          return;
        }
        setDone(true);
        banner.success(c.done);
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /* Removed: the banner says so and the refresh redraws the list. */
  if (done) return null;

  if (!open) {
    return (
      <Button type="button" size="sm" variant="dangerQuiet" onClick={() => setOpen(true)}>
        {c.open}
      </Button>
    );
  }

  return (
    /* The same ruling as the reservation desk's confirm panel: a container
       edge is lit glass, never a flat grey outline. `nf-card` carries it. */
    <div className="nf-panel nf-panel--card nf-admin-card mt-row p-card-sm">
      <p className="nf-body font-semibold text-content">{fill(c.question, { describe })}</p>
      <p className="nf-body-sm mt-row text-content-2">{kind === "card" ? c.bodyCard : c.bodyAccount}</p>
      <label className="mt-row block">
        <span className="nf-label">{c.who}</span>
        <textarea
          className="nf-field min-h-[72px] resize-y"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? problemId : undefined}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder={c.placeholder}
        />
      </label>
      <div className="mt-row flex flex-wrap gap-inline">
        <Button
          type="button"
          size="sm"
          variant="danger"
          loading={pending}
          disabled={reason.trim().length < 10}
          onClick={run}
        >
          {fill(c.confirm, { describe })}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {copy.notNow}
        </Button>
      </div>
      {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={problemId} message={error} />
    </div>
  );
}
