"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  applyToModerate,
  withdrawModeratorApplication,
} from "@/lib/social/areas-actions";
import { TextArea } from "@/components/ui/Field";
import {
  AREA_COPY,
  MODERATOR_CAN,
  MODERATOR_CANNOT,
  MODERATOR_REASON_MIN,
  MODERATOR_REASON_MAX,
} from "@/lib/social/areas-model";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Apply to look after a place.
 *
 * The role's limits are stated on the form rather than in a help page, because
 * the moment somebody is deciding whether to ask is the only moment they will
 * read them. Chief among them: a moderator can hide a post and can never delete
 * one. That is the owner's ruling and it is also what makes the role safe to
 * hand to a stranger who lives on the right street.
 */
export function ModeratorApply({
  areaId,
  areaName,
  pendingApplication,
}: {
  areaId: string;
  areaName: string;
  pendingApplication: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useSafeTransition();

  if (pendingApplication) {
    return (
      <div className="nf-panel nf-panel--card block">
        <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          You asked to look after {areaName}
        </p>
        <p className="mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          {AREA_COPY.moderatorPending}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await withdrawModeratorApplication({ areaId });
                if (result.ok) router.refresh();
                else setError(result.error);
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            })
          }
        >
          {pending ? "Withdrawing" : "Withdraw it"}
        </Button>
        {error ? (
          <p role="alert" className="mt-xs text-[length:var(--nf-text-overline)] text-[var(--nf-state-error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nf-panel nf-panel--card block w-full text-left"
      >
        <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          Look after {areaName}
        </p>
        <p className="mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          If you know this place, you can help keep it honest. We read every
          application.
        </p>
      </button>
    );
  }

  const remaining = MODERATOR_REASON_MIN - reason.trim().length;

  return (
    <form
      className="nf-panel nf-panel--card gap-md"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          try {
            const result = await applyToModerate({ areaId, reason });
            if (result.ok) {
              setOpen(false);
              setReason("");
              router.refresh();
              return;
            }
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <div>
        <h3 className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
          Look after {areaName}
        </h3>
        <div className="mt-sm grid gap-md sm:grid-cols-2">
          <div>
            <p className="nf-overline text-[var(--nf-state-success)]">
              You can
            </p>
            <ul className="mt-2xs flex flex-col gap-2xs">
              {MODERATOR_CAN.map((line) => (
                <li key={line} className="text-[length:var(--nf-text-overline)] leading-snug text-[var(--nf-content-secondary)]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="nf-overline text-[var(--nf-content-muted)]">
              You cannot
            </p>
            <ul className="mt-2xs flex flex-col gap-2xs">
              {MODERATOR_CANNOT.map((line) => (
                <li key={line} className="text-[length:var(--nf-text-overline)] leading-snug text-[var(--nf-content-secondary)]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <TextArea
        label="What do you know about this place?"
        value={reason}
        maxLength={MODERATOR_REASON_MAX}
        rows={4}
        placeholder="How long you have been around here, which streets you know, and why you want to do it."
        onChange={(event) => setReason(event.target.value)}
        error={fieldErrors.reason}
        hint={
          remaining > 0
            ? `${remaining} more characters`
            : `${reason.trim().length}/${MODERATOR_REASON_MAX}`
        }
      />

      {error ? (
        <p
          role="alert"
          className="nf-panel nf-panel--card block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] px-sm py-xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-state-error)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-xs">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="flex-1"
          disabled={pending || remaining > 0}
        >
          {pending ? "Sending" : "Send application"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Not now
        </Button>
      </div>
    </form>
  );
}
