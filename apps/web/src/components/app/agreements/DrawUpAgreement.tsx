"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openRentAgreement } from "@/lib/agreements/actions";
import { PAYMENT_GATE_SENTENCE } from "@/lib/money/copy";
import { withDone } from "@/lib/ui/success-moments";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The step after the inspection report (Track A).
 *
 * The renter's submitted report is the proof of what was seen. From it the
 * agreement is drawn up with the listing's own move-in figures and the dates
 * the renter names here; both parties then confirm it, and Vallo approves it
 * before payment opens. The database refuses unless the report is submitted
 * with all eight items ticked and photos taken at the property.
 */
export function DrawUpAgreement({ inspectionId, minDate }: { inspectionId: string; minDate: string }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [moveIn, setMoveIn] = useState(minDate);
  const [handover, setHandover] = useState(minDate);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="nf-ix-agreement grid gap-inline"
      data-testid="draw-up-agreement"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await openRentAgreement({ inspectionId, moveIn, handoverOn: handover, notes });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          /* The agreement page checks the record before it shows the moment. */
          router.push(withDone(`/agreements/${result.data.agreementId}`, "agreement-drawn"));
        });
      }}
    >
      <p className="nf-ix-hint">{PAYMENT_GATE_SENTENCE}</p>
      <label className="block">
        <span className="nf-label">Move-in date</span>
        <input className="nf-field mt-2xs w-full" type="date" min={minDate} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} required />
      </label>
      <label className="block">
        <span className="nf-label">Keys handed over on</span>
        <input className="nf-field mt-2xs w-full" type="date" min={minDate} value={handover} onChange={(e) => setHandover(e.target.value)} />
      </label>
      <label className="block">
        <span className="nf-label">Anything both of you should agree in writing (optional)</span>
        <textarea className="nf-field mt-2xs min-h-[4.5rem] w-full" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error ? (
        <p role="alert" className="nf-ix-hint text-[var(--nf-status-error)]">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" full disabled={pending}>
        {pending ? "Drawing up the agreement" : "Draw up the agreement"}
      </Button>
    </form>
  );
}
