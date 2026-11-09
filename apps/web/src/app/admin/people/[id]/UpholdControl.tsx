"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { upholdStopAsFraud } from "@/lib/admin/person-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * V-90: a senior reviewer upholds a standing stop as fraud. The note is what a
 * later match reads out ("matches an identity stopped on 3 October for ..."),
 * so it is required and it is a sentence.
 */
export function UpholdControl({ suspensionId, userId }: { suspensionId: string; userId: string }) {
  const fieldId = useId();
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();

  function uphold() {
    start(async () => {
      try {
        const r = await upholdStopAsFraud({ suspensionId, userId, note });
        if (r.ok) banner.success(`Upheld. ${r.data.keys} identity keys are now on the deny-list; lifting the stop removes them.`);
        else banner.error(r.error, { retry: uphold });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="mt-sm grid gap-xs"
      onSubmit={(event) => {
        event.preventDefault();
        uphold();
      }}
    >
      <label htmlFor={fieldId} className="nf-label">
        What was the fraud? A later match reads this out to the reviewer.
      </label>
      <textarea id={fieldId} className="nf-field min-h-20" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" variant="danger" size="md" loading={pending} disabled={note.trim().length < 10}>
        Uphold this stop as fraud
      </Button>
    </form>
  );
}
