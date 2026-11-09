"use client";

import { banner } from "@/lib/ui/toast";
import { useId, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { setCheckableNumber } from "@/lib/doors/agent-check-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { FieldProblem } from "@/components/ui/FieldProblem";

type CardCopy = Dictionary["trustDoors"]["agentCard"];

/**
 * V-61 on /agent/settings: the agent's own code to print, and the business
 * number a renter may paste into /check.
 *
 * The number is never shown back, because the database never keeps it: only
 * an HMAC and the last three digits, which is what "a number ending 123"
 * reads from. Removing it is one tap and takes effect on the next check.
 */
export function AgentLookupCard({
  copy,
  code,
  hint: initialHint,
}: {
  copy: CardCopy;
  /** Null when the code could not be read; the card then says so in words. */
  code: string | null;
  hint: string | null;
}) {
  const fieldId = useId();
  const [hint, setHint] = useState(initialHint);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  const save = (phone: string | null) => {
    setError(null);
    start(async () => {
      try {
        const result = await setCheckableNumber({ phone });
        if (result.ok) {
          setHint(result.data.hint);
          setValue("");
          /* Said by the one banner at the top of the screen (Grade 1). */
          banner.success(result.data.hint ? copy.registered.replace("{hint}", result.data.hint) : copy.none);
          return;
        }
        /* A number that is taken or not a number is the field's own error;
           anything else is the banner's. */
        const reason = result.fieldErrors?.phone ?? result.error;
        if (reason === "taken") setError(copy.taken);
        else if (reason === "invalid") setError(copy.invalid);
        else banner.error(copy.failed, { retry: () => save(phone) });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className="nf-panel nf-panel--card block p-panel" data-testid="agent-lookup-card">
      <p className="nf-overline">{copy.title}</p>
      <p className="mt-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {copy.lede}
      </p>

      <div className="mt-md border-t border-[var(--nf-border-subtle)] pt-sm">
        <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{copy.codeLabel}</p>
        {code ? (
          <p className="nf-numeric mt-2xs select-all text-[length:var(--nf-text-body-lg)] font-semibold tracking-wide text-[var(--nf-content-primary)]">
            {code}
          </p>
        ) : (
          <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{copy.unavailable}</p>
        )}
      </div>

      <div className="mt-md border-t border-[var(--nf-border-subtle)] pt-sm">
        <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">{copy.numberTitle}</p>
        <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {copy.numberLede}
        </p>
        <p className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]" aria-live="polite">
          {hint ? copy.registered.replace("{hint}", hint) : copy.none}
        </p>

        <form
          className="mt-sm grid gap-xs"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) save(value);
          }}
        >
          <label htmlFor={fieldId} className="nf-label">
            {copy.numberLabel}
          </label>
          <input
            id={fieldId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0803 123 4567"
            maxLength={20}
            className="nf-field"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fieldId}-problem` : undefined}
          />
          {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
          <FieldProblem id={`${fieldId}-problem`} message={error} />
          <div className="flex flex-wrap gap-xs">
            <Button type="submit" variant="primary" size="md" loading={pending} disabled={!value.trim()}>
              {copy.save}
            </Button>
            {hint && (
              <Button type="button" variant="ghost" size="md" disabled={pending} onClick={() => save(null)}>
                {copy.remove}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
