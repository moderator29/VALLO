"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { reportDoorCharge } from "@/lib/stays/arrival-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/** V-57. One tap from a paid stay: "I was asked for money at the door." */
export function DoorChargeReport({ bookingId, copy }: { bookingId: string; copy: Dictionary["afterTheGate"]["arrival"] }) {
  const [asked, setAsked] = useState("");
  const [pending, start] = useSafeTransition();
  /* The amount's refusal is the field's own error, under the field. */
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <p className="nf-body-sm text-[var(--nf-state-success)]" role="status">
        {copy.reportSent}
      </p>
    );
  }
  return (
    <form
      className="nf-panel nf-panel--card grid gap-sm p-md"
      data-testid="door-charge-report"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          try {
            const result = await reportDoorCharge({ bookingId, askedNaira: asked });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDone(true);
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <h2 className="nf-h4">{copy.reportHeading}</h2>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.reportLede}</p>
      <Field label={copy.reportAmount} error={error ?? undefined}>
        {(control) => <input {...control} className="nf-field" inputMode="decimal" value={asked} onChange={(e) => setAsked(e.target.value)} />}
      </Field>
      <Button type="submit" variant="secondary" full loading={pending} disabled={pending}>
        {copy.reportSubmit}
      </Button>
    </form>
  );
}
